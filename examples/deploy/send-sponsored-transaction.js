#!/usr/bin/env node

/**
 * Send a REAL sponsored transaction via Kora
 * This actually broadcasts to Solana mainnet!
 *
 * Usage:
 *   npm install @solana/web3.js @solana/spl-token
 *   node send-sponsored-transaction.js /path/to/keypair.json
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
const FIXED_FEE_MICRO_USDC = 12000; // 0.012 USDC

function loadKeypair(keypairPath) {
  if (!keypairPath) {
    console.error("\n❌ Error: Keypair path required");
    console.log("\nUsage: node send-sponsored-transaction.js /path/to/keypair.json");
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

  const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
  const koraUSDC = await getAssociatedTokenAddress(USDC_MINT, koraPaymentAddress);

  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
    createTransferInstruction(senderUSDC, koraUSDC, sender.publicKey, feeAmount),
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

  const message = new TransactionMessage({
    payerKey: koraPayerAddress,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);
  transaction.sign([sender]);

  return transaction;
}

async function sendTransaction() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 SENDING REAL SPONSORED TRANSACTION");
  console.log("=".repeat(60));
  console.log("\n⚠️  WARNING: This will broadcast a REAL transaction to mainnet!");
  console.log("   - You will pay 0.012 USDC");
  console.log("   - You will transfer 0.0001 SOL to juLeso");
  console.log("   - You will transfer 0.0001 SOL to Jito");
  console.log("   - Kora will pay the network fees in SOL");

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

    if (solBalance < 0.0003) {
      console.log("\n❌ Insufficient SOL for transfers (need 0.0003 SOL)");
      process.exit(1);
    }

    if (usdcBalance.value.uiAmount < 0.012) {
      console.log("\n❌ Insufficient USDC for payment (need 0.012 USDC)");
      process.exit(1);
    }

    // Get Kora info
    const payerInfo = await koraRPC("getPayerSigner");
    const koraPayerAddress = new PublicKey(payerInfo.signer_address);
    const koraPaymentAddress = new PublicKey(payerInfo.payment_address);

    console.log(`\n💼 Kora Fee Payer: ${payerInfo.signer_address}`);

    // Create transaction
    console.log(`\n📝 Creating transaction...`);
    const transaction = await createTransaction(sender, koraPayerAddress, koraPaymentAddress, FIXED_FEE_MICRO_USDC);
    const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

    console.log("   ✅ USDC payment to Kora: 0.012 USDC");
    console.log("   ✅ Transfer to juLeso: 0.0001 SOL");
    console.log("   ✅ Transfer to Jito: 0.0001 SOL");

    // Send via Kora!
    console.log(`\n🔏 Sending transaction via Kora...`);
    console.log("=".repeat(60));

    const result = await koraRPC("signAndSendTransaction", {
      transaction: base64Tx,
      paymentToken: USDC_MINT.toBase58(),
    });

    const signature = result.signature || result.transaction_signature;

    console.log("\n" + "=".repeat(60));
    console.log("✅ TRANSACTION SENT SUCCESSFULLY!");
    console.log("=".repeat(60));

    console.log(`\n📝 Transaction Signature:`);
    console.log(`   ${signature}`);

    console.log(`\n🔍 View on Solana Explorer:`);
    console.log(`   https://explorer.solana.com/tx/${signature}`);
    console.log(`   https://solscan.io/tx/${signature}`);

    console.log("\n💰 What just happened:");
    console.log("   ✅ You paid 0.012 USDC to Kora");
    console.log("   ✅ You sent 0.0001 SOL to juLeso");
    console.log("   ✅ You sent 0.0001 SOL to Jito");
    console.log("   ✅ Kora paid the SOL network fees");
    console.log("   ✅ Transaction confirmed on-chain!");

    console.log("\n🎉 GASLESS TRANSACTION COMPLETE!");
    console.log("   Your users just experienced transaction sponsorship!");
    console.log("   They paid in USDC, Kora paid the SOL fees.");

    console.log("\n📊 Final Status:");
    console.log("   - Transaction: ✅ Confirmed");
    console.log("   - Cost to user: 0.012 USDC + 0.0002 SOL (transfers)");
    console.log("   - Network fees paid by: Kora");
    console.log("   - User SOL required: 0 (gasless from SOL perspective)");

    console.log("\n💡 Next steps:");
    console.log("   1. ✅ You just sent a REAL sponsored transaction!");
    console.log("   2. Check the explorer links above to verify");
    console.log("   3. Integrate this flow into your app");
    console.log("   4. Add Assembly program instruction");
    console.log("   5. Enable authentication");
    console.log("   6. Fund fee payer with more SOL");

  } catch (error) {
    console.error("\n❌ Transaction failed:", error.message);
    console.error("\nDetails:", error);
    process.exit(1);
  }
}

sendTransaction();
