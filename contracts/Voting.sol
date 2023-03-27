// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// Import the IERC20 interface from an external Solidity file
import "./FlexyToken.sol";
import "hardhat/console.sol";

contract Voting {
    // Define a token variable of type IERC20 to represent the token contract
    Flexy private token;

    constructor(address _tokenAddress) {
        // Assign the token variable to an instance of the IERC20 contract at the specified address
        token = Flexy(_tokenAddress);
    }

    uint256 proposalCounter;
    uint256 votingCounter;
    uint256 public proposalDeadlinePeriod = 5 days; //5 days period
    uint256 public distributePeriod = 30 days;

    struct Proposal {
        uint256 id;
        ProposalInfo proposalInfo;
        uint256 timestamp;
        bool proposalPendingStatus;
        bool winningStatus;
        uint totalVote;
        uint256 approveCount;
        uint256 rejectCount;
        uint256 balance;
    }

    struct ProposalInfo {
        address owner;
        string title;
        string description;
        string whitePaper;
        uint256 incentivePercentagePerMonth;
    }

    Proposal[] public proposals; //list of proposal

    enum VoteOptionType {
        Approve,
        Reject
    }

    struct VotingState {
        uint256 proposalId;
        address[] voters;
        uint256[] voteBalances;
        VoteOptionType[] votingOption;
        uint256[] claimCounter;
        bool[] claimStatus;
        uint256[] claimTimeStamp;
    }

    struct Voter {
        address voter;
        uint256 voteRight;
        uint256[] proposal;
    }

    //map from id to proposal struct
    mapping(uint => Proposal) public proposal;

    //map from proposalId to VotingState struct
    mapping(uint => VotingState) public votingState;

    //map from voter address to voter
    mapping(address => Voter) public voters;

    //map from proposal to voters state
    mapping(uint256 => mapping(address => bool)) public proposalToVoters;

    event ProposalEvent(
        uint indexed id,
        address owner,
        string title,
        string description,
        uint256 monthlyIncentive
    );

    event VoteEvent(
        uint256 indexed proposalId,
        address voter,
        string voteOption,
        string message
    );

    event WinningProposalEvent(
        uint256 indexed proposalId,
        bool winningStatus,
        string message
    );

    event TransferTokenForProposalRejection(
        uint256 indexed proposalId,
        address[] voters,
        uint256 totalTokenTransferred
    );

    event claimIncentiveEvent(address receiver, uint256 tokenAmount);

    function createProposal(
        string memory title,
        string memory description,
        string memory whitePaper,
        uint256 incentivePercentagePerMonth
    ) public {
        require(msg.sender != address(0), "Must be a valid address");
        require(
            token.balanceOf(msg.sender) >= 100,
            "Must hold 100 tokens or more to create Proposal"
        );
        require(
            incentivePercentagePerMonth > 0,
            "Incentive must be greater than zero"
        );

        ProposalInfo memory newProposalInfo = ProposalInfo({
            owner: msg.sender,
            title: title,
            description: description,
            whitePaper: whitePaper,
            incentivePercentagePerMonth: incentivePercentagePerMonth
        });

        Proposal memory newProposal = Proposal({
            id: proposalCounter++,
            proposalInfo: newProposalInfo,
            timestamp: block.timestamp,
            proposalPendingStatus: true,
            winningStatus: false,
            totalVote: 0,
            approveCount: 0,
            rejectCount: 0,
            balance: 0
        });

        proposal[proposalCounter - 1] = newProposal;
        proposals.push(newProposal);

        emit ProposalEvent(
            newProposal.id,
            msg.sender,
            title,
            description,
            incentivePercentagePerMonth
        );
    }

    //function to create and give rigth to voter
    function delegate(
        address to
    ) external {
        require(msg.sender != address(0), "Address must exist");
        require(to != address(0), "Address must exist");
        Voter storage voter = voters[msg.sender];
        uint256 delegatorAddress = token.balanceOf(msg.sender);
        if (voter.voteRight == 0){
            require(delegatorAddress >= 100, "Address must have at least 100 tokens");
        } else {
            require(delegatorAddress >= (100*voter.voteRight), "Address must have at least 100 tokens");

        }
        voters[to].voter = to;
        voters[to].voteRight += 1;
    }

    function vote(
        uint256 proposalId,
        VoteOptionType voteOption,
        uint256 _tokenAmount
    ) external {
        require(
            token.balanceOf(msg.sender) >= _tokenAmount,
            "Insufficient balance"
        );
        require(
            token.allowance(msg.sender, address(this)) >= _tokenAmount,
            "Token allowance not set"
        );

        Voter storage voter = voters[msg.sender];
        require(voter.voteRight >= 1, "You have no right to vote!!");

        Proposal storage prop = proposal[proposalId];
        require(
            prop.proposalInfo.owner != address(0),
            "Proposal does not Exist"
        );
        require(
            !voteDeadlineReach(proposalId),
            "Can't Vote, proposal had reached deadline"
        );

        require(
            !proposalToVoters[proposalId][msg.sender],
            "You have already voted for this proposal"
        );

        //set voter address to the proposal
        proposalToVoters[proposalId][msg.sender] = true;
        voter.voteRight--;
        //increment total vote
        prop.totalVote++;

        VotingState storage voting = votingState[proposalId];
        voting.proposalId = proposalId;
        voting.voters.push(msg.sender);
        voting.voteBalances.push(_tokenAmount);
        voting.votingOption.push(voteOption);
        voting.claimCounter.push(0);
        voting.claimStatus.push(false);
        voting.claimTimeStamp.push(block.timestamp);
    
        //update proposal voting status
        if (voteOption == VoteOptionType.Approve) {
            prop.approveCount++;
        } else {
            prop.rejectCount++;
        }

        voter.proposal.push(proposalId);

        //transfer token only voter vote approve on the proposal
        if (voteOption == VoteOptionType.Approve) {
            prop.balance += _tokenAmount;
            // Transfer the specified amount of tokens from the sender to the contract
            token.transferFrom(msg.sender, address(this), _tokenAmount);
            // Approve the voting contract (if it exists) to spend the transferred tokens
            if (address(this) != address(0)) {
                token.approve(msg.sender, _tokenAmount);
            }

            emit VoteEvent(
                proposalId,
                msg.sender,
                "Approve",
                "Vote successful"
            );
        } else {
            emit VoteEvent(proposalId, msg.sender, "Reject", "Vote successful");
        }
    }

    function declareWinningProposal(
        uint256 proposalId
    ) public {
        //ensure that proposal owner put some collectural into this contract
        
        require(
            voteDeadlineReach(proposalId),
            "Proposal hasn't reached the deadline"
        );
        Proposal storage prop = proposal[proposalId];
        require(
            msg.sender == prop.proposalInfo.owner,
            "You must be the owner of the proposal"
        );

        if (prop.totalVote == 0) {
            return;
        }

        uint256 approveCount = prop.approveCount;
        uint256 totalVote = prop.totalVote;
        //uint256 rejectRate = prop.totalVote%prop.rejectCount;
        uint256 winningRate = (approveCount * 100) / totalVote;
        if (winningRate >= 50) {
            prop.winningStatus = true;
        } else {
            prop.winningStatus = false;
            //transfer all money back to voters
            transferRejectionCash(proposalId);
        }
        emit WinningProposalEvent(
            proposalId,
            prop.winningStatus,
            "Proposal settled successfully"
        );
    }

    function claimVotingIncentive(
        uint256 proposalId
    ) public {
        require(msg.sender != address(0), "Address must be valid");

        bool voterFound;
        //require the proposal must be approved WIN
        Proposal storage prop = proposal[proposalId];
        require(prop.winningStatus == true, "Proposal has been rejected!");

        VotingState storage voterState = votingState[proposalId];
        uint256 allVotersLength = voterState.voters.length;
        uint256 voterIndex = 0;

        for (uint256 i = 0; i < allVotersLength; i++) {
            if (msg.sender == voterState.voters[i]) {
                voterFound = true;
                voterIndex = i;
                break;
            }
        }
        address receiver = voterState.voters[voterIndex];
        uint256 claimCount = voterState.claimCounter[voterIndex];
        require(
            distributionDeadlineReach(proposalId, claimCount),
            "Claim Period hasn't reached deadline yet!"
        );

        require(voterFound, "You are not a valid voter for this proposal");

        //require voter to vote approve
        require(
            voterState.votingOption[voterIndex] == VoteOptionType.Approve,
            "Voter must vote approve on the proposal"
        );

        require(
            voterState.claimStatus[voterIndex] == false,
            "Voter has reached claim limit"
        );
        require(msg.sender == receiver, "You are not the receiver");

        uint256 voteBalance = voterState.voteBalances[voterIndex];
        uint256 incentivePerMonth = prop
            .proposalInfo
            .incentivePercentagePerMonth;

        sendingIncentive(receiver, voteBalance, incentivePerMonth);
        voterState.claimCounter[voterIndex]++;
        if (voterState.claimCounter[voterIndex] == 12) {
            voterState.claimStatus[voterIndex] = true;
        }
    }

    function sendingIncentive(
        address receiver,
        uint256 transferAmount,
        uint256 incentivePerMonth
    ) internal {
        uint256 amount = (transferAmount * incentivePerMonth) / 100;
        token.transfer(receiver, amount);
        emit claimIncentiveEvent(receiver, amount);
    }

    function transferRejectionCash(
        uint256 proposalId
    ) internal {
        VotingState storage voterState = votingState[proposalId];

        uint256 allVotersLength = votingState[proposalId].voters.length;
        uint256 totalTokenTransferred;
        for (uint i = 0; i < allVotersLength; i++) {
            if (voterState.votingOption[i] == VoteOptionType.Approve) {
                totalTokenTransferred += voterState.voteBalances[i];
                token.transfer(
                    voterState.voters[i],
                    voterState.voteBalances[i]
                );
            }
        }
        emit TransferTokenForProposalRejection(
            proposalId,
            voterState.voters,
            totalTokenTransferred
        );
    }

    function voteDeadlineReach(
        uint256 proposalId
    ) public view returns (bool) {
        uint256 deadlinePeriodLeft = proposalVotingPeriod(proposalId);
        // If there is no time left, the deadline has been reached
        if (deadlinePeriodLeft == 0) {
            return true;
        } else {
            return false;
        }
    }

    function proposalVotingPeriod(
        uint256 proposalId
    ) public view returns (uint256) {
        Proposal storage prop = proposal[proposalId];
        uint256 proposalTimeOut = prop.timestamp + proposalDeadlinePeriod;
        // Calculate the time left until the deadline
        if (block.timestamp >= proposalTimeOut) {
            return 0;
        } else {
            return proposalTimeOut - block.timestamp;
        }
    }

    function distrubutionDeadlinePeriod(
        uint256 proposalId,
        uint256 claimCount
    ) public view returns (uint256) {
        Proposal storage prop = proposal[proposalId];
        require(prop.winningStatus == true, "Proposal has been rejected");
        uint256 claimDeadline;

        if (claimCount == 0) {
            //for first time claiming the incentive
            claimDeadline = prop.timestamp + distributePeriod;
            if (block.timestamp >= claimDeadline + 5 days) {
                //5 days after proposal is delared winning status
                return 0;
            } else {
                return claimDeadline + (5 days) - block.timestamp;
            }
        } else {
            uint cc = claimCount += 1;
            claimDeadline = prop.timestamp + (distributePeriod * cc);

            if (block.timestamp >= claimDeadline + 5 days) {
                return 0;
            } else {
                return claimDeadline + 5 days - block.timestamp;
            }
        }
    }

    function distributionDeadlineReach(
        uint256 proposalId,
        uint256 claimCount
    ) public view returns (bool) {
        uint256 claimPeriodLeft = distrubutionDeadlinePeriod(
            proposalId,
            claimCount
        );
        if (claimPeriodLeft == 0) {
            return true;
        } else {
            return false;
        }
    }

    function getVotedProposals() public view returns (uint256[] memory) {
        return voters[msg.sender].proposal;
    }

    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return proposal[proposalId];
    }

    function getAllProposals() public view returns (Proposal[] memory) {
        return proposals;
    }

    function getVotersByProposalId(
        uint256 proposalId
    ) public view returns (address[] memory) {
        return votingState[proposalId].voters;
    }

    function getVoteBalanceByProposalId(
        uint256 proposalId
    ) public view returns (uint256[] memory) {
        return votingState[proposalId].voteBalances;
    }

    function getVotingOptionByProposalId(
        uint256 proposalId
    ) public view returns (VoteOptionType[] memory) {
        return votingState[proposalId].votingOption;
    }

    function getClaimCounterByProposalId(
        uint256 proposalId
    ) public view returns (uint256[] memory) {
        return votingState[proposalId].claimCounter;
    }

    function getClaimStatusByProposalId(
        uint256 proposalId
    ) public view returns (bool[] memory) {
        return votingState[proposalId].claimStatus;
    }
}
