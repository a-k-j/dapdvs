import React, { useState, useEffect } from 'react';
import DAPDVS_ABI from './ContractABI.json';
const ethers = require("ethers");
const DAPDVS_ADDRESS = '0xa08E7C8d2C2e3618a83A1F9b4ac3ADD2947446C3';

const RentalPlatform = () => {
  const [currentAccount, setCurrentAccount] = useState(null);
  const [isRenter, setIsRenter] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [completedContracts, setCompletedContracts] = useState([]);
  const [allContracts, setAllContracts] = useState([]);
  const [error, setError] = useState(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [contractDuration, setContractDuration] = useState(0);
  const [renterAddress, setRenterAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingContractId, setLoadingContractId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contractIdCounter, setContractIdCounter] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
  checkIfWalletIsConnected();
}, []);

useEffect(() => {
  const init = async () => {
    if (window.ethereum && currentAccount) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        const contractInstance = new ethers.Contract(
          DAPDVS_ADDRESS,
          DAPDVS_ABI,
          signer
        );

        setContract(contractInstance);
        setProvider(provider);
        setSigner(signer);
        setIsInitialized(true);

        // Add event listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
      } catch (error) {
        console.error('Initialization error:', error);
        setError('Failed to initialize. Please refresh and try again.');
      }
    }
  };

  init();
}, [currentAccount]);

// Add this useEffect to fetch contracts when contract is initialized
useEffect(() => {
  const loadContracts = async () => {
    if (isInitialized && contract && currentAccount) {
      console.log('Loading contracts for account:', currentAccount);
      await fetchUserContracts(currentAccount);
    }
  };

  loadContracts();
}, [isInitialized, contract, currentAccount, isRenter]); // Added isRenter to refresh when switching roles

// Add these event handlers
const handleAccountsChanged = (accounts) => {
  if (accounts.length > 0 && accounts[0] !== currentAccount) {
    setCurrentAccount(accounts[0]);
    window.location.reload();
  } else if (accounts.length === 0) {
    setCurrentAccount(null);
    setIsLoggedIn(false);
  }
};

const handleChainChanged = () => {
  window.location.reload();
};

  useEffect(() => {
    const setup = async () => {
      try {
        await initializeContract();
        await fetchUserContracts(currentAccount);
      } catch (error) {
        console.error('Setup failed:', error);
      }
    };

    if (currentAccount) {
      setup();
    }
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
      
      // Switch to Sepolia network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Test Network',
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'SEP',
                decimals: 18
              },
              rpcUrls: [process.env.REACT_APP_SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          });
        } else {
          throw switchError;
        }
      }
      
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

  useEffect(() => {
    if (isInitialized && contract && activeContracts.length > 0) {
      // Check immediately when component mounts or contracts change
      checkExpiredContracts();

      // Set up interval to check every minute
      const interval = setInterval(checkExpiredContracts, 60000);

      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }
  }, [isInitialized, contract, activeContracts]);


    const checkExpiredContracts = async () => {
    if (!contract || !activeContracts) return;

    try {
      for (const rentalContract of activeContracts) {
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > rentalContract.endDate) {
          console.log(`Checking expired contract ${rentalContract.id}`);
          const tx = await contract.checkAndCompleteExpiredContract(rentalContract.id);
          await tx.wait();
          console.log(`Contract ${rentalContract.id} checked for expiration`);
        }
      }
      // Refresh contracts after checking
      await fetchUserContracts(currentAccount);
    } catch (error) {
      console.error('Error checking expired contracts:', error);
      setError('Failed to check expired contracts: ' + error.message);
    }
  };

  const initializeContract = async () => {
  if (window.ethereum && currentAccount) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);

      const signer = await provider.getSigner();
      setSigner(signer);

      const contractInstance = new ethers.Contract(
        DAPDVS_ADDRESS,
        DAPDVS_ABI,
        signer
      );

      setContract(contractInstance);
      
      // Fetch contract ID counter
      const nextId = await contractInstance.nextContractId();
      setContractIdCounter(Number(nextId));

    } catch (error) {
      console.error('Contract initialization error:', error);
      setError('Failed to initialize contract. Please refresh and try again.');
    }
  }
};
  
  const fetchUserContracts = async (userAddress) => {
    if (!contract || !userAddress || !isInitialized) {
      console.log('Contract not ready for fetching');
      return;
    }

    try {
      console.log('Fetching contracts for:', userAddress);
      const result = await contract.getUserContracts(userAddress);
      console.log('Contract result:', result);

      // Get contract counter
      const nextId = await contract.nextContractId();
      let currentId = 1;

      // Transform active contracts
      const transformedActive = result[0].map((c, index) => ({
        id: currentId + index,
        pgOwner: c.pgOwner,
        renter: c.renter,
        depositAmount: c.depositAmount,
        startDate: Number(c.startDate),
        endDate: Number(c.endDate),
        isActive: c.isActive,
        isCompleted: c.isCompleted,
        validatorRequested: c.validatorRequested,
        validator: c.validator
      }));

      // Add time remaining information
      const transformedActiveWithTime = transformedActive.map(contract => ({
        ...contract,
        timeRemaining: Math.max(0, contract.endDate - Math.floor(Date.now() / 1000))
      }));

      // Transform completed contracts
      const transformedCompleted = result[1].map((c, index) => ({
        id: currentId + transformedActive.length + index,
        pgOwner: c.pgOwner,
        renter: c.renter,
        depositAmount: c.depositAmount,
        startDate: Number(c.startDate),
        endDate: Number(c.endDate),
        isActive: c.isActive,
        isCompleted: c.isCompleted,
        validatorRequested: c.validatorRequested,
        validator: c.validator
      }));

      // Filter based on role
      const filteredActive = transformedActiveWithTime.filter(c => {
        const isCorrectRole = isRenter 
          ? c.renter.toLowerCase() === currentAccount.toLowerCase()
          : c.pgOwner.toLowerCase() === currentAccount.toLowerCase();
        return c.isActive && !c.isCompleted && isCorrectRole;
      });

      setActiveContracts(filteredActive);
      setCompletedContracts(transformedCompleted);
      setAllContracts([...transformedActiveWithTime, ...transformedCompleted]);

    } catch (error) {
      console.error('Error fetching contracts:', error);
      setError('Failed to fetch contracts: ' + error.message);
    }
  };

  const toggleDashboard = () => {
    setIsRenter((prevState) => !prevState);
  };

const createContract = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!window.ethereum || !contract) {
        setError('Please install MetaMask or reload the page.');
        return;
      }

      // Normalize addresses for comparison
      const normalizedCurrentAccount = currentAccount.toLowerCase();
      const normalizedRenterAddress = renterAddress.toLowerCase();

      // Add validation checks
      if (normalizedCurrentAccount === normalizedRenterAddress) {
        setError('PG Owner cannot create a contract with themselves as renter.');
        return;
      }

      if (!ethers.isAddress(renterAddress)) {
        setError('Please enter a valid renter address.');
        return;
      }

      console.log('Contract Creation Details:', {
        pgOwner: normalizedCurrentAccount,
        renter: normalizedRenterAddress,
        depositAmount: depositAmount,
        duration: contractDuration
      });

      const depositInWei = ethers.parseEther(depositAmount.toString());
      
      const tx = await contract.createContract(
        renterAddress,
        depositInWei,
        contractDuration,
        {
          gasLimit: 300000
        }
      );
      
      await tx.wait();
      
      // Reset form and refresh contracts
      setDepositAmount(0);
      setContractDuration(0);
      setRenterAddress('');
      await fetchUserContracts(currentAccount);
      
    } catch (error) {
      console.error('Error creating contract:', error);
      setError(error.message || 'An error occurred while creating the contract.');
    } finally {
      setIsLoading(false);
    }
  };

  const signContract = async (contractId, depositAmount) => {
    try {
        setLoadingContractId(contractId);
        setError(null);

        if (!contract) {
            throw new Error('Contract not initialized');
        }

        // Get contract details
        const contractDetails = await contract.getContractDetails(contractId);
        const normalizedRenter = contractDetails.renter.toLowerCase();
        const normalizedCurrentAccount = currentAccount.toLowerCase();
        
        console.log('Contract Signing Details:', {
            contractId,
            designatedRenter: normalizedRenter,
            currentWallet: normalizedCurrentAccount,
            isMatch: normalizedRenter === normalizedCurrentAccount,
            depositAmount: depositAmount.toString()
        });

        if (normalizedRenter !== normalizedCurrentAccount) {
            throw new Error(`Address mismatch. Contract is for ${contractDetails.renter}`);
        }

        // Check if contract is already active
        if (contractDetails.isActive) {
            throw new Error('Contract is already active');
        }

        // Check if contract has expired
        // const currentTime = Math.floor(Date.now() / 1000);
        // if (currentTime > Number(contractDetails.endDate)) {
        //     throw new Error('Contract has expired');
        // }

        // Estimate gas first
        const gasEstimate = await contract.signContract.estimateGas(contractId, {
            value: depositAmount
        });

        // Add 20% buffer to gas estimate
        const gasLimit = ((gasEstimate * 2n));

        const tx = await contract.signContract(contractId, {
            value: depositAmount,
            gasLimit: gasLimit
        });

        await tx.wait();
        await fetchUserContracts(currentAccount);
        
    } catch (error) {
        console.error('Error signing contract:', error);
        if (error.code === 'INSUFFICIENT_FUNDS') {
            setError('Insufficient funds to sign contract.');
        } else if (error.code === 4001) {
            setError('Transaction rejected. Please try again.');
        } else if (error.message.includes('user rejected')) {
            setError('Transaction was rejected. Please try again.');
        } else {
            setError(error.message || 'Error signing contract. Please ensure you have enough ETH for deposit and gas.');
        }
    } finally {
        setLoadingContractId(null);
    }
  };
  
  const renderContractCard = (contract) => {
    if (!contract) return null;
    
    const canSign = !contract.isActive && 
                     isRenter && 
                     contract.renter.toLowerCase() === currentAccount?.toLowerCase();

    const isLoading = loadingContractId === contract.id;
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = currentTime > contract.endDate;

    return (
      <div key={contract.id} className="mb-4 p-4 bg-white rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <p className="text-sm">
            <span className="font-semibold">Contract ID:</span> {contract.id}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Status:</span> 
            {contract.isCompleted ? 'Completed' : (isExpired ? 'Expired' : 'Active')}
          </p>
          <p className="text-sm">
            <span className="font-semibold">PG Owner:</span> 
            {`${contract.pgOwner.slice(0,6)}...${contract.pgOwner.slice(-4)}`}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Renter:</span> 
            {`${contract.renter.slice(0,6)}...${contract.renter.slice(-4)}`}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Deposit:</span> 
            {ethers.formatEther(contract.depositAmount)} ETH
          </p>
          <p className="text-sm">
            <span className="font-semibold">End Date:</span> 
            {new Date(contract.endDate * 1000).toLocaleString()}
          </p>
          {contract.isActive && !contract.isCompleted && (
            <p className={`text-sm col-span-2 ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
              <span className="font-semibold">Status:</span> 
              {isExpired ? ' Expired (processing return)' : ` Time remaining: ${Math.floor(contract.timeRemaining / 3600)}h ${Math.floor((contract.timeRemaining % 3600) / 60)}m`}
            </p>
          )}
        </div>
        
        {canSign && (
          <div className="mt-4">
            <button
              onClick={() => signContract(contract.id, contract.depositAmount)}
              disabled={isLoading}
              className={`w-full py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white ${
                isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
            >
              {isLoading ? 'Processing...' : 'Accept & Pay Deposit'}
            </button>
          </div>
        )}
      </div>
    );
  };

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
                isConnecting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
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
                  <span className={`text-sm ${!isRenter ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>PG Owner</span>
                </div>
              </div>

              {!isRenter && (
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
                    {activeContracts.map((contract) => renderContractCard(contract))}
                  </div>
                ) : (
                  <p className="text-gray-500">No active contracts found.</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">All Contracts</h2>
                {allContracts.length > 0 ? (
                  <div className="space-y-4">
                    {allContracts.map((contract) => renderContractCard(contract))}
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