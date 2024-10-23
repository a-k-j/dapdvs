// // // src/App.js
// // import PGOwnerDashboard from './components/PGOwnerDashboard';
// // import RenterDashboard from './components/RenterDashboard';
// // import ValidatorDashboard from './components/ValidatorDashboard';
// // import ContractABI from './ContractABI.json';
// // import React, { useState, useEffect } from 'react';
// // const { ethers } = require("hardhat");

// // const CONTRACT_ADDRESS = '0xe133D872fdF7B5cCE30Af887080bC82Fec493cb5';

// // function App() {
// //   const [account, setAccount] = useState(null);
// //   const [contract, setContract] = useState(null);
// //   const [userRole, setUserRole] = useState(null);

// //   useEffect(() => {
// //     const init = async () => {
// //       if (typeof window.ethereum !== 'undefined') {
// //         try {
// //           // Request account access
// //           await window.ethereum.request({ method: 'eth_requestAccounts' });
// //           const provider = new ethers.providers.Web3Provider(window.ethereum);
// //           const signer = provider.getSigner();
// //           const address = await signer.getAddress();
// //           setAccount(address);

// //           const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, ContractABI, signer);
// //           setContract(contractInstance);

// //           // Determine user role (this is a simplified example, you might need a more complex logic)
// //           const isValidator = await contractInstance.registeredValidators(address);
// //           if (isValidator) {
// //             setUserRole('validator');
// //           } else {
// //             // For simplicity, we're assuming non-validators are either PG Owners or Renters
// //             // You might need to implement a more sophisticated role determination logic
// //             setUserRole('pgowner'); // or 'renter'
// //           }
// //         } catch (error) {
// //           console.error('Failed to connect to MetaMask', error);
// //         }
// //       } else {
// //         console.log('Please install MetaMask!');
// //       }
// //     };

// //     init();
// //   }, []);

// //   if (!account) {
// //     return <div>Please connect your MetaMask wallet.</div>;
// //   }

// //   return (
// //     <div className="App">
// //       <h1>DAPDVS Dashboard</h1>
// //       <p>Connected Account: {account}</p>
// //       {userRole === 'pgowner' && <PGOwnerDashboard contract={contract} account={account} />}
// //       {userRole === 'renter' && <RenterDashboard contract={contract} account={account} />}
// //       {userRole === 'validator' && <ValidatorDashboard contract={contract} account={account} />}
// //     </div>
// //   );
// // }

// // export default App;


// // import React, { useState, useEffect } from 'react';
// // import RenterDashboard from './components/RenterDashboard';


// // const HomePage = () => {
// //   const [isLoggedIn, setIsLoggedIn] = useState(false);
// //   const [account, setAccount] = useState(null);
// //   const [error, setError] = useState(null);

// //   useEffect(() => {
// //     checkIfWalletIsConnected();
// //   }, []);

// //   const checkIfWalletIsConnected = async () => {
// //     try {
// //       if (window.ethereum) {
// //         const accounts = await window.ethereum.request({ method: 'eth_accounts' });
// //         if (accounts.length > 0) {
// //           setAccount(accounts[0]);
// //           setIsLoggedIn(true);
// //         }
// //       } else {
// //         setError('Please install MetaMask to use this application.');
// //       }
// //     } catch (error) {
// //       console.error('Error checking wallet connection:', error);
// //       setError('An error occurred while checking your wallet connection.');
// //     }
// //   };

// //   const handleLogin = async () => {
// //     try {
// //       if (window.ethereum) {
// //         await window.ethereum.request({ method: 'eth_requestAccounts' });
// //         const accounts = await window.ethereum.request({ method: 'eth_accounts' });
// //         setAccount(accounts[0]);
// //         setIsLoggedIn(true);
// //         setError(null);
// //       } else {
// //         setError('Please install MetaMask to use this application.');
// //       }
// //     } catch (error) {
// //       console.error('Error connecting to MetaMask:', error);
// //       setError('An error occurred while connecting to MetaMask.');
// //     }
// //   };

// //   const handleRoleSelect = (role) => {
// //     // In a real application, you would redirect to the appropriate dashboard here
// //     console.log(`Entering dashboard as ${role} with account ${account}`);
// //   };

// //   const buttonStyle = {
// //     padding: '10px 20px',
// //     fontSize: '16px',
// //     cursor: 'pointer',
// //     backgroundColor: '#4CAF50',
// //     color: 'white',
// //     border: 'none',
// //     borderRadius: '5px',
// //     marginBottom: '10px',
// //     width: '100%',
// //   };

// //   const cardStyle = {
// //     width: '300px',
// //     padding: '20px',
// //     boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2)',
// //     borderRadius: '5px',
// //     backgroundColor: 'white',
// //   };

// //   if (!isLoggedIn) {
// //     return (
// //       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
// //         <div style={cardStyle}>
// //           <h2 style={{ textAlign: 'center' }}>Welcome to DAPDVS</h2>
// //           <p style={{ textAlign: 'center', marginBottom: '20px' }}>Decentralized Apartment PG Digital Verification System</p>
// //           <button onClick={handleLogin} style={buttonStyle}>
// //             Connect with MetaMask
// //           </button>
// //           {error && (
// //             <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>
// //           )}
// //         </div>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
// //       <div style={cardStyle}>
// //         <h2 style={{ textAlign: 'center' }}>Choose Your Role</h2>
// //         <p style={{ textAlign: 'center', marginBottom: '20px' }}>Select how you want to enter the dashboard</p>
// //         <button onClick={() => handleRoleSelect('renter')} style={buttonStyle}>
// //           Enter as Renter
// //         </button>
// //         <button onClick={() => handleRoleSelect('pgOwner')} style={buttonStyle}>
// //           Enter as PG Owner
// //         </button>
// //         <button onClick={() => handleRoleSelect('validator')} style={buttonStyle}>
// //           Enter as Validator
// //         </button>
// //         <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
// //           Connected: {account && `${account.slice(0, 6)}...${account.slice(-4)}`}
// //         </p>
// //       </div>
// //     </div>
// //   );
// // };

// // export default HomePage;













// import React, { useState, useEffect } from 'react';
// import { BrowserRouter as Router, Route, Routes, Link, Navigate } from 'react-router-dom';
// import RenterDashboard from './components/RenterDashboard';

// const CONTRACT_ADDRESS = '0xe133D872fdF7B5cCE30Af887080bC82Fec493cb5';

// function App() {
//   const [isLoggedIn, setIsLoggedIn] = useState(false);
//   const [account, setAccount] = useState(null);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     checkIfWalletIsConnected();
//   }, []);

//   const checkIfWalletIsConnected = async () => {
//     try {
//       if (window.ethereum) {
//         const accounts = await window.ethereum.request({ method: 'eth_accounts' });
//         if (accounts.length > 0) {
//           setAccount(accounts[0]);
//           setIsLoggedIn(true);
//         }
//       } else {
//         setError('Please install MetaMask to use this application.');
//       }
//     } catch (error) {
//       console.error('Error checking wallet connection:', error);
//       setError('An error occurred while checking your wallet connection.');
//     }
//   };

//   const handleLogin = async () => {
//     try {
//       if (window.ethereum) {
//         await window.ethereum.request({ method: 'eth_requestAccounts' });
//         const accounts = await window.ethereum.request({ method: 'eth_accounts' });
//         setAccount(accounts[0]);
//         setIsLoggedIn(true);
//         setError(null);
//       } else {
//         setError('Please install MetaMask to use this application.');
//       }
//     } catch (error) {
//       console.error('Error connecting to MetaMask:', error);
//       setError('An error occurred while connecting to MetaMask.');
//     }
//   };

//   const buttonStyle = {
//     padding: '10px 20px',
//     fontSize: '16px',
//     cursor: 'pointer',
//     backgroundColor: '#4CAF50',
//     color: 'white',
//     border: 'none',
//     borderRadius: '5px',
//     marginBottom: '10px',
//     width: '100%',
//   };

//   const cardStyle = {
//     width: '300px',
//     padding: '20px',
//     boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2)',
//     borderRadius: '5px',
//     backgroundColor: 'white',
//   };

//   const HomePage = () => (
//     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
//       <div style={cardStyle}>
//         <h2 style={{ textAlign: 'center' }}>Choose Your Role</h2>
//         <p style={{ textAlign: 'center', marginBottom: '20px' }}>Select how you want to enter the dashboard</p>
//         <Link to="/renter" style={{ textDecoration: 'none' }}>
//           <button style={buttonStyle}>Enter as Renter</button>
//         </Link>
//         <button style={buttonStyle} disabled>Enter as PG Owner</button>
//         <button style={buttonStyle} disabled>Enter as Validator</button>
//         <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
//           Connected: {account && `${account.slice(0, 6)}...${account.slice(-4)}`}
//         </p>
//       </div>
//     </div>
//   );

//   if (!isLoggedIn) {
//     return (
//       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
//         <div style={cardStyle}>
//           <h2 style={{ textAlign: 'center' }}>Welcome to DAPDVS</h2>
//           <p style={{ textAlign: 'center', marginBottom: '20px' }}>Decentralized Apartment PG Digital Verification System</p>
//           <button onClick={handleLogin} style={buttonStyle}>
//             Connect with MetaMask
//           </button>
//           {error && (
//             <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>
//           )}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={<HomePage />} />
//         <Route 
//           path="/renter" 
//           element={
//             isLoggedIn ? 
//             <RenterDashboard account={account} contractAddress={CONTRACT_ADDRESS} /> : 
//             <Navigate to="/" replace />
//           } 
//         />
//         {/* Add more routes for PG Owner and Validator dashboards when they're ready */}
//       </Routes>
//     </Router>
//   );
// }

// export default App;

import React from 'react';
import SignUp from './components/SignUp';

const App = () => {
  // In your App component
  const handleSignUp = (role, address) => {
    // Here you would typically interact with your smart contract
    // to register the user with their selected role and address
    console.log(`User signed up as ${role} with address ${address}`);
    // Update app state, redirect to dashboard, etc.
  };

  // // In your JSX
  // <SignUp onSignUp={handleSignUp} />

    return (
    <div>
      {/* Pass the handleSignUp function to the SignUp component via props */}
      <SignUp onSignUp={handleSignUp} />
    </div>
  );

};

export default App;
