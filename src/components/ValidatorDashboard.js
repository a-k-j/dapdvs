// src/components/ValidatorDashboard.js
import React, { useState, useEffect } from 'react';
const { ethers } = require("hardhat");

function ValidatorDashboard({ contract, account }) {
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    // Fetch contracts where the current account is the assigned Validator
    const contractCount = await contract.nextContractId();
    const fetchedContracts = [];

    for (let i = 1; i < contractCount; i++) {
      const contractDetails = await contract.getContractDetails(i);
      if (contractDetails.validator === account && contractDetails.validatorRequested) {
        fetchedContracts.push({ id: i, ...contractDetails });
      }
    }

    setContracts(fetchedContracts);
  };

  const completeContract = async (contractId) => {
    const damageAmount = prompt('Enter damage amount (in ETH):');
    const newContentHash = prompt('Enter new content hash:');

    try {
      const tx = await contract.completeContract(
        contractId,
        ethers.utils.parseEther(damageAmount),
        ethers.utils.id(newContentHash)
      );
      await tx.wait();
      fetchContracts();
    } catch (error) {
      console.error('Error completing contract:', error);
    }
  };

  return (
    <div>
      <h2>Validator Dashboard</h2>
      <h3>Assigned Contracts</h3>
      <ul>
        {contracts.map((contract) => (
          <li key={contract.id}>
            Contract ID: {contract.id} - PG Owner: {contract.pgOwner} - Renter: {contract.renter}
            {!contract.isCompleted && (
              <button onClick={() => completeContract(contract.id)}>
                Complete Contract
              </button>
            )}
            {contract.isCompleted && <span>Status: Completed</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ValidatorDashboard;
