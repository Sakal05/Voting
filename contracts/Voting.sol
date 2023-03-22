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
    // uint256 proposalDeadlinePeriod = 432000; //5 days period
    uint256 proposalDeadlinePeriod = 432000; //5 days period

    struct Proposal {
        uint256 id;
        address owner;
        string title;
        string description;
        string whitePaper;
        uint256 timestamp;
        bool proposalPendingStatus;
        bool winningStatus;
        uint totalVote;
        uint256 approveCount;
        uint256 rejectCount;
        uint256 balance;
        //mapping(address => bool) voters; // track which addresses have voted on this proposal
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
    }
    mapping(uint => VotingState) public votingState;

    struct Voter {
        address owner;
        uint256 voteRight;
        uint256[] proposal;
    }

    //map from id to proposal
    mapping(uint => Proposal) public proposal;

    //map from proposal id to Voting Result
    mapping(address => Voter) public voters;

    //map from proposal to voters
    mapping(uint256 => mapping(address => bool)) public proposalToVoters;

    event ProposalEvent(
        uint indexed id,
        address owner,
        string title,
        string description
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

    function createProposal(
        string memory title,
        string memory description,
        string memory whitePaper
    ) public {
        require(msg.sender != address(0), "Must be a valid address");
        require(
            token.balanceOf(msg.sender) >= 100,
            "Must hold 100 tokens or more to create Proposal"
        );

        Proposal memory newProposal = Proposal({
            id: proposalCounter++,
            owner: msg.sender,
            title: title,
            description: description,
            whitePaper: whitePaper,
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

        emit ProposalEvent(newProposal.id, msg.sender, title, description);
    }

    //function to create and give rigth to voter
    function delegate(address to) external {
        require(to != address(0), "Address must exist");

        voters[to].owner = to;
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
        require(prop.owner != address(0), "Proposal does not Exist");
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

    function declareWinningProposal(uint256 proposalId) public {
        require(
            voteDeadlineReach(proposalId),
            "Proposal hasn't reached the deadline"
        );
        Proposal storage prop = proposal[proposalId];
        require(
            msg.sender == prop.owner,
            "You must be the owner of the proposal"
        );

        if (prop.totalVote == 0) {
            return;
        }

        uint256 approveCount = prop.approveCount;
        uint256 totalVote = prop.totalVote;
        //uint256 rejectRate = prop.totalVote%prop.rejectCount;
        uint256 winningRate = (approveCount * 100) / totalVote;
        console.log("Winning Rate: ", winningRate);
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

    function transferRejectionCash(uint256 proposalId) internal {
        VotingState storage voterState = votingState[proposalId];

        uint256 allVotersLength = votingState[proposalId].voters.length;
        for (uint i = 0; i < allVotersLength; i++) {
            if (voterState.votingOption[i] == VoteOptionType.Approve) {
                token.transfer(
                    voterState.voters[i],
                    voterState.voteBalances[i]
                );
            }
        }
    }

    function voteDeadlineReach(uint256 proposalId) public view returns (bool) {
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
        // uint256 deadlinePeriodLeft;
        // Calculate the time left until the deadline
        if (block.timestamp >= proposalTimeOut) {
            // deadlinePeriodLeft = block.timestamp - proposalTimeOut;
            // console.log(
            //     "Deadline Reach no time left. Proposal Time Since Deadline is: ",
            //     deadlinePeriodLeft
            // );
            return 0;
        } else {
            // deadlinePeriodLeft = proposalTimeOut - block.timestamp;

            // console.log(
            //     "Haven't reached deadline yet, Time Remaining: ",
            //     deadlinePeriodLeft
            // );
            return proposalTimeOut - block.timestamp;
        }
    }

    function getVoterProposals() public view returns (uint256[] memory) {
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
}
