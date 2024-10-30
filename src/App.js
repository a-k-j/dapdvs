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
    const initializeContract = async () => {
      if (window.ethereum && currentAccount) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);
          const signer = await provider.getSigner();
          setSigner(signer);
          const contractInstance = new ethers.Contract(DAPDVS_ADDRESS, DAPDVS_ABI, signer);
          setContract(contractInstance);
          
          // Fetch contracts after contract is initialized
          await fetchUserContracts(currentAccount);
        } catch (error) {
          console.error('Error initializing contract:', error);
          setError('Failed to initialize the contract. Please try refreshing the page.');
        }
      }
    };

    initializeContract();
  }, [currentAccount]);

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) {
        setError('Please install MetaMask to use this application.');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        const account = accounts[0];
        setCurrentAccount(account);
        setIsLoggedIn(true);
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
        const account = accounts[0];
        setCurrentAccount(account);
        setIsLoggedIn(true);
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

      if (!ethers.isAddress(renterAddress)) {
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
      const depositInWei = ethers.parseEther(depositAmount.toString());
      
      console.log('Creating contract with params:', {
        renterAddress,
        depositInWei: depositInWei.toString(),
        contractDuration
      });

      // Estimate gas first
      const gasEstimate = await contract.createContract.estimateGas(
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
          gasLimit: (gasEstimate*120n)/(100n) // Add 20% buffer to gas estimate
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
    <div key={index} className="mb-4 p-4 bg-gray-100 rounded-lg shadow">
      <div className="grid grid-cols-2 gap-4">
        <p className="text-sm"><span className="font-semibold">Contract ID:</span> {contract.id}</p>
        <p className="text-sm"><span className="font-semibold">Status:</span> {contract.isCompleted ? 'Completed' : 'Active'}</p>
        <p className="text-sm"><span className="font-semibold">PG Owner:</span> {contract.pgOwner}</p>
        <p className="text-sm"><span className="font-semibold">Renter:</span> {contract.renter}</p>
        <p className="text-sm"><span className="font-semibold">Deposit:</span> {ethers.utils.formatEther(contract.depositAmount)} ETH</p>
        <p className="text-sm"><span className="font-semibold">Start:</span> {contract.startDate ? new Date(contract.startDate * 1000).toLocaleString() : 'Not started'}</p>
        <p className="text-sm col-span-2"><span className="font-semibold">End:</span> {new Date(contract.endDate * 1000).toLocaleString()}</p>
      </div>
      
      {isRenter && !contract.isActive && contract.renter.toLowerCase() === currentAccount?.toLowerCase() && (
        <div className="mt-4 flex space-x-4">
          <button
            onClick={() => signContract(contract.id, contract.depositAmount)}
            disabled={isLoading}
            className={`flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white ${
              isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
          >
            {isLoading ? 'Processing...' : 'Accept & Pay Deposit'}
          </button>
          <button
            disabled={isLoading}
            className={`flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white ${
              isLoading ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Rental Platform
        </h1>

        {!currentAccount ? (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isConnecting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600">Connected: {currentAccount}</p>
                <div className="flex items-center space-x-4">
                  <span className={`text-sm ${isRenter ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>Renter</span>
                  <button
                    onClick={toggleDashboard}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 ${
                      !isRenter ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${
                      !isRenter ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className={`text-sm ${!isRenter ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>Validator</span>
                </div>
              </div>

              {isRenter && (
                <div className="border-t pt-6">
                  <h2 className="text-xl font-semibold mb-4">Create New Contract</h2>
                  <div className="space-y-4">
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
                      disabled={isLoading}
                      className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                    >
                      {isLoading ? 'Creating Contract...' : 'Create Contract'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Active Contracts</h2>
                {activeContracts.length > 0 ? (
                  <div className="space-y-4">
                    {activeContracts.map((contract, index) => renderContractCard(contract, index))}
                  </div>
                ) : (
                  <p className="text-gray-500">No active contracts found.</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">All Contracts</h2>
                {allContracts.length > 0 ? (
                  <div className="space-y-4">
                    {allContracts.map((contract, index) => renderContractCard(contract, index))}
                  </div>
                ) : (
                  <p className="text-gray-500">No contracts found.</p>
                )}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RentalPlatform;
