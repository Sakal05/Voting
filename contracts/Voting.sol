// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// Import the IERC20 interface from an external Solidity file
import "./FlexyToken.sol";

contract Voting {
    // Define a token variable of type IERC20 to represent the token contract
    Flexy private token;

    constructor(address _tokenAddress) {
        // Assign the token variable to an instance of the IERC20 contract at the specified address
        token = Flexy(_tokenAddress);
    }

    uint256 proposalCounter;
    uint256 votingCounter;
    uint256 proposalDeadlinePeriod = 432000;

    struct Proposal {
        uint256 id;
        address owner;
        string title;
        string description;
        string whitePaper;
        uint256 timestamp;
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

    struct Voter {
        address owner;
        uint256 voteRight;
        uint256[] proposalId;
    }

    //map from id to proposal
    mapping(uint => Proposal) public proposal;

    //map from proposal id to Voting Result
    mapping(address => Voter) public voters;

    mapping(uint256 => mapping(address => bool)) public proposalToVoters;

    //map proposal to voter
    //mapping(uint256 => Voter) public proposalToVoter;

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

    function createProposal(
        string memory title,
        string memory description,
        string memory whitePaper
    ) public {
        require(msg.sender != address(0), "Must be a valid address");

        Proposal memory newProposal = Proposal({
            id: proposalCounter++,
            owner: msg.sender,
            title: title,
            description: description,
            whitePaper: whitePaper,
            timestamp: block.timestamp,
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
        //require(proposal[proposalId].id != 0, "Proposal Doesn't Exist");

        Voter storage voter = voters[msg.sender];

        //Voter storage proposalToVote = proposalToVoter[proposalId];

        //require(proposalToVote.owner != msg.sender, "You have already vote on this proposal");
        require(voter.voteRight >= 1, "You have no right to vote!!");

        Proposal storage prop = proposal[proposalId];

        require(
            !voteDeadlineReach(proposalId) , "Can't Vote, proposal had reached deadline"
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

        //update proposal voting status
        if (voteOption == VoteOptionType.Approve) {
            prop.approveCount++;
        } else {
            prop.rejectCount++;
        }

        voter.proposalId.push(proposalId);

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

    function voteDeadlineReach(uint256 proposalId) view public returns (bool deadlineReached){
        uint256 deadlinePeriodLeft = proposalVotingPeriod(proposalId);
        //if the proposal is 5 days old, the deadline reaches
        if (deadlinePeriodLeft <= 0) {
            return true;
        } else {
            return false;
        }
    }

    function proposalVotingPeriod(uint256 proposalId) view public returns (uint256 timeLeft) {
        Proposal storage prop = proposal[proposalId];
        uint256 deadlinePeriodLeft = prop.timestamp - proposalDeadlinePeriod;
        //if the proposal is 5 days old, the deadline reaches
        if (deadlinePeriodLeft <= 0) {
            return 0;
        } else {
            return deadlinePeriodLeft;
        }
    }

    function getVoterProposals() external view returns (uint256[] memory) {
        return voters[msg.sender].proposalId;
    }

    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return proposal[proposalId];
    }

    function getAllProposals() external view returns (Proposal[] memory) {
        return proposals;
    }
}
