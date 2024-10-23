// src/components/PGOwnerDashboard.js
import React, { useState, useEffect } from 'react';
const { ethers } = require("hardhat");

function PGOwnerDashboard({ contract, account }) {
  const [contracts, setContracts] = useState([]);
  const [newContract, setNewContract] = useState({
    renter: '',
    depositAmount: '',
    duration: '',
    contentHash: ''
  });

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    // Fetch contracts where the current account is the PG Owner
    // This is a simplified example. You'll need to implement a way to fetch all relevant contracts.
    const contractCount = await contract.nextContractId();
    const fetchedContracts = [];

    for (let i = 1; i < contractCount; i++) {
      const contractDetails = await contract.getContractDetails(i);
      if (contractDetails.pgOwner === account) {
        fetchedContracts.push({ id: i, ...contractDetails });
      }
    }

    setContracts(fetchedContracts);
  };

  const handleInputChange = (e) => {
    setNewContract({ ...newContract, [e.target.name]: e.target.value });
  };

  const createContract = async (e) => {
    e.preventDefault();
    try {
      const tx = await contract.createContract(
        newContract.renter,
        ethers.utils.parseEther(newContract.depositAmount),
        ethers.utils.id(newContract.contentHash),
        newContract.duration * 86400 // Convert days to seconds
      );
      await tx.wait();
      fetchContracts();
    } catch (error) {
      console.error('Error creating contract:', error);
    }
  };

  const requestValidator = async (contractId, validatorAddress) => {
    try {
      const tx = await contract.requestValidator(contractId, validatorAddress);
      await tx.wait();
      fetchContracts();
    } catch (error) {
      console.error('Error requesting validator:', error);
    }
  };

  return (
    <div>
      <h2>PG Owner Dashboard</h2>
      <form onSubmit={createContract}>
        <input
          name="renter"
          value={newContract.renter}
          onChange={handleInputChange}
          placeholder="Renter Address"
        />
        <input
          name="depositAmount"
          value={newContract.depositAmount}
          onChange={handleInputChange}
          placeholder="Deposit Amount (ETH)"
        />
        <input
          name="duration"
          value={newContract.duration}
          onChange={handleInputChange}
          placeholder="Duration (days)"
        />
        <input
          name="contentHash"
          value={newContract.contentHash}
          onChange={handleInputChange}
          placeholder="Content Hash"
        />
        <button type="submit">Create Contract</button>
      </form>
      <h3>Your Contracts</h3>
      <ul>
        {contracts.map((contract) => (
          <li key={contract.id}>
            Contract ID: {contract.id} - Renter: {contract.renter}
            {!contract.validatorRequested && (
              <button onClick={() => requestValidator(contract.id, prompt('Enter validator address:'))}>
                Request Validator
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PGOwnerDashboard;
