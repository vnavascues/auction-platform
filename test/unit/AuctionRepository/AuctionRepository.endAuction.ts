import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import { MockContract } from "ethereum-waffle";
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { advanceBlockAt, duration, latestBlock } from "../../helpers/time";
import { Signer, BigNumber } from "ethers";
import { Auction } from "../../types";

/**
 * !! Budiler-Waffle currently does not support the following matchers:
 *   * calledOnContract
 *   * calledOnContractWith
 */
export function endAuction(): void {
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
    await expect(this.auctionRepository.connect(owner).endAuction(notAuctionId))
      .to.be.reverted;
  });

  it("reverts if sender is not the auction owner", async function () {
    const notOwner = this.signers[2];
    await expect(
      this.auctionRepository.connect(notOwner).endAuction(auction.id),
    ).to.be.revertedWith("Only auction owner");
  });

  it("reverts if the auction has ended", async function () {
    await mockDeedRepository.mock.approve.withArgs(ownerAddr, deedId).returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(this.auctionRepository.address, ownerAddr, deedId)
      .returns();

    // End the auction before retry again
    await this.auctionRepository.connect(owner).endAuction(auction.id);

    await expect(
      this.auctionRepository.connect(owner).endAuction(auction.id),
    ).to.be.revertedWith("Auction has already ended");
  });

  it("reverts if current block timestamp is gte than the auction blockDeadline", async function () {
    await advanceBlockAt(
      auction.blockDeadline.sub(duration.networkDeltaBlock()),
    );

    await expect(
      this.auctionRepository.connect(owner).endAuction(auction.id),
    ).to.be.revertedWith("Auction deadline is past");
  });

  context("the auction is not active", async function () {
    let deactAuction: Auction;

    beforeEach(async function () {
      // Pre-check `cancelAuction` requirements
      const auction_ = (await this.auctionRepository.auctions(
        auction.id,
      )) as Auction;

      expect(auction_.active).to.be.true;
      expect(auction_.owner).to.equal(ownerAddr);

      // Cancel auction
      await mockDeedRepository.mock.approve
        .withArgs(ownerAddr, deedId)
        .returns();
      await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
        .withArgs(this.auctionRepository.address, ownerAddr, deedId)
        .returns();

      await this.auctionRepository.connect(owner).cancelAuction(auction.id);

      // Post-checks
      deactAuction = (await this.auctionRepository.auctions(
        auction.id,
      )) as Auction;

      expect(deactAuction.active).to.be.false;
    });

    it("sets the auction ended property to true", async function () {
      await this.auctionRepository.connect(owner).endAuction(deactAuction.id);

      const endedAuction = (await this.auctionRepository.auctions(
        deactAuction.id,
      )) as Auction;

      expect(endedAuction.ended).to.be.true;
      // No other auction properties are altered
      expect(endedAuction.id).to.equal(deactAuction.id);
      expect(endedAuction.deedId).to.equal(deactAuction.deedId);
      expect(endedAuction.startPrice).to.equal(deactAuction.startPrice);
      expect(endedAuction.blockDeadline).to.equal(deactAuction.blockDeadline);
      expect(endedAuction.owner).to.equal(deactAuction.owner);
      expect(endedAuction.active).to.equal(deactAuction.active);
      expect(endedAuction.deedRepositoryAddress).to.equal(
        deactAuction.deedRepositoryAddress,
      );
      expect(endedAuction.name).to.equal(deactAuction.name);
      expect(endedAuction.deedMetadata).to.equal(deactAuction.deedMetadata);
    });

    it("emits the LogEndedAuction event", async function () {
      await expect(
        this.auctionRepository.connect(owner).endAuction(deactAuction.id),
      )
        .to.emit(this.auctionRepository, "LogEndedAuction")
        .withArgs(ownerAddr, deactAuction.id);
    });
  });

  context("the auction is active", async function () {
    context("the auction has bids", async function () {
      let bidder: Signer;
      let bidderAddr: string;
      let currBidPrice: BigNumber;

      beforeEach(async function () {
        bidder = this.signers[2];
        bidderAddr = await bidder.getAddress();

        // Pre-check `cancelAuction` requirements
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
        bidsCount = await this.auctionRepository.getAuctionBidsCount(
          auction.id,
        );
        expect(bidsCount).to.equal("1");
      });

      it("reverts if approve() in _approveAndSafeTransferFrom() reverts", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(bidderAddr, deedId)
          .reverts();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, bidderAddr, deedId)
          .returns();

        await expect(
          this.auctionRepository.connect(owner).endAuction(auction.id),
        ).to.be.reverted;
      });

      it("reverts if transferFrom() in _approveAndSafeTransferFrom() reverts", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(bidderAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, bidderAddr, deedId)
          .reverts();

        await expect(
          this.auctionRepository.connect(owner).endAuction(auction.id),
        ).to.be.reverted;
      });

      it("adds the current bid price to the auction owner accountBalance", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(bidderAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, bidderAddr, deedId)
          .returns();

        const ownerBalBefore = await this.auctionRepository.accountBalance(
          ownerAddr,
        );

        await this.auctionRepository.connect(owner).endAuction(auction.id);

        const ownerBalAfter = await this.auctionRepository.accountBalance(
          ownerAddr,
        );
        expect(ownerBalAfter).to.equal(ownerBalBefore.add(currBidPrice));
      });

      it("sets the auction ended property to true, and the auction active property to false", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(bidderAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, bidderAddr, deedId)
          .returns();

        await this.auctionRepository.connect(owner).endAuction(auction.id);

        const endedAuction = (await this.auctionRepository.auctions(
          auction.id,
        )) as Auction;

        expect(endedAuction.ended).to.be.true;
        expect(endedAuction.active).to.be.false;
        // No other auction properties are altered
        expect(endedAuction.id).to.equal(auction.id);
        expect(endedAuction.deedId).to.equal(auction.deedId);
        expect(endedAuction.startPrice).to.equal(auction.startPrice);
        expect(endedAuction.blockDeadline).to.equal(auction.blockDeadline);
        expect(endedAuction.owner).to.equal(auction.owner);
        expect(endedAuction.deedRepositoryAddress).to.equal(
          auction.deedRepositoryAddress,
        );
        expect(endedAuction.name).to.equal(auction.name);
        expect(endedAuction.deedMetadata).to.equal(auction.deedMetadata);
      });

      it("emits the LogEndedAuction event", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(bidderAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, bidderAddr, deedId)
          .returns();

        await expect(
          this.auctionRepository.connect(owner).endAuction(auction.id),
        )
          .to.emit(this.auctionRepository, "LogEndedAuction")
          .withArgs(ownerAddr, auction.id);
      });
    });

    context("the auction does not have bids", async function () {
      it("reverts if approve() in _approveAndSafeTransferFrom() reverts", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(ownerAddr, deedId)
          .reverts();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, ownerAddr, deedId)
          .returns();

        await expect(
          this.auctionRepository.connect(owner).endAuction(auction.id),
        ).to.be.reverted;
      });

      it("reverts if transferFrom() in _approveAndSafeTransferFrom() reverts", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(ownerAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, ownerAddr, deedId)
          .reverts();

        await expect(
          this.auctionRepository.connect(owner).endAuction(auction.id),
        ).to.be.reverted;
      });

      it("sets the auction ended property to true, and the auction active property to false", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(ownerAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, ownerAddr, deedId)
          .returns();

        await this.auctionRepository.connect(owner).endAuction(auction.id);

        const endedAuction = (await this.auctionRepository.auctions(
          auction.id,
        )) as Auction;

        expect(endedAuction.ended).to.be.true;
        expect(endedAuction.active).to.be.false;
        // No other auction properties are altered
        expect(endedAuction.id).to.equal(auction.id);
        expect(endedAuction.deedId).to.equal(auction.deedId);
        expect(endedAuction.startPrice).to.equal(auction.startPrice);
        expect(endedAuction.blockDeadline).to.equal(auction.blockDeadline);
        expect(endedAuction.owner).to.equal(auction.owner);
        expect(endedAuction.deedRepositoryAddress).to.equal(
          auction.deedRepositoryAddress,
        );
        expect(endedAuction.name).to.equal(auction.name);
        expect(endedAuction.deedMetadata).to.equal(auction.deedMetadata);
      });

      it("emits the LogEndedAuction event", async function () {
        await mockDeedRepository.mock.approve
          .withArgs(ownerAddr, deedId)
          .returns();
        await mockDeedRepository.mock[
          "safeTransferFrom(address,address,uint256)"
        ]
          .withArgs(this.auctionRepository.address, ownerAddr, deedId)
          .returns();

        await expect(
          this.auctionRepository.connect(owner).endAuction(auction.id),
        )
          .to.emit(this.auctionRepository, "LogEndedAuction")
          .withArgs(ownerAddr, auction.id);
      });
    });
  });
}
