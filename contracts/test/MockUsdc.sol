// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MockUsdc is ERC20 {
    constructor(address one, address two) ERC20("USDC", "USDC") {
        super._mint(msg.sender, 10000000000000);
        super._mint(one, 10000000000000);
        super._mint(two, 10000000000000);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}