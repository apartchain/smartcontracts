// solhint-disable not-rely-on-time
// Contract Name: Marketplace
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";


interface IRealEstate {
    function createToken(address _owner) external returns (uint256);
    function burn(address _account, uint256 _id, uint256 _amount) external;
}

interface IVerifier {
    function isVerifiedAgency(address _agency) external view returns (bool);
    function isVerifiedUser(address _user) external view returns (bool);
}

interface IReferral {
    function getReferrer(address _user) external view returns (address);
}

interface IFee {
    function getBuyerFee(uint256 _amount) external view returns (uint256);
    function getSellerFee(uint256 _amount) external view returns (uint256);
    function getBookingFee(uint256 _amount) external view returns (uint256);
    function getPoaFee() external view returns (uint256);
}

contract Marketplace is ERC2771Context, ERC1155Receiver, AccessControl {
    bytes32 public constant MARKETPLACE_MANAGER_ROLE = keccak256("MANAGER");

    IRealEstate private realEstate; 
    IVerifier   private verifier;
    IFee        private fee;
    IReferral   private referral;
    IERC20      private usdC;
    
    address private platform; // account address of platform to send platform fees

    struct Property {
        uint256 tokenId; // id returned from RealEstate
        uint256 price;   // price of token
        address agency;  // address of agency selling the token
        address seller;  // seller of the physical real estate
        bool isOnSale;   // for check if it is currently on sale
    }

    struct Booking {
        uint256 tokenId;   // id returned from RealEstate
        uint256 fee;       // booking fee amount on the moment of booking
        address buyer;     // address of a booker and possible future buyer
        uint256 sellerFee; // seller fee amount on the moment of booking
        uint256 buyerFee;  // buyer fee amount on the moment of booking
        bool paid;         // if full sum has been paid; checks true after buyProperty function call
        bool poa;          // is user wanting to use PoA
        bool signedAllDoc; // is buyer sign all the docs that are required before final payment 
    }

    mapping(address => mapping(uint256 => Property)) public properties;

    mapping(uint256 => bool)    private isBooked;
    mapping(uint256 => Booking) private booking;


    // Security
    mapping(uint256 => bool) private noReentrancy;

    event PropertyCreated(uint256 tokenId, string uri, address agency, address seller, uint256 price, uint256 timestamp);
    event PropertyBooked(uint256 tokenId, uint256 fee, address buyer, bool poa, uint256 timestamp);
    event PropertyBookingCancelled(uint256 tokenId, bool toUser, address buyer, uint256 timestamp);
    event PropertyTradeCancelled(uint256 tokenId, address buyer, uint256 timestamp);
    event PropertyPaid(uint256 tokenId, uint256 total, address buyer, uint256 timestamp);
    event PropertyTraded(uint256 tokenId, address referrer, uint256 referralFee, uint256 timestamp);
    
    event BookingSignedAllDoc(uint256  tokenId, uint256 timestamp);

    constructor(
        address _platform, 
        address _realEstate, 
        address _verifier, 
        address _fee, 
        address _referral, 
        address _usdcAddress, 
        address _forwarder
    ) ERC2771Context(_forwarder) {
        platform = _platform;

        realEstate = IRealEstate(_realEstate);
        verifier   = IVerifier(_verifier);
        fee        = IFee(_fee);
        referral   = IReferral(_referral);
        usdC       = IERC20(_usdcAddress);

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    modifier noReentrant(uint256 _tokenId) {
        require(!noReentrancy[_tokenId], "No re-entrancy");
        noReentrancy[_tokenId] = true;
        _;
        noReentrancy[_tokenId] = false;
    }

    /// @notice set or revoke role marketplace for account address
    /// @dev if param _set is true, then it sets up the role for the account address
    /// @param _marketplace Account address to set or revoke role marketplace
    /// @param _set Boolean if false revokes role
    function setMarketplace(address _marketplace, bool _set) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_set) {
            _setupRole(MARKETPLACE_MANAGER_ROLE, _marketplace);
        } else {
            _revokeRole(MARKETPLACE_MANAGER_ROLE, _marketplace);
        }
    }

    /// @notice Create NFT token and save the data to the mapping properties
    /// @dev only verified agency can create the token
    /// @param _uri The _uri is url of a token metadata on ipfs
    /// @param _seller Address of the seller of the physical property
    function createProperty(string memory _uri, address _seller,  uint256 _price) external {
        address sender = _msgSender();
        require(verifier.isVerifiedAgency(sender), "not agency");
        
        uint256 tokenId = realEstate.createToken(address(this));

        properties[address(this)][tokenId] = Property(tokenId, _price, sender, _seller, true);

        emit PropertyCreated(tokenId, _uri, sender, _seller, _price, block.timestamp);
    }

    /// @notice Booking property with payment of 10% in ERC-20 (particularly USDc)
    /// @dev no any reentrancy allowed
    /// @param _tokenId TokenId of a token to book
    /// @param _usePoa If user wants to use PoA
    function bookProperty(uint256 _tokenId, bool _usePoa) external noReentrant(_tokenId) {
        Property memory pt = properties[address(this)][_tokenId];
        require(!isBooked[_tokenId], "already booked");
        require(pt.isOnSale, "not on sale");

        address sender = _msgSender();
        require(verifier.isVerifiedUser(sender), "not user");

        uint256 bookingFee = fee.getBookingFee(pt.price);

        require(usdC.allowance(sender, address(this)) >= bookingFee, "not enough allowance");
        require(usdC.transferFrom(sender, address(this), bookingFee), "not enough usdC");
        
        isBooked[_tokenId] = true;

        uint256 sellerFee = fee.getSellerFee(pt.price);
        uint256 buyerFee = fee.getBuyerFee(pt.price);

        booking[_tokenId] = Booking(_tokenId, bookingFee, sender, sellerFee, buyerFee, false, _usePoa, false);

        emit PropertyBooked(_tokenId, bookingFee, sender, _usePoa, block.timestamp);
    }
    
    /// @notice End booking of property with transfering 10% to platform, seller, and agency
    /// @dev no any reentrancy allowed
    /// @param _tokenId TokenId of a token to end booking
    function cancelBooking(uint256 _tokenId, bool toUser) external onlyRole(MARKETPLACE_MANAGER_ROLE) noReentrant(_tokenId) {
        require(isBooked[_tokenId], "not booked");
        Booking memory bk = booking[_tokenId];
        require(!bk.paid, "already paid");

        isBooked[_tokenId] = false;
        address buyer = bk.buyer;

        if (toUser) {
            require(usdC.transfer(bk.buyer, bk.fee), "not enough usdC");
        } else {
            uint256 bookingFee  = booking[_tokenId].fee;

            uint256 sellerFee   = bookingFee * 5 / 10; // 50%
            uint256 platformFee = bookingFee * 4 / 10; // 40%
            uint256 agencyFee   = bookingFee * 1 / 10; // 10%
            
            Property memory pt = properties[address(this)][_tokenId];
            
            require(usdC.transfer(pt.seller, sellerFee), "not enough usdC");
            require(usdC.transfer(platform, platformFee), "not enough usdC");
            require(usdC.transfer(pt.agency, agencyFee), "not enough usdC");
        }

        delete booking[_tokenId];
        
        emit PropertyBookingCancelled(_tokenId, toUser, buyer, block.timestamp);
    }

    function cancelTrade(uint256 _tokenId) external onlyRole(MARKETPLACE_MANAGER_ROLE) noReentrant(_tokenId) {
        require(isBooked[_tokenId], "not booked");
        Booking memory bk = booking[_tokenId];
        require(bk.paid, "not paid");
        address buyer = bk.buyer;

        isBooked[_tokenId] = false;

        uint256 amount = properties[address(this)][_tokenId].price + bk.buyerFee;
        properties[address(this)][_tokenId].isOnSale = true;

        
        require(usdC.transfer(bk.buyer, amount), "not enough usdC");

        delete booking[_tokenId];
        
        emit PropertyTradeCancelled(_tokenId, buyer, block.timestamp);
    }

    /// @notice Buy booked token by buyer that booked the token
    /// @dev no any reentrancy allowed
    /// @param _tokenId TokenId of a token to buy
    function buyProperty(uint256 _tokenId) external noReentrant(_tokenId) {
        address sender = _msgSender();
        Booking storage bk = booking[_tokenId];
        Property storage pt = properties[address(this)][_tokenId];

        require(isBooked[_tokenId], "not booked");
        require(pt.isOnSale, "not on sale");
        require(bk.buyer == sender, "not your booking");
        require(!bk.paid, "already paid");
        require(bk.signedAllDoc, "not signed all docs");

        uint256 total = pt.price - bk.fee + bk.buyerFee;

        if (bk.poa) {
            total += fee.getPoaFee();
        }

        require(usdC.allowance(sender, address(this)) >= total, "not enough allowance");
        require(usdC.transferFrom(sender, address(this), total), "not enough usdC");
        
        pt.isOnSale = false;
        bk.paid = true;
        bk.buyer = sender;

        emit PropertyPaid(_tokenId, total, sender, block.timestamp);
    }
    
    /// @notice Fulfill buy of token that has been bought by function buyProperty
    /// @dev no any reentrancy allowed
    /// @param _tokenId TokenId of a token to fulfill buy
    function fulfillBuy(uint256 _tokenId) external onlyRole(MARKETPLACE_MANAGER_ROLE) noReentrant(_tokenId) {
        Booking memory bk = booking[_tokenId];

        require(isBooked[_tokenId], "not booked");
        require(bk.paid, "not paid");

        Property memory pt = properties[address(this)][_tokenId];

        uint256 agencyFee   = pt.price * 200 / 10000;
        
        uint256 sellerPart  = pt.price - bk.sellerFee - agencyFee;

        uint256 platformFee = bk.sellerFee + bk.buyerFee;

        address referrer = referral.getReferrer(bk.buyer);
        uint256 referralFee = pt.price * 20 / 10000;

        if (bk.poa) {
            platformFee += fee.getPoaFee();
        }

        if (referrer != address(0)) {
            platformFee -= referralFee;
            if (referrer == pt.agency) {
                agencyFee += referralFee;
            } else {
                require(usdC.transfer(referrer, referralFee), "not enough usdC");
            }
        }

        require(usdC.transfer(pt.seller, sellerPart), "not enough usdC");
        require(usdC.transfer(pt.agency, agencyFee), "not enough usdC");
        require(usdC.transfer(platform, platformFee), "not enough usdC");

        realEstate.burn(address(this), _tokenId, 1);

        delete booking[_tokenId];
        delete isBooked[_tokenId];
        delete properties[address(this)][_tokenId];

        emit PropertyTraded(_tokenId, referrer, referralFee, block.timestamp);
    }

    function signedAllDoc(uint _tokenId, bool _signedAllDoc) external onlyRole(MARKETPLACE_MANAGER_ROLE){
        require(isBooked[_tokenId], "not booked");
        booking[_tokenId].signedAllDoc = _signedAllDoc;

        emit BookingSignedAllDoc(_tokenId, block.timestamp);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure override returns (bytes4) {
        return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Receiver, AccessControl) returns (bool) {
        return ERC1155Receiver.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}