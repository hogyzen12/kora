#!/usr/bin/env node

/**
 * Quick helper to create a test wallet for Kora testing
 * Usage: node create-test-wallet.js
 */

const { Keypair, Connection } = require('@solana/web3.js');
const fs = require('fs');

async function createWallet() {
  console.log("\n🔑 Creating Test Wallet for Kora Testing");
  console.log("=".repeat(60));

  // Generate new keypair
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();

  // Save to file
  const filename = 'test-wallet.json';
  const secretKey = Array.from(keypair.secretKey);
  fs.writeFileSync(filename, JSON.stringify(secretKey));

  console.log("\n✅ Wallet created successfully!");
  console.log(`   File: ${filename}`);
  console.log(`   Address: ${address}`);

  // Check current balance
  console.log("\n📊 Checking balance...");
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  const solBalance = balance / 1e9;

  console.log(`   Current balance: ${solBalance.toFixed(9)} SOL`);

  // Instructions
  console.log("\n" + "=".repeat(60));
  console.log("📋 Next Steps:");
  console.log("=".repeat(60));

  if (solBalance < 0.0003) {
    console.log("\n1. Fund this wallet with SOL:");
    console.log(`   Address: ${address}`);
    console.log(`   Minimum: 0.0003 SOL`);
    console.log(`   Recommended: 0.001 SOL (for multiple tests)`);
    console.log("\n2. Verify balance:");
    console.log(`   node -e "
const { Connection, Keypair } = require('@solana/web3.js');
const fs = require('fs');
(async () => {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('${filename}'))));
  const bal = await connection.getBalance(kp.publicKey);
  console.log('Balance:', bal / 1e9, 'SOL');
})();
"`);
    console.log("\n3. Run sponsorship test:");
    console.log(`   node test-sponsorship.js ${filename}`);
  } else {
    console.log("\n✅ Wallet has balance! Ready to test:");
    console.log(`   node test-sponsorship.js ${filename}`);
  }

  console.log("\n⚠️  Security:");
  console.log("   - Keep this keypair file secure");
  console.log("   - Don't commit it to git");
  console.log("   - Use minimal SOL amounts for testing");

  console.log("\n💡 To add to .gitignore:");
  console.log("   echo 'test-wallet.json' >> .gitignore");
  console.log("");
}

createWallet().catch(error => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
