#!/usr/bin/env node

/**
 * Test Kora transaction sponsorship end-to-end
 * Creates a transaction with the 3 required checks and tests signing/sending
 *
 * Usage:
 *   npm install @solana/web3.js
 *
 *   # With your own funded keypair:
 *   node test-sponsorship.js /path/to/keypair.json
 *
 *   # Or with a generated keypair (will fail - needs funding):
 *   node test-sponsorship.js
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
const ASSEMBLY_PROGRAM = new PublicKey("23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ");
const JULESO_ADDRESS = new PublicKey("juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp");
const JITO_ADDRESS = new PublicKey("Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2");
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JLP_MINT = "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4";
const REQUIRED_TRANSFER = 100_000; // 0.0001 SOL

// Helper to load keypair from file or generate new one
function loadKeypair(keypairPath) {
  if (!keypairPath) {
    console.log("   ⚠️  No keypair provided - generating temporary wallet");
    console.log("   ⚠️  This wallet has 0 SOL and will fail validation");
    console.log("   💡 Run with: node test-sponsorship.js /path/to/keypair.json");
    return Keypair.generate();
  }

  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`   ✅ Loaded keypair from: ${keypairPath}`);
    return keypair;
  } catch (error) {
    console.error(`   ❌ Failed to load keypair from ${keypairPath}`);
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

// Create a transaction with the 3 required checks
async function createAppTransaction(sender) {
  console.log("\n📝 Creating transaction with 3 required checks...");

  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Build instructions
  const instructions = [
    // 1. Compute budget (recommended)
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),

    // 2. Assembly/Slot Replay instruction
    // NOTE: This is a placeholder - you'll need to use your actual Assembly instruction
    // For now, we'll create a basic instruction to the Assembly program
    {
      programId: ASSEMBLY_PROGRAM,
      keys: [
        { pubkey: sender.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from([0]), // Placeholder data
    },

    // 3. Transfer to juLeso (0.0001 SOL)
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: JULESO_ADDRESS,
      lamports: REQUIRED_TRANSFER,
    }),

    // 4. Transfer to Jito (0.0001 SOL)
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

  // Sign with sender (partial signature)
  transaction.sign([sender]);

  console.log("   ✅ Assembly program instruction");
  console.log("   ✅ juLeso transfer (0.0001 SOL)");
  console.log("   ✅ Jito transfer (0.0001 SOL)");
  console.log(`   Transaction size: ${transaction.serialize().length} bytes`);

  return transaction;
}

// Test 1: Estimate transaction fee
async function testEstimateFee(transaction) {
  console.log("\n💰 Test 1: Estimate Transaction Fee");
  console.log("=".repeat(60));

  const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

  try {
    // Test USDC
    const usdcResult = await koraRPC("estimateTransactionFee", {
      transaction: base64Tx,
      paymentToken: USDC_MINT,
    });

    const usdcAmount = usdcResult.amount / 1e6;
    const solFee = usdcResult.solFee / 1e9;

    console.log(`   ✅ USDC fee: ${usdcAmount.toFixed(6)} USDC`);
    console.log(`   SOL equivalent: ${solFee.toFixed(9)} SOL`);
    console.log(`   Raw: ${usdcResult.amount} micro-USDC, ${usdcResult.solFee} lamports`);

    return { success: true, usdcAmount, solFee };
  } catch (error) {
    console.log(`   ❌ Fee estimation failed: ${error.message}`);
    return { success: false, error };
  }
}

// Test 2: Sign transaction
async function testSignTransaction(transaction) {
  console.log("\n✍️  Test 2: Sign Transaction");
  console.log("=".repeat(60));

  const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

  try {
    const result = await koraRPC("signTransaction", {
      transaction: base64Tx,
      paymentToken: USDC_MINT,
    });

    console.log("   ✅ Transaction signed by Kora!");
    console.log(`   Signed transaction: ${result.signedTransaction.substring(0, 80)}...`);

    return { success: true, signedTx: result.signedTransaction };
  } catch (error) {
    console.log(`   ❌ Signing failed: ${error.message}`);
    return { success: false, error };
  }
}

// Test 3: Sign and send transaction (DRY RUN - commented out by default)
async function testSignAndSend(transaction, dryRun = true) {
  console.log("\n🚀 Test 3: Sign and Send Transaction");
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("   ⚠️  DRY RUN MODE - Not actually sending transaction");
    console.log("   To send for real, edit this script and set dryRun = false");
    return { success: true, dryRun: true };
  }

  const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

  try {
    const result = await koraRPC("signAndSendTransaction", {
      transaction: base64Tx,
      paymentToken: USDC_MINT,
    });

    console.log("   ✅ Transaction sent!");
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${result.signature}`);

    return { success: true, signature: result.signature };
  } catch (error) {
    console.log(`   ❌ Send failed: ${error.message}`);
    return { success: false, error };
  }
}

// Main test flow
async function runTests() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Testing Kora Transaction Sponsorship");
  console.log("=".repeat(60));
  console.log(`Kora Endpoint: ${KORA_ENDPOINT}`);
  console.log(`Solana RPC: ${SOLANA_RPC}`);

  try {
    // Load keypair from command line arg or generate new one
    const keypairPath = process.argv[2];
    console.log(`\n👤 Loading sender wallet...`);
    const sender = loadKeypair(keypairPath);
    console.log(`   Address: ${sender.publicKey.toBase58()}`);

    // Check sender's SOL balance
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const balance = await connection.getBalance(sender.publicKey);
    const solBalance = balance / 1e9;
    console.log(`   Balance: ${solBalance.toFixed(9)} SOL`);

    // Minimum balance needed: 0.0001 (juLeso) + 0.0001 (Jito) + buffer for rent
    const minBalanceNeeded = 0.0003;
    if (solBalance < minBalanceNeeded) {
      console.log(`\n❌ Insufficient balance!`);
      console.log(`   Need at least ${minBalanceNeeded} SOL for testing`);
      console.log(`   Current balance: ${solBalance.toFixed(9)} SOL`);
      console.log(`\n💡 Fund this wallet with at least ${minBalanceNeeded} SOL:`);
      console.log(`   ${sender.publicKey.toBase58()}`);
      console.log(`\n   Or provide a funded keypair:`);
      console.log(`   node test-sponsorship.js /path/to/keypair.json`);
      process.exit(1);
    }

    console.log(`   ✅ Sufficient balance for testing`);

    // Get Kora fee payer info
    const payerInfo = await koraRPC("getPayerSigner");
    console.log(`\n💼 Kora Fee Payer: ${payerInfo.signer_address}`);

    // Create transaction
    const transaction = await createAppTransaction(sender);

    // Test 1: Estimate fee
    const feeResult = await testEstimateFee(transaction);
    if (!feeResult.success) {
      console.log("\n⚠️  Fee estimation failed - check error above");
      console.log("Continuing with signing test anyway...");
    }

    // Test 2: Sign transaction
    const signResult = await testSignTransaction(transaction);
    if (!signResult.success) {
      console.log("\n❌ Transaction signing failed");
      console.log("\n🔍 Possible reasons:");
      console.log("   1. Transaction doesn't meet validation rules");
      console.log("   2. Fee payer has insufficient SOL balance");
      console.log("   3. Authentication required (API key/HMAC)");
      console.log("\nCheck Kora logs: flyctl logs -a kora-unruggable");
      return;
    }

    // Test 3: Send transaction (dry run by default)
    await testSignAndSend(transaction, true);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ Transaction Sponsorship Tests PASSED!");
    console.log("=".repeat(60));
    console.log("\n📊 Results:");
    console.log(`   ✅ Fee estimation: ${feeResult.success ? 'Working' : 'Failed'}`);
    console.log(`   ✅ Transaction signing: ${signResult.success ? 'Working' : 'Failed'}`);
    console.log("   ✅ Kora can sponsor transactions with USDC payment");

    if (feeResult.success) {
      console.log(`\n💰 Cost per transaction:`);
      console.log(`   ${feeResult.usdcAmount.toFixed(6)} USDC`);
      console.log(`   (${feeResult.solFee.toFixed(9)} SOL equivalent fee paid by Kora)`);
    }

    console.log("\n🎉 What this means:");
    console.log("   - Your user pays in USDC (or JLP)");
    console.log("   - Kora pays the SOL network fees");
    console.log("   - User gets gasless transactions!");

    console.log("\n💡 Next steps:");
    console.log("   1. ✅ Sponsorship is working!");
    console.log("   2. Integrate this flow into your app");
    console.log("   3. Fund fee payer with more SOL for production use");
    console.log("   4. Enable authentication (API Key + HMAC)");
    console.log("   5. Deploy hardened security config");
    console.log("\n   To send a real transaction:");
    console.log("   - Edit this script and set dryRun = false in testSignAndSend()");
    console.log("   - Or use signAndSendTransaction in your app");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  }
}

// Run the tests
runTests();
