// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Escrow is ReentrancyGuard {
    address public depositor;
    address public beneficiary;
    address public arbiter;
    uint256 public amount;
    bool public funded;
    bool public withdrawn;

    event Deposited(address indexed from, uint256 amount);
    event Released(address indexed to, uint256 amount);
    event Refunded(address indexed to, uint256 amount);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter");
        _;
    }

    modifier onlyDepositor() {
        require(msg.sender == depositor, "Only depositor");
        _;
    }

    constructor(address _beneficiary, address _arbiter) {
        require(_beneficiary != address(0) && _arbiter != address(0), "Zero address");
        depositor = msg.sender;
        beneficiary = _beneficiary;
        arbiter = _arbiter;
    }

    function deposit() external payable onlyDepositor {
        require(!funded, "Already funded");
        require(msg.value > 0, "No funds");
        amount = msg.value;
        funded = true;
        emit Deposited(msg.sender, msg.value);
    }

    function release() external onlyArbiter nonReentrant {
        require(funded, "Not funded");
        require(!withdrawn, "Already withdrawn");
        withdrawn = true;
        funded = false;

        uint256 toSend = amount;
        amount = 0;

        (bool ok, ) = payable(beneficiary).call{value: toSend}("");
        require(ok, "Transfer failed");

        emit Released(beneficiary, toSend);
    }

    function refund() external onlyArbiter nonReentrant {
        require(funded, "Not funded");
        require(!withdrawn, "Already withdrawn");
        withdrawn = true;
        funded = false;

        uint256 toSend = amount;
        amount = 0;

        (bool ok, ) = payable(depositor).call{value: toSend}("");
        require(ok, "Transfer failed");

        emit Refunded(depositor, toSend);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}
