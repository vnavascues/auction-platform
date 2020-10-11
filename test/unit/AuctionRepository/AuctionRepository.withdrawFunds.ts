import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { duration, latestBlock } from "../../helpers/time";
import {
  BigNumber,
  ContractReceipt,
  ContractTransaction,
  Signer,
} from "ethers";
import { Auction } from "../../types";

export function withdrawFunds(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deedId = "12345";
  let auction: Auction;
  let mockDeedRepository: MockContract;
  let owner: Signer;
  let ownerAddr: string;
  let bidder: Signer;
  let currBidder: Signer;
  let bidderAddr: string;
  let currBidderAddr: string;
  let bidPrice: BigNumber;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    owner = this.signers[1];
    bidder = this.signers[2];
    currBidder = this.signers[3];
    ownerAddr = await owner.getAddress();
    bidderAddr = await bidder.getAddress();
    currBidderAddr = await currBidder.getAddress();

    // Deploy a mock of DeedRepository
    mockDeedRepository = await deployMockContract(
      this.deployer,
      DeedRepositoryArtifact.abi,
    );

    await mockDeedRepository.mock.approve
      .withArgs(this.auctionRepository.address, deedId)
      .returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(ownerAddr, this.auctionRepository.address, deedId)
      .returns();
    await mockDeedRepository.mock.ownerOf.withArgs(deedId).returns(ownerAddr);

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("2"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await this.auctionRepository
      .connect(owner)
      .createAuction(
        deedId,
        startPrice,
        blockDeadline,
        deedRepositoryAddress,
        name,
        deedMetadata,
      );
    auction = (await this.auctionRepository.auctions(0)) as Auction;

    // Bid auction twice
    bidPrice = auction.startPrice.add(ethers.utils.parseUnits("1", "wei"));
    const currBidPrice = bidPrice.add(ethers.utils.parseUnits("1", "wei"));

    await this.auctionRepository
      .connect(bidder)
      .bidAuction(auction.id, { value: bidPrice });
    await this.auctionRepository
      .connect(currBidder)
      .bidAuction(auction.id, { value: currBidPrice });
  });

  beforeEach(async function () {
    snapshotLocId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotLocId);
  });

  after(async function () {
    await revertToSnapshot(snapshotOgId);
  });

  it("reverts if sender has no funds to withdraw", async function () {
    const bidderWoFunds = this.signers[4];

    await expect(
      this.auctionRepository.connect(bidderWoFunds).withdrawFunds(),
    ).to.be.revertedWith("No funds to withdraw");
  });

  it("sets to zero the sender accountBalance", async function () {
    await this.auctionRepository.connect(bidder).withdrawFunds();

    const bidderBal = await this.auctionRepository.accountBalance(bidderAddr);
    expect(bidderBal).to.equal(0);
  });

  it("refunds the sender (current bidder)", async function () {
    const bidderBalBefore = await bidder.getBalance();

    const tx = (await this.auctionRepository
      .connect(bidder)
      .withdrawFunds()) as ContractTransaction;
    const receipt = (await tx.wait()) as ContractReceipt;

    const txGas = tx.gasPrice.mul(receipt.gasUsed);
    const bidderBalAfter = await bidder.getBalance();
    expect(bidderBalAfter).to.equal(bidderBalBefore.add(bidPrice).sub(txGas));
  });

  it("emits the LogWithdrawnFunds event", async function () {
    await expect(this.auctionRepository.connect(bidder).withdrawFunds())
      .to.emit(this.auctionRepository, "LogWithdrawnFunds")
      .withArgs(bidderAddr, bidPrice);
  });
}
