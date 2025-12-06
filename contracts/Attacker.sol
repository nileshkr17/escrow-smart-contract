// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEscrow {
    function release() external;
    function refund() external;
}

// Malicious beneficiary that attempts to reenter Escrow during ETH transfer
contract Attacker {
    IEscrow public target;
    bool public tryRelease;
    bool public tryRefund;

    constructor(IEscrow _target) {
        target = _target;
    }

    function setTryRelease(bool v) external { tryRelease = v; }
    function setTryRefund(bool v) external { tryRefund = v; }

    receive() external payable {
        if (tryRelease) {
            // Attempt to reenter release
            try target.release() {} catch {}
        }
        if (tryRefund) {
            // Attempt to reenter refund
            try target.refund() {} catch {}
        }
    }
}
