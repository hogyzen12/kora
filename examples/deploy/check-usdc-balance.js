#!/usr/bin/env node

/**
 * Check USDC balance for a wallet
 * Usage: node check-usdc-balance.js /path/to/keypair.json
 */

const fs = require('fs');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function checkBalance() {
  const keypairPath = process.argv[2];

  if (!keypairPath) {
    console.error("\n❌ Error: Keypair path required");
    console.log("\n Usage: node check-usdc-balance.js /path/to/keypair.json");
    process.exit(1);
  }

  try {
    // Load keypair
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    const walletAddress = keypair.publicKey;

    console.log("\n💰 Checking USDC Balance");
    console.log("=".repeat(60));
    console.log(`Wallet: ${walletAddress.toBase58()}`);

    const connection = new Connection(SOLANA_RPC, 'confirmed');

    // Check SOL balance
    const solBalance = await connection.getBalance(walletAddress);
    console.log(`\n📊 SOL Balance: ${(solBalance / 1e9).toFixed(9)} SOL`);

    // Get USDC token account address
    const usdcTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      walletAddress
    );

    console.log(`\n🪙  USDC Token Account: ${usdcTokenAccount.toBase58()}`);

    // Check if token account exists
    const accountInfo = await connection.getAccountInfo(usdcTokenAccount);

    if (!accountInfo) {
      console.log("\n❌ USDC Token Account does NOT exist");
      console.log("\n💡 To create it and add USDC:");
      console.log("   1. Send USDC to your wallet address:");
      console.log(`      ${walletAddress.toBase58()}`);
      console.log("   2. The USDC token account will be created automatically");
      console.log("   3. Minimum: 0.01 USDC (for multiple tests)");
      console.log("\n   Or use Solana CLI:");
      console.log(`   spl-token create-account ${USDC_MINT.toBase58()}`);
      process.exit(0);
    }

    // Get token balance
    const response = await connection.getTokenAccountBalance(usdcTokenAccount);
    const usdcBalance = response.value.uiAmount || 0;

    console.log(`\n✅ USDC Balance: ${usdcBalance.toFixed(6)} USDC`);

    if (usdcBalance === 0) {
      console.log("\n⚠️  USDC balance is 0!");
      console.log("\n💡 To add USDC:");
      console.log("   1. Transfer USDC to your wallet:");
      console.log(`      ${walletAddress.toBase58()}`);
      console.log("   2. Minimum: 0.01 USDC (enough for ~1000 transactions)");
      console.log("   3. From an exchange or another wallet");
    } else if (usdcBalance < 0.01) {
      console.log("\n⚠️  Low balance - consider adding more USDC");
      console.log("   Recommended: 0.01 USDC or more");
    } else {
      console.log("\n✅ Sufficient balance for testing!");
      const estimatedTxCount = Math.floor(usdcBalance / 0.00001);
      console.log(`   Can sponsor ~${estimatedTxCount} transactions`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Ready to test Kora sponsorship!");
    console.log("Run: node test-sponsorship-simple-tx.js " + keypairPath);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

checkBalance();
