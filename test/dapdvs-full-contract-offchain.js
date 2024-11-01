const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DAPDVS Comprehensive Tests", function () {
  let DAPDVS;
  let dapdvs;
  let owner;
  let pgOwner;
  let renter;
  let validator;
  let otherAccount;
  let anotherValidator;

  const depositAmount = ethers.parseEther("1");
  const validatorFee = ethers.parseEther("0.1");
  const duration = 86400; // 1 day in seconds
  const zeroDuration = 0;
  const smallDuration = 300; // 5 minutes

  beforeEach(async function () {
    [owner, pgOwner, renter, validator, otherAccount, anotherValidator] = await ethers.getSigners();
    DAPDVS = await ethers.getContractFactory("DAPDVS");
    dapdvs = await DAPDVS.deploy();
    await dapdvs.waitForDeployment();
  });

  describe("Contract Creation - All Scenarios", function () {
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

    it("Should create multiple contracts for the same PG owner", async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(pgOwner).createContract(
        otherAccount.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      const [pending, active, completed] = await dapdvs.getPgOwnerContracts(pgOwner.address);
      expect(pending.length).to.equal(2);
    });

    it("Should create multiple contracts for the same renter", async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(otherAccount).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      const [pending, active, completed] = await dapdvs.getRenterContracts(renter.address);
      expect(pending.length).to.equal(2);
    });
  });

  describe("Contract Signing - All Scenarios", function () {
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
      ).to.be.revertedWith("Incorrect deposit amount");
    });

    it("Should fail with excess deposit", async function () {
      const excessDeposit = ethers.parseEther("1.5");
      await expect(
        dapdvs.connect(renter).signContract(1, { value: excessDeposit })
      ).to.be.revertedWith("Incorrect deposit amount");
    });

    it("Should fail when contract is already signed", async function () {
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await expect(
        dapdvs.connect(renter).signContract(1, { value: depositAmount })
      ).to.be.revertedWith("Contract is not in pending state");
    });

    it("Should fail when contract has expired", async function () {
      await time.increase(duration + 1);
      await expect(
        dapdvs.connect(renter).signContract(1, { value: depositAmount })
      ).to.be.revertedWith("Contract has expired");
    });
  });

  describe("Contract Expiration - All Scenarios", function () {
    beforeEach(async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
    });

    it("Should allow renter to expire pending contract", async function () {
      await expect(dapdvs.connect(renter).expireContract(1))
        .to.emit(dapdvs, "ContractExpired")
        .withArgs(1);
    });

    it("Should not allow PG owner to expire contract", async function () {
      await expect(
        dapdvs.connect(pgOwner).expireContract(1)
      ).to.be.revertedWith("Only the renter can expire the contract");
    });

    it("Should not allow expiring non-pending contract", async function () {
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await expect(
        dapdvs.connect(renter).expireContract(1)
      ).to.be.revertedWith("Contract must be pending");
    });
  });

  describe("Validator Request - All Scenarios", function () {
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

    it("Should request validator with correct fee", async function () {
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee })
      )
        .to.emit(dapdvs, "ValidatorRequested")
        .withArgs(1, validator.address);
    });

    it("Should fail when non-PG owner requests validator", async function () {
      await expect(
        dapdvs.connect(otherAccount).requestValidator(1, { value: validatorFee })
      ).to.be.revertedWith("Only the PG owner can request validator");
    });

    it("Should fail with incorrect validator fee", async function () {
      const incorrectFee = ethers.parseEther("0.05");
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: incorrectFee })
      ).to.be.revertedWith("Incorrect validator fee");
    });

    it("Should fail when validator already requested", async function () {
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee })
      ).to.be.revertedWith("Validator already requested");
    });

    it("Should fail when contract has ended", async function () {
      await time.increase(duration + 1);
      await expect(
        dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee })
      ).to.be.revertedWith("Contract has ended");
    });
  });

  describe("Contract Completion - All Scenarios", function () {
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

    it("Should complete contract with zero damage", async function () {
      const damageAmount = ethers.parseEther("0");
      await expect(dapdvs.connect(validator).completeContract(1, damageAmount))
        .to.emit(dapdvs, "ContractCompleted")
        .withArgs(1, depositAmount, damageAmount);
    });

    it("Should complete contract with partial damage", async function () {
      const damageAmount = ethers.parseEther("0.5");
      await expect(dapdvs.connect(validator).completeContract(1, damageAmount))
        .to.emit(dapdvs, "ContractCompleted")
        .withArgs(1, depositAmount - damageAmount, damageAmount);
    });

    it("Should complete contract with full damage", async function () {
      await expect(dapdvs.connect(validator).completeContract(1, depositAmount))
        .to.emit(dapdvs, "ContractCompleted")
        .withArgs(1, 0, depositAmount);
    });

    it("Should fail when non-validator tries to complete", async function () {
      await expect(
        dapdvs.connect(otherAccount).completeContract(1, 0)
      ).to.be.revertedWith("Only the assigned validator can complete");
    });

    it("Should fail with excessive damage amount", async function () {
      const excessiveDamage = depositAmount + ethers.parseEther("0.1");
      await expect(
        dapdvs.connect(validator).completeContract(1, excessiveDamage)
      ).to.be.revertedWith("Damage amount exceeds deposit");
    });

    it("Should fail when completing already completed contract", async function () {
      await dapdvs.connect(validator).completeContract(1, 0);
      await expect(
        dapdvs.connect(validator).completeContract(1, 0)
      ).to.be.revertedWith("Contract is not active");
    });
  });

  describe("Auto-Complete Contract - All Scenarios", function () {
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

    it("Should auto-complete after end date with no validator request", async function () {
      await time.increase(duration + 1);
      await expect(dapdvs.autoCompleteContract(1))
        .to.emit(dapdvs, "ContractCompleted")
        .withArgs(1, depositAmount, 0);
    });

    it("Should fail auto-complete before end date", async function () {
      await expect(
        dapdvs.autoCompleteContract(1)
      ).to.be.revertedWith("Contract has not ended yet");
    });

    it("Should fail auto-complete when validator requested", async function () {
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });
      await time.increase(duration + 1);
      await expect(
        dapdvs.autoCompleteContract(1)
      ).to.be.revertedWith("Validator has been requested");
    });

    it("Should fail auto-complete for already completed contract", async function () {
      await time.increase(duration + 1);
      await dapdvs.autoCompleteContract(1);
      await expect(
        dapdvs.autoCompleteContract(1)
      ).to.be.revertedWith("Contract is not active");
    });
  });

  describe("Query Functions - All Scenarios", function () {
    beforeEach(async function () {
      // Create multiple contracts in different states
      // Contract 1: Pending
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );

      // Contract 2: Active
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(2, { value: depositAmount });

      // Contract 3: Active with validator requested
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(3, { value: depositAmount });
      await dapdvs.connect(pgOwner).requestValidator(3, { value: validatorFee });

      // Contract 4: Completed
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(4, { value: depositAmount });
      await dapdvs.connect(pgOwner).requestValidator(4, { value: validatorFee });
      await dapdvs.connect(validator).completeContract(4, 0);
    });

    it("Should return correct PG owner contracts in all states", async function () {
      const [pending, active, completed] = await dapdvs.getPgOwnerContracts(pgOwner.address);
      expect(pending.length).to.equal(1);
      expect(active.length).to.equal(2);
      expect(completed.length).to.equal(1);

      // Verify contract states
      expect(pending[0].state).to.equal(0); // PENDING
      expect(active[0].state).to.equal(1); // ACTIVE
      expect(completed[0].state).to.equal(3); // COMPLETED
    });

    it("Should return correct renter contracts in all states", async function () {
      const [pending, active, completed] = await dapdvs.getRenterContracts(renter.address);
      expect(pending.length).to.equal(1);
      expect(active.length).to.equal(2);
      expect(completed.length).to.equal(1);

      // Verify specific contract details
      expect(pending[0].depositAmount).to.equal(depositAmount);
      expect(active[0].validatorFee).to.equal(validatorFee);
      expect(completed[0].validatorPaid).to.be.true;
    });

    it("Should return correct validator contracts", async function () {
      const [pending, completed] = await dapdvs.getValidatorContracts(validator.address);
      expect(pending.length).to.equal(1); // Contract 3
      expect(completed.length).to.equal(1); // Contract 4

      // Verify validator-specific details
      expect(pending[0].validatorRequested).to.be.true;
      expect(pending[0].validatorPaid).to.be.false;
      expect(completed[0].validatorPaid).to.be.true;
    });

    it("Should return empty arrays for address with no contracts", async function () {
      const [pending, active, completed] = await dapdvs.getPgOwnerContracts(otherAccount.address);
      expect(pending.length).to.equal(0);
      expect(active.length).to.equal(0);
      expect(completed.length).to.equal(0);
    });

    it("Should return correct contract details for specific ID", async function () {
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
      ] = await dapdvs.getContractDetails(3);

      expect(retPgOwner).to.equal(pgOwner.address);
      expect(retRenter).to.equal(renter.address);
      expect(retValidator).to.equal(validator.address);
      expect(retDepositAmount).to.equal(depositAmount);
      expect(retValidatorFee).to.equal(validatorFee);
      expect(retState).to.equal(1); // ACTIVE
      expect(retValidatorRequested).to.be.true;
      expect(retValidatorPaid).to.be.false;
    });
  });

  describe("Edge Cases and Special Scenarios", function () {
    it("Should handle contract with minimum duration", async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        1 // 1 second duration
      );
      
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await time.increase(2);
      await expect(dapdvs.autoCompleteContract(1)).to.not.be.reverted;
    });

    it("Should handle maximum possible deposit amount", async function () {
      const maxDeposit = ethers.parseEther("1000000"); // Very large deposit
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        maxDeposit,
        validatorFee,
        duration
      );
      
      // Verify contract creation with large deposit
      const contract = await dapdvs.rentalContracts(1);
      expect(contract.depositAmount).to.equal(maxDeposit);
    });

    it("Should handle multiple validator requests for different contracts", async function () {
      // Create and activate multiple contracts
      for(let i = 0; i < 3; i++) {
        await dapdvs.connect(pgOwner).createContract(
          renter.address,
          validator.address,
          depositAmount,
          validatorFee,
          duration
        );
        await dapdvs.connect(renter).signContract(i + 1, { value: depositAmount });
        await dapdvs.connect(pgOwner).requestValidator(i + 1, { value: validatorFee });
      }

      const [pendingValidations, completedValidations] = await dapdvs.getValidatorContracts(validator.address);
      expect(pendingValidations.length).to.equal(3);
    });

    it("Should handle contract completion with partial damage amounts", async function () {
    // Test various damage amounts
    const damageAmounts = [
        ethers.parseEther("0.1"),
        ethers.parseEther("0.5"),
        ethers.parseEther("0.75")
    ];

    for(const damage of damageAmounts) {
        // Create a new contract for each damage amount test
        await dapdvs.connect(pgOwner).createContract(
            renter.address,
            validator.address,
            depositAmount,
            validatorFee,
            duration
        );
        
        const contractId = Number(await dapdvs.nextContractId()) - 1;
        
        // Sign and request validator for the new contract
        await dapdvs.connect(renter).signContract(contractId, { value: depositAmount });
        await dapdvs.connect(pgOwner).requestValidator(contractId, { value: validatorFee });

        // Record initial balances
        const initialPgOwnerBalance = await ethers.provider.getBalance(pgOwner.address);
        const initialRenterBalance = await ethers.provider.getBalance(renter.address);

        // Complete contract with current damage amount
        await dapdvs.connect(validator).completeContract(contractId, damage);

        // Check final balances
        const finalPgOwnerBalance = await ethers.provider.getBalance(pgOwner.address);
        const finalRenterBalance = await ethers.provider.getBalance(renter.address);

        // Verify balances changed correctly
        expect(finalPgOwnerBalance).to.be.gt(initialPgOwnerBalance, 
            `PG owner should receive damage amount of ${ethers.formatEther(damage)} ETH`);
        
        const expectedRenterRefund = depositAmount - damage;
        expect(finalRenterBalance).to.be.gt(initialRenterBalance,
            `Renter should receive refund of ${ethers.formatEther(expectedRenterRefund)} ETH`);
    }
});

    it("Should handle concurrent contract operations", async function () {
      // Create multiple contracts simultaneously
      await Promise.all([
        dapdvs.connect(pgOwner).createContract(
          renter.address,
          validator.address,
          depositAmount,
          validatorFee,
          duration
        ),
        dapdvs.connect(pgOwner).createContract(
          renter.address,
          anotherValidator.address,
          depositAmount,
          validatorFee,
          duration
        )
      ]);

      // Verify both contracts were created correctly
      const contract1 = await dapdvs.rentalContracts(1);
      const contract2 = await dapdvs.rentalContracts(2);
      expect(contract1.validator).to.equal(validator.address);
      expect(contract2.validator).to.equal(anotherValidator.address);
    });

    it("Should handle contract lifecycle with minimum values", async function () {
      const minDeposit = ethers.parseEther("0.0001");
      const minValidatorFee = ethers.parseEther("0.0001");
      
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        minDeposit,
        minValidatorFee,
        duration
      );

      await dapdvs.connect(renter).signContract(1, { value: minDeposit });
      await dapdvs.connect(pgOwner).requestValidator(1, { value: minValidatorFee });
      
      // Complete with minimal damage
      const minDamage = ethers.parseEther("0.00001");
      await expect(
        dapdvs.connect(validator).completeContract(1, minDamage)
      ).to.not.be.reverted;
    });
  });

  describe("Gas Usage and Optimization Tests", function () {
    it("Should optimize gas for contract creation", async function () {
      const tx = await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      const receipt = await tx.wait();
      
      // Log gas usage for analysis
      console.log("Gas used for contract creation:", receipt.gasUsed);
      expect(receipt.gasUsed).to.be.lt(500000); // Adjust threshold as needed
    });

    it("Should optimize gas for contract completion", async function () {
      await dapdvs.connect(pgOwner).createContract(
        renter.address,
        validator.address,
        depositAmount,
        validatorFee,
        duration
      );
      await dapdvs.connect(renter).signContract(1, { value: depositAmount });
      await dapdvs.connect(pgOwner).requestValidator(1, { value: validatorFee });

      const tx = await dapdvs.connect(validator).completeContract(1, 0);
      const receipt = await tx.wait();
      
      console.log("Gas used for contract completion:", receipt.gasUsed);
      expect(receipt.gasUsed).to.be.lt(200000); // Adjust threshold as needed
    });
  });
});