#!/bin/bash

# Install basic dependencies
npm i

# Install additional dev dependencies
npm install --save-dev "@nomicfoundation/hardhat-chai-matchers@^2.0.0" \
                      "@nomicfoundation/hardhat-ignition-ethers@^0.15.0" \
                      "@nomicfoundation/hardhat-network-helpers@^1.0.0" \
                      "@nomicfoundation/hardhat-verify@^2.0.0" \
                      "@typechain/ethers-v6@^0.5.0" \
                      "@typechain/hardhat@^9.0.0" \
                      "@types/chai@^4.2.0" \
                      "@types/mocha@>=9.1.0" \
                      "chai@^4.2.0" \
                      "hardhat-gas-reporter@^1.0.8" \
                      "solidity-coverage@^0.8.1" \
                      "ts-node@>=8.0.0" \
                      "typechain@^8.3.0" \
                      "typescript@>=4.5.0"

# Install Ignition dependencies
npm install --save-dev "@nomicfoundation/hardhat-ignition@^0.15.7" \
                      "@nomicfoundation/ignition-core@^0.15.7"