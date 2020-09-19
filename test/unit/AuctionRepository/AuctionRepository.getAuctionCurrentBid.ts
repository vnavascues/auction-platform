import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { duration, latestBlock } from "../../helpers/time";
import { BigNumber, Signer } from "ethers";
import { Auction, Bid } from "../../types";

export function getAuctionCurrentBid(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deed1Id = "12345";
  const deed2Id = "23456";
  let auction1: Auction;
  let auction2: Auction;
  let mockDeedRepository1: MockContract;
  let mockDeedRepository2: MockContract;
  let owner: Signer;
  let ownerAddr: string;
  let bidder: Signer;
  let bidderAddr: string;
  let bidPrice: BigNumber;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    owner = this.signers[1];
    bidder = this.signers[2];
    ownerAddr = await owner.getAddress();
    bidderAddr = await bidder.getAddress();

    // Deploy DeedRepository mocks
    // DeedRepository 1
    mockDeedRepository1 = await deployMockContract(
      this.deployer,
      DeedRepositoryArtifact.abi,
    );

    await mockDeedRepository1.mock.approve
      .withArgs(this.auctionRepository.address, deed1Id)
      .returns();
    await mockDeedRepository1.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(ownerAddr, this.auctionRepository.address, deed1Id)
      .returns();
    await mockDeedRepository1.mock.ownerOf.withArgs(deed1Id).returns(ownerAddr);

    // DeedRepository 2
    mockDeedRepository2 = await deployMockContract(
      this.deployer,
      DeedRepositoryArtifact.abi,
    );

    await mockDeedRepository2.mock.approve
      .withArgs(this.auctionRepository.address, deed2Id)
      .returns();
    await mockDeedRepository2.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(ownerAddr, this.auctionRepository.address, deed2Id)
      .returns();
    await mockDeedRepository2.mock.ownerOf.withArgs(deed2Id).returns(ownerAddr);

    // Create Auctions
    const startPrice1 = ethers.utils.parseEther("1");
    const startPrice2 = ethers.utils.parseEther("2");
    const blockDeadline1 = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("2"))
      .toString();
    const blockDeadline2 = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("2"))
      .add(duration.seconds("2"))
      .toString();
    const deedRepository1Address = mockDeedRepository1.address;
    const deedRepository2Address = mockDeedRepository2.address;
    const name1 = "Auction 1";
    const name2 = "Auction 2";
    const deedMetadata1 = "token metadata";
    const deedMetadata2 = "token metadata";

    // Auction 1
    await this.auctionRepository
      .connect(owner)
      .createAuction(
        deed1Id,
        startPrice1,
        blockDeadline1,
        deedRepository1Address,
        name1,
        deedMetadata1,
      );
    auction1 = (await this.auctionRepository.auctions(0)) as Auction;

    // Auction 2
    await this.auctionRepository
      .connect(owner)
      .createAuction(
        deed2Id,
        startPrice2,
        blockDeadline2,
        deedRepository2Address,
        name2,
        deedMetadata2,
      );
    auction2 = (await this.auctionRepository.auctions(1)) as Auction;

    // Bid auctions (leaving empty Auction 2)
    // Bid Auction 1
    bidPrice = auction1.startPrice.add(ethers.utils.parseUnits("1", "wei"));

    await this.auctionRepository
      .connect(bidder)
      .bidAuction(auction1.id, { value: bidPrice });
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

  it("returns an unitialised bid if the auction does not have bids", async function () {
    const noBid = (await this.auctionRepository.getAuctionCurrentBid(
      auction2.id,
    )) as Bid;

    expect(noBid.from).to.equal(ethers.constants.AddressZero);
    expect(noBid.price).to.equal(0);
  });

  it("returns the current auction bid", async function () {
    const bid = (await this.auctionRepository.getAuctionCurrentBid(
      auction1.id,
    )) as Bid;

    expect(bid.from).to.equal(bidderAddr);
    expect(bid.price).to.equal(bidPrice);
  });
}
