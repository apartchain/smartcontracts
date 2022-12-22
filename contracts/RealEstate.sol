// Contract Name: RealEstate
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract RealEstate is ERC1155Supply, ERC1155Burnable, AccessControl {
    bytes32 public constant MARKETPLACE_CONTRACT_ROLE = keccak256("MARKETPLACE_CONTRACT_ROLE");

    using Counters for Counters.Counter;
    Counters.Counter public tokenIdCounter;

    constructor() ERC1155("https://apartchain.io/api/v0/contract/{contractAddress}/{id}") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        tokenIdCounter.increment();
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function setMarketplaceContract(address _marketplace) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_marketplace != address(0));

        _setupRole(MARKETPLACE_CONTRACT_ROLE, _marketplace);
    }

    function createToken(
        address _owner
    ) external onlyRole(MARKETPLACE_CONTRACT_ROLE) returns (uint256) {
        uint256 tokenId = tokenIdCounter.current();
        tokenIdCounter.increment();
        _mint(_owner, tokenId, 1, "");
        return tokenId;
    }
    
    function isApprovedForAll(address _account, address _operator) public view override returns (bool) {
        return hasRole(MARKETPLACE_CONTRACT_ROLE, _operator) || super.isApprovedForAll(_account, _operator);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override onlyRole(MARKETPLACE_CONTRACT_ROLE) {
        super.safeTransferFrom(from, to, id, amount, data);
    }

    /**
     * @dev See {IERC1155-safeBatchTransferFrom}.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public override onlyRole(MARKETPLACE_CONTRACT_ROLE) {
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    function burn(
        address account,
        uint256 id,
        uint256 value
    ) public override onlyRole(MARKETPLACE_CONTRACT_ROLE) {
        super.burn(account, id, value);
    }

    function burnBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory values
    ) public override onlyRole(MARKETPLACE_CONTRACT_ROLE) {
        super.burnBatch(account, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return ERC1155.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
