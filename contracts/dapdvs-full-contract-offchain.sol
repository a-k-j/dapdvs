// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAPDVS is ReentrancyGuard, Ownable {
    enum ContractState { PENDING, ACTIVE, REJECTED, COMPLETED }

    struct RentalContract {
        address payable pgOwner;
        address payable renter;
        uint256 depositAmount;
        uint256 validatorFee;
        uint256 startDate;
        uint256 endDate;
        uint256 duration;
        ContractState state;
        bool validatorRequested;
        address payable validator;
        bool validatorPaid;
        uint256 contractId;
        // uint256 contractBalance; // Track the actual balance held by the contract
    }

    mapping(uint256 => RentalContract) public rentalContracts;
    uint256 public nextContractId;

    mapping(address => uint256[]) private userContracts;
    mapping(address => uint256[]) private validatorContracts;

    event ContractCreated(uint256 indexed contractId, address pgOwner, address renter, address validator);
    event ContractSigned(uint256 indexed contractId);
    event ContractRejected(uint256 indexed contractId, address rejector);
    event ValidatorRequested(uint256 indexed contractId, address validator);
    event ContractCompleted(uint256 indexed contractId, uint256 renterRefund, uint256 ownerPayment);
    event ValidatorPaid(uint256 indexed contractId, address validator, uint256 fee);
    event PaymentReceived(uint256 indexed contractId, uint256 amount);

    constructor() Ownable(msg.sender) {
        nextContractId = 1;
    }

    function createContract(
        address payable _renter,
        address payable _validator,
        uint256 _depositAmount,
        uint256 _validatorFee,
        uint256 _duration
    ) external {
        require(_validator != msg.sender && _validator != _renter, "Validator cannot be part of the contract");
        require(_validatorFee > 0, "Validator fee must be greater than 0");

        RentalContract storage newContract = rentalContracts[nextContractId];
        newContract.pgOwner = payable(msg.sender);
        newContract.renter = _renter;
        newContract.validator = _validator;
        newContract.depositAmount = _depositAmount;
        newContract.validatorFee = _validatorFee;
        newContract.state = ContractState.PENDING;
        newContract.validatorRequested = false;
        newContract.validatorPaid = false;
        newContract.duration = _duration;
        newContract.contractId = nextContractId;

        userContracts[msg.sender].push(nextContractId);
        userContracts[_renter].push(nextContractId);

        emit ContractCreated(nextContractId, msg.sender, _renter, _validator);
        nextContractId++;
    }

    function signContract(uint256 _contractId) external payable nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.renter, "Only the designated renter can sign");
        require(rentalContract.state == ContractState.PENDING, "Contract is not in pending state");
        require(msg.value == rentalContract.depositAmount, "Incorrect deposit amount sent");
        
        rentalContract.state = ContractState.ACTIVE;
        rentalContract.startDate = block.timestamp;
        rentalContract.endDate = block.timestamp + rentalContract.duration;
        // rentalContract.contractBalance = msg.value; // Track the received balance

        emit ContractSigned(_contractId);
        emit PaymentReceived(_contractId, msg.value);
    }

    function rejectContract(uint256 _contractId) external {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.pgOwner || msg.sender == rentalContract.renter, "Only PG owner or renter can reject the contract");
        require(rentalContract.state == ContractState.PENDING, "Contract can only be rejected when pending");
        
        rentalContract.state = ContractState.REJECTED;
        
        emit ContractRejected(_contractId, msg.sender);
    }

    function requestValidator(uint256 _contractId) external payable nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.pgOwner, "Only the PG owner can request validator");
        require(rentalContract.state == ContractState.ACTIVE, "Contract is not active");
        require(!rentalContract.validatorRequested, "Validator already requested");
        require(block.timestamp <= rentalContract.endDate, "Contract has ended");
        require(msg.value == rentalContract.validatorFee, "Incorrect validator fee amount sent");

        rentalContract.validatorRequested = true;
        // rentalContract.contractBalance += msg.value;
        validatorContracts[rentalContract.validator].push(_contractId);

        emit ValidatorRequested(_contractId, rentalContract.validator);
    }

    function completeContract(uint256 _contractId, uint256 _damageAmount) external nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(msg.sender == rentalContract.validator, "Only the assigned validator can complete");
        require(rentalContract.state == ContractState.ACTIVE, "Contract is not active");
        require(rentalContract.validatorRequested, "Validator not requested");
        require(_damageAmount <= rentalContract.depositAmount, "Damage amount exceeds deposit");
        // require(rentalContract.contractBalance >= 
        //         rentalContract.depositAmount + rentalContract.validatorFee, 
        //         "Insufficient contract balance");

        uint256 renterRefund = rentalContract.depositAmount - _damageAmount;
        
        // Update state before transfers to prevent reentrancy
        rentalContract.state = ContractState.COMPLETED;
        rentalContract.validatorPaid = true;
        rentalContract.endDate = block.timestamp;
        // uint256 originalBalance = rentalContract.contractBalance;
        // rentalContract.contractBalance = 0;

        // Perform transfers after state updates
        bool successRenter = sendPayment(rentalContract.renter, renterRefund);
        require(successRenter, "Transfer to renter failed");

        bool successOwner = sendPayment(rentalContract.pgOwner, _damageAmount);
        require(successOwner, "Transfer to property owner failed");

        bool successValidator = sendPayment(rentalContract.validator, rentalContract.validatorFee);
        require(successValidator, "Transfer to validator failed");

        emit ContractCompleted(_contractId, renterRefund, _damageAmount);
        emit ValidatorPaid(_contractId, rentalContract.validator, rentalContract.validatorFee);
    }

    function autoCompleteContract(uint256 _contractId) external nonReentrant {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        require(rentalContract.state == ContractState.ACTIVE, "Contract is not active");
        require(!rentalContract.validatorRequested, "Validator has been requested");
        require(block.timestamp > rentalContract.endDate, "Contract has not ended yet");
        // require(rentalContract.contractBalance >= rentalContract.depositAmount, 
        //         "Insufficient contract balance");

        // Update state before transfer
        rentalContract.state = ContractState.COMPLETED;
        uint256 refundAmount = rentalContract.depositAmount;
        // rentalContract.contractBalance = 0;

        bool success = sendPayment(rentalContract.renter, refundAmount);
        require(success, "Transfer to renter failed");

        emit ContractCompleted(_contractId, refundAmount, 0);
    }

    function getPgOwnerContracts(address _pgOwner) external view returns (
        RentalContract[] memory pendingContracts,
        RentalContract[] memory activeContracts,
        RentalContract[] memory completedContracts
    ) {
        uint256[] memory ownerContractIds = userContracts[_pgOwner];
        
        (uint256 pendingCount, uint256 activeCount, uint256 completedCount) = countContractsByState(ownerContractIds, _pgOwner, true);
        
        pendingContracts = new RentalContract[](pendingCount);
        activeContracts = new RentalContract[](activeCount);
        completedContracts = new RentalContract[](completedCount);
        
        uint256 pendingIndex = 0;
        uint256 activeIndex = 0;
        uint256 completedIndex = 0;
        
        for (uint256 i = 0; i < ownerContractIds.length; i++) {
            RentalContract storage currentContract = rentalContracts[ownerContractIds[i]];
            if (currentContract.pgOwner != _pgOwner) continue;
            
            if (currentContract.state == ContractState.PENDING) {
                pendingContracts[pendingIndex++] = currentContract;
            } else if (currentContract.state == ContractState.ACTIVE) {
                activeContracts[activeIndex++] = currentContract;
            } else if (currentContract.state == ContractState.COMPLETED) {
                completedContracts[completedIndex++] = currentContract;
            }
        }
        
        return (pendingContracts, activeContracts, completedContracts);
    }

    function getRenterContracts(address _renter) external view returns (
        RentalContract[] memory pendingContracts,
        RentalContract[] memory activeContracts,
        RentalContract[] memory completedContracts
    ) {
        uint256[] memory renterContractIds = userContracts[_renter];
        
        (uint256 pendingCount, uint256 activeCount, uint256 completedCount) = countContractsByState(renterContractIds, _renter, false);
        
        pendingContracts = new RentalContract[](pendingCount);
        activeContracts = new RentalContract[](activeCount);
        completedContracts = new RentalContract[](completedCount);
        
        uint256 pendingIndex = 0;
        uint256 activeIndex = 0;
        uint256 completedIndex = 0;
        
        for (uint256 i = 0; i < renterContractIds.length; i++) {
            RentalContract storage currentContract = rentalContracts[renterContractIds[i]];
            if (currentContract.renter != _renter) continue;
            
            if (currentContract.state == ContractState.PENDING) {
                pendingContracts[pendingIndex++] = currentContract;
            } else if (currentContract.state == ContractState.ACTIVE) {
                activeContracts[activeIndex++] = currentContract;
            } else if (currentContract.state == ContractState.COMPLETED) {
                completedContracts[completedIndex++] = currentContract;
            }
        }
        
        return (pendingContracts, activeContracts, completedContracts);
    }

    function getValidatorContracts(address _validator) external view returns (
        RentalContract[] memory pendingValidationContracts,
        RentalContract[] memory completedValidationContracts
    ) {
        uint256[] memory validatorContractIds = validatorContracts[_validator];
        
        uint256 pendingCount = 0;
        uint256 completedCount = 0;
        
        for (uint256 i = 0; i < validatorContractIds.length; i++) {
            RentalContract storage rentalContract = rentalContracts[validatorContractIds[i]];
            if (rentalContract.validator != _validator) continue;
            
            if (rentalContract.validatorRequested && !rentalContract.validatorPaid) {
                pendingCount++;
            } else if (rentalContract.validatorPaid) {
                completedCount++;
            }
        }
        
        pendingValidationContracts = new RentalContract[](pendingCount);
        completedValidationContracts = new RentalContract[](completedCount);
        
        uint256 pendingIndex = 0;
        uint256 completedIndex = 0;
        
        for (uint256 i = 0; i < validatorContractIds.length; i++) {
            RentalContract storage currentContract = rentalContracts[validatorContractIds[i]];
            if (currentContract.validator != _validator) continue;
            
            if (currentContract.validatorRequested && !currentContract.validatorPaid) {
                pendingValidationContracts[pendingIndex++] = currentContract;
            } else if (currentContract.validatorPaid) {
                completedValidationContracts[completedIndex++] = currentContract;
            }
        }
        
        return (pendingValidationContracts, completedValidationContracts);
    }

    function countContractsByState(
        uint256[] memory contractIds,
        address user,
        bool isPgOwner
    ) private view returns (
        uint256 pendingCount,
        uint256 activeCount,
        uint256 completedCount
    ) {
        for (uint256 i = 0; i < contractIds.length; i++) {
            RentalContract storage currentContract = rentalContracts[contractIds[i]];
            if ((isPgOwner && currentContract.pgOwner != user) || (!isPgOwner && currentContract.renter != user)) {
                continue;
            }
            
            if (currentContract.state == ContractState.PENDING) {
                pendingCount++;
            } else if (currentContract.state == ContractState.ACTIVE) {
                activeCount++;
            } else if (currentContract.state == ContractState.COMPLETED) {
                completedCount++;
            }
        }
        return (pendingCount, activeCount, completedCount);
    }

    function getContractDetails(uint256 _contractId) external view returns (
        address pgOwner,
        address renter,
        address validator,
        uint256 depositAmount,
        uint256 validatorFee,
        uint256 startDate,
        uint256 endDate,
        ContractState state,
        bool validatorRequested,
        bool validatorPaid,
        uint256 contractId
    ) {
        RentalContract storage rentalContract = rentalContracts[_contractId];
        return (
            rentalContract.pgOwner,
            rentalContract.renter,
            rentalContract.validator,
            rentalContract.depositAmount,
            rentalContract.validatorFee,
            rentalContract.startDate,
            rentalContract.endDate,
            rentalContract.state,
            rentalContract.validatorRequested,
            rentalContract.validatorPaid,
            rentalContract.contractId
        );
    }

    function sendPayment(address payable recipient, uint256 amount) private returns (bool) {
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        
        (bool success, ) = recipient.call{value: amount}("");
        return success;
    }

    // // Add function to verify contract balance
    // function getContractBalance(uint256 _contractId) external view returns (uint256) {
    //     return rentalContracts[_contractId].contractBalance;
    // }

    // // Add emergency withdrawal function for stuck funds (only owner)
    // function emergencyWithdraw(uint256 _contractId) external onlyOwner {
    //     RentalContract storage rentalContract = rentalContracts[_contractId];
    //     require(rentalContract.state == ContractState.COMPLETED, "Contract must be completed");
    //     // require(rentalContract.contractBalance > 0, "No balance to withdraw");

    //     uint256 amount = rentalContract.contractBalance;
    //     rentalContract.contractBalance = 0;
        
    //     (bool success, ) = payable(owner()).call{value: amount}("");
    //     require(success, "Emergency withdrawal failed");
    // }
}