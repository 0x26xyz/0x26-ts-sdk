/**
 * RFC 027 market-maker bot — TypeScript reference implementation.
 *
 * Mirrors `chain/crates/loadgen/src/bin/kombat_mm_bot.rs` behavior at a
 * simplified scope: account identity only (no delegation), single shared
 * policy, no collateral or open-order bootstrap. Suitable as a starting
 * point for a real bot, or to run alongside the Rust loadgen bot so a mix
 * of language implementations are quoting the same markets.
 *
 * Configuration is read from environment variables matching the Rust bot
 * where possible, so a single .env file can drive a mix of bots.
 *
 * Run with:
 *   npm run build
 *   node --enable-source-maps dist/examples/mm_bot.js
 *
 * Required env:
 *   AND_MM_BOT_RPC_URL                   — e.g. http://localhost:18545
 *   AND_MM_BOT_CHAIN_ID                  — chain id (decimal)
 *   AND_MM_BOT_MAKER_ACCOUNT_ID          — bot account id
 *   AND_MM_BOT_MAKER_POLICY_ID           — pre-created session policy id
 *   AND_MM_BOT_MAKER_SESSION_SECRET_HEX  — 32-byte hex seed for session key
 *   AND_MM_BOT_MAKER_OWNER_SECRET_HEX    — 32-byte hex owner seed (only used when bootstrap_rfc027=true)
 *   AND_MM_BOT_MARKET_IDS                — comma-separated, e.g. "7,11"
 *   AND_MM_BOT_PROGRAM_ID_HEX            — RFC 027 program id (operator pre-creates)
 *
 * Optional env (with defaults):
 *   AND_MM_BOT_LEVELS                    — number of levels per side (default 5)
 *   AND_MM_BOT_SPREAD_BPS                — half-spread from mark (default 5)
 *   AND_MM_BOT_LEVEL_STEP_BPS            — per-level step (default 5)
 *   AND_MM_BOT_LEVEL_SIZE_GROWTH_BPS     — qty growth per level (default 2500)
 *   AND_MM_BOT_BASE_QUANTITY_LOTS        — base size in lots (default 5_000_000)
 *   AND_MM_BOT_QUOTE_INTERVAL_MS         — refresh interval (default 30_000)
 *   AND_MM_BOT_INTENT_TTL_MS             — per-intent ttl (default 120_000)
 *   AND_MM_BOT_OPERATOR_TOKEN            — bearer for operator-only RPCs
 *   AND_MM_BOT_BOND_MICRO_USDC           — RFC 027 bond on first enrollment (default 10_000_000_000)
 *   AND_MM_BOT_ENROLL_ON_START           — "true" to (re)enroll on startup (default "true")
 */

import {
  AndChainClient,
  Keypair,
  signMarketMakerProgramAction,
  type IntentRequest,
  type MarketMakerEnrollmentGraceEnteredEvent,
  type MarketMakerEnrollmentNonCompliantEvent,
  type MarketMakerEnrollmentRecoveredEvent,
  type MmProgramBonusForfeitedEvent,
  type MmProgramBonusPaidEvent,
  type RuntimeEventRecord,
} from "../dist/index.js";

interface BotConfig {
  rpcUrl: string;
  chainId: number;
  makerAccountId: number;
  makerPolicyId: number;
  session: Keypair;
  owner: Keypair;
  marketIds: number[];
  programIdHex: string;
  levels: number;
  spreadBps: number;
  levelStepBps: number;
  levelSizeGrowthBps: number;
  baseQuantityLots: number;
  quoteIntervalMs: number;
  intentTtlMs: number;
  operatorToken: string | undefined;
  bondMicroUsdc: bigint;
  enrollOnStart: boolean;
}

interface LaneState {
  marketId: number;
  side: "bid" | "ask";
  level: number;
  currentClientOrderId: number | null;
}

function loadConfig(): BotConfig {
  const required = (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`missing required env ${key}`);
    return value;
  };
  const optionalInt = (key: string, fallback: number): number => {
    const value = process.env[key];
    return value ? Number(value) : fallback;
  };
  const optionalBigInt = (key: string, fallback: bigint): bigint => {
    const value = process.env[key];
    return value ? BigInt(value) : fallback;
  };
  const marketIds = required("AND_MM_BOT_MARKET_IDS")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id));
  if (marketIds.length === 0) {
    throw new Error("AND_MM_BOT_MARKET_IDS must list at least one market");
  }
  return {
    rpcUrl: required("AND_MM_BOT_RPC_URL"),
    chainId: Number(required("AND_MM_BOT_CHAIN_ID")),
    makerAccountId: Number(required("AND_MM_BOT_MAKER_ACCOUNT_ID")),
    makerPolicyId: Number(required("AND_MM_BOT_MAKER_POLICY_ID")),
    session: Keypair.fromSecretHex(required("AND_MM_BOT_MAKER_SESSION_SECRET_HEX")),
    owner: Keypair.fromSecretHex(
      process.env.AND_MM_BOT_MAKER_OWNER_SECRET_HEX ??
        required("AND_MM_BOT_MAKER_SESSION_SECRET_HEX")
    ),
    marketIds,
    programIdHex: required("AND_MM_BOT_PROGRAM_ID_HEX"),
    levels: optionalInt("AND_MM_BOT_LEVELS", 5),
    spreadBps: optionalInt("AND_MM_BOT_SPREAD_BPS", 5),
    levelStepBps: optionalInt("AND_MM_BOT_LEVEL_STEP_BPS", 5),
    levelSizeGrowthBps: optionalInt("AND_MM_BOT_LEVEL_SIZE_GROWTH_BPS", 2500),
    baseQuantityLots: optionalInt("AND_MM_BOT_BASE_QUANTITY_LOTS", 5_000_000),
    quoteIntervalMs: optionalInt("AND_MM_BOT_QUOTE_INTERVAL_MS", 30_000),
    intentTtlMs: optionalInt("AND_MM_BOT_INTENT_TTL_MS", 120_000),
    operatorToken: process.env.AND_MM_BOT_OPERATOR_TOKEN,
    bondMicroUsdc: optionalBigInt("AND_MM_BOT_BOND_MICRO_USDC", 10_000_000_000n),
    enrollOnStart: (process.env.AND_MM_BOT_ENROLL_ON_START ?? "true") !== "false",
  };
}

function nowMs(): number {
  return Date.now();
}

function quotePriceTicks(
  mark: number,
  side: "bid" | "ask",
  spreadBps: number,
  levelStepBps: number,
  level: number
): number {
  const offsetBps = spreadBps + levelStepBps * level;
  const factor =
    side === "bid" ? 10_000 - offsetBps : 10_000 + offsetBps;
  return Math.max(1, Math.floor((mark * factor) / 10_000));
}

function postOnlySafePriceTicks(
  priceTicks: number,
  side: "bid" | "ask",
  bestBid: number | null,
  bestAsk: number | null
): number {
  if (side === "bid" && bestAsk != null) {
    return Math.max(1, Math.min(priceTicks, bestAsk - 1));
  }
  if (side === "ask" && bestBid != null) {
    return Math.max(priceTicks, bestBid + 1);
  }
  return Math.max(1, priceTicks);
}

function quoteQuantityLots(
  base: number,
  growthBps: number,
  level: number
): number {
  const multiplier = 10_000 + growthBps * level;
  return Math.max(1, Math.floor((base * multiplier) / 10_000));
}

function nextClientOrderId(lane: LaneState): number {
  const sideBit = lane.side === "bid" ? 0 : 1;
  // Wide-spaced so concurrent lanes don't collide. Mirrors the Rust bot's
  // pattern (timestamp ms × 1000 + market×100 + side×50 + level).
  return (
    nowMs() * 1000 +
    lane.marketId * 100 +
    sideBit * 50 +
    lane.level
  );
}

async function bootstrapRfc027Enrollment(
  client: AndChainClient,
  config: BotConfig
): Promise<void> {
  for (const marketId of config.marketIds) {
    const existing = await client.getMarketMakerEnrollment(
      config.makerAccountId,
      marketId,
      config.programIdHex
    );
    if (existing && existing.status === "active") {
      console.log(
        `[mm-bot] market=${marketId} already enrolled, status=active, skipping enroll`
      );
      continue;
    }
    const signed = signMarketMakerProgramAction(config.owner, {
      chain_id: config.chainId,
      signer_account_id: config.makerAccountId,
      action: {
        kind: "enroll",
        market_maker_identity: {
          kind: "account",
          account_id: config.makerAccountId,
        },
        market_id: marketId,
        program_id_hex: config.programIdHex,
        bond_micro_usdc: config.bondMicroUsdc,
      },
      timestamp_ms: nowMs(),
      submitter_nonce: nowMs() + marketId,
    });
    try {
      const response = await client.submitSignedMarketMakerProgramAction(
        signed,
        60_000
      );
      console.log(
        `[mm-bot] enrolled market=${marketId} action=${response.action_id_hex} status=${response.status}`
      );
    } catch (err) {
      const message = String(err);
      if (message.includes("enrollment_already_live")) {
        console.log(`[mm-bot] market=${marketId} enrollment already live`);
        continue;
      }
      throw err;
    }
  }
}

async function getNextNonce(
  client: AndChainClient,
  policyId: number
): Promise<number> {
  const policy = await client.getPolicy(policyId);
  return policy.next_intent_nonce;
}

async function submitLaneIntent(
  client: AndChainClient,
  config: BotConfig,
  lane: LaneState,
  nonce: number,
  priceTicks: number,
  quantityLots: number,
  replacementClientOrderId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ts = nowMs();
  const orderKind = { kind: "limit" as const, price_ticks: priceTicks };
  const timeInForce = { kind: "gtc" as const };
  const intent: IntentRequest = {
    chain_id: config.chainId,
    account_id: config.makerAccountId,
    policy_id: config.makerPolicyId,
    nonce,
    expires_at: ts + config.intentTtlMs,
    predicate: null,
    kind: lane.currentClientOrderId
      ? {
          kind: "replace_order",
          market_id: lane.marketId,
          target_client_order_id: lane.currentClientOrderId,
          replacement_client_order_id: replacementClientOrderId,
          side: lane.side,
          quantity_lots: quantityLots,
          order_kind: orderKind,
          time_in_force: timeInForce,
          post_only: true,
        }
      : {
          kind: "place_order",
          market_id: lane.marketId,
          client_order_id: replacementClientOrderId,
          side: lane.side,
          quantity_lots: quantityLots,
          order_kind: orderKind,
          time_in_force: timeInForce,
          post_only: true,
        },
  };
  try {
    await client.submitTypedIntent(config.session, intent, ts);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function buildLanes(config: BotConfig): LaneState[] {
  const lanes: LaneState[] = [];
  for (const marketId of config.marketIds) {
    for (const side of ["bid", "ask"] as const) {
      for (let level = 0; level < config.levels; level++) {
        lanes.push({
          marketId,
          side,
          level,
          currentClientOrderId: null,
        });
      }
    }
  }
  return lanes;
}

interface MarketQuoteInput {
  markPriceTicks: number;
  bestBidTicks: number | null;
  bestAskTicks: number | null;
}

async function readMarketInputs(
  client: AndChainClient,
  marketIds: number[]
): Promise<Map<number, MarketQuoteInput>> {
  const out = new Map<number, MarketQuoteInput>();
  for (const marketId of marketIds) {
    const snapshot = await client.getMarketSnapshot(marketId, { depth: 1 });
    const state = snapshot.state;
    const mark = state.mark_price_ticks ?? state.index_price_ticks;
    if (mark == null) {
      console.warn(`[mm-bot] market=${marketId} has no mark/index, skipping`);
      continue;
    }
    out.set(marketId, {
      markPriceTicks: mark,
      bestBidTicks: snapshot.order_book.bids[0]?.price_ticks ?? null,
      bestAskTicks: snapshot.order_book.asks[0]?.price_ticks ?? null,
    });
  }
  return out;
}

async function quoteCycle(
  client: AndChainClient,
  config: BotConfig,
  lanes: LaneState[],
  nonceRef: { value: number }
): Promise<void> {
  const inputs = await readMarketInputs(client, config.marketIds);
  for (const lane of lanes) {
    const input = inputs.get(lane.marketId);
    if (!input) continue;
    const raw = quotePriceTicks(
      input.markPriceTicks,
      lane.side,
      config.spreadBps,
      config.levelStepBps,
      lane.level
    );
    const priceTicks = postOnlySafePriceTicks(
      raw,
      lane.side,
      input.bestBidTicks,
      input.bestAskTicks
    );
    const quantityLots = quoteQuantityLots(
      config.baseQuantityLots,
      config.levelSizeGrowthBps,
      lane.level
    );
    const replacementClientOrderId = nextClientOrderId(lane);
    const result = await submitLaneIntent(
      client,
      config,
      lane,
      nonceRef.value,
      priceTicks,
      quantityLots,
      replacementClientOrderId
    );
    if (result.ok) {
      lane.currentClientOrderId = replacementClientOrderId;
      nonceRef.value++;
    } else {
      console.error(
        `[mm-bot] quote failed market=${lane.marketId} side=${lane.side} level=${lane.level} nonce=${nonceRef.value} err=${result.error}`
      );
      // Resync nonce from chain — most errors here are nonce drift.
      nonceRef.value = await getNextNonce(client, config.makerPolicyId);
      lane.currentClientOrderId = null;
    }
  }
}

function startEventSubscription(
  client: AndChainClient,
  config: BotConfig,
  shutdown: AbortSignal
): void {
  // Polling fallback because EventSource is browser-only. A native Node
  // SSE consumer would use undici's fetch+stream API. For this example we
  // poll `listEvents` against the bot's account to surface compliance.
  let cursor: number | undefined = undefined;
  void (async () => {
    while (!shutdown.aborted) {
      try {
        const page = await client.listEvents({
          fromSeq: cursor,
          limit: 100,
          filter: { account_id: config.makerAccountId },
        });
        for (const record of page.events) {
          handleEvent(record);
        }
        cursor = page.next_cursor.next_seq;
      } catch (err) {
        console.error(`[mm-bot] event poll error: ${err}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  })();
}

function handleEvent(record: RuntimeEventRecord): void {
  const kind = record.kind as { topic?: string } & Record<string, unknown>;
  switch (kind.topic) {
    case "mm_program_bonus_paid": {
      const ev = kind as unknown as MmProgramBonusPaidEvent;
      console.log(
        `[mm-bot][bonus_paid] market=${ev.market_id} requested=${ev.requested_bonus_micro_usdc} paid=${ev.paid_bonus_micro_usdc}`
      );
      break;
    }
    case "mm_program_bonus_forfeited": {
      const ev = kind as unknown as MmProgramBonusForfeitedEvent;
      console.warn(
        `[mm-bot][bonus_forfeited] market=${ev.market_id} forfeited=${ev.forfeited_bonus_micro_usdc}`
      );
      break;
    }
    case "market_maker_enrollment_grace_entered": {
      const ev = kind as unknown as MarketMakerEnrollmentGraceEnteredEvent;
      console.warn(
        `[mm-bot][grace_entered] market=${ev.market_id} breach=${ev.breach}`
      );
      break;
    }
    case "market_maker_enrollment_non_compliant": {
      const ev = kind as unknown as MarketMakerEnrollmentNonCompliantEvent;
      console.error(
        `[mm-bot][non_compliant] market=${ev.market_id} breach_counter=${ev.breach_counter}`
      );
      break;
    }
    case "market_maker_enrollment_recovered": {
      const ev = kind as unknown as MarketMakerEnrollmentRecoveredEvent;
      console.log(
        `[mm-bot][recovered] market=${ev.market_id} from=${ev.recovered_from}`
      );
      break;
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new AndChainClient(config.rpcUrl);

  const chainInfo = await client.chainInfo();
  console.log(
    `[mm-bot] connected chain=${chainInfo.chain_id} head=${chainInfo.head_height} markets=${config.marketIds.join(",")}`
  );

  if (config.enrollOnStart) {
    await bootstrapRfc027Enrollment(client, config);
  }

  const lanes = buildLanes(config);
  const nonceRef = { value: await getNextNonce(client, config.makerPolicyId) };
  console.log(`[mm-bot] starting policy=${config.makerPolicyId} initial_nonce=${nonceRef.value} lanes=${lanes.length}`);

  const shutdown = new AbortController();
  process.on("SIGINT", () => {
    console.log("[mm-bot] SIGINT received, shutting down");
    shutdown.abort();
  });
  process.on("SIGTERM", () => {
    console.log("[mm-bot] SIGTERM received, shutting down");
    shutdown.abort();
  });

  startEventSubscription(client, config, shutdown.signal);

  while (!shutdown.signal.aborted) {
    const cycleStart = nowMs();
    try {
      await quoteCycle(client, config, lanes, nonceRef);
    } catch (err) {
      console.error(`[mm-bot] cycle error: ${err}`);
      nonceRef.value = await getNextNonce(client, config.makerPolicyId);
    }
    const elapsed = nowMs() - cycleStart;
    const sleep = Math.max(0, config.quoteIntervalMs - elapsed);
    console.log(
      `[mm-bot] cycle complete in ${elapsed}ms, sleeping ${sleep}ms (next_nonce=${nonceRef.value})`
    );
    if (sleep > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleep));
    }
  }

  console.log("[mm-bot] exited");
}

main().catch((err) => {
  console.error(`[mm-bot] fatal: ${err}`);
  process.exit(1);
});
