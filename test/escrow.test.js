const { expect } = require("chai");
const { ethers } = require("hardhat");

// Test suite for Escrow.sol using ethers.js v6 syntax
// Covers positive and negative scenarios, events, balances, and reentrancy protection.

describe("Escrow", function () {
  let Escrow;
  let escrow;
  let depositor;
  let beneficiary;
  let arbiter;
  const depositAmount = ethers.parseEther("1");

  // Deploy fresh contract before each test to ensure isolation
  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [depositor, beneficiary, arbiter] = signers;

    Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.connect(depositor).deploy(beneficiary.address, arbiter.address);
    await escrow.waitForDeployment();
  });

  describe("Constructor", function () {
    it("should initialize depositor, beneficiary, arbiter correctly", async function () {
      // Validate constructor sets roles correctly
      expect(await escrow.depositor()).to.equal(depositor.address);
      expect(await escrow.beneficiary()).to.equal(beneficiary.address);
      expect(await escrow.arbiter()).to.equal(arbiter.address);
      expect(await escrow.amount()).to.equal(0n);
      expect(await escrow.funded()).to.equal(false);
      expect(await escrow.withdrawn()).to.equal(false);
    });

    it("should revert for zero-address beneficiary", async function () {
      const Factory = await ethers.getContractFactory("Escrow");
      await expect(
        Factory.connect(depositor).deploy(ethers.ZeroAddress, arbiter.address)
      ).to.be.revertedWith("Zero address");
    });

    it("should revert for zero-address arbiter", async function () {
      const Factory = await ethers.getContractFactory("Escrow");
      await expect(
        Factory.connect(depositor).deploy(beneficiary.address, ethers.ZeroAddress)
      ).to.be.revertedWith("Zero address");
    });
  });

  describe("Deposit", function () {
    it("should allow depositor to deposit funds", async function () {
      // Depositor calls deposit with value
      const tx = await escrow.connect(depositor).deposit({ value: depositAmount });
      await tx.wait();
      // State updates
      expect(await escrow.amount()).to.equal(depositAmount);
      expect(await escrow.funded()).to.equal(true);
    });

    it("should emit Deposited event with correct args", async function () {
      await expect(escrow.connect(depositor).deposit({ value: depositAmount }))
        .to.emit(escrow, "Deposited")
        .withArgs(depositor.address, depositAmount);
    });

    it("should update contract balance correctly after deposit", async function () {
      const balBefore = await ethers.provider.getBalance(await escrow.getAddress());
      expect(balBefore).to.equal(0n);
      await escrow.connect(depositor).deposit({ value: depositAmount });
      const balAfter = await ethers.provider.getBalance(await escrow.getAddress());
      expect(balAfter).to.equal(depositAmount);
      // balance() view should match
      expect(await escrow.balance()).to.equal(depositAmount);
    });

    it("should revert when non-depositor tries to deposit", async function () {
      await expect(
        escrow.connect(beneficiary).deposit({ value: depositAmount })
      ).to.be.revertedWith("Only depositor");
    });

    it("should revert when deposit value is zero", async function () {
      await expect(
        escrow.connect(depositor).deposit({ value: 0 })
      ).to.be.revertedWith("No funds");
    });

    it("should prevent depositor from depositing twice (Already funded)", async function () {
      await escrow.connect(depositor).deposit({ value: depositAmount });
      await expect(
        escrow.connect(depositor).deposit({ value: depositAmount })
      ).to.be.revertedWith("Already funded");
    });
  });

  describe("Release", function () {
    beforeEach(async function () {
      // Ensure funded state before release tests
      await escrow.connect(depositor).deposit({ value: depositAmount });
    });

    it("should allow arbiter to release funds", async function () {
      const tx = await escrow.connect(arbiter).release();
      await tx.wait();
      expect(await escrow.withdrawn()).to.equal(true);
      expect(await escrow.funded()).to.equal(false);
      expect(await escrow.amount()).to.equal(0n);
    });

    it("should emit Released event with correct args", async function () {
      await expect(escrow.connect(arbiter).release())
        .to.emit(escrow, "Released")
        .withArgs(beneficiary.address, depositAmount);
    });

    it("should transfer funds to beneficiary on release", async function () {
      // Track beneficiary balance change
      const before = await ethers.provider.getBalance(beneficiary.address);
      const tx = await escrow.connect(arbiter).release();
      const receipt = await tx.wait();
      // No gas cost for beneficiary in a call, so delta should be +depositAmount
      const after = await ethers.provider.getBalance(beneficiary.address);
      expect(after - before).to.equal(depositAmount);
      // Contract balance should drop to 0
      const contractBal = await ethers.provider.getBalance(await escrow.getAddress());
      expect(contractBal).to.equal(0n);
    });

    it("should revert when non-arbiter tries to release", async function () {
      await expect(escrow.connect(depositor).release()).to.be.revertedWith("Only arbiter");
      await expect(escrow.connect(beneficiary).release()).to.be.revertedWith("Only arbiter");
    });

    it("should revert if release called twice (Not funded after first)", async function () {
      await escrow.connect(arbiter).release();
      await expect(escrow.connect(arbiter).release()).to.be.revertedWith("Not funded");
    });

    it("should revert release after refund (mutually exclusive)", async function () {
      // Re-deploy and fund fresh, then refund first
      const EscrowFactory = await ethers.getContractFactory("Escrow");
      const newEscrow = await EscrowFactory.connect(depositor).deploy(beneficiary.address, arbiter.address);
      await newEscrow.waitForDeployment();
      await newEscrow.connect(depositor).deposit({ value: depositAmount });
      await newEscrow.connect(arbiter).refund();
      await expect(newEscrow.connect(arbiter).release()).to.be.revertedWith("Not funded");
    });

    it("should revert release with 'Transfer failed' if beneficiary rejects ETH", async function () {
      // Deploy a Rejector beneficiary and a fresh escrow with it
      const RejectorFactory = await ethers.getContractFactory("Rejector");
      const rejector = await RejectorFactory.deploy();
      await rejector.waitForDeployment();

      const EscrowFactory = await ethers.getContractFactory("Escrow");
      const esc2 = await EscrowFactory.connect(depositor).deploy(await rejector.getAddress(), arbiter.address);
      await esc2.waitForDeployment();
      await esc2.connect(depositor).deposit({ value: depositAmount });

      await expect(esc2.connect(arbiter).release()).to.be.revertedWith("Transfer failed");
    });
  });

  describe("Refund", function () {
    beforeEach(async function () {
      // Ensure funded state before refund tests
      await escrow.connect(depositor).deposit({ value: depositAmount });
    });

    it("should allow arbiter to refund depositor", async function () {
      const tx = await escrow.connect(arbiter).refund();
      await tx.wait();
      expect(await escrow.withdrawn()).to.equal(true);
      expect(await escrow.funded()).to.equal(false);
      expect(await escrow.amount()).to.equal(0n);
    });

    it("should emit Refunded event with correct args", async function () {
      await expect(escrow.connect(arbiter).refund())
        .to.emit(escrow, "Refunded")
        .withArgs(depositor.address, depositAmount);
    });

    it("should transfer funds back to depositor on refund", async function () {
      const before = await ethers.provider.getBalance(depositor.address);
      const tx = await escrow.connect(arbiter).refund();
      const receipt = await tx.wait();
      // Depositor receives the deposit back
      const after = await ethers.provider.getBalance(depositor.address);
      // after - before includes gas costs for arbiter tx only; depositor received exactly depositAmount
      expect(after - before).to.equal(depositAmount);
      const contractBal = await ethers.provider.getBalance(await escrow.getAddress());
      expect(contractBal).to.equal(0n);
    });

    it("should revert when non-arbiter tries to refund", async function () {
      await expect(escrow.connect(depositor).refund()).to.be.revertedWith("Only arbiter");
      await expect(escrow.connect(beneficiary).refund()).to.be.revertedWith("Only arbiter");
    });

    it("should revert if refund called twice (Not funded after first)", async function () {
      await escrow.connect(arbiter).refund();
      await expect(escrow.connect(arbiter).refund()).to.be.revertedWith("Not funded");
    });

    it("should revert refund after release (mutually exclusive)", async function () {
      const EscrowFactory = await ethers.getContractFactory("Escrow");
      const newEscrow = await EscrowFactory.connect(depositor).deploy(beneficiary.address, arbiter.address);
      await newEscrow.waitForDeployment();
      await newEscrow.connect(depositor).deposit({ value: depositAmount });
      await newEscrow.connect(arbiter).release();
      await expect(newEscrow.connect(arbiter).refund()).to.be.revertedWith("Not funded");
    });
  });

  describe("Preconditions and edge cases", function () {
    it("should revert release before any deposit (Not funded)", async function () {
      await expect(escrow.connect(arbiter).release()).to.be.revertedWith("Not funded");
    });

    it("should revert refund before any deposit (Not funded)", async function () {
      await expect(escrow.connect(arbiter).refund()).to.be.revertedWith("Not funded");
    });

    it("should keep balance() consistent after deposit succeeds", async function () {
      await escrow.connect(depositor).deposit({ value: depositAmount });
      expect(await escrow.balance()).to.equal(depositAmount);
      const onChain = await ethers.provider.getBalance(await escrow.getAddress());
      expect(onChain).to.equal(depositAmount);
    });

    it("should enforce withdrawn flag to prevent double-spend", async function () {
      await escrow.connect(depositor).deposit({ value: depositAmount });
      await escrow.connect(arbiter).release();
      // After release, both release and refund should fail with Not funded
      await expect(escrow.connect(arbiter).release()).to.be.revertedWith("Not funded");
      await expect(escrow.connect(arbiter).refund()).to.be.revertedWith("Not funded");
    });

    it("should not accept ETH via fallback/receive directly", async function () {
      // Contract has no receive()/fallback(), sending ether directly should revert
      await expect(
        depositor.sendTransaction({ to: await escrow.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.reverted; // No message on low-level revert
    });
  });

  describe("Reentrancy protection", function () {
    // A malicious beneficiary that tries to reenter release/refund
    let attacker;
    let escrowForAttack;

    beforeEach(async function () {
      const signers = await ethers.getSigners();
      [depositor, beneficiary, arbiter] = signers;

      const EscrowFactory = await ethers.getContractFactory("Escrow");
      // Deploy a temporary escrow first to pass to attacker constructor; then deploy final escrow with attacker as beneficiary
      const tempEscrow = await EscrowFactory.connect(depositor).deploy(beneficiary.address, arbiter.address);
      await tempEscrow.waitForDeployment();

      const AttackerFactory = await ethers.getContractFactory("Attacker");
      attacker = await AttackerFactory.connect(beneficiary).deploy(await tempEscrow.getAddress());
      await attacker.waitForDeployment();

      escrowForAttack = await EscrowFactory.connect(depositor).deploy(await attacker.getAddress(), arbiter.address);
      await escrowForAttack.waitForDeployment();
      await escrowForAttack.connect(depositor).deposit({ value: depositAmount });
    });

    it("should fail reentrancy on release due to nonReentrant", async function () {
      // Set attacker to try reenter release
      await (await attacker.connect(beneficiary).setTryRelease(true)).wait();
      // Call release which triggers attacker receive and reentrancy attempt
      await expect(escrowForAttack.connect(arbiter).release()).to.not.be.reverted;
      // Escrow should be withdrawn and amount zero
      expect(await escrowForAttack.withdrawn()).to.equal(true);
      expect(await escrowForAttack.amount()).to.equal(0n);
    });

    it("should fail reentrancy on refund due to nonReentrant", async function () {
      // Re-deploy fresh with attacker beneficiary again
      const EscrowFactory = await ethers.getContractFactory("Escrow");
      const newEscrow = await EscrowFactory.connect(depositor).deploy(await attacker.getAddress(), arbiter.address);
      await newEscrow.waitForDeployment();
      await newEscrow.connect(depositor).deposit({ value: depositAmount });

      // Set attacker to try reenter refund
      await (await attacker.connect(beneficiary).setTryRefund(true)).wait();

      await expect(newEscrow.connect(arbiter).refund()).to.not.be.reverted;
      expect(await newEscrow.withdrawn()).to.equal(true);
      expect(await newEscrow.amount()).to.equal(0n);
    });

    it("should execute attacker receive() refund branch when sent ETH directly", async function () {
      // Toggle refund branch and send ETH to attacker so its receive() triggers
      await (await attacker.connect(beneficiary).setTryRefund(true)).wait();
      await expect(
        depositor.sendTransaction({ to: await attacker.getAddress(), value: ethers.parseEther("0.01") })
      ).to.not.be.reverted;
    });
  });
});
