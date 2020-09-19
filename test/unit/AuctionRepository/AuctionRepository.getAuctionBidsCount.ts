import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { duration, latestBlock } from "../../helpers/time";
import { Auction } from "../../types";

export function getAuctionBidsCount(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  let auction1: Auction;
  let auction2: Auction;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    const deed1Id = "12345";
    const deed2Id = "23456";
    const owner = this.signers[1];
    const bidder = this.signers[2];
    const ownerAddr = await owner.getAddress();

    // Deploy DeedRepository mocks
    // DeedRepository 1
    const mockDeedRepository1 = await deployMockContract(
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
    const mockDeedRepository2 = await deployMockContract(
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
    const bidPrice = auction1.startPrice.add(
      ethers.utils.parseUnits("1", "wei"),
    );

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

  it("returns zero (no bids)", async function () {
    const bidsCount = await this.auctionRepository.getAuctionBidsCount(
      auction2.id,
    );

    expect(bidsCount).to.equal(0);
  });

  it("returns one (one bid)", async function () {
    const bidsCount = await this.auctionRepository.getAuctionBidsCount(
      auction1.id,
    );

    expect(bidsCount).to.equal(1);
  });
}
