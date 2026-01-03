# Kora Transaction Sponsorship - Implementation Guide for Rust Apps

This guide shows how to integrate Kora transaction sponsorship into your Rust application (Dioxus, Leptos, or any Rust app).

---

## 🎯 What is Kora?

**In 30 seconds:**

Kora is a **transaction paymaster** that lets your users pay transaction fees in **USDC/SPL tokens** instead of **SOL**.

**How it works:**
1. User creates a transaction (their transfer, swap, NFT mint, etc.)
2. User adds a **USDC payment** to Kora
3. Kora **signs as fee payer** (pays SOL network fees)
4. User pays in USDC, Kora pays in SOL
5. **Result:** Gasless transactions for users who don't have SOL!

**Perfect for:**
- Onboarding new users (no SOL required!)
- Apps that want predictable pricing in USDC
- Simplifying UX (users only need one token)

---

## 🚀 Quick Start Integration

### 1. Add Dependencies

```toml
[dependencies]
solana-sdk = "2.0"
solana-client = "2.0"
spl-associated-token-account = "6.0"
spl-token = "6.0"
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
base64 = "0.22"
```

### 2. Core Integration Code

```rust
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::Instruction,
    message::Message,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::instruction::transfer;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

// Kora RPC endpoint
const KORA_ENDPOINT: &str = "https://kora-unruggable.fly.dev";

// Required addresses
const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JULESO_ADDRESS: &str = "juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp";
const JITO_ADDRESS: &str = "Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2";

// Kora fee (adjust based on your testing)
const KORA_FEE_MICRO_USDC: u64 = 12_000; // 0.012 USDC

#[derive(Serialize, Deserialize, Debug)]
struct KoraRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug)]
struct KoraRpcResponse<T> {
    jsonrpc: String,
    id: u64,
    result: Option<T>,
    error: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
struct PayerInfo {
    signer_address: String,
    payment_address: String,
}

/// Get Kora fee payer info
async fn get_kora_payer() -> Result<PayerInfo, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let request = KoraRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "getPayerSigner".to_string(),
        params: serde_json::json!({}),
    };

    let response = client
        .post(KORA_ENDPOINT)
        .json(&request)
        .send()
        .await?
        .json::<KoraRpcResponse<PayerInfo>>()
        .await?;

    response.result.ok_or("No result from Kora".into())
}

/// Send USDC via Kora sponsorship
async fn send_usdc_sponsored(
    sender: &Keypair,
    recipient: &Pubkey,
    usdc_amount: u64, // in micro-USDC (1 USDC = 1_000_000 micro-USDC)
    rpc_client: &solana_client::rpc_client::RpcClient,
) -> Result<String, Box<dyn std::error::Error>> {

    // 1. Get Kora payer info
    let payer_info = get_kora_payer().await?;
    let kora_payer = Pubkey::from_str(&payer_info.signer_address)?;
    let kora_payment = Pubkey::from_str(&payer_info.payment_address)?;

    // 2. Get token accounts
    let usdc_mint = Pubkey::from_str(USDC_MINT)?;
    let sender_usdc = get_associated_token_address(&sender.pubkey(), &usdc_mint);
    let kora_usdc = get_associated_token_address(&kora_payment, &usdc_mint);
    let recipient_usdc = get_associated_token_address(recipient, &usdc_mint);

    // 3. Get recent blockhash
    let recent_blockhash = rpc_client.get_latest_blockhash()?;

    // 4. Build instructions
    let mut instructions = Vec::new();

    // Compute budget
    instructions.push(ComputeBudgetInstruction::set_compute_unit_price(1000));

    // Pay Kora fee (USDC)
    instructions.push(
        transfer(
            &spl_token::id(),
            &sender_usdc,
            &kora_usdc,
            &sender.pubkey(),
            &[],
            KORA_FEE_MICRO_USDC,
        )?
    );

    // Send USDC to recipient
    instructions.push(
        transfer(
            &spl_token::id(),
            &sender_usdc,
            &recipient_usdc,
            &sender.pubkey(),
            &[],
            usdc_amount,
        )?
    );

    // juLeso transfer (required check)
    let juleso = Pubkey::from_str(JULESO_ADDRESS)?;
    instructions.push(
        system_instruction::transfer(&sender.pubkey(), &juleso, 100_000)
    );

    // Jito transfer (required check)
    let jito = Pubkey::from_str(JITO_ADDRESS)?;
    instructions.push(
        system_instruction::transfer(&sender.pubkey(), &jito, 100_000)
    );

    // 5. Create transaction with KORA as fee payer
    let message = Message::new_with_blockhash(
        &instructions,
        Some(&kora_payer), // ⚠️ CRITICAL: Kora is the fee payer!
        &recent_blockhash,
    );

    let mut transaction = Transaction::new_unsigned(message);

    // 6. Sign with sender (authorizes USDC payment + transfers)
    transaction.partial_sign(&[sender], recent_blockhash);

    // 7. Serialize to base64
    let serialized = bincode::serialize(&transaction)?;
    let base64_tx = base64::encode(&serialized);

    // 8. Send to Kora for signing and broadcasting
    let client = reqwest::Client::new();

    let request = KoraRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "signAndSendTransaction".to_string(),
        params: serde_json::json!({
            "transaction": base64_tx,
            "paymentToken": USDC_MINT,
        }),
    };

    let response = client
        .post(KORA_ENDPOINT)
        .json(&request)
        .send()
        .await?
        .json::<KoraRpcResponse<serde_json::Value>>()
        .await?;

    if let Some(error) = response.error {
        return Err(format!("Kora error: {:?}", error).into());
    }

    let result = response.result.ok_or("No result from Kora")?;
    let signature = result["signature"]
        .as_str()
        .or_else(|| result.as_str())
        .ok_or("No signature in response")?;

    Ok(signature.to_string())
}
```

### 3. Example Usage in Dioxus

```rust
use dioxus::prelude::*;

#[component]
fn SendUSDCButton(cx: Scope) -> Element {
    let status = use_state(cx, || "Ready".to_string());

    let send_usdc = move |_| {
        let status = status.clone();

        cx.spawn(async move {
            status.set("Sending...".to_string());

            // Your wallet keypair (from user's wallet)
            let sender = get_user_keypair(); // Your implementation

            // Recipient address
            let recipient = Pubkey::from_str("6tBou5MHL5aWpDy6cgf3wiwGGK2mR8qs68ujtpaoWrf2")
                .unwrap();

            // Amount in micro-USDC (0.42 USDC = 420,000 micro-USDC)
            let amount = 420_000;

            // RPC client
            let rpc_client = solana_client::rpc_client::RpcClient::new(
                "https://api.mainnet-beta.solana.com".to_string()
            );

            match send_usdc_sponsored(&sender, &recipient, amount, &rpc_client).await {
                Ok(signature) => {
                    status.set(format!("Success! Tx: {}", signature));
                    println!("View on explorer: https://solscan.io/tx/{}", signature);
                }
                Err(e) => {
                    status.set(format!("Error: {}", e));
                }
            }
        });
    };

    render! {
        div {
            button {
                onclick: send_usdc,
                "Send 0.42 USDC (Sponsored)"
            }
            p { "{status}" }
        }
    }
}
```

---

## 📋 Checklist for Production

- [ ] **Test on devnet first** (use devnet endpoint and devnet USDC)
- [ ] **Fund Kora fee payer** with sufficient SOL
- [ ] **Enable authentication** (API Key + HMAC) in production
- [ ] **Implement retry logic** for failed transactions
- [ ] **Monitor Kora fee payer balance** (set up alerts)
- [ ] **Add Assembly program instruction** (get real instruction from your firmware)
- [ ] **Validate transactions** before sending to Kora
- [ ] **Handle edge cases** (insufficient balance, network errors, etc.)

---

## 🔐 Adding Authentication (Production)

When you enable authentication in Kora, add headers to your requests:

```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;

const API_KEY: &str = "your-api-key-here";
const HMAC_SECRET: &str = "your-hmac-secret-here";

fn create_hmac_signature(body: &str, timestamp: u64) -> String {
    type HmacSha256 = Hmac<Sha256>;

    let message = format!("{}{}", timestamp, body);
    let mut mac = HmacSha256::new_from_slice(HMAC_SECRET.as_bytes())
        .expect("HMAC key");
    mac.update(message.as_bytes());

    let result = mac.finalize();
    base64::encode(result.into_bytes())
}

async fn kora_rpc_authenticated(
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    });

    let body = serde_json::to_string(&request)?;
    let signature = create_hmac_signature(&body, timestamp);

    let response = client
        .post(KORA_ENDPOINT)
        .header("x-api-key", API_KEY)
        .header("x-timestamp", timestamp.to_string())
        .header("x-hmac-signature", signature)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await?
        .json()
        .await?;

    Ok(response)
}
```

---

## 💡 Common Patterns

### Pattern 1: Simple USDC Transfer
```rust
// User sends USDC, Kora pays fees
send_usdc_sponsored(&sender, &recipient, 1_000_000, &rpc_client).await?;
```

### Pattern 2: NFT Mint (Gasless for User)
```rust
// Add your NFT mint instructions + Kora payment
let mut instructions = vec![
    kora_payment_instruction,
    your_nft_mint_instruction,
    juleso_transfer,
    jito_transfer,
];
// Set Kora as fee payer, send to Kora
```

### Pattern 3: Token Swap
```rust
// Add Jupiter/Raydium swap + Kora payment
let mut instructions = vec![
    kora_payment_instruction,
    swap_instruction,
    juleso_transfer,
    jito_transfer,
];
// Set Kora as fee payer, send to Kora
```

---

## 🆘 Troubleshooting

### Error: "Insufficient token payment"
**Cause:** USDC payment to Kora is too low
**Fix:** Increase `KORA_FEE_MICRO_USDC` (test with 12,000 = 0.012 USDC)

### Error: "Signer not found in transaction"
**Cause:** Fee payer not set correctly
**Fix:** Ensure `Some(&kora_payer)` in Message::new_with_blockhash

### Error: "Transaction simulation failed"
**Cause:** Missing required checks or invalid instruction
**Fix:** Verify juLeso + Jito transfers are included

### Error: "Insufficient SOL"
**Cause:** Kora fee payer has insufficient balance
**Fix:** Fund Kora fee payer address with more SOL

---

## 📚 Resources

- **Kora Endpoint:** `https://kora-unruggable.fly.dev`
- **Fee Payer:** `KoRaXJTbWuDNgCFdhu6dygok5Fh1dcQB6iLxuDNLoiN`
- **Typical Cost:** ~0.012 USDC per transaction
- **Explorer:** https://explorer.solana.com
- **API Docs:** See `TESTING.md` in examples/deploy/

---

## 🎉 You're Ready!

Your app can now offer **gasless transactions** where users pay in USDC instead of SOL!

**Benefits:**
- ✅ Easier onboarding (no SOL required)
- ✅ Predictable pricing (USDC-based fees)
- ✅ Better UX (users only need one token)
- ✅ Production-ready with authentication
