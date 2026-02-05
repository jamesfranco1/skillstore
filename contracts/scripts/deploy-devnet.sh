#!/bin/bash
# Deploy Skillstore to Devnet

set -e

echo "=== Skillstore Devnet Deployment ==="
echo ""

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "Error: Solana CLI not installed"
    echo "Install: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
    exit 1
fi

# Check if Anchor is installed
if ! command -v anchor &> /dev/null; then
    echo "Error: Anchor CLI not installed"
    echo "Install: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    echo "Then: avm install latest && avm use latest"
    exit 1
fi

# Set cluster to devnet
echo "Setting cluster to devnet..."
solana config set --url devnet

# Check wallet
WALLET_PUBKEY=$(solana address)
echo "Deployer wallet: $WALLET_PUBKEY"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo ""
    echo "Insufficient balance. Requesting airdrop..."
    solana airdrop 2
    sleep 5
    echo "New balance: $(solana balance)"
fi

# Build the program
echo ""
echo "Building program..."
anchor build

# Get program ID from build
PROGRAM_ID=$(solana address -k target/deploy/skillstore-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update Anchor.toml with actual program ID
echo "Updating Anchor.toml..."
sed -i "s/skillstore = \".*\"/skillstore = \"$PROGRAM_ID\"/" Anchor.toml

# Update lib.rs declare_id
echo "Updating lib.rs..."
sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/skillstore/src/lib.rs

# Rebuild with correct program ID
echo "Rebuilding with correct program ID..."
anchor build

# Deploy
echo ""
echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo ""
echo "=== Deployment Complete ==="
echo "Program ID: $PROGRAM_ID"
echo ""
echo "Next steps:"
echo "1. Initialize the config: anchor run init-config"
echo "2. Update PROGRAM_ID in src/solana/skillstore-client.ts"
echo "3. Test with: anchor test --skip-local-validator"


