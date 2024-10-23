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
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Initial contract details"));
    const duration = 30 * 24 * 60 * 60; // 30 days

    await dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, contentHash, duration);
    contractId = 1;

    // Sign the contract
    await dapdvs.connect(renter).signContract(contractId, { value: depositAmount });
  });

  describe("Contract Creation and Signing", function () {
    it("Should create a rental contract", async function () {
      const depositAmount = ethers.parseEther("1");
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("New contract details"));
      const duration = 30 * 24 * 60 * 60; // 30 days

      await expect(dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, contentHash, duration))
        .to.emit(dapdvs, "ContractCreated")
        .withArgs(2, pgOwner.address, renter.address, contentHash);
    });

    it("Should allow renter to sign the contract", async function () {
      const depositAmount = ethers.parseEther("1");
      const newContractId = 2;

      // Create a new contract for this test
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("New contract details"));
      const duration = 30 * 24 * 60 * 60; // 30 days
      await dapdvs.connect(pgOwner).createContract(renter.address, depositAmount, contentHash, duration);

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

    it("Should allow validator to complete the contract", async function () {
      await dapdvs.connect(pgOwner).requestValidator(contractId, validator.address);

      const damageAmount = ethers.parseEther("0.5");
      const newContentHash = ethers.keccak256(ethers.toUtf8Bytes("Updated contract details"));

      await expect(dapdvs.connect(validator).completeContract(contractId, damageAmount, newContentHash))
        .to.emit(dapdvs, "ContractCompleted");

      const contract = await dapdvs.rentalContracts(contractId);
      expect(contract.isActive).to.be.false;
      expect(contract.isCompleted).to.be.true;
      expect(contract.contentHash).to.equal(newContentHash);
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

  describe("Contract Hash Update", function () {
    it("Should allow PG owner or renter to update contract hash", async function () {
      const newContentHash = ethers.keccak256(ethers.toUtf8Bytes("Updated off-chain data"));

      await expect(dapdvs.connect(pgOwner).updateContractHash(contractId, newContentHash))
        .to.not.be.reverted;

      let contract = await dapdvs.rentalContracts(contractId);
      expect(contract.contentHash).to.equal(newContentHash);

      const newerContentHash = ethers.keccak256(ethers.toUtf8Bytes("Newer off-chain data"));

      await expect(dapdvs.connect(renter).updateContractHash(contractId, newerContentHash))
        .to.not.be.reverted;

      contract = await dapdvs.rentalContracts(contractId);
      expect(contract.contentHash).to.equal(newerContentHash);
    });
  });

  describe("Contract Details Retrieval", function () {
    it("Should return correct contract details", async function () {
      const details = await dapdvs.getContractDetails(contractId);

      expect(details.pgOwner).to.equal(pgOwner.address);
      expect(details.renter).to.equal(renter.address);
      expect(details.isActive).to.be.true; // Contract is now signed in beforeEach
      // Add more assertions for other contract details
    });
  });
});