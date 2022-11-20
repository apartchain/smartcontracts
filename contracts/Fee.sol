// Contract Name: Fee
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.1;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Fee is AccessControl {
    bytes32 public constant FEE_CHANGER_ROLE = keccak256("FEE_CHANGER");
    
    uint256 private bookingNumerator;
    uint256 private poaFee;

    uint256 private buyerFeeNumerator;
    uint256 private sellerFeeNumerator;

    event BookingPercentageChanged(uint256 newPercentage, uint256 timestamp);
    event PoaFeeChanged(uint256 newFee, uint256 timestamp);
    event BuyerFeeChanged(uint256 newFeeNumerator, uint256 timestamp);
    event SellerFeeChanged(uint256 newFeeNumerator, uint256 timestamp);

    constructor(uint256 _bookingPercentage, uint256 _poaFee, uint256 _buyerFeeNumerator, uint256 _sellerFeeNumerator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(FEE_CHANGER_ROLE, _msgSender());
        
        setBookingFeeNumerator(_bookingPercentage);
        setPoaFee(_poaFee);
        setBuyerFeeNumerator(_buyerFeeNumerator);
        setSellerFeeNumerator(_sellerFeeNumerator);
    }

    modifier checkPercentage(uint256 _percentage) {
        require(_percentage >= 0 && _percentage <= 10000, "Percentage 0 <= x <= 10000");
        _;
    }

    function setBuyerFeeNumerator(uint256 _numerator) public checkPercentage(_numerator) onlyRole(FEE_CHANGER_ROLE) {
        buyerFeeNumerator = _numerator;

        emit BuyerFeeChanged(_numerator, block.timestamp);
    }

    function setSellerFeeNumerator(uint256 _numerator) public checkPercentage(_numerator) onlyRole(FEE_CHANGER_ROLE) {
        sellerFeeNumerator = _numerator;

        emit SellerFeeChanged(_numerator, block.timestamp);
    }

    function setFeeChanger(address _feeChanger) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setupRole(FEE_CHANGER_ROLE, _feeChanger);
    }

    function setPoaFee(uint256 _fee) public onlyRole(FEE_CHANGER_ROLE) {
        poaFee = _fee;
        emit PoaFeeChanged(poaFee, block.timestamp);
    }

    function setBookingFeeNumerator(uint256 _bookingNumerator) public onlyRole(FEE_CHANGER_ROLE) checkPercentage(_bookingNumerator) {
        bookingNumerator = _bookingNumerator;
        emit BookingPercentageChanged(_bookingNumerator, block.timestamp);
    }

    function getBookingFee(uint256 _amount) public view returns (uint256) {
        return _amount * bookingNumerator / 10000;
    }

    function getPlatformFee(uint256 _amount) internal pure returns (uint256) {
        if (_amount == 0) {
            return 0;
        }

        uint256 factor = 1;

        for (uint256 i = 0; i < 18 && _amount > factor * 10; i++) {
            factor = factor * 10;
        }

        return ((_amount / factor) + 1) * factor;
    }

    function getBuyerFee(uint256 _amount) public view returns (uint256) {
        return getPlatformFee(_amount) * buyerFeeNumerator / 10000;
    }

    function getSellerFee(uint256 _amount) public view returns (uint256) {
        return getPlatformFee(_amount) * sellerFeeNumerator / 10000;
    }

    function getPoaFee() public view returns (uint256) {
        return poaFee;
    }
}