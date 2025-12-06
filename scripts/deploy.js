async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(deployer.address, deployer.address);

  await escrow.waitForDeployment();
  console.log("Escrow deployed at:", await escrow.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
