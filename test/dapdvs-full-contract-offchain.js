const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DAPDVS", function () {
  let DAPDVS, dapdvs, owner, pgOwner, renter, validator, addr1;
  let contractId;

  beforeEach(async function () {
    DAPDVS = await ethers.getContractFactory("DAPDVS");
    [owner, pgOwner, renter, validator, addr1] = await ethers.getSigners();
    
    dapdvs = await DAPDVS.deploy();
    await dapdvs.waitForDeployment();

    await dapdvs.registerValidator(validator.address);

    // Create a contract before each test
    const depositAmount = ethers.parseEther("1");
    const duration = 30 * 24 * 60 * 60; // 30 days

    await dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, duration);
    contractId = 1;

    // Sign the contract
    await dapdvs.connect(renter).signContract(contractId, { value: depositAmount });
  });

  describe("Contract Creation and Signing", function () {
    it("Should create a rental contract", async function () {
      const depositAmount = ethers.parseEther("1");
      const duration = 30 * 24 * 60 * 60; // 30 days

      await expect(dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, duration))
        .to.emit(dapdvs, "ContractCreated")
        .withArgs(2, pgOwner.address, renter.address);
    });

    it("Should allow renter to sign the contract", async function () {
      const depositAmount = ethers.parseEther("1");
      const newContractId = 2;

      // Create a new contract for this test
      const duration = 30 * 24 * 60 * 60; // 30 days
      await dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, duration);

      await expect(dapdvs.connect(renter).signContract(newContractId, { value: depositAmount }))
        .to.emit(dapdvs, "ContractSigned")
        .withArgs(newContractId);

      const contract = await dapdvs.rentalContracts(newContractId);
      expect(contract.isActive).to.be.true;
    });
  });

  describe("Validator Operations", function () {
    it("Should allow PG owner to request a validator", async function () {
      await expect(dapdvs.connect(pgOwner).requestValidator(contractId, validator.address))
        .to.emit(dapdvs, "ValidatorRequested")
        .withArgs(contractId, validator.address);

      const contract = await dapdvs.rentalContracts(contractId);
      expect(contract.validatorRequested).to.be.true;
      expect(contract.validator).to.equal(validator.address);
    });

    it("Should not allow contract participant to be validator", async function () {
      // Try to request PG owner as validator
      await dapdvs.registerValidator(pgOwner.address);
      await expect(
        dapdvs.connect(pgOwner).requestValidator(contractId, pgOwner.address)
      ).to.be.revertedWith("Validator cannot be part of the contract");

      // Try to request renter as validator
      await dapdvs.registerValidator(renter.address);
      await expect(
        dapdvs.connect(pgOwner).requestValidator(contractId, renter.address)
      ).to.be.revertedWith("Validator cannot be part of the contract");
    });

    it("Should allow validator to complete the contract", async function () {
      await dapdvs.connect(pgOwner).requestValidator(contractId, validator.address);

      const damageAmount = ethers.parseEther("0.5");

      await expect(dapdvs.connect(validator).completeContract(contractId, damageAmount))
        .to.emit(dapdvs, "ContractCompleted");

      const contract = await dapdvs.rentalContracts(contractId);
      expect(contract.isActive).to.be.false;
      expect(contract.isCompleted).to.be.true;
    });
  });

  describe("Auto-completion", function () {
    it("Should auto-complete contract after end date if no validator requested", async function () {
      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]); // 31 days
      await ethers.provider.send("evm_mine");

      await expect(dapdvs.connect(addr1).autoCompleteContract(contractId))
        .to.emit(dapdvs, "ContractCompleted");

      const contract = await dapdvs.rentalContracts(contractId);
      expect(contract.isActive).to.be.false;
      expect(contract.isCompleted).to.be.true;
    });

    it("Should auto-complete contract with validator after end date", async function () {
      await dapdvs.connect(pgOwner).requestValidator(contractId, validator.address);

      // Fast-forward time
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]); // 31 days
      await ethers.provider.send("evm_mine");

      await expect(dapdvs.connect(addr1).checkAndCompleteExpiredContract(contractId))
        .to.emit(dapdvs, "ContractAutoCompleted");

      const contract = await dapdvs.rentalContracts(contractId);
      expect(contract.isActive).to.be.false;
      expect(contract.isCompleted).to.be.true;
    });
  });

  describe("Contract Retrieval Functions", function () {
    beforeEach(async function () {
      // Create additional contracts for testing retrieval
      const depositAmount = ethers.parseEther("1");
      const duration = 30 * 24 * 60 * 60;

      // Create another contract with same PG owner
      await dapdvs.connect(pgOwner).createContract(addr1.address, depositAmount, duration);
      await dapdvs.connect(addr1).signContract(2, { value: depositAmount });

      // Create a contract and complete it
      await dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, duration);
      await dapdvs.connect(renter).signContract(3, { value: depositAmount });
      await dapdvs.connect(pgOwner).requestValidator(3, validator.address);
      await dapdvs.connect(validator).completeContract(3, 0);
    });

    it("Should retrieve all user contracts correctly", async function () {
      const [activeContracts, completedContracts] = await dapdvs.getUserContracts(pgOwner.address);
      
      expect(activeContracts.length).to.equal(2); // Contracts 1 and 2
      expect(completedContracts.length).to.equal(1); // Contract 3

      // Verify active contracts
      expect(activeContracts[0].renter).to.equal(renter.address);
      expect(activeContracts[1].renter).to.equal(addr1.address);

      // Verify completed contracts
      expect(completedContracts[0].isCompleted).to.be.true;
    });

    it("Should retrieve all validator contracts correctly", async function () {
      const [activeContracts, completedContracts] = await dapdvs.getValidatorContracts(validator.address);
      
      expect(activeContracts.length).to.equal(0);
      expect(completedContracts.length).to.equal(1);

      // Verify completed validator contracts
      expect(completedContracts[0].isCompleted).to.be.true;
      expect(completedContracts[0].validator).to.equal(validator.address);
    });

    it("Should not allow unregistered validator to fetch contracts", async function () {
      await expect(
        dapdvs.getValidatorContracts(addr1.address)
      ).to.be.revertedWith("Not a registered validator");
    });
  });

  describe("Validator Management", function () {
    it("Should allow owner to register and unregister validators", async function () {
      await expect(dapdvs.connect(owner).registerValidator(addr1.address))
        .to.emit(dapdvs, "ValidatorRegistered")
        .withArgs(addr1.address);

      expect(await dapdvs.registeredValidators(addr1.address)).to.be.true;

      await expect(dapdvs.connect(owner).unregisterValidator(addr1.address))
        .to.emit(dapdvs, "ValidatorUnregistered")
        .withArgs(addr1.address);

      expect(await dapdvs.registeredValidators(addr1.address)).to.be.false;
    });
  });

  describe("Contract Details Retrieval", function () {
    it("Should return correct contract details", async function () {
      const details = await dapdvs.getContractDetails(contractId);

      expect(details.pgOwner).to.equal(pgOwner.address);
      expect(details.renter).to.equal(renter.address);
      expect(details.isActive).to.be.true;
      expect(details.validatorRequested).to.be.false;
      expect(details.isCompleted).to.be.false;
    });
  });
});