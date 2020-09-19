import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { duration, latestBlock } from "../../helpers/time";
import { Auction } from "../../types";

export function createAuction(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  let mockDeedRepository: MockContract;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    // Deploy a mock of DeedRepository
    mockDeedRepository = await deployMockContract(
      this.deployer,
      DeedRepositoryArtifact.abi,
    );
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

  it("reverts if deedRepositoryAddress is not the contract address", async function () {
    const owner = this.signers[1];
    const notDeedRepositoryAddr = this.auctionRepository.address;
    const deedId = "12345";

    await mockDeedRepository.mock.ownerOf
      .withArgs(deedId)
      .returns(await owner.getAddress());

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = notDeedRepositoryAddr;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.reverted;
  });

  it("reverts if there is no deed by deedId", async function () {
    const owner = this.signers[1];
    const deedId = "12345";
    const notDeedId = "23456";

    await mockDeedRepository.mock.ownerOf
      .withArgs(deedId)
      .returns(await owner.getAddress());

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          notDeedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.reverted;
  });

  it("reverts if sender is not the deed owner", async function () {
    const owner = this.signers[1];
    const notOwner = this.signers[2];
    const deedId = "12345";

    await mockDeedRepository.mock.ownerOf
      .withArgs(deedId)
      .returns(await owner.getAddress());

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(notOwner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.revertedWith("Only deed owner");
  });

  it("reverts if blockDeadline is lte +1 day", async function () {
    const owner = this.signers[1];
    const deedId = "12345";

    await mockDeedRepository.mock.ownerOf
      .withArgs(deedId)
      .returns(await owner.getAddress());

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.revertedWith("Deadline minimum 1 day ahead");
  });

  it("reverts if name is empty string", async function () {
    const owner = this.signers[1];
    const deedId = "12345";

    await mockDeedRepository.mock.ownerOf
      .withArgs(deedId)
      .returns(await owner.getAddress());

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.revertedWith("Name is required");
  });

  it("reverts if deedMetadata is empty string", async function () {
    const owner = this.signers[1];
    const deedId = "12345";

    await mockDeedRepository.mock.ownerOf
      .withArgs(deedId)
      .returns(await owner.getAddress());

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.revertedWith("deedMetadata is required");
  });

  it("reverts if approve() in _approveAndSafeTransferFrom() reverts", async function () {
    const owner = this.signers[1];
    const ownerAddr = await owner.getAddress();
    const deedId = "12345";

    await mockDeedRepository.mock.approve
      .withArgs(this.auctionRepository.address, deedId)
      .reverts();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(ownerAddr, this.auctionRepository.address, deedId)
      .returns();
    await mockDeedRepository.mock.ownerOf.withArgs(deedId).returns(ownerAddr);

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.reverted;
  });

  it("reverts if transferFrom() in _approveAndSafeTransferFrom() reverts", async function () {
    const owner = this.signers[1];
    const ownerAddr = await owner.getAddress();
    const deedId = "12345";

    await mockDeedRepository.mock.approve
      .withArgs(this.auctionRepository.address, deedId)
      .returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(ownerAddr, this.auctionRepository.address, deedId)
      .reverts();
    await mockDeedRepository.mock.ownerOf.withArgs(deedId).returns(ownerAddr);

    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    ).to.be.reverted;
  });
  it("pushes the created auction into auctions", async function () {
    const owner = this.signers[1];
    const ownerAddr = await owner.getAddress();
    const deedId = "12345";

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

    const auction = (await this.auctionRepository.auctions(0)) as Auction;
    expect(auction.id).to.equal(0);
    expect(auction.deedId).to.equal(deedId);
    expect(auction.startPrice).to.equal(startPrice);
    expect(auction.blockDeadline).to.equal(blockDeadline);
    expect(auction.owner).to.equal(ownerAddr);
    expect(auction.active).to.be.true;
    expect(auction.deedRepositoryAddress).to.equal(deedRepositoryAddress);
    expect(auction.ended).to.be.false;
    expect(auction.name).to.equal(name);
    expect(auction.deedMetadata).to.equal(deedMetadata);
  });

  it("pushes the created auction into sender's ownerAuctions", async function () {
    const owner = this.signers[1];
    const ownerAddr = await owner.getAddress();
    const deedId = "12345";

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
    const auction = (await this.auctionRepository.auctions(0)) as Auction;
    const auctionId = await this.auctionRepository.ownerAuctions(ownerAddr, 0);
    expect(auctionId).to.equal(auction.id);
  });

  it("emits the LogCreatedAuction event", async function () {
    const owner = this.signers[1];
    const ownerAddr = await owner.getAddress();
    const deedId = "12345";

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
      .add(duration.seconds("1"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    await expect(
      this.auctionRepository
        .connect(owner)
        .createAuction(
          deedId,
          startPrice,
          blockDeadline,
          deedRepositoryAddress,
          name,
          deedMetadata,
        ),
    )
      .to.emit(this.auctionRepository, "LogCreatedAuction")
      .withArgs(ownerAddr, 0);
  });
}
