import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { advanceBlockAt, duration, latestBlock } from "../../helpers/time";
import { Signer, BigNumber } from "ethers";
import { Auction, Bid } from "../../types";

/**
 * !! Budiler-Waffle currently does not support the following matchers:
 *   * calledOnContract
 *   * calledOnContractWith
 */
export function bidAuction(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deedId = "12345";
  let auction: Auction;
  let mockDeedRepository: MockContract;
  let owner: Signer;
  let ownerAddr: string;
  let bidder: Signer;
  let bidderAddr: string;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    owner = this.signers[1];
    bidder = this.signers[2];
    ownerAddr = await owner.getAddress();
    bidderAddr = await bidder.getAddress();

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
    const currBidPrice = auction.startPrice.add(
      ethers.utils.parseUnits("1", "wei"),
    );

    await expect(
      this.auctionRepository
        .connect(bidder)
        .bidAuction(notAuctionId, { value: currBidPrice }),
    ).to.be.reverted;
  });

  it("reverts if sender is the auction owner", async function () {
    const currBidPrice = auction.startPrice.add(
      ethers.utils.parseUnits("1", "wei"),
    );

    await expect(
      this.auctionRepository
        .connect(owner)
        .bidAuction(auction.id, { value: currBidPrice }),
    ).to.be.revertedWith("Only not auction owner");
  });

  it("reverts if the auction is not active", async function () {
    const currBidPrice = auction.startPrice.add(
      ethers.utils.parseUnits("1", "wei"),
    );
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .returns();

    // Cancel the auction before bidding
    await this.auctionRepository.connect(owner).cancelAuction(auction.id);

    await expect(
      this.auctionRepository
        .connect(bidder)
        .bidAuction(auction.id, { value: currBidPrice }),
    ).to.be.revertedWith("Auction is not active");
  });

  it("reverts if current block timestamp is gte than the auction blockDeadline", async function () {
    const currBidPrice = auction.startPrice.add(
      ethers.utils.parseUnits("1", "wei"),
    );
    await advanceBlockAt(
      auction.blockDeadline.sub(duration.networkDeltaBlock()),
    );

    await expect(
      this.auctionRepository
        .connect(bidder)
        .bidAuction(auction.id, { value: currBidPrice }),
    ).to.be.revertedWith("Auction deadline is past");
  });

  context("the auction does not have bids", async function () {
    it("reverts if msg value is lte the auction startPrice", async function () {
      const currBidPrice = auction.startPrice;
      await advanceBlockAt(
        auction.blockDeadline
          .sub(duration.seconds("1"))
          .sub(duration.networkDeltaBlock()),
      );

      await expect(
        this.auctionRepository
          .connect(bidder)
          .bidAuction(auction.id, { value: currBidPrice }),
      ).to.be.revertedWith("Bid below starting price");
    });

    it("pushes the created auction bid into auctionBids", async function () {
      const currBidPrice = auction.startPrice.add(
        ethers.utils.parseUnits("1", "wei"),
      );

      await this.auctionRepository
        .connect(bidder)
        .bidAuction(auction.id, { value: currBidPrice });

      const currBid = (await this.auctionRepository.getAuctionCurrentBid(
        auction.id,
      )) as Bid;

      expect(currBid.price).to.equal(currBidPrice);
      expect(currBid.from).to.equal(bidderAddr);
    });

    it("emits the LogBiddedAuction event", async function () {
      const currBidPrice = auction.startPrice.add(
        ethers.utils.parseUnits("1", "wei"),
      );

      await expect(
        this.auctionRepository
          .connect(bidder)
          .bidAuction(auction.id, { value: currBidPrice }),
      )
        .to.emit(this.auctionRepository, "LogBiddedAuction")
        .withArgs(bidderAddr, auction.id);
    });
  });
  context("the auction has bids", async function () {
    let currBidder: Signer;
    let currBidderAddr: string;
    let currBidPrice: BigNumber;

    beforeEach(async function () {
      currBidder = this.signers[3];
      currBidderAddr = await currBidder.getAddress();
      currBidPrice = auction.startPrice.add(
        ethers.utils.parseUnits("1", "wei"),
      );
      // Pre-check `cancelAuction` requirements
      const nextBlock = (await latestBlock())
        .add(duration.networkDeltaBlock())
        .toString();

      expect(currBidPrice).to.gt(auction.startPrice);
      expect(nextBlock).to.lt(auction.blockDeadline.sub(duration.seconds("1")));

      // Add a bid
      await this.auctionRepository
        .connect(currBidder)
        .bidAuction(auction.id, { value: currBidPrice });

      // Post-check
      const currBid = (await this.auctionRepository.getAuctionCurrentBid(
        auction.id,
      )) as Bid;

      expect(currBid.price).to.equal(currBidPrice);
      expect(currBid.from).to.equal(currBidderAddr);
    });

    it("reverts if msg value is lte the auction current bid", async function () {
      await expect(
        this.auctionRepository
          .connect(bidder)
          .bidAuction(auction.id, { value: currBidPrice }),
      ).to.be.revertedWith("Bid below current bid");
    });

    it("pushes the created auction bid into auctionBids", async function () {
      const bidPrice = currBidPrice.add(ethers.utils.parseUnits("1", "wei"));

      await this.auctionRepository
        .connect(bidder)
        .bidAuction(auction.id, { value: bidPrice });

      const newCurrBid = (await this.auctionRepository.getAuctionCurrentBid(
        auction.id,
      )) as Bid;

      expect(newCurrBid.price).to.equal(bidPrice);
      expect(newCurrBid.from).to.equal(bidderAddr);
    });

    it("adds the current bid price to the current bidder accountBalance", async function () {
      const bidPrice = currBidPrice.add(ethers.utils.parseUnits("1", "wei"));
      const currBidderBalBefore = await this.auctionRepository.accountBalance(
        currBidderAddr,
      );

      await this.auctionRepository
        .connect(bidder)
        .bidAuction(auction.id, { value: bidPrice });

      const currBidderBalAfter = await this.auctionRepository.accountBalance(
        currBidderAddr,
      );
      expect(currBidderBalAfter).to.equal(
        currBidderBalBefore.add(currBidPrice),
      );
    });
  });
}
