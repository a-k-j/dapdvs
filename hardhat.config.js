require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.27",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: [process.env.PRIVATE_KEY],
      timeout: 60000, // 60 seconds
      gasPrice: "auto",
      gas: "auto",
      maxFeePerGas: "auto",
      maxPriorityFeePerGas: "auto",
      networkCheckTimeout: 100000,
      httpHeaders: {
        "User-Agent": "hardhat",
      },
    }
  },
  mocha: {
    timeout: 100000
  }
};
