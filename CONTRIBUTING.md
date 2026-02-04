# Contributing

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Start server: `npm start`

## Code Style

- Use 2 spaces for indentation
- No semicolons (StandardJS style)
- Single quotes for strings
- Trailing commas in multiline

## Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: code restructure
test: add tests
chore: maintenance tasks
```

## Pull Request Process

1. Create feature branch from `main`
2. Make changes
3. Run tests: `npm test`
4. Update documentation if needed
5. Submit PR with clear description

## Project Structure

```
skillstore/
├── server.js           # Main Express server
├── src/
│   └── solana/         # Solana payment modules
├── docs/               # Documentation
├── tests/              # Test files
└── data/               # Runtime data storage
```

## Adding Features

### New API Endpoint

1. Add route in `server.js`
2. Document in `docs/API.md`
3. Add tests in `tests/`

### Solana Integration

Payment code lives in `src/solana/`. Server-side in `payment.js`, client-side in `client.js`.

## Reporting Issues

Include:

- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs


