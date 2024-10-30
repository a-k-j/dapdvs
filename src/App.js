import React, { useState, useEffect } from 'react';
import DAPDVS_ABI from './ContractABI.json';
const ethers = require("ethers");
const DAPDVS_ADDRESS = '0xb13b93881dA1f59cfe1390e5c03f669a5260B649';

const RentalPlatform = () => {
  const [currentAccount, setCurrentAccount] = useState(null);
  const [isRenter, setIsRenter] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [allContracts, setAllContracts] = useState([]);
  const [error, setError] = useState(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [contractDuration, setContractDuration] = useState(0);
  const [renterAddress, setRenterAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      const signer = provider.getSigner();
      setSigner(signer);
      const contractInstance = new ethers.Contract(DAPDVS_ADDRESS, DAPDVS_ABI, signer);
      setContract(contractInstance);
    }
  }, [currentAccount]);

  const checkIfWalletIsConnected = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setCurrentAccount(accounts[0]);
          setIsLoggedIn(true);
          await fetchUserContracts(accounts[0]);
        }
      } else {
        setError('Please install MetaMask to use this application.');
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      setError('An error occurred while checking your wallet connection.');
    }
  };

  const connectWallet = async () => {
    if (isConnecting) {
      setError('Connection request is already pending. Please check MetaMask.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      if (!window.ethereum) {
        setError('Please install MetaMask to use this application.');
        return;
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length > 0) {
        setCurrentAccount(accounts[0]);
        setIsLoggedIn(true);
        await fetchUserContracts(accounts[0]);
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      if (error.code === -32002) {
        setError('Please open MetaMask to complete the connection.');
      } else if (error.code === 4001) {
        setError('Connection rejected. Please try again.');
      } else {
        setError('An error occurred while connecting to MetaMask.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchUserContracts = async (userAddress) => {
    try {
      if (!contract) {
        console.error('Contract not initialized');
        return;
      }

      const result = await contract.getUserContracts(userAddress);
      const { activeContracts: active, completedContracts: completed } = result;

      // Transform contract data
      const transformedActive = active.map((c, index) => ({
        id: index,
        pgOwner: c.pgOwner,
        renter: c.renter,
        depositAmount: c.depositAmount,
        startDate: c.startDate.toNumber(),
        endDate: c.endDate.toNumber(),
        isActive: c.isActive,
        isCompleted: c.isCompleted
      }));

      const transformedCompleted = completed.map((c, index) => ({
        id: index,
        pgOwner: c.pgOwner,
        renter: c.renter,
        depositAmount: c.depositAmount,
        startDate: c.startDate.toNumber(),
        endDate: c.endDate.toNumber(),
        isActive: c.isActive,
        isCompleted: c.isCompleted
      }));

      setActiveContracts(transformedActive);
      setAllContracts([...transformedActive, ...transformedCompleted]);
    } catch (error) {
      console.error('Error fetching user contracts:', error);
      setError('An error occurred while fetching your contracts.');
    }
  };

  const createContract = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.ethereum || !contract) {
        setError('Please install MetaMask or reload the page.');
        return;
      }

      if (!ethers.utils.isAddress(renterAddress)) {
        setError('Please enter a valid renter address.');
        return;
      }

      if (depositAmount <= 0) {
        setError('Deposit amount must be greater than 0.');
        return;
      }

      if (contractDuration <= 0) {
        setError('Contract duration must be greater than 0.');
        return;
      }

      // Convert deposit amount to Wei
      const depositInWei = ethers.utils.parseEther(depositAmount.toString());
      
      console.log('Creating contract with params:', {
        renterAddress,
        depositInWei: depositInWei.toString(),
        contractDuration
      });

      // Estimate gas first
      const gasEstimate = await contract.estimateGas.createContract(
        renterAddress,
        depositInWei,
        contractDuration
      );

      console.log('Estimated gas:', gasEstimate.toString());

      // Create the contract with estimated gas
      const tx = await contract.createContract(
        renterAddress,
        depositInWei,
        contractDuration,
        {
          gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer to gas estimate
        }
      );
      
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Reset form
      setDepositAmount(0);
      setContractDuration(0);
      setRenterAddress('');
      
      // Refresh contracts
      await fetchUserContracts(currentAccount);
      
      setError(null);
    } catch (error) {
      console.error('Error creating contract:', error);
      if (error.code === 'INSUFFICIENT_FUNDS') {
        setError('Insufficient funds to create contract.');
      } else if (error.code === 4001) {
        setError('Transaction rejected. Please try again.');
      } else {
        setError(`Error: ${error.message || 'An error occurred while creating the contract.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signContract = async (contractId, depositAmount) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!contract) {
        setError('Contract not initialized. Please refresh the page.');
        return;
      }

      // Estimate gas first
      const gasEstimate = await contract.estimateGas.signContract(contractId, {
        value: depositAmount
      });

      console.log('Estimated gas for signing:', gasEstimate.toString());

      const tx = await contract.signContract(contractId, {
        value: depositAmount,
        gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
      });
      
      console.log('Sign transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Sign transaction confirmed:', receipt);

      await fetchUserContracts(currentAccount);
    } catch (error) {
      console.error('Error signing contract:', error);
      if (error.code === 'INSUFFICIENT_FUNDS') {
        setError('Insufficient funds to sign contract.');
      } else if (error.code === 4001) {
        setError('Transaction rejected. Please try again.');
      } else {
        setError(`Error: ${error.message || 'An error occurred while signing the contract.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDashboard = () => {
    setIsRenter((prevState) => !prevState);
    if (currentAccount) {
      fetchUserContracts(currentAccount);
    }
  };

  const renderContractCard = (contract, index) => (
    <li key={index} className="mb-4 p-4 bg-gray-100 rounded">
      <p>Contract ID: {contract.id}</p>
      <p>PG Owner: {contract.pgOwner}</p>
      <p>Renter: {contract.renter}</p>
      <p>Deposit Amount: {ethers.utils.formatEther(contract.depositAmount)} ETH</p>
      <p>Start Date: {contract.startDate ? new Date(contract.startDate * 1000).toLocaleString() : 'Not started'}</p>
      <p>End Date: {new Date(contract.endDate * 1000).toLocaleString()}</p>
      {isRenter && !contract.isActive && contract.renter.toLowerCase() === currentAccount?.toLowerCase() && (
        <div className="mt-4 space-x-4">
          <button
            onClick={() => signContract(contract.id, contract.depositAmount)}
            disabled={isLoading}
            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
              isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
          >
            {isLoading ? 'Processing...' : 'Accept & Pay Deposit'}
          </button>
          <button
            disabled={isLoading}
            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
              isLoading ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Rental Platform
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {currentAccount ? (
            <div>
              <p className="mb-4 text-sm text-gray-600">Connected Account: {currentAccount}</p>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  {isRenter ? 'Renter Dashboard' : 'Validator Dashboard'}
                </h2>
                <label className="inline-flex items-center">
                  <span className="mr-2">Renter</span>
                  <input
                    type="checkbox"
                    checked={!isRenter}
                    onChange={toggleDashboard}
                    className="form-checkbox h-5 w-5 text-blue-500"
                  />
                  <span className="ml-2">Validator</span>
                </label>
              </div>
              <h3 className="text-xl font-bold mb-2">Active Contracts</h3>
              {activeContracts.length > 0 ? (
                <ul>
                  {activeContracts.map((contract, index) => (
                    <li key={index} className="mb-4 p-4 bg-gray-100 rounded">
                      <p>Contract ID: {contract.id}</p>
                      <p>PG Owner: {contract.pgOwner}</p>
                      <p>Renter: {contract.renter}</p>
                      <p>Deposit Amount: {ethers.utils.formatEther(contract.depositAmount)} ETH</p>
                      <p>Start Date: {new Date(contract.startDate * 1000).toLocaleString()}</p>
                      <p>End Date: {new Date(contract.endDate * 1000).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No active contracts.</p>
              )}
              <h3 className="text-xl font-bold mb-2 mt-6">All Contracts</h3>
              {allContracts.length > 0 ? (
                <ul>
                  {allContracts.map((contract, index) => (
                    <li key={index} className="mb-4 p-4 bg-gray-100 rounded">
                      <p>Contract ID: {contract.id}</p>
                      <p>PG Owner: {contract.pgOwner}</p>
                      <p>Renter: {contract.renter}</p>
                      <p>Deposit Amount: {ethers.utils.formatEther(contract.depositAmount)} ETH</p>
                      <p>Start Date: {new Date(contract.startDate * 1000).toLocaleString()}</p>
                      <p>End Date: {new Date(contract.endDate * 1000).toLocaleString()}</p>
                      <p>Status: {contract.isCompleted ? 'Completed' : 'Active'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No contracts found.</p>
              )}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isConnecting 
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
          {error && (
            <div className="text-sm text-red-600 mt-4 text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      {isRenter && isLoggedIn && (
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <h2 className="text-2xl font-bold mb-4">Create New Contract</h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="renterAddress" className="block text-sm font-medium text-gray-700">
                  Renter Address
                </label>
                <input
                  type="text"
                  id="renterAddress"
                  value={renterAddress}
                  onChange={(e) => setRenterAddress(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label htmlFor="depositAmount" className="block text-sm font-medium text-gray-700">
                  Deposit Amount (ETH)
                </label>
                <input
                  type="number"
                  id="depositAmount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="contractDuration" className="block text-sm font-medium text-gray-700">
                  Contract Duration (seconds)
                </label>
                <input
                  type="number"
                  id="contractDuration"
                  value={contractDuration}
                  onChange={(e) => setContractDuration(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                />
              </div>
              <button
                onClick={createContract}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h3 className="text-xl font-bold mb-2">Active Contracts</h3>
          {activeContracts.length > 0 ? (
            <ul>
              {activeContracts.map((contract, index) => renderContractCard(contract, index))}
            </ul>
          ) : (
            <p>No active contracts.</p>
          )}
        </div>
      </div> */}
    </div>
  );
};

export default RentalPlatform;