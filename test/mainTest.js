const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// const sinon = require("sinon"); //skip timeout

describe("Contract", function () {
  let contract;
  let tokenContract;
  let owner;
  let ad1, ad2, ad3, ad4, ad5, ad6, ad7;
  let addresses;
  let voting;
  let decimal = 10 ** 18;
  let DECIMAL = BigInt(decimal);  

  before(async function () {
    const TokenContract = await ethers.getContractFactory("Flexy");
    const token = await TokenContract.deploy();
    tokenContract = await token.deployed();

    [owner, ad1, ad2, ad3, ad4, ad5, ad6, ad7] = await ethers.getSigners();
    addresses = [ad1, ad2, ad3, ad4, ad5, ad6, ad7];

    // Deploy a new instance of the Voting contract, passing in the address of the FlexyToken contract
    const VotingContract = await ethers.getContractFactory("Voting");
    voting = await VotingContract.deploy(token.address);
    contract = await voting.deployed();

    await contract
      .connect(owner)
      .createProposal(
        "Test Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf",
        1500
      );

    await contract
      .connect(owner)
      .createProposal(
        "Test Second Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf",
        550
      );

    await contract
      .connect(owner)
      .createProposal(
        "Test Third Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf",
        500
      );

    for (let i = 0; i < addresses.length; i++) {
      await tokenContract.transfer(addresses[i].address, BigInt(200) * DECIMAL);
      await tokenContract
        .connect(addresses[i])
        .approve(contract.address, BigInt(200) * DECIMAL);
      await contract.connect(addresses[i]).delegate(addresses[i].address);
      await contract.connect(addresses[i]).delegate(addresses[i].address);
    }
  });

  it("Should show total number of proposal", async function () {
    const proposal = await contract.getAllProposalsLength();
    expect(proposal).to.equal(3);
  });

  it("Should show voting right is equal to 2", async function () {
    let voterRight;
    let voter;
    for (let i = 0; i < addresses.length; i++) {
      voter = await contract.voters(addresses[i].address);
      voterRight = voter.voteRight;
      expect(voterRight).to.equal(2);
    }
  });

  describe("Vote on Proposal", function () {
    let voteApprove, voteReject;

    before(async function() {
      //first proposal voting
      
      voteApprove = await contract.connect(addresses[0]).vote(0, 0, 100);
      await contract.connect(addresses[1]).vote(0, 0, 100);
      await contract.connect(addresses[2]).vote(0, 1, 100);
      await contract.connect(addresses[3]).vote(0, 1, 100);
      await contract.connect(addresses[4]).vote(0, 1, 100);

      //second proposal voting
      await contract.connect(addresses[0]).vote(1, 0, 100);
      await contract.connect(addresses[1]).vote(1, 0, 100);
      await contract.connect(addresses[2]).vote(1, 0, 100);
      await contract.connect(addresses[3]).vote(1, 0, 100);
      voteReject = await contract.connect(addresses[4]).vote(1, 1, 100);
    }); 

    // afterEach(async function(){
    //   const proposal = await contract.proposals;
    //   console.log(proposal);
    // });

    it("Should show total vote on proposal", async function () {
      const proposal = await contract.proposal(0);
      expect(proposal.totalVote).to.equal(5);
    });

    it("Should emit right event when voting APPROVE", async function () {
      await expect(voteApprove)
        .to.emit(contract, "VoteEvent")
        .withArgs(0, addresses[0].address, "Approve", "Vote successful");
    });

    it("Should emit right event when voting REJECT", async function () {
      await expect(voteReject)
        .to.emit(contract, "VoteEvent")
        .withArgs(1, addresses[4].address, "Reject", "Vote successful");
    });

    it("Should decrease the voter balance", async function () {
      const voterToken = await tokenContract.balanceOf(addresses[0].address);
      expect(voterToken).to.equal(0);
    });

    it("Should increase the proposal balance", async function () {
      const proposal = await contract.proposal(1);
      expect(proposal.balance).to.equal(BigInt(400) * DECIMAL);
    });

    it("Should decrease the vote right", async function () {
      let voterRightAfter;
      for (let i = 0; i < addresses.length; i++) {
        voterRightAfter = await contract.voters(addresses[0].address);
        expect(voterRightAfter.voteRight).to.equal(0);
      }
    });

    it("Should shows all voters by proposal ID", async function () {
      let allVoters = [];

      let voter = await contract.getVotersByProposalId(1);
      allVoters = voter;

      expect(allVoters.length).to.equal(5);
    });

    it("Should shows all voted balances of voted proposal", async function () {
      const votersBalance1 = await contract.getVoteBalance(
        addresses[0].address,
        0
      );
      const votersBalance2 = await contract.getVoteBalance(
        addresses[0].address,
        0
      );
      const votersBalance3 = await contract.getVoteBalance(
        addresses[0].address,
        0
      );

      const expectValue = BigInt(100) * DECIMAL;

      expect(votersBalance1).to.equal(expectValue);
      expect(votersBalance2).to.equal(expectValue);
      expect(votersBalance3).to.equal(expectValue);
    });

    describe("Declare winning proposal", function () {
      let declareWinSecondProposal;
      let declareWinFirstProposal;
      before(async function () {
        //declare winning for 1st and 2nd proposal
        await time.increase(435000);

        declareWinSecondProposal = await contract
          .connect(owner)
          .declareWinningProposal(1);

        declareWinFirstProposal = await contract
          .connect(owner)
          .declareWinningProposal(0);
      });

      it("Should declare Winning for 1st proposal", async function () {
        const firstProposal = await contract.proposal(0);

        expect(await firstProposal.winningStatus).to.equal(false);
        expect(await firstProposal.pendingStatus).to.equal(false);

        await expect(declareWinFirstProposal)
          .to.emit(contract, "WinningProposalEvent")
          .withArgs(0, false, "Proposal settled successfully");
      });

      it("Should declare Rejected for 2nd proposal", async function () {
        const secondProposal = await contract.proposal(1);
        expect(await secondProposal.winningStatus).to.equal(true);
        expect(await secondProposal.pendingStatus).to.equal(false);
        await expect(declareWinSecondProposal)
          .to.emit(contract, "WinningProposalEvent")
          .withArgs(1, true, "Proposal settled successfully");
      });

      it("Should transfer back token to approved voters when proposal is rejected", async function () {
        await expect(declareWinFirstProposal)
          .to.emit(contract, "WinningProposalEvent")
          .withArgs(0, false, "Proposal settled successfully")
          .to.emit(contract, "TransferTokenForProposalRejection")
          .withArgs(0, addresses[0].address, BigInt(100) * DECIMAL)
          .to.emit(contract, "TransferTokenForProposalRejection")
          .withArgs(0, addresses[1].address, BigInt(100) * DECIMAL);
      });

      it("Should get all Pending Proposals",async function(){
       
          let pendingProposals = new Array();
          let allProposals = new Array();
          const proposalLength = await contract.getAllProposalsLength();
          for(let i = 0; i < proposalLength; i++){
              let prop = await contract.getProposal(i);
              allProposals.push(prop);
          }
          for(let i = 0; i < proposalLength; i++){
            if(allProposals[i].pendingStatus == true){
              pendingProposals.push(allProposals[i]);
            }
          }
          expect(pendingProposals.length).to.equal(1);
          expect(pendingProposals[0].proposalInfo.title).to.equal("Test Third Proposal");
        
      });

      describe("Claiming Incentive", function () {
        let claimIncentive;
        let secondProposal;
        let initialVoterBalance;

        beforeEach(async function () {
          initialVoterBalance = await tokenContract.balanceOf(
            addresses[1].address
          );

          // //logger for balance before claim incentive proposal
          // const balance = await tokenContract.balanceOf(addresses[1].address);
          // console.log("Initial Balance: ", balance);
        });

        afterEach(async function(){
          // //logger for balance after claim incentive proposal
          // const balance = await tokenContract.balanceOf(addresses[1].address);
          // console.log("After Balance: ", balance);
        });

        //first claim after proposal is being declared
        it("Should claim first incentive after 1 month started from proposal declare win", async function () {
          await time.increase(86400 * 30); //increase by 1 day from proposal declared
          claimIncentive = await contract
            .connect(addresses[1])
            .claimVotingIncentive(1);
          secondProposal = await contract.proposal(1);

          const secondProposalIncentive =
            secondProposal.proposalInfo.incentivePercentagePerMonth;

          const voteBalance = await contract.getVoteBalance(
            addresses[1].address,
            1
          );

          const incentive =
            (BigInt(secondProposalIncentive) * BigInt(voteBalance)) /
            BigInt(10000);
          // //log out incentive value 
          // console.log("Incentive: ", BigInt(incentive));
          const voterBalanceAfter = await tokenContract.balanceOf(
            addresses[1].address
          );
          const expectedBalance =
            parseInt(initialVoterBalance) + parseInt(incentive);

          expect(voterBalanceAfter).to.equal(BigInt(expectedBalance));

          await expect(claimIncentive)
            .to.emit(contract, "claimIncentiveEvent")
            .withArgs(addresses[1].address, incentive);

          // const claimStatusByMonth = await contract.connect(addresses[1]).getClaimStatusByMonth(1);
          // console.log("claimStatusByMonth: ", claimStatusByMonth);
        });

        //second claim, 2 months from proposal is being declared
        it("Should claim second incentive after 2 months", async function () {
          await time.increase(86400 * 30); //increase by 1 month

          claimIncentive = await contract
            .connect(addresses[1])
            .claimVotingIncentive(1);

          const secondProposalIncentive =
            secondProposal.proposalInfo.incentivePercentagePerMonth;
          
          const voteBalance = await contract.getVoteBalance(
            addresses[1].address,
            1
          );

          const incentive =
            (BigInt(secondProposalIncentive) * BigInt(voteBalance)) /
            BigInt(10000);
          // //log out incentive value 
          // console.log("Incentive: ", BigInt(incentive));
          const voterBalanceAfter = await tokenContract.balanceOf(
            addresses[1].address
          );
          const expectedBalance =
            parseInt(initialVoterBalance) + parseInt(incentive);

          expect(voterBalanceAfter).to.equal(BigInt(expectedBalance));

          await expect(claimIncentive)
            .to.emit(contract, "claimIncentiveEvent")
            .withArgs(addresses[1].address, incentive);
        });

        //third and forth claims, 4 months after proposal is being declared
        it("Should claim incentive after 4 months", async function () {
          await time.increase(86400 * 30 * 2); //increase by  2 months
          initialVoterBalance = await tokenContract.balanceOf(
            addresses[1].address
          );
          claimIncentive = await contract
            .connect(addresses[1])
            .claimVotingIncentive(1);

          const secondProposalIncentive =
            secondProposal.proposalInfo.incentivePercentagePerMonth;
          const voteBalance = await contract.getVoteBalance(
            addresses[1].address,
            1
          );

          let incentive =
            (BigInt(secondProposalIncentive) * BigInt(voteBalance)) /
            BigInt(10000);
          //2 months period, so multiply incentive by 2
          incentive *= BigInt(2);
          // //log out incentive value 
          // console.log("Incentive: ", BigInt(incentive));

          const voterBalanceAfter = await tokenContract.balanceOf(
            addresses[1].address
          );
          const expectedBalance =
            parseInt(initialVoterBalance) + parseInt(incentive);

          expect(voterBalanceAfter).to.equal(BigInt(expectedBalance));

          await expect(claimIncentive)
            .to.emit(contract, "claimIncentiveEvent")
            .withArgs(addresses[1].address, incentive);
        });

        //second claim, 2 months from proposal is being declared
        it("Should claim fifth incentive after 5 months", async function () {
          await time.increase(86400 * 30);
          claimIncentive = await contract
            .connect(addresses[1])
            .claimVotingIncentive(1);

          const secondProposalIncentive =
            secondProposal.proposalInfo.incentivePercentagePerMonth;
          const voteBalance = await contract.getVoteBalance(
            addresses[1].address,
            1
          );

          const incentive =
            (BigInt(secondProposalIncentive) * BigInt(voteBalance)) /
            BigInt(10000);

            // //log out incentive value 
          // console.log("Incentive: ", BigInt(incentive));
          const voterBalanceAfter = await tokenContract.balanceOf(
            addresses[1].address
          );
          const expectedBalance =
            parseInt(initialVoterBalance) + parseInt(incentive);

          expect(voterBalanceAfter).to.equal(BigInt(expectedBalance));

          await expect(claimIncentive)
            .to.emit(contract, "claimIncentiveEvent")
            .withArgs(addresses[1].address, incentive);
        });

        //latest claim
        it.skip("Should claim sixth incentive after 12 months", async function () {
          await time.increase(86400 * 30 * 7);
        
          claimIncentive = await contract
            .connect(addresses[1])
            .claimVotingIncentive(1);

          const secondProposalIncentive =
            secondProposal.proposalInfo.incentivePercentagePerMonth;
          const voteBalance = await contract.getVoteBalance(
            addresses[1].address,
            1
          );

          let incentive =
            (BigInt(secondProposalIncentive) * BigInt(voteBalance)) /
            BigInt(10000);
          //2 months period, so multiply incentive by 2
          incentive *= BigInt(7);
          
          // //log out incentive value 
          // console.log("Incentive: ", BigInt(incentive));
          const voterBalanceAfter = await tokenContract.balanceOf(
            addresses[1].address
          );
          const expectedBalance =
            parseInt(initialVoterBalance) + parseInt(incentive);

          expect(voterBalanceAfter).to.equal(BigInt(expectedBalance));

          await expect(claimIncentive)
            .to.emit(contract, "claimIncentiveEvent")
            .withArgs(addresses[1].address, incentive);
        });

        //execute claim after claim period reached
        it("Should execute claim after claim period reach", async function () {
          await time.increase(86400 * 30 * 8);
        
          claimIncentive = await contract
            .connect(addresses[1])
            .executeIncentive(1);

          const secondProposalIncentive =
            secondProposal.proposalInfo.incentivePercentagePerMonth;
          const voteBalance = await contract.getVoteBalance(
            addresses[1].address,
            1
          );

          let incentive =
            (BigInt(secondProposalIncentive) * BigInt(voteBalance)) /
            BigInt(10000);
          //2 months period, so multiply incentive by 2
          incentive *= BigInt(7);
          
          // //log out incentive value 
          // console.log("Incentive: ", BigInt(incentive));
          const voterBalanceAfter = await tokenContract.balanceOf(
            addresses[1].address
          );
          const expectedBalance =
            parseInt(initialVoterBalance) + parseInt(incentive);

          expect(voterBalanceAfter).to.equal(BigInt(expectedBalance));

          await expect(claimIncentive)
            .to.emit(contract, "claimIncentiveEvent")
            .withArgs(addresses[1].address, incentive);
        });

        it("Should failed as voter already claim everything", async function () {
          await time.increase(86400 * 30 * 8);         

          await expect(contract
            .connect(addresses[1])
            .executeIncentive(1))
            .to.revertedWith("You have claimed this proposal");
        });


      });
    });
  });
});
