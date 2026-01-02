# Creating a Test Wallet for Kora Testing

To test Kora transaction sponsorship, you need a funded Solana wallet.

## Option 1: Create New Test Wallet

### Step 1: Generate Keypair

```bash
# Using Solana CLI (if installed)
solana-keygen new --outfile test-wallet.json

# Or use Node.js
node -e "
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const keypair = Keypair.generate();
const secretKey = Array.from(keypair.secretKey);
fs.writeFileSync('test-wallet.json', JSON.stringify(secretKey));
console.log('Wallet created: test-wallet.json');
console.log('Address:', keypair.publicKey.toBase58());
"
```

### Step 2: Fund the Wallet

You need **at least 0.0003 SOL** for testing (preferably 0.001 SOL):

1. **Get the wallet address:**
   ```bash
   node -e "
   const { Keypair } = require('@solana/web3.js');
   const fs = require('fs');
   const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('test-wallet.json'))));
   console.log(keypair.publicKey.toBase58());
   "
   ```

2. **Send SOL to this address** from your main wallet or exchange

3. **Verify balance:**
   ```bash
   node -e "
   const { Connection, Keypair } = require('@solana/web3.js');
   const fs = require('fs');
   (async () => {
     const connection = new Connection('https://api.mainnet-beta.solana.com');
     const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('test-wallet.json'))));
     const balance = await connection.getBalance(keypair.publicKey);
     console.log('Balance:', balance / 1e9, 'SOL');
   })();
   "
   ```

### Step 3: Run Test

```bash
node test-sponsorship.js test-wallet.json
```

---

## Option 2: Use Existing Wallet

If you already have a Solana wallet keypair:

```bash
# Test with your existing keypair
node test-sponsorship.js /path/to/your-wallet.json
```

**Requirements:**
- Keypair must be in JSON format (array of 64 bytes)
- Must have at least 0.0003 SOL balance
- Recommended: 0.001 SOL or more for multiple tests

---

## Expected Balance Breakdown

For each test transaction, the wallet needs:

| Purpose | Amount | Description |
|---------|--------|-------------|
| juLeso transfer | 0.0001 SOL | Required check #1 |
| Jito tip | 0.0001 SOL | Required check #2 |
| Buffer | 0.0001 SOL | Safety margin |
| **Total** | **0.0003 SOL** | Minimum needed |

**Note:** Kora pays the network transaction fees! Your wallet only needs enough for the transfers.

---

## Security Note

⚠️ **Keep your test wallet keypair secure!**

- Don't commit it to git
- Don't share it publicly
- Use a separate wallet from your main funds
- This is for testing only - use minimal amounts

Add to `.gitignore`:
```
test-wallet.json
*.keypair.json
```

---

## Troubleshooting

### Error: "Insufficient balance"

**Solution:** Fund the wallet with more SOL
```bash
# Check current balance
node -e "
const { Connection, Keypair } = require('@solana/web3.js');
const fs = require('fs');
(async () => {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('test-wallet.json'))));
  const balance = await connection.getBalance(keypair.publicKey);
  console.log('Need at least 0.0003 SOL');
  console.log('Current:', balance / 1e9, 'SOL');
  console.log('Address:', keypair.publicKey.toBase58());
})();
"
```

### Error: "Failed to load keypair"

**Possible issues:**
1. File doesn't exist at the path
2. File is not valid JSON
3. File is not in the correct format (should be array of 64 numbers)

**Solution:** Verify the keypair file format:
```bash
cat test-wallet.json | jq 'length'
# Should output: 64
```

### Error: "Transaction simulation failed"

**Possible issues:**
1. Wallet has 0 SOL
2. Network issues
3. Kora validation rules not met

**Solution:** Check the wallet is funded and try again

---

## Quick Start Example

```bash
# 1. Install dependencies
npm install @solana/web3.js

# 2. Create wallet
node -e "
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const keypair = Keypair.generate();
fs.writeFileSync('test-wallet.json', JSON.stringify(Array.from(keypair.secretKey)));
console.log('Created wallet:', keypair.publicKey.toBase58());
console.log('Fund this address with 0.001 SOL');
"

# 3. Fund the wallet (copy address from above)
# Send 0.001 SOL to the address

# 4. Run test
node test-sponsorship.js test-wallet.json
```

---

## What Happens During Test

1. ✅ Loads your keypair
2. ✅ Checks SOL balance (needs 0.0003+)
3. ✅ Creates transaction with 3 required checks
4. ✅ Estimates fee in USDC
5. ✅ Signs transaction with Kora
6. ✅ Shows you the cost per transaction

**Result:** You'll know exactly how much USDC users will pay for gasless transactions!
