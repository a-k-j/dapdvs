import React, { useState, useEffect } from 'react';
import { ethers, Contract, BrowserProvider } from 'ethers';

// Import the ABI of your contract
import DAPDVS_ABI from './ContractABI.json'; // Make sure to have this file in your project

function RenterDashboard({ account, contractAddress }) {
  const [contracts, setContracts] = useState([]);
  const [contract, setContract] = useState(null);

  useEffect(() => {
    const initContract = async () => {
      console.log("ABI", DAPDVS_ABI.abi);
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const dapdvsContract = new Contract(contractAddress, DAPDVS_ABI.abi, signer);
        setContract(dapdvsContract);
      }
    };

    initContract();
  }, [contractAddress]);

  useEffect(() => {
    if (contract && account) {
      fetchContracts();
    }
  }, [contract, account]);

  const fetchContracts = async () => {
    try {
      const contractCount = await contract.nextContractId();
      const fetchedContracts = [];

      for (let i = 1; i < contractCount.toNumber(); i++) {
        const contractDetails = await contract.getContractDetails(i);
        if (contractDetails.renter.toLowerCase() === account.toLowerCase()) {
          fetchedContracts.push({
            id: i,
            pgOwner: contractDetails.pgOwner,
            depositAmount: ethers.formatEther(contractDetails.depositAmount),
            isActive: contractDetails.isActive,
            // Add other relevant details here
          });
        }
      }

      setContracts(fetchedContracts);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const signContract = async (contractId, depositAmount) => {
    try {
      const tx = await contract.signContract(contractId, {
        value: ethers.parseEther(depositAmount.toString())
      });
      await tx.wait();
      fetchContracts();
    } catch (error) {
      console.error('Error signing contract:', error);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center' }}>Renter Dashboard</h2>
      <h3>Your Contracts</h3>
      {contracts.length === 0 ? (
        <p>No contracts found for this account.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {contracts.map((contract) => (
            <li key={contract.id} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <p>Contract ID: {contract.id}</p>
              <p>PG Owner: {contract.pgOwner}</p>
              <p>Deposit Amount: {contract.depositAmount} ETH</p>
              {!contract.isActive ? (
                <button 
                  onClick={() => signContract(contract.id, contract.depositAmount)}
                  style={{
                    padding: '10px 15px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Sign and Pay Deposit
                </button>
              ) : (
                <span style={{ color: 'green' }}>Status: Active</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RenterDashboard;