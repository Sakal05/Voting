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
    uint256 public distributionPeriod = 375 days;
    uint256 public DECIMAL = 10**18;
 
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
        uint256[] lastClaimTimeStamp;
    }

    struct Voter {
        address voter;
        uint256 voteRight;
        uint256[] proposal;
    }

    //map from voter address to list of proposal id
    mapping(address => uint[]) public voterProposals;

    //map from voter to proposal id to vote balance
    mapping(address => mapping(uint256 => uint256)) public voterToVoteBalance;

    //map from voter to proposal id to vote option
    mapping(address => mapping(uint256 => VoteOptionType)) public voterToVoteOption;

    //map from voter to proposal id to each claim time stamp
    mapping(address => mapping(uint256 => uint256)) public voterToClaimTimeStamp;
    
    //================================================================ not optimized
    //map from voter to proposal id to each month claim status
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) voterToClaimStatusMonthly;

    //map from proposal id to proposal struct
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
        address voters,
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
    function delegate(address to) external {
        require(msg.sender != address(0), "Address must exist");
        require(to != address(0), "Address must exist");
        Voter storage voter = voters[msg.sender];
        uint256 delegatorAddress = token.balanceOf(msg.sender);
        if (voter.voteRight == 0) {
            require(
                delegatorAddress >= 100,
                "Address must have at least 100 tokens"
            );
        } else {
            require(
                delegatorAddress >= (100 * voter.voteRight),
                "Address must have at least 100 tokens"
            );
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
        // require(
        //     token.allowance(msg.sender, address(this)) >= _tokenAmount,
        //     "Token allowance not set"
        // );

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

        addProposal(msg.sender, proposalId);

        //set voter address to the proposal
        proposalToVoters[proposalId][msg.sender] = true;
        voter.voteRight--;
        //increment total vote
        prop.totalVote++;

        addVoteBalance(msg.sender, proposalId, _tokenAmount);
        addVoterOption(msg.sender, proposalId, voteOption);

        VotingState storage voting = votingState[proposalId];
        voting.proposalId = proposalId;
        voting.voters.push(msg.sender);
        // voting.voteBalances.push(_tokenAmount);
        // voting.votingOption.push(voteOption);
        // voting.claimCounter.push(0);
        voting.claimStatus.push(false);
        // voting.lastClaimTimeStamp.push(0);
        uint256 numMonths = 12; 
        // bool[] memory newClaimStatusRow = new bool[](numMonths);
        
        bool claimState;
        for (uint256 i = 0; i < numMonths; i++) {
            claimState = voterToClaimStatusMonthly[msg.sender][proposalId][i];
            // newClaimStatusRow[i] = false;
        }
        voterToClaimTimeStamp[msg.sender][proposalId] = 0;

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

    function hasVoted(address _voter, uint _proposalId) public view returns (bool) {
    for (uint i = 0; i < voterProposals[_voter].length; i++) {
        if (voterProposals[_voter][i] == _proposalId) {
            return true;
        }
    }
    return false;
    }

    function claimVotingIncentive(uint256 proposalId) public {
        require(msg.sender != address(0), "Address must be valid");
        Proposal storage prop = proposal[proposalId];
        require(prop.winningStatus == true, "Proposal has been rejected!");

        require(!claimPeriodReached(proposalId), "Claim period reached");

        require(hasVoted(msg.sender, proposalId), "You have not voted on this proposal");

        uint256 transferredAmount = calculateIncentive(msg.sender, proposalId);
        sendingIncentive(msg.sender, transferredAmount);

        addClaimTimeStamp(msg.sender, proposalId, block.timestamp);

    }

    function calculateIncentive(address _voter, uint256 _proposalId) public view returns (uint256){
        Proposal storage prop = proposal[_proposalId];
        uint256 incentive = prop.proposalInfo.incentivePercentagePerMonth;
        uint256 voteBalance = getVoteBalance(msg.sender,_proposalId);
        uint256 proposalTimeStamp = prop.timestamp + 5 days;
        uint256 lastClaimTimeStamp = getClaimTimeStamp(_voter, _proposalId);
        uint256 incentivePeriodInDay;
        uint256 incentiveAmount;
        if(lastClaimTimeStamp == 0){
            incentivePeriodInDay = (block.timestamp - proposalTimeStamp)/86400;
            incentiveAmount = (incentivePeriodInDay * incentive * (voteBalance))/3000;
            // console.log("Incentive amount:", (incentiveAmount));
            return incentiveAmount;
        } else {
            incentivePeriodInDay = (block.timestamp - lastClaimTimeStamp)/86400;
            // (incentive/3000): incentive is being input in percentage per month, so we divide it by 100 to get the exact value and divide by 30 (days) to know interest rate per day
            incentiveAmount = (incentivePeriodInDay * incentive * (voteBalance))/3000;
            // console.log("Incentive amount:", (incentiveAmount));
            return incentiveAmount;
        }

    }


    function sendingIncentive(
        address receiver,
        uint256 transferAmount
    ) internal {
        token.transfer(receiver, transferAmount);
        emit claimIncentiveEvent(receiver, transferAmount);
    }

    function transferRejectionCash(uint256 proposalId) internal {
        address[] memory allVoters = getVotersByProposalId(proposalId);
        
        for (uint i = 0; i < allVoters.length; i++) {
            // if (voterState.votingOption[i] == VoteOptionType.Approve) {
                if (getVoterOptionByVoter(allVoters[i], proposalId) == VoteOptionType.Approve) {
                uint256 balanceTransferred = getVoteBalance(allVoters[i], proposalId);
                token.transfer(
                    allVoters[i],
                    balanceTransferred
                );
                emit TransferTokenForProposalRejection(
                    proposalId,
                    allVoters[i],
                    balanceTransferred
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
        // Calculate the time left until the deadline
        if (block.timestamp >= proposalTimeOut) {
            return 0;
        } else {
            return proposalTimeOut - block.timestamp;
        }
    }

    function distrubutionDeadlinePeriod(
        uint256 proposalId
    ) public view returns (uint256) {
        Proposal storage prop = proposal[proposalId];
        require(prop.winningStatus == true, "Proposal has been rejected");
        uint256 claimPeriod = prop.timestamp + (distributionPeriod) + 5 days;
        
        if (block.timestamp >= claimPeriod ) {
            return 0;
        } else {
            return claimPeriod - block.timestamp;
        }
    }

    function claimPeriodReached(uint256 proposalId) public view returns (bool){
        uint256 timeLeft = distrubutionDeadlinePeriod(proposalId);
        if(timeLeft == 0){
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

    // function getClaimStatusByMonth(
    //     uint256 proposalId
    // ) public view returns (bool[] memory) {
    //    bool[] memory claimStatus = new bool[](12);
    //    for(uint256 i=0; i<12; i++){
    //         claimStatus[i] = voterToClaimStatusMonthly[msg.sender][proposalId][i];
    //    }
    //    return claimStatus;
        
    // }

    function addProposal(address _voter, uint _proposalId) public {
        voterProposals[_voter].push(_proposalId);
    }

    function getProposals(address _voter) public view returns (uint[] memory) {
        return voterProposals[_voter];
    }

    function addVoteBalance(address _voter, uint _proposalId, uint256 _voteBalance) public {
        voterToVoteBalance[_voter][_proposalId] = _voteBalance;
    }

    function getVoteBalance(address _voter, uint _proposalId) public view returns (uint256){
        return voterToVoteBalance[_voter][_proposalId];
    }

    function addClaimTimeStamp(address _voter, uint _proposalId, uint256 claimTimeStamp) public {
        voterToClaimTimeStamp[_voter][_proposalId] = claimTimeStamp;
    }

    function getClaimTimeStamp(address _voter, uint _proposalId) public view returns (uint256){
        return voterToClaimTimeStamp[_voter][_proposalId];
    }

    function getProposalIdByVoter(address _voter) public view returns(uint[] memory) {
        return voterProposals[_voter];
    }

    function getVoterOptionByVoter(address _voter, uint _proposalId) public view returns(VoteOptionType) {
        return voterToVoteOption[_voter][_proposalId];
    }

    function addVoterOption(address _voter, uint _proposalId, VoteOptionType voteOptionType) public {
        voterToVoteOption[_voter][_proposalId] = voteOptionType;
    }
}