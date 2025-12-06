require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("solidity-coverage");

const config = {
  solidity: "0.8.20",
};

// Configure networks only if env vars are provided to avoid HH8 in local tests
if (process.env.SEPOLIA_RPC && process.env.PRIVATE_KEY) {
  config.networks = {
    sepolia: {
      url: process.env.SEPOLIA_RPC,
      accounts: [process.env.PRIVATE_KEY],
    },
  };
}

module.exports = config;
