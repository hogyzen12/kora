#!/usr/bin/env node

/**
 * Simplified Kora sponsorship test - WITHOUT the Assembly program
 * Tests just the basic Kora functionality with juLeso + Jito transfers
 *
 * Usage:
 *   npm install @solana/web3.js
 *   node test-sponsorship-simple-tx.js /path/to/keypair.json
 */

const fs = require('fs');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} = require('@solana/web3.js');

const KORA_ENDPOINT = "https://kora-unruggable.fly.dev";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

// Required addresses
const JULESO_ADDRESS = new PublicKey("juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp");
const JITO_ADDRESS = new PublicKey("Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2");
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const REQUIRED_TRANSFER = 100_000; // 0.0001 SOL

// Helper to load keypair
function loadKeypair(keypairPath) {
  if (!keypairPath) {
    console.error("\n❌ Error: Keypair path required");
    console.log("\n Usage: node test-sponsorship-simple-tx.js /path/to/keypair.json");
    process.exit(1);
  }

  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    return keypair;
  } catch (error) {
    console.error(`\n❌ Failed to load keypair from ${keypairPath}`);
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }
}

// Helper to call Kora RPC
async function koraRPC(method, params = {}) {
  const response = await fetch(KORA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Kora RPC Error: ${JSON.stringify(data.error, null, 2)}`);
  }
  return data.result;
}

// Create simple transaction (NO Assembly program - just transfers)
async function createSimpleTransaction(sender) {
  console.log("\n📝 Creating simplified transaction...");

  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Build instructions - SIMPLIFIED (no Assembly program)
  const instructions = [
    // 1. Compute budget
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),

    // 2. Transfer to juLeso (0.0001 SOL)
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: JULESO_ADDRESS,
      lamports: REQUIRED_TRANSFER,
    }),

    // 3. Transfer to Jito (0.0001 SOL)
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: JITO_ADDRESS,
      lamports: REQUIRED_TRANSFER,
    }),
  ];

  // Create v0 transaction message
  const messageV0 = new TransactionMessage({
    payerKey: sender.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  // Create versioned transaction
  const transaction = new VersionedTransaction(messageV0);

  // Sign with sender
  transaction.sign([sender]);

  console.log("   ⚠️  Assembly program NOT included (placeholder doesn't work)");
  console.log("   ✅ juLeso transfer (0.0001 SOL)");
  console.log("   ✅ Jito transfer (0.0001 SOL)");
  console.log(`   Transaction size: ${transaction.serialize().length} bytes`);

  return transaction;
}

// Main test
async function runTest() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Simplified Kora Sponsorship Test");
  console.log("=".repeat(60));
  console.log(`Kora Endpoint: ${KORA_ENDPOINT}`);

  try {
    // Load keypair
    const keypairPath = process.argv[2];
    console.log(`\n👤 Loading wallet...`);
    const sender = loadKeypair(keypairPath);
    console.log(`   ✅ Loaded: ${keypairPath}`);
    console.log(`   Address: ${sender.publicKey.toBase58()}`);

    // Check balance
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const balance = await connection.getBalance(sender.publicKey);
    const solBalance = balance / 1e9;
    console.log(`   Balance: ${solBalance.toFixed(9)} SOL`);

    if (solBalance < 0.0003) {
      console.log(`\n❌ Insufficient balance (need 0.0003 SOL minimum)`);
      process.exit(1);
    }

    // Get Kora info
    const payerInfo = await koraRPC("getPayerSigner");
    console.log(`\n💼 Kora Fee Payer: ${payerInfo.signer_address}`);

    // Create transaction
    const transaction = await createSimpleTransaction(sender);
    const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

    // Test fee estimation
    console.log("\n💰 Testing Fee Estimation...");
    console.log("=".repeat(60));

    try {
      const feeResult = await koraRPC("estimateTransactionFee", {
        transaction: base64Tx,
        paymentToken: USDC_MINT,
      });

      const usdcAmount = feeResult.amount / 1e6;
      const solFee = feeResult.solFee / 1e9;

      console.log(`   ✅ USDC fee: ${usdcAmount.toFixed(6)} USDC`);
      console.log(`   ✅ SOL fee: ${solFee.toFixed(9)} SOL (paid by Kora)`);

      // Test signing
      console.log("\n✍️  Testing Transaction Signing...");
      console.log("=".repeat(60));

      const signResult = await koraRPC("signTransaction", {
        transaction: base64Tx,
        paymentToken: USDC_MINT,
      });

      console.log("   ✅ Transaction signed successfully!");

      // Success!
      console.log("\n" + "=".repeat(60));
      console.log("✅ SIMPLIFIED TEST PASSED!");
      console.log("=".repeat(60));
      console.log("\n🎉 Kora sponsorship is working!");
      console.log(`   - Fee estimation: Working`);
      console.log(`   - Transaction signing: Working`);
      console.log(`   - Cost: ${usdcAmount.toFixed(6)} USDC per transaction`);

      console.log("\n⚠️  Important Notes:");
      console.log("   - This test does NOT include the Assembly program");
      console.log("   - Your app needs the real Assembly instruction format");
      console.log("   - Get the Assembly instruction from your firmware code");

      console.log("\n💡 Next Steps:");
      console.log("   1. ✅ Kora basic sponsorship works!");
      console.log("   2. Get the real Assembly program instruction from firmware");
      console.log("   3. Update test-sponsorship.js with real Assembly instruction");
      console.log("   4. Integrate into your app with all 3 required checks");

    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
      throw error;
    }

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTest();
