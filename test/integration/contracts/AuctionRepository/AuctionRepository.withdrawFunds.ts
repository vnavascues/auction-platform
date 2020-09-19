import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract, deployContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../../build/artifacts/DeedRepository.json";
import ReentrancyBidderArtifact from "../../../../build/artifacts/ReentrancyBidder.json";
import { ReentrancyBidder } from "../../../../build/typechain/ReentrancyBidder";
import { takeSnapshot, revertToSnapshot } from "../../../helpers/snapshot";
import { duration, latestBlock } from "../../../helpers/time";
import { BigNumber, Signer } from "ethers";
import { Auction } from "../../../types";

export function withdrawFundsReentrancy(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deedId = "12345";
  let auction: Auction;
  let mockDeedRepository: MockContract;
  let owner: Signer;
  let ownerAddr: string;
  let bidder: Signer;
  let bidPrice: BigNumber;
  let attacker: Signer;
  let reentrancyBidder: ReentrancyBidder;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    owner = this.signers[1];
    bidder = this.signers[2];
    attacker = this.signers[3];
    ownerAddr = await owner.getAddress();

    // Deploy ReentrancyBidder contract (requires AuctionRepository address)
    reentrancyBidder = (await deployContract(
      attacker,
      ReentrancyBidderArtifact,
      [this.auctionRepository.address],
    )) as ReentrancyBidder;

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
    // NB: The first bid must be done by the attacker via the bidAuction function in
    // ReentrancyBidder.
    bidPrice = auction.startPrice.add(ethers.utils.parseUnits("1", "wei"));
    const currBidPrice = bidPrice.add(ethers.utils.parseUnits("1", "wei"));

    await reentrancyBidder
      .connect(attacker)
      .bidAuction(auction.id, { value: bidPrice });
    await this.auctionRepository
      .connect(bidder)
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

  it("prevents an attacker to withdrawn more than the accountBalance", async function () {
    const reBalBefore = await ethers.provider.getBalance(
      reentrancyBidder.address,
    );
    const arBalBefore = await ethers.provider.getBalance(
      this.auctionRepository.address,
    );

    await reentrancyBidder.connect(attacker).withdrawFunds();

    const reBalAfter = await ethers.provider.getBalance(
      reentrancyBidder.address,
    );
    const arBalAfter = await ethers.provider.getBalance(
      this.auctionRepository.address,
    );
    expect(reBalAfter).to.equal(reBalBefore.add(bidPrice));
    expect(arBalAfter).to.equal(arBalBefore.sub(bidPrice));
  });
}
