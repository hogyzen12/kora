#!/usr/bin/env node

/**
 * Simple test script for Kora RPC API
 * Tests: getSupportedTokens, getPayerSigner, estimateTransactionFee
 */

const KORA_ENDPOINT = "https://kora-unruggable.fly.dev";

// Helper function to call Kora RPC
async function koraRPC(method, params = {}) {
  const response = await fetch(KORA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC Error: ${data.error.message}`);
  }

  return data.result;
}

// Test 1: Get supported tokens
async function testGetSupportedTokens() {
  console.log("\n🧪 Test 1: getSupportedTokens");
  console.log("=" .repeat(60));

  const result = await koraRPC("getSupportedTokens");
  console.log("✅ Supported tokens:");
  result.forEach(token => {
    console.log(`   - ${token.symbol}: ${token.mint}`);
  });

  return result;
}

// Test 2: Get payer signer info
async function testGetPayerSigner() {
  console.log("\n🧪 Test 2: getPayerSigner");
  console.log("=".repeat(60));

  const result = await koraRPC("getPayerSigner");
  console.log("✅ Fee Payer Info:");
  console.log(`   Payer: ${result.payer}`);
  console.log(`   Payment Destination: ${result.paymentDestination}`);

  return result;
}

// Test 3: Estimate transaction fee
async function testEstimateTransactionFee() {
  console.log("\n🧪 Test 3: estimateTransactionFee");
  console.log("=".repeat(60));

  // Get a recent blockhash first
  const blockhashResponse = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getLatestBlockhash",
    }),
  });
  const blockhashData = await blockhashResponse.json();
  const recentBlockhash = blockhashData.result.value.blockhash;

  // Create a simple transaction (just a transfer instruction as example)
  const { Connection, Keypair, SystemProgram, Transaction } = await import("@solana/web3.js");

  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const testWallet = Keypair.generate();
  const recipient = Keypair.generate().publicKey;

  const transaction = new Transaction({
    recentBlockhash,
    feePayer: testWallet.publicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: testWallet.publicKey,
      toPubkey: recipient,
      lamports: 10000, // 0.00001 SOL
    })
  );

  // Serialize transaction
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const base64Tx = serialized.toString("base64");

  console.log("   Testing fee estimation for simple transfer...");

  // Test with USDC
  try {
    const usdcResult = await koraRPC("estimateTransactionFee", {
      transaction: base64Tx,
      paymentToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    });
    console.log("✅ USDC Fee Estimate:");
    console.log(`   Amount: ${usdcResult.amount} (${usdcResult.amount / 1e6} USDC)`);
    console.log(`   Sol Fee: ${usdcResult.solFee} lamports`);
  } catch (error) {
    console.log(`❌ USDC estimation failed: ${error.message}`);
  }

  // Test with JLP
  try {
    const jlpResult = await koraRPC("estimateTransactionFee", {
      transaction: base64Tx,
      paymentToken: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", // JLP
    });
    console.log("✅ JLP Fee Estimate:");
    console.log(`   Amount: ${jlpResult.amount} (${jlpResult.amount / 1e6} JLP)`);
    console.log(`   Sol Fee: ${jlpResult.solFee} lamports`);
  } catch (error) {
    console.log(`❌ JLP estimation failed: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  console.log("\n🚀 Testing Kora RPC API");
  console.log("Endpoint:", KORA_ENDPOINT);
  console.log("=".repeat(60));

  try {
    await testGetSupportedTokens();
    await testGetPayerSigner();
    await testEstimateTransactionFee();

    console.log("\n" + "=".repeat(60));
    console.log("✅ All tests completed successfully!");
    console.log("=".repeat(60));
    console.log("\n💡 Next steps:");
    console.log("   1. Fund fee payer with more SOL if needed");
    console.log("   2. Test actual transaction signing");
    console.log("   3. Enable authentication (API Key + HMAC)");
    console.log("   4. Deploy hardened security config");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

runTests();
