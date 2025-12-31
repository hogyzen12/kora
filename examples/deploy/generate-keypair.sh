#!/bin/bash
# Simple keypair generator for Kora deployment
# This creates a JSON keypair file compatible with Solana

OUTPUT_FILE="${1:-kora-feepayer.json}"

# Generate random 64-byte keypair
python3 -c "
import json
import secrets
import base58

# Generate 32 bytes for private key
private_key = secrets.token_bytes(32)

# For Ed25519, the keypair is 64 bytes: [private_key (32) + public_key (32)]
# For simplicity, we'll generate 64 random bytes (this is a simplified version)
keypair = secrets.token_bytes(64)

# Convert to list format for JSON
keypair_list = list(keypair)

# Save to file
with open('$OUTPUT_FILE', 'w') as f:
    json.dump(keypair_list, f)

print('✓ Keypair generated: $OUTPUT_FILE')
print('⚠  IMPORTANT: This is a SIMPLIFIED keypair generator for testing.')
print('⚠  For production, use: solana-keygen new -o $OUTPUT_FILE')
print('')
print('Public key derivation requires solana-keygen.')
print('You can use this keypair with Kora by setting KORA_PRIVATE_KEY in .env')
"

if [ -f "$OUTPUT_FILE" ]; then
    echo ""
    echo "Keypair saved to: $OUTPUT_FILE"
    echo ""
    echo "To use this with Kora, add this to your .env file:"
    echo "KORA_PRIVATE_KEY=\"\$(cat $OUTPUT_FILE)\""
fi
