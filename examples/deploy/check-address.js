#!/usr/bin/env node

const { PublicKey } = require('@solana/web3.js');

const address = process.argv[2] || '6tBou5MHL5aWpDy6cgf3wiwGGGK2mR8qs68ujtpaoWrf2';

console.log('Testing address:', address);
console.log('Length:', address.length);
console.log('Characters:', address.split('').join(' '));

// Check for invalid Base58 characters
const invalidChars = ['0', 'O', 'I', 'l'];
const found = [];
for (let i = 0; i < address.length; i++) {
  const char = address[i];
  if (invalidChars.includes(char)) {
    found.push({ position: i, char });
  }
}

if (found.length > 0) {
  console.log('\n❌ Found invalid Base58 characters:');
  found.forEach(({position, char}) => {
    console.log(`   Position ${position}: '${char}'`);
  });
} else {
  console.log('\n✅ No obviously invalid Base58 characters found');
}

// Try to create PublicKey
try {
  const pubkey = new PublicKey(address);
  console.log('\n✅ Valid Solana address!');
  console.log('   PublicKey:', pubkey.toBase58());
} catch (error) {
  console.log('\n❌ Invalid address!');
  console.log('   Error:', error.message);

  // Try to decode base58
  const bs58 = require('bs58');
  try {
    const decoded = bs58.decode(address);
    console.log('   Decoded length:', decoded.length);
    console.log('   Expected: 32 bytes');
  } catch (decodeError) {
    console.log('   Base58 decode error:', decodeError.message);
  }
}
