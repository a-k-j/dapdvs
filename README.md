# Project Setup

## Step 1: Extract the zip file
Extract the zip file to a folder of your choice.

## Step 2: Open the terminal
Open the terminal and navigate to the extracted folder.

## Step 3: Run the install script
Run the following command to execute the install script:

```bash
bash install.sh
```

This will install the required dependencies for the project.

## Step 4: Compile the contract
Run the following command to compile the contract:

```bash
npx hardhat compile
```

## Step 5: Run the tests
Run the following command to execute the tests:

```bash
npx hardhat test
```

## Step 6: Deploy the contract (Option 1)
To deploy the contract from scratch, use the following command:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

This will deploy the contract to the Sepolia network. Once the deployment is complete, you will see the deployed contract address in the terminal. Copy this address and paste it in the `src/app.js` file at the top, in the `DAPDVS_ADDRESS` constant.

## Step 7: Run the application
After completing the previous steps, run the following command to start the application:

```bash
npm run start
```

This will start the application and you can access it in your web browser.

## Step 8: Use the already deployed contract (Option 2)
If you don't want to deploy the contract from scratch, you can directly run the following command to start the application:

```bash
npm run start
```

This will use the already deployed contract and start the application.

# Project Overview

## Features

Our project offers the following features:

### Login through Metamask

![login through metamask](./Execution%20screenshots/login.png)

### Create New contracts

![create new contract](./Execution%20screenshots/create%20contract.png)

### Fetch contracts

![Fetch contracts](./Execution%20screenshots/fetch%20contracts.png)

### pgOwner Reject

![reject contract by pgOwner](./Execution%20screenshots/pgowner%20reject.png)

### Renter accept reject

![Renter accept reject](./Execution%20screenshots/renter%20accept%20reject.png)

### Request Validator

![Request Validator](./Execution%20screenshots/request%20validator.png)

