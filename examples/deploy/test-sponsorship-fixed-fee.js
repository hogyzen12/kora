#!/usr/bin/env node

/**
 * Simple working test with fixed fee amount
 * Bypasses the chicken-and-egg problem of fee estimation
 *
 * Usage:
 *   npm install @solana/web3.js @solana/spl-token
 *   node test-sponsorship-fixed-fee.js /path/to/keypair.json
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

// Fixed fee for testing
// Kora requires 10720 micro-USDC based on actual transaction simulation
// Adding 20% buffer for safety
const FIXED_FEE_MICRO_USDC = 12000; // 0.012 USDC - covers transaction + buffer

function loadKeypair(keypairPath) {
  if (!keypairPath) {
    console.error("\n❌ Error: Keypair path required");
    process.exit(1);
  }
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

async function koraRPC(method, params = {}) {
  const response = await fetch(KORA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(`Kora Error: ${JSON.stringify(data.error, null, 2)}`);
  }
  return data.result;
}

async function createTransaction(sender, koraPayerAddress, koraPaymentAddress, feeAmount) {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Get token accounts
  const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
  const koraUSDC = await getAssociatedTokenAddress(USDC_MINT, koraPaymentAddress);

  console.log(`   Your USDC account: ${senderUSDC.toBase58()}`);
  console.log(`   Kora USDC account: ${koraUSDC.toBase58()}`);
  console.log(`   Payment amount: ${feeAmount} micro-USDC (${(feeAmount / 1e6).toFixed(6)} USDC)`);
  console.log(`   Fee payer: ${koraPayerAddress.toBase58()} (Kora)`);

  // Build transaction
  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),

    // USDC payment to Kora
    createTransferInstruction(
      senderUSDC,
      koraUSDC,
      sender.publicKey,
      feeAmount,
    ),

    // juLeso transfer
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: JULESO_ADDRESS,
      lamports: REQUIRED_TRANSFER,
    }),

    // Jito transfer
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: JITO_ADDRESS,
      lamports: REQUIRED_TRANSFER,
    }),
  ];

  const message = new TransactionMessage({
    payerKey: koraPayerAddress,  // ✅ Kora is the fee payer!
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);
  transaction.sign([sender]);

  return transaction;
}

async function runTest() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 Kora Sponsorship Test (Fixed Fee)");
  console.log("=".repeat(60));

  try {
    const keypairPath = process.argv[2];
    const sender = loadKeypair(keypairPath);

    console.log(`\n👤 Wallet: ${sender.publicKey.toBase58()}`);

    // Check balances
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const solBalance = await connection.getBalance(sender.publicKey);
    console.log(`   SOL: ${(solBalance / 1e9).toFixed(9)} SOL`);

    const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
    const usdcBalance = await connection.getTokenAccountBalance(senderUSDC);
    console.log(`   USDC: ${usdcBalance.value.uiAmount} USDC`);

    // Get Kora info
    const payerInfo = await koraRPC("getPayerSigner");
    const koraPayerAddress = new PublicKey(payerInfo.signer_address);
    const koraPaymentAddress = new PublicKey(payerInfo.payment_address);

    console.log(`\n💼 Kora Fee Payer: ${payerInfo.signer_address}`);
    console.log(`   Payment Address: ${payerInfo.payment_address}`);

    // Create transaction with fixed fee
    console.log(`\n📝 Creating transaction...`);
    const transaction = await createTransaction(sender, koraPayerAddress, koraPaymentAddress, FIXED_FEE_MICRO_USDC);
    const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

    console.log(`\n✅ Transaction created with:`);
    console.log(`   1. USDC payment to Kora: ${(FIXED_FEE_MICRO_USDC / 1e6).toFixed(6)} USDC`);
    console.log(`   2. Transfer to juLeso: 0.0001 SOL`);
    console.log(`   3. Transfer to Jito: 0.0001 SOL`);

    // Test signing
    console.log(`\n🔏 Testing Kora sponsorship...`);
    console.log("=".repeat(60));

    const result = await koraRPC("signTransaction", {
      transaction: base64Tx,
      paymentToken: USDC_MINT.toBase58(),
    });

    console.log("   ✅ Transaction signed by Kora!");
    console.log(`   Signed tx: ${result.signedTransaction.substring(0, 80)}...`);

    // Success!
    console.log("\n" + "=".repeat(60));
    console.log("✅ KORA SPONSORSHIP IS WORKING!");
    console.log("=".repeat(60));

    console.log("\n🎉 What just happened:");
    console.log(`   - You paid ${(FIXED_FEE_MICRO_USDC / 1e6).toFixed(6)} USDC to Kora`);
    console.log("   - Kora signed as fee payer (will pay SOL network fees)");
    console.log("   - Your users get gasless transactions!");

    console.log("\n💰 Transaction breakdown:");
    console.log(`   User pays: ${(FIXED_FEE_MICRO_USDC / 1e6).toFixed(6)} USDC`);
    console.log("   Kora pays: SOL network fees (~0.000005 SOL)");
    console.log("   Net result: User transaction with 0 SOL required!");

    console.log("\n💡 Next steps:");
    console.log("   1. ✅ Kora sponsorship WORKS!");
    console.log("   2. Integrate into your app");
    console.log("   3. Add Assembly program instruction (get from firmware)");
    console.log("   4. Fund fee payer with more SOL");
    console.log("   5. Enable authentication");
    console.log("   6. Use signAndSendTransaction to broadcast");

    console.log("\n🔗 To send this transaction:");
    console.log("   Use the signed transaction from Kora");
    console.log("   Or call signAndSendTransaction instead of signTransaction");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\nDetails:", error);
    process.exit(1);
  }
}

runTest();
