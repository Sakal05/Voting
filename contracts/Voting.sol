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
        uint totalVote;
        uint256 approveCount;
        uint256 rejectCount;
        uint256 balance;
        address[] voters;
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

    // //map proposal to vter 
    // mapping(uint256 => Voter) public proposalToVoter;

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
            totalVote: 0,
            approveCount: 0,
            rejectCount: 0,
            balance: 0,
            voters: new address[](0)
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
        //require(prop.voters != msg.sender, "You have already voted for this proposal!");
        
        prop.totalVote++;
        prop.balance = _tokenAmount;

        //update proposal voting status
        if (voteOption == VoteOptionType.Approve) {
            prop.approveCount++;
        } else {
            prop.rejectCount++;
        }

        voter.voteRight--;

        voter.proposalId.push(proposalId);
        // Transfer the specified amount of tokens from the sender to the contract
        token.transferFrom(msg.sender, address(this), _tokenAmount);
        // Approve the voting contract (if it exists) to spend the transferred tokens
        if (address(this) != address(0)) {
            token.approve(msg.sender, _tokenAmount);
        }
    }
}
