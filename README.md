# skillstore.md

A skill directory for AI agents. Agents index skills, creators get paid in SOL.

## Overview

skillstore.md is a machine-readable marketplace where AI agents can discover and purchase skill files. Creators upload `.md` skill files and set prices in Solana. The directory is accessible via JSON and Markdown endpoints for agent consumption.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         FRONTEND                               │
│  - Browse/search skills                                        │
│  - Connect Phantom wallet                                      │
│  - Purchase skills (triggers Solana transaction)              │
│  - Generate agent API keys                                     │
│  - View purchased skills                                       │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    SOLANA PROGRAM                              │
│  contracts/programs/skillstore/                                │
│  - list_skill(skill_id, price, metadata_uri)                  │
│  - purchase_skill() → 95% creator, 5% platform                │
│  - Stores on-chain receipts                                   │
│  - Emits purchase events                                       │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                       BACKEND                                  │
│  server.js + src/services/                                     │
│  - Agent API key management                                    │
│  - Purchase verification                                       │
│  - Watermarked content delivery                               │
│  - Skill CRUD operations                                       │
└────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills with stats |
| GET | `/api/skills/:id` | Get single skill by ID |
| POST | `/api/skills` | Create new skill listing |
| GET | `/skills.json` | Agent-friendly JSON index |
| GET | `/skills.md` | Markdown index |
| GET | `/api/purchases/verify/:wallet/:skillId` | Check ownership |

### Authenticated Endpoints (Requires Agent API Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/my-skills` | List purchased skills |
| GET | `/api/skills/:id/content` | Download watermarked content |
| GET | `/api/agent-keys` | List agent API keys |
| DELETE | `/api/agent-keys/:key` | Revoke API key |

### Purchase Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/purchases` | Record purchase after on-chain payment |
| POST | `/api/agent-keys` | Generate API key (requires wallet signature) |
| POST | `/api/verify-watermark` | Verify watermarked content |

## Agent Integration

### 1. Discover Skills

```bash
curl -s https://skillstoremd.xyz/skills.json
```

### 2. Purchase (via Solana Program)

Agents or users purchase through the Solana program which:
- Splits payment (95% creator, 5% platform)
- Creates on-chain receipt
- Emits `SkillPurchased` event

### 3. Generate API Key

After purchase, generate an agent API key:

```bash
# User signs message with Phantom wallet
# Backend verifies signature and issues key
POST /api/agent-keys
{
  "wallet": "7xKXtg...",
  "message": "Skillstore Agent Key Request\nWallet: 7xKXtg...\nTimestamp: 1707091200000",
  "signature": "base64_signature"
}
```

### 4. Download Content

```bash
curl -H "Authorization: Bearer sk_abc123..." \
  https://skillstoremd.xyz/api/skills/skill-123/content
```

Response includes watermarked content with:
- Visible license header
- Invisible steganographic watermark
- Unique fingerprint for piracy tracking

## Solana Program

The smart contract handles:
- Skill listing with price and metadata
- Payment splitting (configurable fee percentage)
- On-chain purchase receipts
- Treasury management

### Deployment (Devnet)

```bash
cd contracts
npm install
./scripts/deploy-devnet.sh
```

### Program Accounts

| Account | Seeds | Description |
|---------|-------|-------------|
| Config | `["config"]` | Platform settings, treasury address |
| Listing | `["listing", skill_id]` | Individual skill listing |
| Receipt | `["receipt", buyer, skill_id]` | Purchase proof |

## Watermarking

Downloaded skills are watermarked with:

```markdown
<!--
================================================================================
  SKILLSTORE.MD - Licensed Content
================================================================================
  License ID: purchase-abc123
  Fingerprint: a1b2c3d4e5f6g7h8
  Licensed To: 7xKXtg...AsU
  Purchase Date: 2026-02-04T00:00:00.000Z
  
  Redistribution is prohibited and traceable.
  Verify: https://skillstoremd.xyz/verify/a1b2c3d4e5f6g7h8
================================================================================
-->
```

Plus invisible zero-width character watermarks embedded throughout the content.

## Installation

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.

### Deploy Smart Contracts

```bash
# Install Solana CLI and Anchor
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest && avm use latest

# Deploy to devnet
cd contracts
npm install
./scripts/deploy-devnet.sh
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| SOLANA_RPC | devnet | Solana RPC endpoint |
| PROGRAM_ID | - | Deployed program address |

## Dependencies

### Backend
- express ^4.18.2
- cors ^2.8.5
- @solana/web3.js ^1.87.6
- tweetnacl ^1.0.3
- bs58 ^5.0.0

### Smart Contract
- anchor-lang 0.29.0

## File Structure

```
skillstore/
├── index.html              # Frontend
├── styles.css              # Styles (8-bit aesthetic)
├── script.js               # Client-side logic + Phantom
├── server.js               # Express backend
├── package.json            # Dependencies
├── data/
│   ├── skills.json         # Skill storage
│   └── purchases.json      # Purchase records
├── src/
│   ├── services/
│   │   ├── agent-keys.js   # API key management
│   │   └── watermark.js    # Content watermarking
│   └── solana/
│       └── skillstore-client.ts  # TypeScript client
├── contracts/
│   ├── Anchor.toml         # Anchor config
│   ├── programs/
│   │   └── skillstore/
│   │       └── src/lib.rs  # Solana program
│   ├── tests/
│   │   └── skillstore.ts   # Integration tests
│   └── scripts/
│       ├── deploy-devnet.sh
│       └── init-config.ts
└── README.md
```

## Skill Schema

```json
{
  "id": "string",
  "title": "string",
  "creator": "string",
  "wallet": "string | null",
  "tags": "string (comma-separated)",
  "price": "number",
  "description": "string",
  "content": "string (markdown)",
  "downloads": "number",
  "createdAt": "ISO 8601 timestamp"
}
```

## Development

```bash
# Run server with auto-reload
npm run dev

# Run tests
npm test

# Build smart contract
cd contracts && anchor build

# Test smart contract
cd contracts && anchor test
```

## Production Considerations

- Deploy Solana program to mainnet
- Use PostgreSQL or MongoDB for storage
- Add IPFS/Pinata for decentralized file hosting
- Implement rate limiting
- Deploy behind reverse proxy (nginx)
- Set up program upgrade authority multisig
