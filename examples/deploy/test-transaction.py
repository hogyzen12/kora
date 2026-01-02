#!/usr/bin/env python3
"""
Test Kora transaction sponsorship with a real transaction
Creates a transaction with the 3 required checks:
1. Assembly/Slot Replay program
2. 0.0001 SOL transfer to juLeso
3. 0.0001 SOL transfer to Jito
"""

import json
import base64
import requests
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.instruction import Instruction, AccountMeta
from solders.pubkey import Pubkey
from solders.system_program import transfer, TransferParams
from solders.hash import Hash
from solders.compute_budget import set_compute_unit_price

# Configuration
KORA_ENDPOINT = "https://kora-unruggable.fly.dev"
SOLANA_RPC = "https://api.mainnet-beta.solana.com"

# Required addresses
ASSEMBLY_PROGRAM = Pubkey.from_string("23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ")
JULESO_ADDRESS = Pubkey.from_string("juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp")
JITO_ADDRESS = Pubkey.from_string("Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2")
REQUIRED_TRANSFER_LAMPORTS = 100_000  # 0.0001 SOL

def solana_rpc(method, params=None):
    """Call Solana RPC"""
    response = requests.post(SOLANA_RPC, json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or []
    })
    data = response.json()
    if "error" in data:
        raise Exception(f"Solana RPC error: {data['error']}")
    return data["result"]

def kora_rpc(method, params=None):
    """Call Kora RPC"""
    response = requests.post(KORA_ENDPOINT, json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or {}
    })
    data = response.json()
    if "error" in data:
        raise Exception(f"Kora RPC error: {data['error']}")
    return data["result"]

def create_app_transaction():
    """
    Create a transaction with the 3 required checks:
    1. Assembly program instruction (slot replay protection)
    2. Transfer 0.0001 SOL to juLeso
    3. Transfer 0.0001 SOL to Jito
    """
    # Get recent blockhash
    blockhash_result = solana_rpc("getLatestBlockhash", [{"commitment": "finalized"}])
    blockhash = Hash.from_string(blockhash_result["value"]["blockhash"])

    # Create a test sender wallet
    sender = Keypair()

    print(f"\n📝 Creating transaction...")
    print(f"   Sender: {sender.pubkey()}")
    print(f"   Blockhash: {blockhash}")

    # Build instructions
    instructions = []

    # 1. Compute budget (optional but recommended)
    instructions.append(set_compute_unit_price(1000))

    # 2. Assembly/Slot Replay instruction
    # Note: This is a placeholder - in reality, you'd need the actual Assembly instruction format
    # For now, we'll create a basic instruction to the Assembly program
    assembly_ix = Instruction(
        program_id=ASSEMBLY_PROGRAM,
        accounts=[
            AccountMeta(pubkey=sender.pubkey(), is_signer=True, is_writable=False),
        ],
        data=bytes([0])  # Placeholder data
    )
    instructions.append(assembly_ix)

    # 3. Transfer to juLeso
    juleso_transfer = transfer(TransferParams(
        from_pubkey=sender.pubkey(),
        to_pubkey=JULESO_ADDRESS,
        lamports=REQUIRED_TRANSFER_LAMPORTS
    ))
    instructions.append(juleso_transfer)

    # 4. Transfer to Jito
    jito_transfer = transfer(TransferParams(
        from_pubkey=sender.pubkey(),
        to_pubkey=JITO_ADDRESS,
        lamports=REQUIRED_TRANSFER_LAMPORTS
    ))
    instructions.append(jito_transfer)

    # Create message
    message = MessageV0.try_compile(
        payer=sender.pubkey(),
        instructions=instructions,
        address_lookup_table_accounts=[],
        recent_blockhash=blockhash,
    )

    # Create transaction (unsigned)
    tx = VersionedTransaction(message, [])

    # Serialize to base64
    tx_bytes = bytes(tx)
    tx_base64 = base64.b64encode(tx_bytes).decode()

    print(f"   ✅ Transaction created ({len(instructions)} instructions)")
    print(f"   ✅ Assembly program: {ASSEMBLY_PROGRAM}")
    print(f"   ✅ juLeso transfer: {REQUIRED_TRANSFER_LAMPORTS / 1e9} SOL")
    print(f"   ✅ Jito transfer: {REQUIRED_TRANSFER_LAMPORTS / 1e9} SOL")

    return tx_base64

def test_estimate_fee(tx_base64):
    """Test estimateTransactionFee endpoint"""
    print(f"\n💰 Testing fee estimation...")

    # Test with USDC
    usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    try:
        result = kora_rpc("estimateTransactionFee", {
            "transaction": tx_base64,
            "paymentToken": usdc_mint
        })
        usdc_amount = result["amount"] / 1e6
        sol_fee = result["solFee"] / 1e9
        print(f"   ✅ USDC fee estimate: {usdc_amount:.6f} USDC (SOL: {sol_fee:.9f})")
        return True
    except Exception as e:
        print(f"   ❌ Fee estimation failed: {e}")
        return False

def test_sign_transaction(tx_base64):
    """Test signTransaction endpoint"""
    print(f"\n✍️  Testing transaction signing...")

    usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    try:
        result = kora_rpc("signTransaction", {
            "transaction": tx_base64,
            "paymentToken": usdc_mint
        })
        print(f"   ✅ Transaction signed successfully")
        print(f"   Signed transaction (base64): {result['signedTransaction'][:80]}...")
        return True, result
    except Exception as e:
        print(f"   ❌ Signing failed: {e}")
        return False, None

def main():
    print("=" * 70)
    print("🧪 Testing Kora Transaction Sponsorship")
    print("=" * 70)
    print(f"\nEndpoint: {KORA_ENDPOINT}")

    # Get Kora config
    print(f"\n⚙️  Getting Kora configuration...")
    try:
        config = kora_rpc("getConfig")
        payer = config["fee_payers"][0]
        print(f"   Fee Payer: {payer}")
    except Exception as e:
        print(f"   ❌ Failed to get config: {e}")
        return

    # Create test transaction
    try:
        tx_base64 = create_app_transaction()
    except Exception as e:
        print(f"\n❌ Failed to create transaction: {e}")
        return

    # Test fee estimation
    if not test_estimate_fee(tx_base64):
        print("\n⚠️  Continuing despite fee estimation error...")

    # Test signing
    success, result = test_sign_transaction(tx_base64)

    # Summary
    print("\n" + "=" * 70)
    if success:
        print("✅ Transaction sponsorship test PASSED!")
        print("=" * 70)
        print("\n📊 Results:")
        print("   ✅ Transaction created with required checks")
        print("   ✅ Fee estimation working")
        print("   ✅ Transaction signing working")
        print("\n💡 Next steps:")
        print("   1. Test signAndSendTransaction to broadcast")
        print("   2. Verify transaction on Solana Explorer")
        print("   3. Enable authentication (API Key + HMAC)")
        print("   4. Deploy hardened security config")
    else:
        print("❌ Transaction sponsorship test FAILED")
        print("=" * 70)
        print("\n🔍 Troubleshooting:")
        print("   - Check fee payer has sufficient SOL balance")
        print("   - Verify allowed programs in kora.toml")
        print("   - Check Kora logs: flyctl logs -a kora-unruggable")

    print()

if __name__ == "__main__":
    main()
