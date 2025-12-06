# Escrow Smart Contract

Production-grade Escrow DApp smart contract with comprehensive Hardhat test suite (Mocha + Chai + ethers.js v6), reentrancy protections, and CI coverage reporting.

![CI](https://github.com/nileshkr17/escrow-smart-contract/actions/workflows/ci.yml/badge.svg)
![Coverage](https://codecov.io/gh/nileshkr17/escrow-smart-contract/branch/main/graph/badge.svg)

## Overview
- Implements `Escrow.sol` using OpenZeppelin `ReentrancyGuard` to protect fund flows.
- Roles: `depositor`, `beneficiary`, `arbiter`.
- Lifecycle: `deposit()` → `release()` to beneficiary or `refund()` to depositor.
- Emits events: `Deposited`, `Released`, `Refunded`.
- Negative checks: zero addresses, role guards, double actions, pre-deposit actions.
- Extra security tests: reentrancy attempts via a malicious beneficiary (`Attacker.sol`).

## Tech Stack
- Hardhat `^2.19.1` with `@nomicfoundation/hardhat-toolbox` (ethers v6).
- OpenZeppelin Contracts `^5.x`.
- Mocha + Chai test framework.
- Solidity Coverage.

## Repository Structure
```
contracts/
	Escrow.sol        # Core escrow logic
	Attacker.sol      # Simulates reentrancy via receive()
	Rejector.sol      # Rejects ETH to exercise transfer failure
test/
	escrow.test.js    # 30 test cases: positive, negative, reentrancy, edge cases
scripts/
	deploy.js         # Example deployment script
hardhat.config.js   # Config with toolbox and optional network guard
```

## Quick Start
```zsh
git clone https://github.com/nileshkr17/escrow-smart-contract
cd escrow-smart-contract
npm install
npx hardhat test
```

## Local Coverage
```zsh
npm run coverage
# Reports in coverage/ (HTML) and coverage.json
```

Example summary (from local run):
```
All files      | 100% statements | 86.11% branches | 100% funcs | 100% lines
Escrow.sol     | 100% statements | 84.38% branches | 100% funcs | 100% lines
Attacker.sol   | 100% statements | 100% branches   | 100% funcs | 100% lines
Rejector.sol   | 100% statements | 100% branches   | 100% funcs | 100% lines
```

## Deploy (Optional)
Set environment variables in `.env` for Sepolia:
```
SEPOLIA_RPC="https://sepolia.infura.io/v3/<key>"
PRIVATE_KEY="0x..."
```
Run:
```zsh
npx hardhat run scripts/deploy.js --network sepolia
```

## Tests Included
- Constructor config (roles, zero-address validation).
- Deposit success, events, and balance checks.
- Release/refund success + events + transfers.
- Negative scenarios (role guards, zero value, already funded/withdrawn, pre-deposit).
- Double actions blocked and cross action constraints.
- Reentrancy blocked via `nonReentrant`.
- Fallback/receive direct ETH rejection.
- Transfer failure branch tested via `Rejector.sol`.

## CI/CD
GitHub Actions workflow runs on pushes/PRs to `main`:
- Install deps
- Run tests
- Run coverage
- Upload coverage to Codecov + publish artifact

Workflow file: `.github/workflows/ci.yml`.

## Badges
- CI Status: GitHub Actions
- Coverage: Codecov (branch `main`)

## Development Notes
- Solidity compiler `0.8.20` to match OpenZeppelin v5.
- Hardhat config guards test runs from missing `.env` by only enabling networks when vars are set.
- Uses ethers v6 syntax (`parseEther`, `getSigners`, `waitForDeployment`).

## License
MIT
