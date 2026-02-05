import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Skillstore } from "../target/types/skillstore";
import { expect } from "chai";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("skillstore", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Skillstore as Program<Skillstore>;
  
  const admin = provider.wallet;
  const treasury = Keypair.generate();
  const creator = Keypair.generate();
  const buyer = Keypair.generate();

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const skillId = "kubernetes-security";
  const [listingPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), Buffer.from(skillId)],
    program.programId
  );

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropCreator = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropCreator);

    const airdropBuyer = await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropBuyer);
  });

  it("Initializes the config", async () => {
    const feeBasisPoints = 500; // 5%

    await program.methods
      .initialize(feeBasisPoints)
      .accounts({
        admin: admin.publicKey,
        treasury: treasury.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.config.fetch(configPda);
    expect(config.admin.toString()).to.equal(admin.publicKey.toString());
    expect(config.treasury.toString()).to.equal(treasury.publicKey.toString());
    expect(config.feeBasisPoints).to.equal(feeBasisPoints);
    expect(config.totalSales.toNumber()).to.equal(0);
  });

  it("Lists a skill", async () => {
    const priceInSol = 0.1;
    const priceLamports = new anchor.BN(priceInSol * LAMPORTS_PER_SOL);
    const metadataUri = "https://skillstoremd.xyz/api/skills/kubernetes-security/metadata";

    await program.methods
      .listSkill(skillId, priceLamports, metadataUri)
      .accounts({
        creator: creator.publicKey,
        listing: listingPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const listing = await program.account.listing.fetch(listingPda);
    expect(listing.creator.toString()).to.equal(creator.publicKey.toString());
    expect(listing.skillId).to.equal(skillId);
    expect(listing.priceLamports.toNumber()).to.equal(priceLamports.toNumber());
    expect(listing.isActive).to.be.true;
  });

  it("Purchases a skill", async () => {
    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), buyer.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    const creatorBalanceBefore = await provider.connection.getBalance(creator.publicKey);
    const treasuryBalanceBefore = await provider.connection.getBalance(treasury.publicKey);

    await program.methods
      .purchaseSkill()
      .accounts({
        buyer: buyer.publicKey,
        creator: creator.publicKey,
        treasury: treasury.publicKey,
        config: configPda,
        listing: listingPda,
        receipt: receiptPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Verify receipt
    const receipt = await program.account.receipt.fetch(receiptPda);
    expect(receipt.buyer.toString()).to.equal(buyer.publicKey.toString());
    expect(receipt.skillId).to.equal(skillId);

    // Verify payments
    const listing = await program.account.listing.fetch(listingPda);
    const price = listing.priceLamports.toNumber();
    const expectedFee = Math.floor(price * 0.05); // 5%
    const expectedCreatorAmount = price - expectedFee;

    const creatorBalanceAfter = await provider.connection.getBalance(creator.publicKey);
    const treasuryBalanceAfter = await provider.connection.getBalance(treasury.publicKey);

    expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(expectedCreatorAmount);
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedFee);

    // Verify stats updated
    const config = await program.account.config.fetch(configPda);
    expect(config.totalSales.toNumber()).to.equal(1);
    expect(config.totalFeesCollected.toNumber()).to.equal(expectedFee);
  });

  it("Cannot purchase inactive listing", async () => {
    // First deactivate
    await program.methods
      .deactivateListing()
      .accounts({
        creator: creator.publicKey,
        listing: listingPda,
      })
      .signers([creator])
      .rpc();

    const listing = await program.account.listing.fetch(listingPda);
    expect(listing.isActive).to.be.false;

    // Try to purchase - should fail
    const newBuyer = Keypair.generate();
    const airdrop = await provider.connection.requestAirdrop(
      newBuyer.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), newBuyer.publicKey.toBuffer(), Buffer.from(skillId)],
      program.programId
    );

    try {
      await program.methods
        .purchaseSkill()
        .accounts({
          buyer: newBuyer.publicKey,
          creator: creator.publicKey,
          treasury: treasury.publicKey,
          config: configPda,
          listing: listingPda,
          receipt: receiptPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newBuyer])
        .rpc();
      expect.fail("Should have thrown error");
    } catch (err) {
      expect(err.message).to.include("ListingNotActive");
    }
  });
});


