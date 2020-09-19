import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { duration, latestBlock } from "../../helpers/time";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { Signer, BigNumber } from "ethers";
import { Auction } from "../../types";

/**
 * !! Budiler-Waffle currently does not support the following matchers:
 *   * calledOnContract
 *   * calledOnContractWith
 */
export function cancelAuction(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deedId = "12345";
  let auction: Auction;
  let mockDeedRepository: MockContract;
  let owner: Signer;
  let ownerAddr: string;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    owner = this.signers[1];
    ownerAddr = await owner.getAddress();
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

    const startPrice = ethers.utils.parseEther("1.0");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
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

  it("reverts if there is no auction by auctionId", async function () {
    const notAuctionId = auction.id.add("1");

    await expect(
      this.auctionRepository.connect(owner).cancelAuction(notAuctionId),
    ).to.be.reverted;
  });

  it("reverts if sender is not the auction owner", async function () {
    const notOwner = this.signers[2];

    await expect(
      this.auctionRepository.connect(notOwner).cancelAuction(auction.id),
    ).to.be.revertedWith("Only auction owner");
  });

  it("reverts if auction is not active", async function () {
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .returns();

    // Cancel the auction before retry again
    await this.auctionRepository.connect(owner).cancelAuction(auction.id);

    await expect(
      this.auctionRepository.connect(owner).cancelAuction(auction.id),
    ).to.be.revertedWith("Auction is not active");
  });

  it("reverts if approve() in _approveAndSafeTransferFrom() reverts", async function () {
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).reverts();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .returns();

    await expect(
      this.auctionRepository.connect(owner).cancelAuction(auction.id),
    ).to.be.reverted;
  });

  it("reverts if transferFrom() in _approveAndSafeTransferFrom() reverts", async function () {
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .reverts();

    await expect(
      this.auctionRepository.connect(owner).cancelAuction(auction.id),
    ).to.be.reverted;
  });

  context("the auction has bids", async function () {
    let bidder: Signer;
    let bidderAddr: string;
    let currBidPrice: BigNumber;

    beforeEach(async function () {
      bidder = this.signers[2];
      bidderAddr = await bidder.getAddress();

      // Pre-check `bidAuction()` requirements
      const auction_ = (await this.auctionRepository.auctions(
        auction.id,
      )) as Auction;
      let bidsCount = await this.auctionRepository.getAuctionBidsCount(
        auction.id,
      );
      const nextBlock = (await latestBlock())
        .add(duration.networkDeltaBlock())
        .toString();

      expect(auction_.active).to.be.true;
      expect(bidsCount).to.equal("0");
      expect(bidderAddr).to.not.equal(auction_.owner);
      expect(nextBlock).to.lt(auction_.blockDeadline);

      // Add a bid
      currBidPrice = auction.startPrice.add(
        ethers.utils.parseUnits("1", "wei"),
      );
      await this.auctionRepository
        .connect(bidder)
        .bidAuction(auction.id, { value: currBidPrice });

      // Post-check
      bidsCount = await this.auctionRepository.getAuctionBidsCount(auction.id);
      expect(bidsCount).to.equal("1");
    });

    it("adds the current bid price to the current bidder accountBalance", async function () {
      await mockDeedRepository.mock.approve
        .withArgs(ownerAddr, deedId)
        .returns();
      await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
        .withArgs(this.auctionRepository.address, ownerAddr, deedId)
        .returns();

      const bidderBalBefore = await this.auctionRepository.accountBalance(
        bidderAddr,
      );

      await this.auctionRepository.connect(owner).cancelAuction(auction.id);

      const bidderBalAfter = await this.auctionRepository.accountBalance(
        bidderAddr,
      );
      expect(bidderBalAfter).to.equal(bidderBalBefore.add(currBidPrice));
    });
  });

  it("sets the auction active property to false", async function () {
    const count = await this.auctionRepository.getAuctionBidsCount(auction.id);
    expect(count).to.equal(0);
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .returns();

    await this.auctionRepository.connect(owner).cancelAuction(auction.id);

    const deactAuction = (await this.auctionRepository.auctions(
      auction.id,
    )) as Auction;

    expect(deactAuction.active).to.be.false;
    // No other auction properties are altered
    expect(deactAuction.id).to.equal(auction.id);
    expect(deactAuction.deedId).to.equal(auction.deedId);
    expect(deactAuction.startPrice).to.equal(auction.startPrice);
    expect(deactAuction.blockDeadline).to.equal(auction.blockDeadline);
    expect(deactAuction.owner).to.equal(auction.owner);
    expect(deactAuction.deedRepositoryAddress).to.equal(
      auction.deedRepositoryAddress,
    );
    expect(deactAuction.ended).to.equal(auction.ended);
    expect(deactAuction.name).to.equal(auction.name);
    expect(deactAuction.deedMetadata).to.equal(auction.deedMetadata);
  });

  it("emits the LogCancelledAuction event", async function () {
    const count = await this.auctionRepository.getAuctionBidsCount(auction.id);
    expect(count).to.equal(0);
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .returns();

    await expect(
      this.auctionRepository.connect(owner).cancelAuction(auction.id),
    )
      .to.emit(this.auctionRepository, "LogCancelledAuction")
      .withArgs(ownerAddr, auction.id);
  });
}
