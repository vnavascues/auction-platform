// SPDX-License-Identifier: CC-BY-NC-SA-4.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@nomiclabs/buidler/console.sol";
// import "@openzeppelin/contracts-ethereum-package/contracts/utils/Initializable.sol";
// import "./DeedRepository.sol";
import {
    Initializable as TrustedInitializable
} from "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import {
    SafeMath as TrustedSafeMath
} from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import {
    IERC721Receiver as TrustedIERC721Receiver
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Receiver.sol";
import {DeedRepository as TrustedDeedRepository} from "./DeedRepository.sol";

/**
 * @title Mastering Ethereum Chapter 12, AuctionRepository contract.
 * @author Victor Navascues.
 * @notice This contract allows create auctions for non-fungible tokens.
 * @dev This contract is upgradable by inheriting from the OpenZeppelin
 * Inizializable.sol contract.
 */
contract AuctionRepository is TrustedInitializable, TrustedIERC721Receiver {
    using TrustedSafeMath for uint256;

    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;
    bool private _locked;
    struct Auction {
        uint256 id;
        uint256 deedId;
        uint256 startPrice;
        uint256 blockDeadline;
        address owner;
        bool active;
        address deedRepositoryAddress;
        bool ended;
        string name;
        string deedMetadata;
    }
    struct Bid {
        uint256 price;
        address from;
    }
    Auction[] public auctions;
    mapping(uint256 => Bid[]) public auctionBids;
    mapping(address => uint256[]) public ownerAuctions;
    mapping(address => uint256) public accountBalance;

    /**
     * @dev Triggered after an auction bid has been created.
     * @param _by the bidder address (sender).
     * @param _auctionId the auction identifier.
     */
    event LogBiddedAuction(address _by, uint256 _auctionId);
    /**
     * @dev Triggered after an auction has been created.
     * @param _by the auction owner address (sender).
     * @param _auctionId the auction identifier.
     */
    event LogCreatedAuction(address _by, uint256 _auctionId);
    /**
     * @dev Triggered after an auction has been cancelled (not active).
     * @param _by the auction owner address (sender).
     * @param _auctionId the auction identifier.
     */
    event LogCancelledAuction(address _by, uint256 _auctionId);
    /**
     * @dev Triggered after an auction has ended.
     * @param _by the auction owner address (sender).
     * @param _auctionId the auction identifier.
     */
    event LogEndedAuction(address _by, uint256 _auctionId);
    /**
     * @dev Triggered after a deed has changed ownership (standard ERC721).
     * @param _operator the DeedRepository contract address (approved).
     * @param _from the previous deed owner (sender).
     * @param _deedId the deed identifier.
     */
    event LogReceivedDeed(address _operator, address _from, uint256 _deedId);
    /**
     * @dev Triggered after an account has withdrawn its funds.
     * @param _to the account address (sender).
     * @param _value the total amount withdrawn.
     */
    event LogWithdrawnFunds(address _to, uint256 _value);

    /**
     * @dev Prevent reentrancy attacks.
     */
    modifier noReentrancyMutex {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
    /**
     * @dev Prevent access to anyone except the auction owner.
     */
    modifier onlyAuctionOwner(uint256 _auctionId) {
        require(auctions[_auctionId].owner == msg.sender, "Only auction owner");
        _;
    }
    /**
     * @dev Prevent the access by the auction owner.
     */
    modifier onlyNotAuctionOwner(uint256 _auctionId) {
        require(
            auctions[_auctionId].owner != msg.sender,
            "Only not auction owner"
        );
        _;
    }
    /**
     * @dev Prevent access to anyone except the deed owner.
     */
    modifier onlyDeedOwner(address _deedRepositoryAddress, uint256 _deedId) {
        address deedOwner = TrustedDeedRepository(_deedRepositoryAddress)
            .ownerOf(_deedId);
        require(deedOwner == msg.sender, "Only deed owner");
        _;
    }

    /**
     * @dev Create an upgradable AuctionRepository, and set the
     * noReentrancyMutex flag to false.
     */
    function initialize() public initializer {
        _locked = false;
    }

    /**
     * @notice Get the auction bids by auction ID.
     * @param _auctionId the auction identifer (array index).
     * @return an array of bids (structs).
     */
    function getAuctionBids(uint256 _auctionId)
        public
        view
        returns (Bid[] memory)
    {
        return auctionBids[_auctionId];
    }

    /**
     * @notice Get the number of bids in the auction by auction ID.
     * @param _auctionId the auction identifer (array index).
     * @return the number of bids.
     */
    function getAuctionBidsCount(uint256 _auctionId)
        public
        view
        returns (uint256)
    {
        return auctionBids[_auctionId].length;
    }

    /**
     * @notice Get the current auction by auction ID.
     * @param _auctionId the auction identifer (array index).
     * @return the current bid (struct) if exists, otherwise a default bid.
     */
    function getAuctionCurrentBid(uint256 _auctionId)
        public
        view
        returns (Bid memory)
    {
        uint256 bidsLength = auctionBids[_auctionId].length;
        if (bidsLength == 0) {
            Bid memory noBid;
            return noBid;
        }
        return auctionBids[_auctionId][bidsLength - 1];
    }

    /**
     * @notice Get the number of auctions.
     * @return the number of auctions.
     */
    function getAuctionsCount() public view returns (uint256) {
        return auctions.length;
    }

    /**
     * @notice Get the owner auctions by owner address.
     * @param _owner the owner address.
     * @return the number of auctions.
     */
    function getOwnerAuctionsCount(address _owner)
        public
        view
        returns (uint256)
    {
        return ownerAuctions[_owner].length;
    }

    /**
     * @notice Bid an auction by auction ID.
     * @dev The auction owner can't bid on it. If the current bid is outbidded
     * (gt current bid price) following a pull pattern, the current bid will be
     * reimbursed to its bidder (it requires to withdraw the funds).
     * @param _auctionId the auction identifer (array index).
     */
    function bidAuction(uint256 _auctionId)
        external
        payable
        onlyNotAuctionOwner(_auctionId)
    {
        Auction memory auction = auctions[_auctionId];

        require(auction.active, "Auction is not active");
        require(
            // solhint-disable-next-line not-rely-on-time
            block.timestamp < auction.blockDeadline,
            "Auction deadline is past"
        );

        uint256 bidsLength = auctionBids[_auctionId].length;
        Bid memory currentBid;

        if (bidsLength == 0) {
            require(msg.value > auction.startPrice, "Bid below starting price");
        } else {
            currentBid = auctionBids[_auctionId][bidsLength - 1];
            require(msg.value > currentBid.price, "Bid below current bid");
        }

        auctionBids[_auctionId].push(Bid({from: msg.sender, price: msg.value}));

        if (bidsLength > 0) {
            accountBalance[currentBid.from] = accountBalance[currentBid.from]
                .add(currentBid.price);
        }

        emit LogBiddedAuction(msg.sender, _auctionId);
    }

    /**
     * @notice Bid an auction by auction ID.
     * @dev Only the auction owner can cancel it (the deed is transferred back).
     * If there are bids, following a pull pattern, the current bid will be
     * reimbursed its bidder (it requires to withdraw the funds).
     * @param _auctionId the auction identifer (array index).
     */
    function cancelAuction(uint256 _auctionId)
        public
        onlyAuctionOwner(_auctionId)
    {
        Auction storage auction = auctions[_auctionId];

        require(auction.active, "Auction is not active");
        auction.active = false;

        uint256 bidsLength = auctionBids[_auctionId].length;

        _approveAndSafeTransferFrom(
            address(this),
            auction.owner,
            auction.deedRepositoryAddress,
            auction.deedId
        );

        if (bidsLength > 0) {
            Bid memory currentBid = auctionBids[_auctionId][bidsLength - 1];
            accountBalance[currentBid.from] += currentBid.price;
        }

        emit LogCancelledAuction(msg.sender, _auctionId);
    }

    /**
     * @notice Create an auction.
     * @dev Only the deed owner can create it. It pushes the auction into the
     * auctions array, and in the ownerAuctions array. Finally the deed is
     * transferred to this contract.
     * @param _deedId the deed identifier.
     * @param _startPrice the starting auction price in ether.
     * @param _blockDeadline the block number when the auction ends.
     * @param _deedRepositoryAddress the deed address (contract).
     * @param _name the auction name.
     * @param _deedMetadata the deed metadata.
     */
    function createAuction(
        uint256 _deedId,
        uint256 _startPrice,
        uint256 _blockDeadline,
        address _deedRepositoryAddress,
        string calldata _name,
        string calldata _deedMetadata
    ) external onlyDeedOwner(_deedRepositoryAddress, _deedId) {
        require(
            // solhint-disable-next-line not-rely-on-time
            _blockDeadline > block.timestamp + 1 days,
            "Deadline minimum 1 day ahead"
        );
        bytes memory name = bytes(_name);
        require(name.length > 0, "Name is required");
        bytes memory deedMetadata = bytes(_deedMetadata);
        require(deedMetadata.length > 0, "deedMetadata is required");

        Auction memory auction;
        auction.id = auctions.length;
        auction.deedId = _deedId;
        auction.startPrice = _startPrice;
        auction.blockDeadline = _blockDeadline;
        auction.owner = msg.sender;
        auction.active = true;
        auction.deedRepositoryAddress = _deedRepositoryAddress;
        auction.ended = false;
        auction.name = _name;
        auction.deedMetadata = _deedMetadata;

        auctions.push(auction);
        ownerAuctions[msg.sender].push(auction.id);

        _approveAndSafeTransferFrom(
            msg.sender,
            address(this),
            auction.deedRepositoryAddress,
            auction.deedId
        );

        emit LogCreatedAuction(msg.sender, auction.id);
    }

    /**
     * @notice End an auction.
     * @dev Only the auction owner can end it. If there are bids, following a
     * pull pattern, the current bid will be paid to the auction owner (it
     * requires to withdraw the funds) and the deed ownership transferred
     * to the current bidder. If there are no bids the deed ownership will be
     * transferred back to its owner.
     * @param _auctionId the auction identifer (array index).
     */
    function endAuction(uint256 _auctionId)
        public
        onlyAuctionOwner(_auctionId)
    {
        Auction storage auction = auctions[_auctionId];

        require(!auction.ended, "Auction has already ended");
        require(
            // solhint-disable-next-line not-rely-on-time
            block.timestamp < auction.blockDeadline,
            "Auction deadline is past"
        );
        auction.ended = true;

        if (auction.active == true) {
            auction.active = false;
            uint256 bidsLength = auctionBids[_auctionId].length;

            if (bidsLength > 0) {
                Bid memory currentBid = auctionBids[_auctionId][bidsLength - 1];
                accountBalance[auction.owner] = accountBalance[auction.owner]
                    .add(currentBid.price);

                _approveAndSafeTransferFrom(
                    address(this),
                    currentBid.from,
                    auction.deedRepositoryAddress,
                    auction.deedId
                );
            } else {
                _approveAndSafeTransferFrom(
                    address(this),
                    auction.owner,
                    auction.deedRepositoryAddress,
                    auction.deedId
                );
            }
        }

        emit LogEndedAuction(msg.sender, _auctionId);
    }

    /**
     * @dev This function is required by the ERC721 safeTransferFrom().
     * @param _operator the DeedRepository contract address (approved).
     * @param _from the previous deed owner (sender).
     * @param _deedId the deed identifier.
     */
    function onERC721Received(
        address _operator,
        address _from,
        uint256 _deedId,
        bytes calldata _data // solhint-disable no-unused-vars
    ) external override returns (bytes4) {
        emit LogReceivedDeed(_operator, _from, _deedId);
        return _ERC721_RECEIVED;
    }

    /**
     * @dev This function transfers the deed ownership in a safe way.
     * @param _from the current deed owner address.
     * @param _to the next deed owner address.
     * @param _deedRepositoryAddress the deed contract address.
     * @param _deedId the deed identifier.
     */
    function _approveAndSafeTransferFrom(
        address _from,
        address _to,
        address _deedRepositoryAddress,
        uint256 _deedId
    ) private {
        TrustedDeedRepository remoteContract = TrustedDeedRepository(
            _deedRepositoryAddress
        );
        remoteContract.approve(_to, _deedId);
        remoteContract.safeTransferFrom(_from, _to, _deedId);
    }

    /**
     * @notice Withdraw the funds after salling a deed or being outbidded.
     * @dev The account balance is set to zero and all funds are sent at once.
     */
    function withdrawFunds() public noReentrancyMutex {
        require(accountBalance[msg.sender] > 0, "No funds to withdraw");
        uint256 funds = accountBalance[msg.sender];
        accountBalance[msg.sender] = 0;
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = msg.sender.call{value: funds}("");
        require(success, "Withdrawal failed");

        emit LogWithdrawnFunds(msg.sender, funds);
    }
}
