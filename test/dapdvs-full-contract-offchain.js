const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DAPDVS", function () {
  let DAPDVS;
  let dapdvs;
  let owner;
  let pgOwner;
  let renter;
  let validator;
  let otherAccount;

  const depositAmount = ethers.parseEther("1");
  const validatorFee = ethers.parseEther("0.1");
  const duration = 86400; // 1 day in seconds

  beforeEach(async function () {
    [owner, pgOwner, renter, validator, otherAccount] = await ethers.getSigners();
    DAPDVS = await ethers.getContractFactory("DAPDVS");
    dapdvs = await DAPDVS.deploy();
    await dapdvs.waitForDeployment();
  });

  describe("Contract Creation", function () {
    it("Should create a new rental contract", async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      const contractId = 1;
      const contract = await dapdvs.rentalContracts(contractId);

      expect(contract.pgOwner).to.equal(pgOwner.address);
      expect(contract.renter).to.equal(renter.address);
      expect(contract.validator).to.equal(validator.address);
      expect(contract.depositAmount).to.equal(depositAmount);
      expect(contract.validatorFee).to.equal(validatorFee);
      expect(contract.state).to.equal(0); // PENDING
    });

    it("Should not allow validator to be part of the contract", async function () {
      await expect(
        dapdvs.connect(pgOwner).createContract(
          validator.address, // renter same as validator
          validator.address,
          depositAmount,
          validatorFee,
          duration
        )
      ).to.be.revertedWith("Validator cannot be part of the contract");
    });
  });

  describe("Contract Signing", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
    });

    it("Should allow renter to sign contract with correct deposit", async function () {
      await expect(
        dapdvs.connect(renter).signContract(1, { value: depositAmount })
      ).to.not.be.reverted;

      const contract = await dapdvs.rentalContracts(1);
      expect(contract.state).to.equal(1); // ACTIVE
    });

    it("Should not allow signing with incorrect deposit amount", async function () {
      const incorrectDeposit = ethers.parseEther("0.5");
      await expect(
        dapdvs.connect(renter).signContract(1, { value: incorrectDeposit })
      ).to.be.revertedWith("Incorrect deposit amount");
    });
  });

  describe("Validator Request and Completion", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
    });

    it("Should allow PG owner to request validator", async function () {
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee })
      ).to.not.be.reverted;

      const contract = await dapdvs.rentalContracts(1);
      expect(contract.validatorRequested).to.be.true;
    });

    it("Should allow validator to complete contract with damage assessment", async function () {
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
      const damageAmount = ethers.parseEther("0.3");

      const initialPgOwnerBalance = await ethers.provider.getBalance(pgOwner.address);
      const initialRenterBalance = await ethers.provider.getBalance(renter.address);
      const initialValidatorBalance = await ethers.provider.getBalance(validator.address);

      await dapdvs.connect(validator).completeContract(1, damageAmount);

      const contract = await dapdvs.rentalContracts(1);
      expect(contract.state).to.equal(3); // COMPLETED
      expect(contract.validatorPaid).to.be.true;

      // Check balances were updated correctly
      const finalPgOwnerBalance = await ethers.provider.getBalance(pgOwner.address);
      const finalRenterBalance = await ethers.provider.getBalance(renter.address);
      const finalValidatorBalance = await ethers.provider.getBalance(validator.address);

      expect(finalPgOwnerBalance).to.be.gt(initialPgOwnerBalance);
      expect(finalRenterBalance).to.be.gt(initialRenterBalance);
      expect(finalValidatorBalance).to.be.gt(initialValidatorBalance);
    });
  });

  describe("Auto-Complete Contract", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
    });

    it("Should auto-complete contract after end date if validator not requested", async function () {
      await time.increase(duration + 1);

      const initialRenterBalance = await ethers.provider.getBalance(renter.address);
      
      await dapdvs.autoCompleteContract(1);

      const contract = await dapdvs.rentalContracts(1);
      expect(contract.state).to.equal(3); // COMPLETED

      const finalRenterBalance = await ethers.provider.getBalance(renter.address);
      expect(finalRenterBalance).to.be.gt(initialRenterBalance);
    });

    it("Should not auto-complete if validator was requested", async function () {
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
      await time.increase(duration + 1);

      await expect(
        dapdvs.autoCompleteContract(1)
      ).to.be.revertedWith("Validator has been requested");
    });
  });

  describe("Contract Queries", function () {
    beforeEach(async function () {
      // Create multiple contracts with different states
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
    });

    it("Should return correct PG owner contracts", async function () {
      const [pending, active, completed] = await dapdvs.getPgOwnerContracts(pgOwner.address);
      
      expect(pending.length).to.equal(1);
      expect(active.length).to.equal(1);
      expect(completed.length).to.equal(0);
    });

    it("Should return correct renter contracts", async function () {
      const [pending, active, completed] = await dapdvs.getRenterContracts(renter.address);
      
      expect(pending.length).to.equal(1);
      expect(active.length).to.equal(1);
      expect(completed.length).to.equal(0);
    });

    it("Should return correct validator contracts", async function () {
      const [pending, completed] = await dapdvs.getValidatorContracts(validator.address);
      
      expect(pending.length).to.equal(0);
      expect(completed.length).to.equal(0);
    });
  });

  describe("Contract Details", function () {
    it("Should return correct contract details", async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      const [
        retPgOwner,
        retRenter,
        retValidator,
        retDepositAmount,
        retValidatorFee,
        retStartDate,
        retEndDate,
        retState,
        retValidatorRequested,
        retValidatorPaid
      ] = await dapdvs.getContractDetails(1);

      expect(retPgOwner).to.equal(pgOwner.address);
      expect(retRenter).to.equal(renter.address);
      expect(retValidator).to.equal(validator.address);
      expect(retDepositAmount).to.equal(depositAmount);
      expect(retValidatorFee).to.equal(validatorFee);
      expect(retState).to.equal(0); // PENDING
      expect(retValidatorRequested).to.be.false;
      expect(retValidatorPaid).to.be.false;
    });
  });
});