// SPDX-License-Identifier: CC-BY-NC-SA-4.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@nomiclabs/buidler/console.sol";
import {
    ERC721UpgradeSafe as TrustedERC721UpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/ERC721.sol";
import {
    Initializable as TrustedInitializable
} from "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

/**
 * @title Mastering Ethereum Chapter 12, DeedRepository contract.
 * @author Victor Navascues.
 * @notice This contract contains the list of deeds registered by users.
 * This is a demo to show how deeds can be minted and added to the repository.
 * @dev This contract is an ERC721 upgradable by inheriting from both
 * OpenZeppelin Inizializable.sol and ERC721UpgradeSafe.sol contracts.
 */
contract DeedRepository is TrustedInitializable, TrustedERC721UpgradeSafe {
    /**
     * @dev Tiggered after the token has been successfully minted and its URI
     * set.
     * @param _by the registrar address (sender).
     * @param _deedId the deed identifier.
     */

    event LogMintedDeed(address _by, uint256 _deedId);
    /**
     * @dev Triggered after the token URI has been successfully set.
     * @param _by the registrar address (sender).
     * @param _deedId the deed identifier.
     */
    event LogSetDeedMetadata(address _by, uint256 _deedId);

    /**
     * @dev Create an upgradable DeedRepository with name and symbol (ERC721).
     * @param _name the repository name.
     * @param _symbol the repository symbol.
     */
    function initialize(string memory _name, string memory _symbol)
        public
        initializer
    {
        TrustedERC721UpgradeSafe.__ERC721_init(_name, _symbol);
    }

    /**
     * @notice Mint (register) a new deed, and set its metadata.
     * @dev Call the ERC721UpgradeSafe minter, set its metadata, and log the
     * minted deed event.
     * @param _deedId the deed identifier.
     * @param _metadata the deed metadata.
     */
    function mintDeed(uint256 _deedId, string memory _metadata) public {
        _mint(msg.sender, _deedId);
        setDeedMetadata(_deedId, _metadata);
        emit LogMintedDeed(msg.sender, _deedId);
    }

    /**
     * @notice Set a deed metadata.
     * @dev Set the token URI, and log the set URI event.
     * @param _deedId the deed identifier.
     * @param _metadata the deed metadata.
     */
    function setDeedMetadata(uint256 _deedId, string memory _metadata) public {
        require(ownerOf(_deedId) == msg.sender, "Only deed owner");
        _setTokenURI(_deedId, _metadata);
        emit LogSetDeedMetadata(msg.sender, _deedId);
    }
}
