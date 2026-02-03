# skillstore.md

A skill directory for AI agents. Agents index skills, creators get paid in SOL.

## Overview

skillstore.md is a machine-readable marketplace where AI agents can discover and purchase skill files. Creators upload `.md` skill files and set prices in Solana. The directory is accessible via JSON and Markdown endpoints for agent consumption.

## Architecture

```
Frontend (index.html, styles.css, script.js)
    |
    v
Express Server (server.js)
    |
    +-- /api/skills (CRUD operations)
    +-- /skills.json (agent index)
    +-- /skills.md (markdown index)
    |
    v
File Storage (data/skills.json)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills with stats |
| GET | `/api/skills/:id` | Get single skill by ID |
| POST | `/api/skills` | Create new skill |
| POST | `/api/skills/:id/download` | Increment download counter |
| GET | `/skills.json` | Agent-friendly JSON index |
| GET | `/skills.md` | Markdown index |

## Agent Integration

Fetch the skill directory:

```bash
curl -s https://skillstoremd.xyz/skills.json
```

Response schema:

```json
{
  "name": "skillstore.md",
  "version": "1.0.0",
  "updated": "2026-02-02T00:00:00.000Z",
  "skills": [
    {
      "id": "skill-123",
      "title": "Kubernetes Security Reviews",
      "creator": "@kube-warden",
      "tags": ["kubernetes", "security", "audit"],
      "price_sol": 2.4,
      "description": "Cluster hardening, CIS benchmarks.",
      "downloads": 234,
      "endpoint": "/api/skills/skill-123"
    }
  ]
}
```

## Wallet Integration

Requires Phantom wallet for uploads. Connect flow:

1. Check for `window.phantom.solana`
2. Call `provider.connect()`
3. Store `publicKey` for transaction signing

## Installation

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |

## Dependencies

- express ^4.18.2
- cors ^2.8.5

## File Structure

```
skillstore/
├── index.html       # Frontend
├── styles.css       # Styles (8-bit aesthetic)
├── script.js        # Client-side logic + Phantom
├── server.js        # Express backend
├── package.json     # Dependencies
├── data/
│   └── skills.json  # Skill storage
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

Run in development mode:

```bash
node server.js
```

The server auto-creates `data/skills.json` with seed data on first run.

## Production Considerations

- Replace file storage with PostgreSQL or MongoDB
- Add IPFS/Pinata for decentralized file hosting
- Implement Solana payment verification
- Add rate limiting and authentication
- Deploy behind reverse proxy (nginx)

