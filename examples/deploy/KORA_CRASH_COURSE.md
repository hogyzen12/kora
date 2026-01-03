# Kora - 5 Minute Crash Course

## 🎯 What is Kora?

**Kora is a transaction paymaster for Solana.** It lets users pay transaction fees in **USDC** (or other SPL tokens) instead of **SOL**.

---

## 🤔 The Problem Kora Solves

**Normal Solana transaction:**
```
User needs:
- SOL for network fees (~0.000005 SOL)
- The token they want to send (USDC, NFT, etc.)

Problem: New users have to acquire TWO tokens just to make ONE transaction!
```

**With Kora:**
```
User needs:
- Just USDC (or their token)

Kora pays the SOL fees for them!
```

---

## 💡 How It Works (Simple Version)

```
1. User creates a transaction
   └─ Example: Send 10 USDC to Alice

2. User adds a USDC payment to Kora (~0.01 USDC)
   └─ This is their "fee" to Kora

3. User sends transaction to Kora
   └─ Transaction has Kora set as the "fee payer"

4. Kora validates and signs the transaction
   └─ Takes the USDC payment
   └─ Pays the SOL network fees (~0.000005 SOL)

5. Transaction is broadcast to Solana
   └─ User paid in USDC
   └─ Kora paid in SOL
   └─ Result: Gasless for the user!
```

---

## 🔧 Technical Flow

```rust
// 1. Normal transaction (without Kora)
let transaction = Transaction {
    fee_payer: user.pubkey(),  // ❌ User must have SOL
    instructions: [send_usdc_instruction],
    // User pays SOL fees
};

// 2. Kora-sponsored transaction
let transaction = Transaction {
    fee_payer: kora.pubkey(),  // ✅ Kora pays SOL fees!
    instructions: [
        pay_kora_in_usdc,      // User pays Kora in USDC
        send_usdc_instruction,  // User's actual transaction
        juleso_transfer,        // Required validation
        jito_transfer,          // Required validation
    ],
    // Kora pays SOL fees, user pays USDC
};
```

---

## 💰 The Economics

**User perspective:**
- Pays ~0.01-0.02 USDC per transaction
- No SOL required
- Simple, predictable pricing

**Kora's perspective:**
- Receives 0.01-0.02 USDC per transaction
- Pays ~0.000005 SOL in network fees (~$0.0005 at $100/SOL)
- Makes ~$0.01 profit per transaction

**Your app's perspective:**
- Users don't need SOL to get started
- Easier onboarding
- Better UX
- Pay Kora ~$0.01 per transaction for this service

---

## 🔐 Security Model

Kora has **3 layers** of security:

### Layer 1: Configuration (kora.toml)
```toml
# Only allow specific programs
allowed_programs = [
    "System Program",
    "Token Program",
    "Your App's Program",
]

# Only accept specific tokens for payment
allowed_tokens = ["USDC", "JLP"]

# Strict fee payer policy (all actions denied by default)
fee_payer_policy.allow_transfer = false  # Kora can't steal!
```

### Layer 2: Transaction Validation
- Kora simulates transactions before signing
- Validates all instructions
- Checks payment is sufficient
- Ensures no malicious behavior

### Layer 3: Authentication (Production)
- API Key authentication
- HMAC request signing
- Rate limiting
- Only your app can use your Kora instance

---

## 🎯 Key Concepts

### 1. Fee Payer
The account that pays SOL network fees for a transaction.
- **Normal:** User is fee payer (needs SOL)
- **Kora:** Kora is fee payer (user doesn't need SOL)

### 2. Payment Token
The token users pay Kora with (usually USDC).
- Kora receives USDC
- Kora pays SOL
- Conversion happens at market rates

### 3. Sponsorship Fee
The USDC amount paid to Kora per transaction.
- ~0.01-0.02 USDC typical
- Covers SOL costs + Kora profit
- Fixed and predictable

### 4. Required Checks
Instructions that must be in every transaction:
- **juLeso transfer:** 0.0001 SOL to slot replay service
- **Jito transfer:** 0.0001 SOL to Jito for MEV protection
- **Assembly program:** Replay protection (optional in your config)

---

## 🚀 Real-World Example

**Scenario:** User wants to send 100 USDC to a friend

**Without Kora:**
```
User needs:
- 100 USDC (to send)
- ~0.000005 SOL (for fees)
- Must acquire SOL first (friction!)
```

**With Kora:**
```
User needs:
- 100.012 USDC total
  - 100 USDC (to send)
  - 0.012 USDC (Kora fee)
- 0 SOL required!

Transaction:
1. Pay Kora 0.012 USDC
2. Send 100 USDC to friend
3. Kora pays SOL fees
4. Done!
```

---

## 📊 Kora Architecture

```
┌─────────────┐
│  Your App   │  Creates transaction
│   (Dioxus)  │  Sets Kora as fee payer
└──────┬──────┘  Signs with user wallet
       │
       ▼
┌─────────────┐
│    Kora     │  Validates transaction
│  RPC Server │  Checks USDC payment
└──────┬──────┘  Signs as fee payer
       │
       ▼
┌─────────────┐
│   Solana    │  Receives signed transaction
│  Mainnet    │  Kora's SOL pays network fees
└─────────────┘  User's USDC goes to recipient
```

---

## 🎓 Key Takeaways

1. **Kora = Paymaster** - Pays SOL fees so users don't have to
2. **Users pay in USDC** - ~$0.01 per transaction
3. **Kora pays in SOL** - ~$0.0005 in actual network fees
4. **Net result:** Gasless transactions for users (from SOL perspective)
5. **Perfect for:** Onboarding users who don't have SOL

---

## 🔑 Core Implementation Steps

```rust
// 1. Get Kora's fee payer address
let kora_payer = get_kora_payer().await;

// 2. Build transaction with Kora as fee payer
let transaction = Transaction {
    fee_payer: kora_payer,  // ← This is the magic!
    instructions: [
        pay_kora_usdc,       // Pay Kora
        your_instruction,    // Your transaction
        required_checks,     // juLeso + Jito
    ],
};

// 3. Sign with user's wallet
transaction.sign(&[user_wallet]);

// 4. Send to Kora
let signature = kora_sign_and_send(transaction).await;

// 5. Transaction confirmed!
// User paid USDC, Kora paid SOL
```

---

## 💡 When to Use Kora

**✅ Perfect for:**
- Apps with non-technical users
- Onboarding new users to Solana
- Predictable USDC-based pricing
- Simplifying UX (one token only)

**❌ Not ideal for:**
- Power users who have SOL
- High-volume trading (SOL fees are cheaper)
- Apps that need custom fee payers

---

## 🎉 That's Kora!

**In one sentence:**
Kora lets users pay transaction fees in USDC instead of SOL by acting as a paymaster that pays the SOL fees on their behalf.

**Your deployment:**
- Endpoint: `https://kora-unruggable.fly.dev`
- Fee: ~0.012 USDC per transaction
- Status: ✅ Live and working!

Now go build awesome gasless experiences! 🚀
