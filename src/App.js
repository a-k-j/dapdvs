import React, { useState, useEffect } from "react";
import { ClockIcon, WalletIcon, CheckCircleIcon, HomeIcon } from "lucide-react";
import DAPDVS_ABI from "./ContractABI.json";
const ethers = require("ethers");
const DAPDVS_ADDRESS = "0xD6A3d8C60944BC38ded01Ca3FD6AC7cE77953861";
const EXPECTED_CHAIN_ID = 11155111n; // Sepolia testnet - adjust as needed
const MINIMUM_GAS_LIMIT = 300000;

const RentalPlatform = () => {
  const [currentAccount, setCurrentAccount] = useState(null);
  const [role, setRole] = useState("renter");
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingContractId, setLoadingContractId] = useState(null);
  const [damageAmount, setDamageAmount] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  // Contract states remain the same...
  const [pendingContracts, setPendingContracts] = useState([]);
  const [activeContracts, setActiveContracts] = useState([]);
  const [completedContracts, setCompletedContracts] = useState([]);
  const [validatorPendingContracts, setValidatorPendingContracts] = useState(
    []
  );
  const [validatorCompletedContracts, setValidatorCompletedContracts] =
    useState([]);

  // Form states remain the same...
  const [newContract, setNewContract] = useState({
    renter: "",
    validator: "",
    depositAmount: "",
    validatorFee: "",
    duration: "",
  });

  // Wallet connection functions
  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        setError("Please install MetaMask!");
        return;
      }

      setIsConnecting(true);
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      setCurrentAccount(accounts[0]);
      setError(null);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        setError("Please install MetaMask!");
        return;
      }

      const accounts = await ethereum.request({ method: "eth_accounts" });

      if (accounts.length !== 0) {
        const account = accounts[0];
        setCurrentAccount(account);
      }
    } catch (error) {
      console.error(error);
      setError("Error checking wallet connection");
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setError("Please connect to MetaMask.");
      setCurrentAccount(null);
      setIsInitialized(false);
    } else if (accounts[0] !== currentAccount) {
      setCurrentAccount(accounts[0]);
      setPendingContracts([]);
      setActiveContracts([]);
      setCompletedContracts([]);
      setValidatorPendingContracts([]);
      setValidatorCompletedContracts([]);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  // Initialize wallet connection
  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  // Initialize contract connection
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

          window.ethereum.on("accountsChanged", handleAccountsChanged);
          window.ethereum.on("chainChanged", handleChainChanged);

          return () => {
            window.ethereum.removeListener(
              "accountsChanged",
              handleAccountsChanged
            );
            window.ethereum.removeListener("chainChanged", handleChainChanged);
          };
        } catch (error) {
          console.error("Initialization error:", error);
          setError("Failed to initialize contract");
        }
      }
    };

    init();
  }, [currentAccount]);

  // Fetch contracts based on role
  useEffect(() => {
    fetchContracts();
  }, [isInitialized, contract, currentAccount, role]);

  const formatContracts = (contracts) => {
    if (!contracts) return [];
    return contracts.map((c, index) => ({
      id: index, // Add an id if not present in the contract
      ...c,
      depositAmount: ethers.formatEther(c.depositAmount.toString()),
      validatorFee: ethers.formatEther(c.validatorFee.toString()),
      startDate: Number(c.startDate),
      endDate: Number(c.endDate),
    }));
  };

  const validateContractInput = (contract) => {
  if (!contract.renter || !ethers.isAddress(contract.renter)) {
    throw new Error("Invalid renter address");
  }
  if (!contract.validator || !ethers.isAddress(contract.validator)) {
    throw new Error("Invalid validator address");
  }
  if (!contract.depositAmount || isNaN(contract.depositAmount) || contract.depositAmount <= 0) {
    throw new Error("Invalid deposit amount");
  }
  if (!contract.validatorFee || isNaN(contract.validatorFee) || contract.validatorFee <= 0) {
    throw new Error("Invalid validator fee");
  }
  if (!contract.duration || isNaN(contract.duration) || contract.duration <= 0) {
    throw new Error("Invalid duration");
  }
};


  const createContract = async (e) => {
  if (e) {
    e.preventDefault();
  }
  
  try {
    setIsLoading(true);
    setError(null);

    // Validate input
    validateContractInput(newContract);

    const depositInWei = ethers.parseEther(newContract.depositAmount);
    const feeInWei = ethers.parseEther(newContract.validatorFee);
    // const durationInSeconds = Number(newContract.duration) * 24 * 60 * 60; // Convert days to seconds
    const durationInSeconds = Number(newContract.duration); // Convert days to seconds

    // Verify network
    await verifyNetwork(provider);
    
    // Estimate gas before sending transaction
    const gasEstimate = await contract.createContract.estimateGas(
      newContract.renter,
      newContract.validator,
      depositInWei,
      feeInWei,
      durationInSeconds
    );

    // Add 100% buffer to gas estimate
    const gasLimit = Math.floor(gasEstimate.toString() * 2);

    console.log("Creating contract with parameters:", {
      renter: newContract.renter,
      validator: newContract.validator,
      depositAmount: depositInWei.toString(),
      validatorFee: feeInWei.toString(),
      duration: durationInSeconds,
      gasLimit
    });

    const tx = await contract.createContract(
      newContract.renter,
      newContract.validator,
      depositInWei,
      feeInWei,
      durationInSeconds,
      { gasLimit }
    );

    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);

    if (receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    // Reset form
    setNewContract({
      renter: "",
      validator: "",
      depositAmount: "",
      validatorFee: "",
      duration: "",
    });

    // Refresh the contracts list
    await fetchContracts();

  } catch (error) {
    console.error("Error creating contract:", error);
    let errorMessage;
    if (error.reason) {
      errorMessage = `Failed to create contract: ${error.reason}`;
    } else if (error.data?.message) {
      errorMessage = `Failed to create contract: ${error.data.message}`;
    } else if (error.message.includes("user rejected")) {
      errorMessage = "Transaction was rejected by user";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Insufficient funds to complete transaction";
    } else {
      errorMessage = error.message || "Failed to create contract";
    }
    setError(errorMessage);
  } finally {
    setIsLoading(false);
  }
};

  const fetchContracts = async () => {
    if (!isInitialized || !contract || !currentAccount) return;

    try {
      setIsLoading(true);
      if (role === "pgOwner") {
        const result = await contract.getPgOwnerContracts(currentAccount);
        setPendingContracts(formatContracts(result.pendingContracts));
        setActiveContracts(formatContracts(result.activeContracts));
        setCompletedContracts(formatContracts(result.completedContracts));
      } else if (role === "renter") {
        const result = await contract.getRenterContracts(currentAccount);
        setPendingContracts(formatContracts(result.pendingContracts));
        setActiveContracts(formatContracts(result.activeContracts));
        setCompletedContracts(formatContracts(result.completedContracts));
      } else if (role === "validator") {
        const result = await contract.getValidatorContracts(currentAccount);
        setValidatorPendingContracts(formatContracts(result.pendingValidationContracts));
        setValidatorCompletedContracts(formatContracts(result.completedValidationContracts));
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setError("Failed to fetch contracts");
    } finally {
      setIsLoading(false);
    }
  };

  const signContract = async (contractId, depositAmount) => {
  try {
    // Input validation
    if (!contractId || !depositAmount) {
      throw new Error("Invalid contract parameters");
    }

    setLoadingContractId(contractId);
    setError(null);

    // Convert deposit amount to Wei
    const depositInWei = ethers.parseEther(depositAmount.toString());

    // Perform all verifications
    console.log("Starting contract verification process...");

    // 1. Verify network connection
    await verifyNetwork(provider);
    console.log("Network verification successful");

    // 2. Verify user balance
    await verifyBalance(provider, currentAccount, depositInWei);
    console.log("Balance verification successful");

    // 3. Verify contract state
    await verifyContractBeforeSigning(contractId);
    console.log("Contract state verification successful");

    // 4. Estimate gas to ensure transaction won't fail
    const gasEstimate = await contract.signContract.estimateGas(contractId);

    // Add 20% buffer to gas estimate
    const gasLimit = (gasEstimate*2n);

    // Ensure minimum gas limit
    const finalGasLimit = gasLimit < MINIMUM_GAS_LIMIT
      ? MINIMUM_GAS_LIMIT 
      : gasLimit.toString();

    console.log("Estimated gas limit:", finalGasLimit);

    // Prepare transaction with all verified parameters
    const tx = await contract.signContract(contractId, {
      value: depositInWei,
      gasLimit: finalGasLimit
    });

    console.log("Transaction sent:", tx.hash);

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);

    // Verify transaction success
    if (receipt.status === 0) {
      throw new Error("Transaction failed");
    }

    // Refresh contracts list
    await fetchContracts();

    return receipt;
  } catch (error) {
    console.error("Error in signContract:", error);
    
    // Enhanced error handling with specific messages
    let errorMessage;
    if (error.reason) {
      errorMessage = `Contract signing failed: ${error.reason}`;
    } else if (error.data?.message) {
      errorMessage = `Contract signing failed: ${error.data.message}`;
    } else if (error.message.includes("user rejected")) {
      errorMessage = "Transaction was rejected by user";
    } else if (error.message.includes("insufficient funds")) {
      errorMessage = "Insufficient funds to complete transaction";
    } else {
      errorMessage = error.message || "Failed to sign contract";
    }

    setError(errorMessage);
    throw error;
  } finally {
    setLoadingContractId(null);
  }
};

// Event Listeners for network and account changes
const setupEventListeners = () => {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId) => {
      console.log('Network changed to:', chainId);
      // Convert chainId to decimal for comparison
      const decimalChainId = parseInt(chainId, 16);
      if (decimalChainId !== EXPECTED_CHAIN_ID) {
        setError(`Please connect to the correct network. Expected chain ID: ${EXPECTED_CHAIN_ID}`);
      } else {
        setError(null);
      }
    });

    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        setError('Please connect your wallet');
        setCurrentAccount(null);
      } else {
        setCurrentAccount(accounts[0]);
        setError(null);
      }
    });
  }
};

// Usage in useEffect
useEffect(() => {
  setupEventListeners();
  return () => {
    // Cleanup listeners on component unmount
    if (window.ethereum) {
      window.ethereum.removeAllListeners('chainChanged');
      window.ethereum.removeAllListeners('accountsChanged');
    }
  };
}, []);

const verifyContractBeforeSigning = async (contractId) => {
  try {

    if (!contract) {
      throw new Error("Contract instance not initialized");
    }

    // Get contract state
    const contractData = await contract.getContractDetails(contractId);
    
    // Verify contract exists and is in valid state
    if (!contractData) {
      throw new Error("Contract does not exist");
    }

    // // Check if contract is in pending state (adjust based on your contract's state enum)
    // if (contractData.state !== 0) { // Assuming 0 is PENDING state
    //   throw new Error("Contract is not in pending state");
    // }

    // Check if contract is expired
    // const currentTime = Math.floor(Date.now() / 1000);
    // if (currentTime > Number(contractData.endDate)) {
    //   throw new Error("Contract has expired");
    // }

    return true;
  } catch (error) {
    console.error("Contract verification failed:", error);
    throw new Error(`Contract verification failed: ${error.message}`);
  }
};

// Helper function to verify network
const verifyNetwork = async (provider) => {
  const network = await provider.getNetwork();
  console.log('Decimal chain ID:', network.chainId);
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Please connect to the correct network. Expected chain ID: ${EXPECTED_CHAIN_ID}`);
  }
  return true;
};

// Helper function to verify user balance
const verifyBalance = async (provider, account, requiredAmount) => {
  const balance = await provider.getBalance(account);
  if (balance < requiredAmount) {
    throw new Error(`Insufficient balance. Required: ${ethers.formatEther(requiredAmount)} ETH`);
  }
  return true;
};

  const requestValidator = async (contractId, validatorFee) => {
    try {
      setLoadingContractId(contractId);
      setError(null);

      const tx = await contract.requestValidator(contractId, {
        value: ethers.parseEther(validatorFee.toString()),
        gasLimit: 300000,
      });

      await tx.wait();
    } catch (error) {
      console.error("Error requesting validator:", error);
      setError(error.message);
    } finally {
      setLoadingContractId(null);
    }
  };

  const completeContract = async (contractId, damageAmount) => {
    try {
      setLoadingContractId(contractId);
      setError(null);

      const tx = await contract.completeContract(
        contractId,
        ethers.parseEther(damageAmount.toString()),
        { gasLimit: 500000 }
      );

      await tx.wait();
    } catch (error) {
      console.error("Error completing contract:", error);
      setError(error.message);
    } finally {
      setLoadingContractId(null);
    }
  };

  const renderContractCard = (contract, type) => {
    const isLoading = loadingContractId === contract.id;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = contract.endDate - currentTime;
    const canRequestValidator = timeRemaining <= 86400; // 24 hours before end

    return (
      <div key={contract.id} className="mb-4 p-6 bg-white rounded-lg shadow-md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Contract ID: {contract.id}</p>
            <p className="text-sm">PG Owner: {contract.pgOwner}</p>
            <p className="text-sm">Renter: {contract.renter}</p>
            <p className="text-sm">Validator: {contract.validator}</p>
          </div>
          <div>
            <p className="text-sm">Deposit: {contract.depositAmount} ETH</p>
            <p className="text-sm">
              Validator Fee: {contract.validatorFee} ETH
            </p>
            <p className="text-sm">
              End Date: {new Date(contract.endDate * 1000).toLocaleString()}
            </p>
            {/* {timeRemaining > 0 && (
              <p className="text-sm text-green-600">
                Time Remaining: {Math.floor(timeRemaining / 3600)}h{" "}
                {Math.floor((timeRemaining % 3600) / 60)}m
              </p>
            )} */}
          </div>
        </div>

        <div className="mt-4">
          {role === "renter" && type === "pending" && (
            <button
              onClick={() => signContract(contract.id, contract.depositAmount)}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400"
            >
              {isLoading ? "Signing..." : "Sign & Pay Deposit"}
            </button>
          )}

          {role === "pgOwner" &&
            type === "active" &&
            canRequestValidator &&
            !contract.validatorRequested && (
              <button
                onClick={() =>
                  requestValidator(contract.id, contract.validatorFee)
                }
                disabled={isLoading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isLoading ? "Requesting..." : "Request Validator"}
              </button>
            )}

          {role === "validator" && type === "pending" && (
            <div className="flex gap-4">
              <input
                type="number"
                placeholder="Damage amount in ETH"
                className="flex-1 p-2 border rounded-md"
                onChange={(e) => setDamageAmount(e.target.value)}
              />
              <button
                onClick={() => completeContract(contract.id, damageAmount)}
                disabled={isLoading}
                className="py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-400"
              >
                {isLoading ? "Processing..." : "Complete Contract"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const logout = () => {
    setCurrentAccount(null);
    setIsInitialized(false);
  };

  const renderDashboard = () => {
    return (
      <div className="w-full">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-600">Connected: {currentAccount}</p>
            <button
              onClick={logout}
              className="py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8 bg-gray-100 p-1 rounded-lg">
          {["renter", "pgOwner", "validator"].map((tabValue) => (
            <button
              key={tabValue}
              onClick={() => setRole(tabValue)}
              className={`flex items-center justify-center py-2 px-4 rounded-md transition-all ${
                role === tabValue ? "bg-white shadow-sm" : "hover:bg-gray-200"
              }`}
            >
              {tabValue === "renter" && <WalletIcon className="w-4 h-4 mr-2" />}
              {tabValue === "pgOwner" && <HomeIcon className="w-4 h-4 mr-2" />}
              {tabValue === "validator" && (
                <CheckCircleIcon className="w-4 h-4 mr-2" />
              )}
              {tabValue.charAt(0).toUpperCase() + tabValue.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-8">
          {role === "pgOwner" && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">
                Create New Contract
              </h2>
              <form
  className="space-y-4"
  onSubmit={createContract}
>
  {/* Form fields remain the same */}
  <div>
    <label className="block text-sm font-medium mb-1">
      Renter Address
    </label>
    <input
      type="text"
      value={newContract.renter}
      onChange={(e) =>
        setNewContract({ ...newContract, renter: e.target.value })
      }
      className="w-full p-2 border rounded-md"
      placeholder="0x..."
      required
    />
  </div>
  <div>
    <label className="block text-sm font-medium mb-1">
      Validator Address
    </label>
    <input
      type="text"
      value={newContract.validator}
      onChange={(e) =>
        setNewContract({ ...newContract, validator: e.target.value })
      }
      className="w-full p-2 border rounded-md"
      placeholder="0x..."
      required
    />
  </div>
  <div>
    <label className="block text-sm font-medium mb-1">
      Deposit Amount (ETH)
    </label>
    <input
      type="number"
      value={newContract.depositAmount}
      onChange={(e) =>
        setNewContract({ ...newContract, depositAmount: e.target.value })
      }
      className="w-full p-2 border rounded-md"
      step="0.01"
      min="0"
      required
    />
  </div>
  <div>
    <label className="block text-sm font-medium mb-1">
      Validator Fee (ETH)
    </label>
    <input
      type="number"
      value={newContract.validatorFee}
      onChange={(e) =>
        setNewContract({ ...newContract, validatorFee: e.target.value })
      }
      className="w-full p-2 border rounded-md"
      step="0.01"
      min="0"
      required
    />
  </div>
  <div>
    <label className="block text-sm font-medium mb-1">
      Duration (in days)
    </label>
    <input
      type="number"
      value={newContract.duration}
      onChange={(e) =>
        setNewContract({ ...newContract, duration: e.target.value })
      }
      className="w-full p-2 border rounded-md"
      min="1"
      required
    />
  </div>
  <button
    type="submit"
    disabled={isLoading}
    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
  >
    {isLoading ? "Creating..." : "Create Contract"}
  </button>
</form>
            </div>
          )}

          {/* Contracts Sections */}
          {(role === "renter" || role === "pgOwner") && (
            <>
              <div className="bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold p-6 border-b">
                  Pending Contracts
                </h2>
                <div className="p-6">
                  {pendingContracts.length > 0 ? (
                    pendingContracts.map((c) =>
                      renderContractCard(c, "pending")
                    )
                  ) : (
                    <p className="text-gray-500">No pending contracts</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold p-6 border-b">
                  Active Contracts
                </h2>
                <div className="p-6">
                  {activeContracts.length > 0 ? (
                    activeContracts.map((c) => renderContractCard(c, "active"))
                  ) : (
                    <p className="text-gray-500">No active contracts</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold p-6 border-b">
                  Completed Contracts
                </h2>
                <div className="p-6">
                  {completedContracts.length > 0 ? (
                    completedContracts.map((c) =>
                      renderContractCard(c, "completed")
                    )
                  ) : (
                    <p className="text-gray-500">No completed contracts</p>
                  )}
                </div>
              </div>
            </>
          )}

          {role === "validator" && (
            <>
              <div className="bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold p-6 border-b">
                  Pending Validation Requests
                </h2>
                <div className="p-6">
                  {validatorPendingContracts.length > 0 ? (
                    validatorPendingContracts.map((c) =>
                      renderContractCard(c, "pending")
                    )
                  ) : (
                    <p className="text-gray-500">
                      No pending validation requests
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold p-6 border-b">
                  Completed Validations
                </h2>
                <div className="p-6">
                  {validatorCompletedContracts.length > 0 ? (
                    validatorCompletedContracts.map((c) =>
                      renderContractCard(c, "completed")
                    )
                  ) : (
                    <p className="text-gray-500">No completed validations</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderWalletConnection = () => {
    if (!window.ethereum) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="mb-4 text-xl font-semibold">
            MetaMask is not installed
          </div>
          <p className="mb-6 text-gray-600">
            Please install MetaMask to use this application
          </p>
          <a
            href="https://metamask.io/download.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Install MetaMask
          </a>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="mb-4 text-xl font-semibold">
          Welcome to Rental Platform
        </div>
        <p className="mb-6 text-gray-600">
          Please connect your wallet to continue
        </p>
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {isConnecting ? (
            <>
              <span className="inline-block animate-spin mr-2">↻</span>
              Connecting...
            </>
          ) : (
            <>
              <WalletIcon className="w-5 h-5 mr-2" />
              Connect Wallet
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}
      {!currentAccount ? renderWalletConnection() : renderDashboard()}
    </div>
  );
};

export default RentalPlatform;
