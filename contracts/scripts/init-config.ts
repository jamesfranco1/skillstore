/**
 * Initialize Skillstore Config on Devnet
 * Run after deployment to set up the platform config
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Skillstore } from "../target/types/skillstore";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Load environment
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Skillstore as Program<Skillstore>;
  
  console.log("=== Skillstore Config Initialization ===");
  console.log("Program ID:", program.programId.toBase58());
  console.log("Admin wallet:", provider.wallet.publicKey.toBase58());

  // Treasury wallet - in production, use a hardware wallet or multisig
  // For demo, we'll generate a new one or use an existing one
  let treasuryKeypair: Keypair;
  const treasuryPath = path.join(__dirname, "../keys/treasury.json");

  if (fs.existsSync(treasuryPath)) {
    const secretKey = JSON.parse(fs.readFileSync(treasuryPath, "utf8"));
    treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    console.log("Using existing treasury:", treasuryKeypair.publicKey.toBase58());
  } else {
    treasuryKeypair = Keypair.generate();
    fs.mkdirSync(path.dirname(treasuryPath), { recursive: true });
    fs.writeFileSync(
      treasuryPath,
      JSON.stringify(Array.from(treasuryKeypair.secretKey))
    );
    console.log("Generated new treasury:", treasuryKeypair.publicKey.toBase58());
    console.log("Treasury keypair saved to:", treasuryPath);
  }

  // Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  console.log("Config PDA:", configPda.toBase58());

  // Check if already initialized
  const existingConfig = await provider.connection.getAccountInfo(configPda);
  if (existingConfig) {
    console.log("\nConfig already initialized!");
    const config = await program.account.config.fetch(configPda);
    console.log("  Admin:", config.admin.toBase58());
    console.log("  Treasury:", config.treasury.toBase58());
    console.log("  Fee:", config.feeBasisPoints / 100, "%");
    console.log("  Total sales:", config.totalSales.toNumber());
    console.log("  Total fees collected:", config.totalFeesCollected.toNumber() / LAMPORTS_PER_SOL, "SOL");
    return;
  }

  // Initialize with 5% fee
  const feeBasisPoints = 500; // 5%
  
  console.log("\nInitializing config...");
  console.log("  Fee:", feeBasisPoints / 100, "%");
  console.log("  Treasury:", treasuryKeypair.publicKey.toBase58());

  try {
    const tx = await program.methods
      .initialize(feeBasisPoints)
      .accounts({
        admin: provider.wallet.publicKey,
        treasury: treasuryKeypair.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("\n✓ Config initialized!");
    console.log("  Transaction:", tx);

    // Save deployment info
    const deploymentInfo = {
      programId: program.programId.toBase58(),
      configPda: configPda.toBase58(),
      admin: provider.wallet.publicKey.toBase58(),
      treasury: treasuryKeypair.publicKey.toBase58(),
      feeBasisPoints,
      network: "devnet",
      deployedAt: new Date().toISOString(),
    };

    const infoPath = path.join(__dirname, "../deployment-info.json");
    fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info saved to:", infoPath);

  } catch (err) {
    console.error("Failed to initialize:", err);
    process.exit(1);
  }
}

main();

