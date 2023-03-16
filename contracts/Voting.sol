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

    struct Proposal {
        uint256 id;
        address owner;
        string title;
        string description;
        string whitePaper;
        uint256 timestamp;
        uint voteCount;
        uint256 approveCount;
        uint256 rejectCount;
        uint256 balance;
    }

    Proposal[] public proposals; //list of proposal

    enum VoteOptionType {
        Approve,
        Reject
    }

    struct Voter {
        address owner;
        bool voteStatus;
        uint256 voteRight;
        Proposal[] proposals;
    }

    //map from id to proposal
    mapping(uint => Proposal) public proposal;

    //map from proposal id to Voting Result
    mapping(address => Voter) public voters;

    event ProposalEvent(
        uint indexed id,
        address owner,
        string title,
        string description
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
            voteCount: 0,
            approveCount: 0,
            rejectCount: 0,
            balance: 0
        });

        proposal[newProposal.id] = newProposal;
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
        require(proposal[proposalId].id != 0, "Proposal Doesn't Exist");

        Voter storage voter = voters[msg.sender];

        require(voter.voteRight >= 1, "You have no right to vote!!");

        proposal[proposalId].voteCount++;

        //update proposal voting status
        if( voteOption == VoteOptionType.Approve ) {
            proposal[proposalId].approveCount++;
        } else {
            proposal[proposalId].rejectCount++;
        } 

        voter.voteStatus = true;

        









        

        // votes[proposalId].id = votingCounter++;
        // votes[proposalId].voter = msg.sender;
        // if (voteOption == VoteOptionType.Approve) {
        //     votes[proposalId].approveCount += 1;
        //     votes[proposalId].rejectCount = votes[proposalId].rejectCount;
        // } else {
        //     votes[proposalId].rejectCount += 1;
        //     votes[proposalId].approveCount = votes[proposalId].approveCount;
        // }
        // votes[proposalId].balance += _tokenAmount;


        // Transfer the specified amount of tokens from the sender to the contract
        token.transferFrom(msg.sender, address(this), _tokenAmount);
        // Approve the voting contract (if it exists) to spend the transferred tokens
        // if (votingContract != address(0)) {
        //     token.approve(_tokenAmount);
        // }
    }
}
