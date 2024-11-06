const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DAPDVS Contract", function () {
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
    it("Should create a new rental contract with valid parameters", async function () {
      await expect(
        dapdvs.connect(pgOwner).createContract(
          renter.address,
          validator.address,
          depositAmount,
          validatorFee,
          duration
        )
      )
        .to.emit(dapdvs, "ContractCreated")
        .withArgs(1, pgOwner.address, renter.address, validator.address);

      const contract = await dapdvs.rentalContracts(1);
      expect(contract.pgOwner).to.equal(pgOwner.address);
    });

    it("Should fail when validator is same as PG owner", async function () {
      await expect(
        dapdvs.connect(pgOwner).createContract(
          renter.address,
          pgOwner.address,
          depositAmount,
          validatorFee,
          duration
        )
      ).to.be.revertedWith("Validator cannot be part of the contract");
    });

    it("Should fail when validator is same as renter", async function () {
      await expect(
        dapdvs.connect(pgOwner).createContract(
          renter.address,
          renter.address,
          depositAmount,
          validatorFee,
          duration
        )
      ).to.be.revertedWith("Validator cannot be part of the contract");
    });

    it("Should fail when validator fee is zero", async function () {
      await expect(
        dapdvs.connect(pgOwner).createContract(
          renter.address,
          validator.address,
          depositAmount,
          0,
          duration
        )
      ).to.be.revertedWith("Validator fee must be greater than 0");
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

    it("Should sign contract with exact deposit amount", async function () {
      await expect(
        dapdvs.connect(renter).signContract(1, { value: depositAmount })
      )
        .to.emit(dapdvs, "ContractSigned")
        .withArgs(1);
    });

    it("Should fail when non-renter tries to sign", async function () {
      await expect(
        dapdvs.connect(otherAccount).signContract(1, { value: depositAmount })
      ).to.be.revertedWith("Only the designated renter can sign");
    });

    it("Should fail with insufficient deposit", async function () {
      const insufficientDeposit = ethers.parseEther("0.5");
      await expect(
        dapdvs.connect(renter).signContract(1, { value: insufficientDeposit })
      ).to.be.revertedWith("Incorrect deposit amount sent");
    });

    it("Should fail with excess deposit", async function () {
      const excessDeposit = ethers.parseEther("1.5");
      await expect(
        dapdvs.connect(renter).signContract(1, { value: excessDeposit })
      ).to.be.revertedWith("Incorrect deposit amount sent");
    });
  });

  describe("Contract Rejection", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
    });

    it("Should allow PG owner to reject pending contract", async function () {
      await expect(dapdvs.connect(pgOwner).rejectContract(1))
        .to.emit(dapdvs, "ContractRejected")
        .withArgs(1, pgOwner.address);
    });

    it("Should allow renter to reject pending contract", async function () {
      await expect(dapdvs.connect(renter).rejectContract(1))
        .to.emit(dapdvs, "ContractRejected")
        .withArgs(1, renter.address);
    });

    it("Should fail when non-PG owner or renter tries to reject contract", async function () {
      await expect(
        dapdvs.connect(otherAccount).rejectContract(1)
      ).to.be.revertedWith("Only PG owner or renter can reject the contract");
    });

    it("Should fail when trying to reject an active contract", async function () {
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await expect(
        dapdvs.connect(pgOwner).rejectContract(1)
      ).to.be.revertedWith("Contract can only be rejected when pending");
    });
  });

  describe("Request Validator", function () {
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
      await expect(dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee }))
        .to.emit(dapdvs, "ValidatorRequested")
        .withArgs(1, validator.address);
      const contract = await dapdvs.rentalContracts(1);
      expect(contract.validatorRequested).to.be.true;
      // expect(await dapdvs.getContractBalance(1)).to.equal(depositAmount + validatorFee);
    });

    it("Should fail when non-PG owner tries to request validator", async function () {
      await expect(
        dapdvs.connect(renter).requestValidator(1, { value: validatorFee })
      ).to.be.revertedWith("Only the PG owner can request validator");
    });

    it("Should fail when validator fee is incorrect", async function () {
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Incorrect validator fee amount sent");
    });

    it("Should fail when contract has ended", async function () {
      await time.increase(duration + 1);
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee })
      ).to.be.revertedWith("Contract has ended");
    });
  });

  describe("Complete Contract", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
    });

    it("Should allow validator to complete contract", async function () {
      const damageAmount = ethers.parseEther("0.5");
      await expect(dapdvs.connect(validator).completeContract(1, damageAmount))
        .to.emit(dapdvs, "ContractCompleted")
        .withArgs(1, depositAmount - damageAmount, damageAmount)
        .and.to.emit(dapdvs, "ValidatorPaid")
        .withArgs(1, validator.address, validatorFee);
      const contract = await dapdvs.rentalContracts(1);
      expect(contract.state).to.equal(3);
      // expect(await dapdvs.getContractBalance(1)).to.equal(0);
    });

    it("Should fail when non-validator tries to complete contract", async function () {
      await expect(
        dapdvs.connect(otherAccount).completeContract(1, ethers.parseEther("0.5"))
      ).to.be.revertedWith("Only the assigned validator can complete");
    });

    it("Should fail when damage amount exceeds deposit", async function () {
      await expect(
        dapdvs.connect(validator).completeContract(1, depositAmount + ethers.parseEther("0.1"))
      ).to.be.revertedWith("Damage amount exceeds deposit");
    });
  });

  describe("Auto Complete Contract", function () {
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

    it("Should auto-complete contract after duration", async function () {
      await time.increase(duration + 1);
      await expect(dapdvs.connect(validator).autoCompleteContract(1))
        .to.emit(dapdvs, "ContractCompleted")
        .withArgs(1, depositAmount, 0);
      const contract = await dapdvs.rentalContracts(1);
      expect(contract.state).to.equal(3);
      // expect(await dapdvs.getContractBalance(1)).to.equal(0);
    });

    it("Should fail when validator has been requested", async function () {
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
      await time.increase(duration + 1);
      await expect(
        dapdvs.connect(validator).autoCompleteContract(1)
      ).to.be.revertedWith("Validator has been requested");
    });
  });

  describe("Get Contract Details", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
      await dapdvs.connect(validator).completeContract(1, ethers.parseEther("0.2"));
    });

    it("Should return correct contract details", async function () {
      const [
        _pgOwner,
        _renter,
        _validator,
        depositAmount,
        validatorFee,
        startDate,
        endDate,
        state,
        validatorRequested,
        validatorPaid,
        contractId
      ] = await dapdvs.getContractDetails(1);
      expect(_pgOwner).to.equal(pgOwner.address);
      expect(_renter).to.equal(renter.address);
      expect(_validator).to.equal(validator.address);
      expect(depositAmount).to.equal(depositAmount);
      expect(validatorFee).to.equal(validatorFee);
      expect(state).to.equal(3);
      expect(validatorRequested).to.be.true;
      expect(validatorPaid).to.be.true;
      expect(contractId).to.equal(1);
    });
  });

  // describe("Emergency Withdraw", function () {
  //   beforeEach(async function () {
  //     await dapdvs.connect(pgOwner).createContract(
  //       renter.address,
  //       validator.address,
  //       depositAmount,
  //       validatorFee,
  //       duration
  //     );
  //     await dapdvs.connect(renter).signContract(1, { value: depositAmount });
  //     await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
  //     await dapdvs.connect(validator).completeContract(1, ethers.parseEther("0.2"));
  //   });

  //   it("Should allow owner to withdraw stuck funds", async function () {
  //     const ownerBalance = await owner.getBalance();
  //     await dapdvs.connect(owner).emergencyWithdraw(1);
  //     expect(await owner.getBalance()).to.be.gt(ownerBalance);
  //   });

  //   it("Should fail when contract is not completed", async function () {
  //     await dapdvs.connect(pgOwner).createContract(
  //       renter.address,
  //       validator.address,
  //       depositAmount,
  //       validatorFee,
  //       duration
  //     );
  //     await dapdvs.connect(renter).signContract(2, { value: depositAmount });
  //     await expect(
  //       dapdvs.connect(owner).emergencyWithdraw(2)
  //     ).to.be.revertedWith("Contract must be completed");
  //   });

  //   it("Should fail when no balance to withdraw", async function () {
  //     await dapdvs.connect(owner).emergencyWithdraw(1);
  //     await expect(
  //       dapdvs.connect(owner).emergencyWithdraw(1)
  //     ).to.be.revertedWith("No balance to withdraw");
  //   });
  // });

});