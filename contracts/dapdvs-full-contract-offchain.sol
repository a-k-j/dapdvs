// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAPDVS is ReentrancyGuard, Ownable {
    struct RentalContract {
        address payable pgOwner;
        address payable renter;
        uint256 depositAmount;
        bytes32 contentHash;  // Hash of off-chain stored data
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

    event ContractCreated(uint256 indexed contractId, address pgOwner, address renter, bytes32 contentHash);
    event ContractSigned(uint256 indexed contractId);
    event ValidatorRequested(uint256 indexed contractId, address validator);
    event ContractCompleted(uint256 indexed contractId, uint256 renterRefund, uint256 ownerPayment);
    event ValidatorRegistered(address validator);
    event ValidatorUnregistered(address validator);

    constructor() Ownable(msg.sender) {
        nextContractId = 1;
    }


    function createContract(
        address payable _renter,
        uint256 _depositAmount,
        bytes32 _contentHash,
        uint256 _duration
    ) external {
        RentalContract storage newContract = rentalContracts[nextContractId];
        newContract.pgOwner = payable(msg.sender);
        newContract.renter = _renter;
        newContract.depositAmount = _depositAmount;
        newContract.contentHash = _contentHash;
        newContract.isActive = false;
        newContract.validatorRequested = false;
        newContract.endDate = block.timestamp + _duration;

        emit ContractCreated(nextContractId, msg.sender, _renter, _contentHash);
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

        rentalContract.validatorRequested = true;
        rentalContract.validator = _validator;

        emit ValidatorRequested(_contractId, _validator);
    }

    function completeContract(uint256 _contractId, uint256 _damageAmount, bytes32 _newContentHash) external nonReentrant {
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
        rentalContract.contentHash = _newContentHash;

        emit ContractCompleted(_contractId, renterRefund, _damageAmount);
    }

    function autoCompleteContract(uint256 _contractId) external nonReentrant {
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

    function updateContractHash(uint256 _contractId, bytes32 _newContentHash) external {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.pgOwner || msg.sender == rentalContract.renter, "Unauthorized");
        require(rentalContract.isActive, "Contract is not active");
        rentalContract.contentHash = _newContentHash;
    }

    function getContractDetails(uint256 _contractId) external view returns (
        address pgOwner,
        address renter,
        uint256 depositAmount,
        bytes32 contentHash,
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
            rentalContract.contentHash,
            rentalContract.startDate,
            rentalContract.endDate,
            rentalContract.isActive,
            rentalContract.validatorRequested,
            rentalContract.validator,
            rentalContract.isCompleted
        );
    }
}
