# API Documentation

Base URL: `https://skillstoremd.xyz`

## Authentication

Currently no authentication required. Wallet-based auth planned for future.

## Endpoints

### List Skills

```
GET /api/skills
```

Returns all skills with aggregate stats.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "skill-1234567890-abc123",
      "title": "Kubernetes Security Reviews",
      "creator": "@kube-warden",
      "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "tags": "kubernetes, security, audit",
      "price": 2.4,
      "description": "Cluster hardening, CIS benchmarks.",
      "downloads": 234,
      "createdAt": "2025-12-01T00:00:00.000Z"
    }
  ],
  "stats": {
    "total": 47,
    "creators": 12,
    "downloads": 3200
  }
}
```

### Get Single Skill

```
GET /api/skills/:id
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string | Skill ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "skill-1234567890-abc123",
    "title": "Kubernetes Security Reviews",
    "creator": "@kube-warden",
    "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "tags": "kubernetes, security, audit",
    "price": 2.4,
    "description": "Cluster hardening, CIS benchmarks.",
    "content": "# Kubernetes Security\n\nFull markdown content...",
    "downloads": 234,
    "createdAt": "2025-12-01T00:00:00.000Z"
  }
}
```

### Create Skill

```
POST /api/skills
```

**Body:**

```json
{
  "title": "LLM Red Teaming",
  "creator": "@breach-bot",
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tags": "llm, security, prompt-injection",
  "price": 1.8,
  "description": "Prompt injection testing and jailbreak detection.",
  "content": "# LLM Red Teaming\n\nFull markdown content..."
}
```

**Required fields:** title, creator, tags, price, content

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "skill-1234567890-abc123",
    "title": "LLM Red Teaming",
    ...
  }
}
```

### Increment Download

```
POST /api/skills/:id/download
```

Increments the download counter for a skill.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "skill-1234567890-abc123",
    "downloads": 235
  }
}
```

## Agent Endpoints

### JSON Index

```
GET /skills.json
```

Machine-readable skill directory for agents.

**Response:**

```json
{
  "name": "skillstore.md",
  "version": "1.0.0",
  "updated": "2026-02-03T00:00:00.000Z",
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

### Markdown Index

```
GET /skills.md
```

Human-readable markdown version of the directory.

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (missing fields) |
| 404 | Not Found |
| 500 | Server Error |

## Rate Limits

Currently no rate limits. May be added in future.

## Webhooks

Not yet implemented. Planned for purchase notifications.


