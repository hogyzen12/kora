#!/usr/bin/env node

/**
 * Send USDC via Kora sponsorship
 *
 * Usage:
 *   npm install @solana/web3.js @solana/spl-token
 *   node send-usdc-sponsored.js <keypair> <amount> <recipient>
 *
 * Example:
 *   node send-usdc-sponsored.js wallet.json 0.42 6tBou5MHL5aWpDy6cgf3wiwGGGK2mR8qs68ujtpaoWrf2
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
  getOrCreateAssociatedTokenAccount,
} = require('@solana/spl-token');

const KORA_ENDPOINT = "https://kora-unruggable.fly.dev";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

// Required addresses
const JULESO_ADDRESS = new PublicKey("juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp");
const JITO_ADDRESS = new PublicKey("Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const REQUIRED_TRANSFER = 100_000; // 0.0001 SOL
const KORA_FEE_MICRO_USDC = 12000; // 0.012 USDC

function parseArgs() {
  const [,, keypairPath, amount, recipient] = process.argv;

  if (!keypairPath || !amount || !recipient) {
    console.error("\n❌ Missing arguments!");
    console.log("\nUsage:");
    console.log("  node send-usdc-sponsored.js <keypair> <amount> <recipient>");
    console.log("\nExample:");
    console.log("  node send-usdc-sponsored.js wallet.json 0.42 6tBou5MHL5aWpDy6cgf3wiwGGGK2mR8qs68ujtpaoWrf2");
    console.log("\nArguments:");
    console.log("  keypair   - Path to your wallet keypair JSON file");
    console.log("  amount    - USDC amount to send (e.g., 0.42)");
    console.log("  recipient - Destination wallet address");
    process.exit(1);
  }

  const usdcAmount = parseFloat(amount);
  if (isNaN(usdcAmount) || usdcAmount <= 0) {
    console.error("\n❌ Invalid amount! Must be a positive number.");
    process.exit(1);
  }

  try {
    new PublicKey(recipient);
  } catch (error) {
    console.error("\n❌ Invalid recipient address!");
    console.error(`   Received: "${recipient}"`);
    console.error(`   Error: ${error.message}`);
    console.log("\n   Solana addresses should be:");
    console.log("   - 32-44 characters long");
    console.log("   - Base58 encoded (no 0, O, I, l)");
    console.log("\n   Example: 6tBou5MHL5aWpDy6cgf3wiwGGGK2mR8qs68ujtpaoWrf2");
    process.exit(1);
  }

  return { keypairPath, usdcAmount, recipient: new PublicKey(recipient) };
}

function loadKeypair(keypairPath) {
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error(`\n❌ Failed to load keypair: ${error.message}`);
    process.exit(1);
  }
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

async function createTransaction(sender, koraPayerAddress, koraPaymentAddress, usdcAmount, recipient) {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  // Get token accounts
  const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
  const koraUSDC = await getAssociatedTokenAddress(USDC_MINT, koraPaymentAddress);
  const recipientUSDC = await getAssociatedTokenAddress(USDC_MINT, recipient);

  // Convert USDC amount to smallest units (micro-USDC)
  const microUSDC = Math.floor(usdcAmount * 1e6);

  console.log("\n📝 Transaction details:");
  console.log(`   From: ${sender.publicKey.toBase58()}`);
  console.log(`   To: ${recipient.toBase58()}`);
  console.log(`   USDC amount: ${usdcAmount} USDC (${microUSDC} micro-USDC)`);
  console.log(`   Kora fee: 0.012 USDC (${KORA_FEE_MICRO_USDC} micro-USDC)`);
  console.log(`   Total USDC needed: ${(usdcAmount + 0.012).toFixed(6)} USDC`);

  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),

    // 1. Pay Kora fee
    createTransferInstruction(
      senderUSDC,
      koraUSDC,
      sender.publicKey,
      KORA_FEE_MICRO_USDC,
    ),

    // 2. Send USDC to recipient
    createTransferInstruction(
      senderUSDC,
      recipientUSDC,
      sender.publicKey,
      microUSDC,
    ),

    // 3. juLeso transfer
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: JULESO_ADDRESS,
      lamports: REQUIRED_TRANSFER,
    }),

    // 4. Jito transfer
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

async function sendUSDC() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 SEND USDC VIA KORA SPONSORSHIP");
  console.log("=".repeat(60));

  const { keypairPath, usdcAmount, recipient } = parseArgs();

  try {
    const sender = loadKeypair(keypairPath);
    console.log(`\n👤 Your wallet: ${sender.publicKey.toBase58()}`);

    // Check balances
    const connection = new Connection(SOLANA_RPC, 'confirmed');

    const solBalance = await connection.getBalance(sender.publicKey);
    console.log(`   SOL: ${(solBalance / 1e9).toFixed(9)} SOL`);

    const senderUSDC = await getAssociatedTokenAddress(USDC_MINT, sender.publicKey);
    const usdcBalance = await connection.getTokenAccountBalance(senderUSDC);
    const currentUSDC = usdcBalance.value.uiAmount;
    console.log(`   USDC: ${currentUSDC} USDC`);

    // Calculate total needed
    const totalNeeded = usdcAmount + 0.012; // amount + Kora fee

    if (currentUSDC < totalNeeded) {
      console.log(`\n❌ Insufficient USDC!`);
      console.log(`   Need: ${totalNeeded.toFixed(6)} USDC`);
      console.log(`   Have: ${currentUSDC} USDC`);
      console.log(`   Missing: ${(totalNeeded - currentUSDC).toFixed(6)} USDC`);
      process.exit(1);
    }

    if (solBalance < 0.0003) {
      console.log(`\n❌ Insufficient SOL for transfers (need 0.0003 SOL)`);
      process.exit(1);
    }

    // Check if recipient has USDC token account
    const recipientUSDC = await getAssociatedTokenAddress(USDC_MINT, recipient);
    const recipientAccountInfo = await connection.getAccountInfo(recipientUSDC);

    if (!recipientAccountInfo) {
      console.log(`\n⚠️  WARNING: Recipient doesn't have a USDC token account!`);
      console.log(`   Address: ${recipientUSDC.toBase58()}`);
      console.log(`   This transaction will FAIL.`);
      console.log(`\n   Recipient needs to create their USDC account first.`);
      console.log(`   Or use a wallet that auto-creates token accounts.`);
      process.exit(1);
    }

    // Get Kora info
    const payerInfo = await koraRPC("getPayerSigner");
    const koraPayerAddress = new PublicKey(payerInfo.signer_address);
    const koraPaymentAddress = new PublicKey(payerInfo.payment_address);

    console.log(`\n💼 Kora Fee Payer: ${payerInfo.signer_address}`);

    // Create transaction
    const transaction = await createTransaction(
      sender,
      koraPayerAddress,
      koraPaymentAddress,
      usdcAmount,
      recipient
    );
    const base64Tx = Buffer.from(transaction.serialize()).toString('base64');

    console.log("\n✅ Transaction created with:");
    console.log(`   1. Kora fee payment: 0.012 USDC`);
    console.log(`   2. USDC transfer: ${usdcAmount} USDC → ${recipient.toBase58()}`);
    console.log(`   3. juLeso transfer: 0.0001 SOL`);
    console.log(`   4. Jito transfer: 0.0001 SOL`);

    // Send via Kora
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

    console.log(`\n🔍 View on Explorer:`);
    console.log(`   https://explorer.solana.com/tx/${signature}`);
    console.log(`   https://solscan.io/tx/${signature}`);

    console.log("\n💰 Summary:");
    console.log(`   ✅ Sent ${usdcAmount} USDC to ${recipient.toBase58()}`);
    console.log(`   ✅ Paid 0.012 USDC to Kora (sponsorship fee)`);
    console.log(`   ✅ Kora paid SOL network fees`);
    console.log(`   ✅ Total cost: ${totalNeeded.toFixed(6)} USDC + 0.0002 SOL`);

    console.log("\n🎉 Transaction complete!");
    console.log("   Check the explorer link above to verify.");

  } catch (error) {
    console.error("\n❌ Transaction failed:", error.message);
    console.error("\nDetails:", error);
    process.exit(1);
  }
}

sendUSDC();
