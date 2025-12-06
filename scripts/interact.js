// Interact with a deployed Escrow on localhost using ethers v6
// Usage examples:
//   npx hardhat run scripts/interact.js --network localhost --action deposit --amount 1 --address 0x...
//   npx hardhat run scripts/interact.js --network localhost --action release --address 0x...
//   npx hardhat run scripts/interact.js --network localhost --action refund --address 0x...

const { ethers } = require("hardhat");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const escrowAddress = args.address || process.env.ESCROW_ADDRESS;
  if (!escrowAddress) {
    throw new Error("Missing --address or ESCROW_ADDRESS env var");
  }

  const [depositor, beneficiary, arbiter] = await ethers.getSigners();
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.attach(escrowAddress);

  console.log("Escrow at:", escrowAddress);
  console.log("Depositor:", depositor.address);
  console.log("Beneficiary:", beneficiary.address);
  console.log("Arbiter:", arbiter.address);

  const action = args.action || "status";
  if (action === "status") {
    await printStatus(escrow);
    return;
  }

  if (action === "deposit") {
    const amountEth = args.amount || "1";
    const value = ethers.parseEther(String(amountEth));
    console.log(`Depositing ${amountEth} ETH as depositor...`);
    const tx = await escrow.connect(depositor).deposit({ value });
    await tx.wait();
    await printStatus(escrow);
    return;
  }

  if (action === "release") {
    console.log("Releasing funds as arbiter...");
    const tx = await escrow.connect(arbiter).release();
    await tx.wait();
    await printStatus(escrow);
    return;
  }

  if (action === "refund") {
    console.log("Refunding funds as arbiter...");
    const tx = await escrow.connect(arbiter).refund();
    await tx.wait();
    await printStatus(escrow);
    return;
  }

  throw new Error(`Unknown --action '${action}'. Use deposit|release|refund|status.`);
}

async function printStatus(escrow) {
  const amount = await escrow.amount();
  const funded = await escrow.funded();
  const withdrawn = await escrow.withdrawn();
  const balance = await escrow.balance();
  console.log("Status:", { amount: amount.toString(), funded, withdrawn, balance: balance.toString() });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--action") out.action = argv[++i];
    else if (a === "--amount") out.amount = argv[++i];
    else if (a === "--address") out.address = argv[++i];
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
