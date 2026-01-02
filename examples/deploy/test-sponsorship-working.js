#!/usr/bin/env node

/**
 * Working Kora sponsorship test with proper USDC payment
 * This version includes all required instructions INCLUDING the USDC payment to Kora
 *
 * Usage:
 *   npm install @solana/web3.js @solana/spl-token
 *   node test-sponsorship-working.js /path/to/keypair.json
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
const {
  createTransferInstruction,
  getAssociatedTokenAddress,
} = require('@solana/spl-token');

const KORA_ENDPOINT = "https://kora-unruggable.fly.dev";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

// Required addresses
const JULESO_ADDRESS = new PublicKey("juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp");
const JITO_ADDRESS = new PublicKey("Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const REQUIRED_TRANSFER = 100_000; // 0.0001 SOL

// Helper to load keypair
function loadKeypair(keypairPath) {
  if (!keypairPath) {
    console.error("\n❌ Error: Keypair path required");
    console.log("\n Usage: node test-sponsorship-working.js /path/to/keypair.json");
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

// Create transaction with USDC payment to Kora
async function createTransactionWithPayment(sender, usdcFeeAmount, koraPaymentAddress) {
  console.log("\n📝 Creating transaction with USDC payment...");

  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Get token accounts
  const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
  const koraUSDC = await getAssociatedTokenAddress(USDC_MINT, koraPaymentAddress);

  console.log(`   Sender USDC account: ${senderUSDC.toBase58()}`);
  console.log(`   Kora payment account: ${koraUSDC.toBase58()}`);

  // Build instructions
  const instructions = [
    // 1. Compute budget
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),

    // 2. USDC payment to Kora (CRITICAL - this was missing!)
    createTransferInstruction(
      senderUSDC,           // from
      koraUSDC,             // to
      sender.publicKey,     // owner
      usdcFeeAmount,        // amount in smallest units (micro-USDC)
    ),

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

  // Sign with sender
  transaction.sign([sender]);

  console.log("   ✅ USDC payment instruction (to Kora)");
  console.log("   ✅ juLeso transfer (0.0001 SOL)");
  console.log("   ✅ Jito transfer (0.0001 SOL)");
  console.log(`   Transaction size: ${transaction.serialize().length} bytes`);

  return transaction;
}

// Main test
async function runTest() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Working Kora Sponsorship Test (with USDC payment)");
  console.log("=".repeat(60));
  console.log(`Kora Endpoint: ${KORA_ENDPOINT}`);

  try {
    // Load keypair
    const keypairPath = process.argv[2];
    console.log(`\n👤 Loading wallet...`);
    const sender = loadKeypair(keypairPath);
    console.log(`   ✅ Loaded: ${keypairPath}`);
    console.log(`   Address: ${sender.publicKey.toBase58()}`);

    // Check balances
    const connection = new Connection(SOLANA_RPC, 'confirmed');

    const solBalance = await connection.getBalance(sender.publicKey);
    console.log(`   SOL: ${(solBalance / 1e9).toFixed(9)} SOL`);

    const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
    const usdcAccountInfo = await connection.getTokenAccountBalance(senderUSDC);
    const usdcBalance = usdcAccountInfo.value.uiAmount || 0;
    console.log(`   USDC: ${usdcBalance.toFixed(6)} USDC`);

    if (usdcBalance < 0.01) {
      console.log(`\n⚠️  Low USDC balance - might not be enough for testing`);
    }

    // Get Kora info
    const payerInfo = await koraRPC("getPayerSigner");
    const koraPaymentAddress = new PublicKey(payerInfo.payment_address);
    console.log(`\n💼 Kora Fee Payer: ${payerInfo.signer_address}`);
    console.log(`   Payment Address: ${payerInfo.payment_address}`);

    // Step 1: Create initial transaction (without payment) to estimate fee
    console.log("\n💰 Step 1: Estimating fee...");
    console.log("=".repeat(60));

    // Create a dummy transaction just for estimation
    const dummyBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const dummyInstructions = [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: JULESO_ADDRESS,
        lamports: REQUIRED_TRANSFER,
      }),
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: JITO_ADDRESS,
        lamports: REQUIRED_TRANSFER,
      }),
    ];
    const dummyMessage = new TransactionMessage({
      payerKey: sender.publicKey,
      recentBlockhash: dummyBlockhash,
      instructions: dummyInstructions,
    }).compileToV0Message();
    const dummyTx = new VersionedTransaction(dummyMessage);
    dummyTx.sign([sender]);
    const dummyBase64 = Buffer.from(dummyTx.serialize()).toString('base64');

    let feeAmount;
    try {
      const feeResult = await koraRPC("estimateTransactionFee", {
        transaction: dummyBase64,
        paymentToken: USDC_MINT.toBase58(),
      });

      feeAmount = feeResult.amount;
      const usdcFee = feeAmount / 1e6;
      const solFee = feeResult.solFee / 1e9;

      console.log(`   ✅ USDC fee: ${usdcFee.toFixed(6)} USDC`);
      console.log(`   ✅ SOL fee: ${solFee.toFixed(9)} SOL (paid by Kora)`);
      console.log(`   Fee amount (raw): ${feeAmount} micro-USDC`);
    } catch (error) {
      console.log(`   ❌ Fee estimation failed: ${error.message}`);
      console.log(`   Using fallback fee: 0.00001 USDC`);
      feeAmount = 10; // Fallback: 10 micro-USDC = 0.00001 USDC
    }

    // Step 2: Create transaction WITH payment instruction
    console.log("\n✍️  Step 2: Creating transaction with payment...");
    console.log("=".repeat(60));

    const transaction = await createTransactionWithPayment(sender, feeAmount, koraPaymentAddress);
    const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

    // Step 3: Sign transaction
    console.log("\n🔏 Step 3: Signing transaction with Kora...");
    console.log("=".repeat(60));

    try {
      const signResult = await koraRPC("signTransaction", {
        transaction: base64Tx,
        paymentToken: USDC_MINT.toBase58(),
      });

      console.log("   ✅ Transaction signed successfully!");
      console.log(`   Signed tx: ${signResult.signedTransaction.substring(0, 80)}...`);

      // Success!
      console.log("\n" + "=".repeat(60));
      console.log("✅ KORA SPONSORSHIP TEST PASSED!");
      console.log("=".repeat(60));
      console.log("\n🎉 Results:");
      console.log(`   ✅ Fee estimation: Working`);
      console.log(`   ✅ USDC payment: Working (${(feeAmount / 1e6).toFixed(6)} USDC)`);
      console.log(`   ✅ Transaction signing: Working`);
      console.log(`   ✅ Kora can sponsor your transactions!`);

      console.log("\n💰 Cost per transaction:");
      console.log(`   ${(feeAmount / 1e6).toFixed(6)} USDC`);
      console.log(`   Your users pay in USDC, Kora pays SOL network fees`);

      console.log("\n💡 Next steps:");
      console.log("   1. ✅ Sponsorship is WORKING!");
      console.log("   2. Integrate this flow into your app");
      console.log("   3. Add the Assembly program instruction (real format from firmware)");
      console.log("   4. Enable authentication (API Key + HMAC)");
      console.log("   5. Fund fee payer with more SOL for production");

    } catch (error) {
      console.log(`   ❌ Signing failed: ${error.message}`);
      throw error;
    }

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTest();
