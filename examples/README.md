# Examples — TypeScript SDK

## `mm_bot.ts` — RFC 027 market-maker bot

Reference implementation that mirrors the canonical Rust bot
(`chain/crates/loadgen/src/bin/kombat_mm_bot.rs`) at a simplified scope:

- Account identity only (no delegation)
- Single shared session policy (assumed pre-created)
- No collateral bootstrap, no open-order cleanup on start
- Multi-market, multi-level two-sided quoting
- Background event poller logs RFC 027/054 MM events

Suitable as a starting point for a real bot, or to run alongside the Rust
loadgen bot and the Python/.NET examples — they all share env-var names so
a single `.env` file can drive a mix of language implementations quoting
the same markets.

### Build & run

```bash
npm install
npm run build
node dist/examples/mm_bot.js
```

### Required environment variables

| Variable | Description |
| --- | --- |
| `AND_MM_BOT_RPC_URL` | JSON-RPC endpoint, e.g. `http://localhost:18545` |
| `AND_MM_BOT_CHAIN_ID` | Chain id (decimal) |
| `AND_MM_BOT_MAKER_ACCOUNT_ID` | Bot's account id |
| `AND_MM_BOT_MAKER_POLICY_ID` | Pre-created session policy id |
| `AND_MM_BOT_MAKER_SESSION_SECRET_HEX` | 32-byte hex seed for the session key (grantee of the policy) |
| `AND_MM_BOT_MAKER_OWNER_SECRET_HEX` | 32-byte hex owner seed (only required when enrolling) |
| `AND_MM_BOT_MARKET_IDS` | Comma-separated market ids, e.g. `7,11` |
| `AND_MM_BOT_PROGRAM_ID_HEX` | RFC 027 program id (operator pre-creates the program) |

### Optional environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `AND_MM_BOT_LEVELS` | 5 | Levels per side |
| `AND_MM_BOT_SPREAD_BPS` | 5 | Half-spread from mark |
| `AND_MM_BOT_LEVEL_STEP_BPS` | 5 | Per-level step |
| `AND_MM_BOT_LEVEL_SIZE_GROWTH_BPS` | 2500 | Quantity growth per level |
| `AND_MM_BOT_BASE_QUANTITY_LOTS` | 5_000_000 | Base size in lots |
| `AND_MM_BOT_QUOTE_INTERVAL_MS` | 30_000 | Refresh cadence |
| `AND_MM_BOT_INTENT_TTL_MS` | 120_000 | Per-intent TTL |
| `AND_MM_BOT_OPERATOR_TOKEN` | _unset_ | Bearer token for operator-only RPCs |
| `AND_MM_BOT_BOND_MICRO_USDC` | 10_000_000_000 | RFC 027 enrollment bond |
| `AND_MM_BOT_ENROLL_ON_START` | true | Whether to (re)enroll on startup |
