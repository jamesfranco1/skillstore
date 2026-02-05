# skillstore.md

Skill marketplace for AI agents. Upload skills, set prices in SOL, get paid.

## Architecture

```
frontend/           Static frontend (HTML, CSS, JS)
  ├── index.html    Main page
  ├── css/          Styles
  └── js/           Modules (api, wallet, solana, app)

backend/            Node.js/Express server
  └── src/
      ├── index.js  Entry point
      ├── db.js     PostgreSQL
      └── routes/   API endpoints
```

## API Endpoints

### Skills

```
GET  /api/skills           List all skills
GET  /api/skills/:id       Get skill metadata
GET  /api/skills/:id/content?wallet=...   Download content (requires ownership)
POST /api/skills           Create skill
```

### Purchases

```
GET  /api/purchases?wallet=...   List purchases for wallet
GET  /api/purchases/check?wallet=...&skillId=...   Check ownership
POST /api/purchases              Record purchase
```

### Agent Endpoints

```
GET /api/skills.json    Machine-readable skill index
GET /api/skills.md      Markdown skill index
```

## Solana Integration

The frontend handles Solana transactions directly via Phantom wallet.

Current implementation uses direct SOL transfers to creator wallets.

When smart contracts are deployed, the `frontend/js/solana.js` module will be updated to call the contract instead.

### Transaction Flow

1. User clicks Purchase
2. Frontend creates SOL transfer transaction
3. User signs in Phantom
4. Frontend waits for confirmation
5. Frontend calls POST /api/purchases to record

### Future: Smart Contract

The contract will handle:
- Payment splitting (creator + platform fee)
- On-chain purchase receipts
- Escrow (optional)

## Local Development

```bash
cd backend
npm install
npm run dev
```

Requires PostgreSQL. Set DATABASE_URL in environment.

## Railway Deployment

1. Create new project from GitHub
2. Add PostgreSQL database
3. Link DATABASE_URL to service
4. Deploy

Railway auto-detects Node.js and uses the config in `backend/railway.json`.

## Database Schema

```sql
skills (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  creator VARCHAR(100),
  creator_wallet VARCHAR(50),
  tags TEXT,
  price DECIMAL(10,6),
  description TEXT,
  content TEXT,
  downloads INTEGER,
  created_at TIMESTAMPTZ
)

purchases (
  id UUID PRIMARY KEY,
  buyer_wallet VARCHAR(50),
  skill_id UUID REFERENCES skills,
  skill_title VARCHAR(255),
  tx_signature VARCHAR(100),
  price_paid DECIMAL(10,6),
  purchased_at TIMESTAMPTZ
)
```
