// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAPDVS is ReentrancyGuard, Ownable {
    struct RentalContract {
        address payable pgOwner;
        address payable renter;
        uint256 depositAmount;
        uint256 startDate;
        uint256 endDate;
        bool isActive;
        bool validatorRequested;
        address validator;
        bool isCompleted;
    }

    mapping(uint256 => RentalContract) public rentalContracts;
    uint256 public nextContractId;

    mapping(address => bool) public registeredValidators;
    mapping(address => uint256[]) private userContracts;
    mapping(address => uint256[]) private validatorContracts;

    event ContractCreated(uint256 indexed contractId, address pgOwner, address renter);
    event ContractSigned(uint256 indexed contractId);
    event ValidatorRequested(uint256 indexed contractId, address validator);
    event ContractCompleted(uint256 indexed contractId, uint256 renterRefund, uint256 ownerPayment);
    event ValidatorRegistered(address validator);
    event ValidatorUnregistered(address validator);
    event ContractAutoCompleted(uint256 indexed contractId);

    constructor() Ownable(msg.sender) {
        nextContractId = 1;
    }

    function createContract(
        address payable _renter,
        uint256 _depositAmount,
        uint256 _duration
    ) external {
        RentalContract storage newContract = rentalContracts[nextContractId];
        newContract.pgOwner = payable(msg.sender);
        newContract.renter = _renter;
        newContract.depositAmount = _depositAmount;
        newContract.isActive = false;
        newContract.validatorRequested = false;
        newContract.endDate = block.timestamp + _duration;

        userContracts[msg.sender].push(nextContractId);
        userContracts[_renter].push(nextContractId);

        emit ContractCreated(nextContractId, msg.sender, _renter);
        nextContractId++;
    }

    function signContract(uint256 _contractId) external payable nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.renter, "Only the renter can sign");
        require(!rentalContract.isActive, "Contract already active");
        require(msg.value == rentalContract.depositAmount, "Incorrect deposit amount");

        rentalContract.isActive = true;
        rentalContract.startDate = block.timestamp;

        emit ContractSigned(_contractId);
    }

    function requestValidator(uint256 _contractId, address _validator) external {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.pgOwner, "Only the PG owner can request a validator");
        require(rentalContract.isActive, "Contract is not active");
        require(!rentalContract.validatorRequested, "Validator already requested");
        require(registeredValidators[_validator], "Validator is not registered");
        require(block.timestamp <= rentalContract.endDate, "Contract has ended");
        
        require(_validator != rentalContract.pgOwner && _validator != rentalContract.renter, 
                "Validator cannot be part of the contract");

        rentalContract.validatorRequested = true;
        rentalContract.validator = _validator;
        validatorContracts[_validator].push(_contractId);

        emit ValidatorRequested(_contractId, _validator);
    }

    function completeContract(uint256 _contractId, uint256 _damageAmount) external nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.validator, "Only the assigned validator can complete the contract");
        require(rentalContract.isActive, "Contract is not active");
        require(!rentalContract.isCompleted, "Contract already completed");
        require(_damageAmount <= rentalContract.depositAmount, "Damage amount exceeds deposit");

        uint256 renterRefund = rentalContract.depositAmount - _damageAmount;
        rentalContract.renter.transfer(renterRefund);
        rentalContract.pgOwner.transfer(_damageAmount);

        rentalContract.isActive = false;
        rentalContract.isCompleted = true;

        emit ContractCompleted(_contractId, renterRefund, _damageAmount);
    }

    function checkAndCompleteExpiredContract(uint256 _contractId) public {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        if (rentalContract.isActive && 
            !rentalContract.isCompleted && 
            block.timestamp > rentalContract.endDate) {
            
            if (rentalContract.validatorRequested) {
                rentalContract.renter.transfer(rentalContract.depositAmount);
                rentalContract.isActive = false;
                rentalContract.isCompleted = true;
                emit ContractAutoCompleted(_contractId);
            } else {
                autoCompleteContract(_contractId);
            }
        }
    }

    function autoCompleteContract(uint256 _contractId) public nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(rentalContract.isActive, "Contract is not active");
        require(!rentalContract.isCompleted, "Contract already completed");
        require(!rentalContract.validatorRequested, "Validator has been requested");
        require(block.timestamp > rentalContract.endDate, "Contract has not ended yet");

        rentalContract.renter.transfer(rentalContract.depositAmount);
        rentalContract.isActive = false;
        rentalContract.isCompleted = true;

        emit ContractCompleted(_contractId, rentalContract.depositAmount, 0);
    }

    function getUserContracts(address _user) external view returns (
        RentalContract[] memory activeContracts,
        RentalContract[] memory completedContracts
    ) {
        uint256[] memory userContractIds = userContracts[_user];
        
        uint256 activeCount = 0;
        uint256 completedCount = 0;
        
        for (uint256 i = 0; i < userContractIds.length; i++) {
            if (rentalContracts[userContractIds[i]].isCompleted) {
                completedCount++;
            } else {
                activeCount++;
            }
        }
        
        activeContracts = new RentalContract[](activeCount);
        completedContracts = new RentalContract[](completedCount);
        
        uint256 activeIndex = 0;
        uint256 completedIndex = 0;
        
        for (uint256 i = 0; i < userContractIds.length; i++) {
            RentalContract storage currentContract = rentalContracts[userContractIds[i]];
            if (currentContract.isCompleted) {
                completedContracts[completedIndex] = currentContract;
                completedIndex++;
            } else {
                activeContracts[activeIndex] = currentContract;
                activeIndex++;
            }
        }
        
        return (activeContracts, completedContracts);
    }

    function getValidatorContracts(address _validator) external view returns (
        RentalContract[] memory activeContracts,
        RentalContract[] memory completedContracts
    ) {
        require(registeredValidators[_validator], "Not a registered validator");
        
        uint256[] memory validatorContractIds = validatorContracts[_validator];
        
        uint256 activeCount = 0;
        uint256 completedCount = 0;
        
        for (uint256 i = 0; i < validatorContractIds.length; i++) {
            if (rentalContracts[validatorContractIds[i]].isCompleted) {
                completedCount++;
            } else {
                activeCount++;
            }
        }
        
        activeContracts = new RentalContract[](activeCount);
        completedContracts = new RentalContract[](completedCount);
        
        uint256 activeIndex = 0;
        uint256 completedIndex = 0;
        
        for (uint256 i = 0; i < validatorContractIds.length; i++) {
            RentalContract storage currentContract = rentalContracts[validatorContractIds[i]];
            if (currentContract.isCompleted) {
                completedContracts[completedIndex] = currentContract;
                completedIndex++;
            } else {
                activeContracts[activeIndex] = currentContract;
                activeIndex++;
            }
        }
        
        return (activeContracts, completedContracts);
    }

    function registerValidator(address _validator) external onlyOwner {
        require(!registeredValidators[_validator], "Validator already registered");
        registeredValidators[_validator] = true;
        emit ValidatorRegistered(_validator);
    }

    function unregisterValidator(address _validator) external onlyOwner {
        require(registeredValidators[_validator], "Validator not registered");
        registeredValidators[_validator] = false;
        emit ValidatorUnregistered(_validator);
    }

    function getContractDetails(uint256 _contractId) external view returns (
        address pgOwner,
        address renter,
        uint256 depositAmount,
        uint256 startDate,
        uint256 endDate,
        bool isActive,
        bool validatorRequested,
        address validator,
        bool isCompleted
    ) {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        return (
            rentalContract.pgOwner,
            rentalContract.renter,
            rentalContract.depositAmount,
            rentalContract.startDate,
            rentalContract.endDate,
            rentalContract.isActive,
            rentalContract.validatorRequested,
            rentalContract.validator,
            rentalContract.isCompleted
        );
    }
}