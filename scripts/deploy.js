// const hre = require("hardhat");

// async function main() {
//   // Get the contract factory
//   const DAPDVS = await hre.ethers.getContractFactory("DAPDVS");
  
//   // Deploy the contract
//   console.log("Deploying DAPDVS contract...");
//   const dapdvs = await DAPDVS.deploy();

//   // Wait for the contract to be deployed
//   await dapdvs.waitForDeployment();

//   console.log("DAPDVS deployed to:", dapdvs.address);
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });


const hre = require("hardhat");

async function main() {
  try {
    console.log("Network name:", hre.network.name);
    console.log("Network config:", JSON.stringify(hre.network.config, null, 2));

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance));

    const DAPDVS = await hre.ethers.getContractFactory("DAPDVS");
    
    console.log("Estimating gas...");
    const deploymentEstimate = await hre.ethers.provider.estimateGas(
      DAPDVS.getDeployTransaction()
    );
    console.log("Estimated gas for deployment:", deploymentEstimate.toString());

    console.log("Deploying DAPDVS contract...");
    const dapdvs = await DAPDVS.deploy();

    console.log("Waiting for deployment...");
    await dapdvs.waitForDeployment();

    console.log("DAPDVS deployed to:", await dapdvs.getAddress());
    
    const deploymentGas = await dapdvs.deploymentTransaction().gasLimit;
    console.log("Actual gas used for deployment:", deploymentGas.toString());
  } catch (error) {
    console.error("Deployment failed with error:", error);
    if (error.reason) console.error("Error reason:", error.reason);
    if (error.code) console.error("Error code:", error.code);
    if (error.body) console.error("Error body:", error.body);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
