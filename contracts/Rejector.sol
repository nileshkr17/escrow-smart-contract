// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Simple contract that rejects incoming ETH via receive()
contract Rejector {
    receive() external payable {
        revert("reject");
    }
}
