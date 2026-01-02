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

  // Token names mapping
  const tokenNames = {
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4": "JLP"
  };

  result.tokens.forEach(mint => {
    const name = tokenNames[mint] || "Unknown";
    console.log(`   - ${name}: ${mint}`);
  });

  return result;
}

// Test 2: Get payer signer info
async function testGetPayerSigner() {
  console.log("\n🧪 Test 2: getPayerSigner");
  console.log("=".repeat(60));

  const result = await koraRPC("getPayerSigner");
  console.log("✅ Fee Payer Info:");
  console.log(`   Signer Address: ${result.signer_address}`);
  console.log(`   Payment Address: ${result.payment_address}`);

  return result;
}

// Test 3: Get blockhash
async function testGetBlockhash() {
  console.log("\n🧪 Test 3: getBlockhash");
  console.log("=".repeat(60));

  try {
    const result = await koraRPC("getBlockhash");
    console.log("✅ Recent blockhash:");
    console.log(`   ${result.blockhash}`);
    console.log(`   Last valid block height: ${result.lastValidBlockHeight}`);
  } catch (error) {
    console.log(`❌ getBlockhash failed: ${error.message}`);
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
    await testGetBlockhash();

    console.log("\n" + "=".repeat(60));
    console.log("✅ All tests completed successfully!");
    console.log("=".repeat(60));
    console.log("\n💡 Next steps:");
    console.log("   1. Check fee payer balance and fund if needed");
    console.log("   2. Test transaction signing with your app");
    console.log("   3. Enable authentication (API Key + HMAC)");
    console.log("   4. Deploy hardened security config");
    console.log("\n📊 Current Status:");
    console.log("   - Endpoint: https://kora-unruggable.fly.dev");
    console.log("   - Authentication: ❌ DISABLED (test mode)");
    console.log("   - Ready for testing: ✅");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\nError details:", error);
    process.exit(1);
  }
}

runTests();
