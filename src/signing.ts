import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";
import { keccak_256 } from "@noble/hashes/sha3";

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex"
);
const ED25519_SPKI_PREFIX_LENGTH = 12;

type BigIntLike = bigint | number | string;

export interface SignedIntentJson {
  intent: {
    chain_id: number;
    account: number;
    policy_id: number;
    nonce: number;
    expires_at: number;
    predicate: Record<string, unknown> | null;
  } & Record<string, unknown>;
  signature_hex: string;
}

export interface SignedOwnerCallJson {
  account_id: number;
  chain_id: number;
  call: {
    signer_hex: string;
    nonce: number;
  } & Record<string, unknown>;
  signature_hex: string;
}

export interface PolicyTermsWire {
  gas_budget_per_day: string;
  gas_refill_per_day: string;
  max_intents_per_second: number;
  max_intents_per_day: number;
  max_volume_per_day: string;
  max_drawdown_pct: number;
}

export class PolicyTermsBuilder {
  private terms: PolicyTermsWire = {
    gas_budget_per_day: "0",
    gas_refill_per_day: "0",
    max_intents_per_second: 0,
    max_intents_per_day: 0,
    max_volume_per_day: "0",
    max_drawdown_pct: 0,
  };

  gasBudgetPerDayMicrousdc(value: BigIntLike) {
    this.terms.gas_budget_per_day = toBigInt(value).toString();
    return this;
  }

  gasRefillPerDayMicrousdc(value: BigIntLike) {
    this.terms.gas_refill_per_day = toBigInt(value).toString();
    return this;
  }

  maxIntentsPerSecond(value: number) {
    this.terms.max_intents_per_second = value;
    return this;
  }

  maxIntentsPerDay(value: number) {
    this.terms.max_intents_per_day = value;
    return this;
  }

  maxVolumePerDayUsdc(value: BigIntLike) {
    this.terms.max_volume_per_day = (toBigInt(value) * 1_000_000n).toString();
    return this;
  }

  maxVolumePerDayMicrousdc(value: BigIntLike) {
    this.terms.max_volume_per_day = toBigInt(value).toString();
    return this;
  }

  maxDrawdownPct(value: number) {
    this.terms.max_drawdown_pct = value;
    return this;
  }

  build(): PolicyTermsWire {
    return { ...this.terms };
  }
}

export type PredicateInput =
  | { kind: "time_after"; not_before_ms: number }
  | { kind: "time_before"; not_after_ms: number };

export type OrderKindInput =
  | { kind: "limit"; price_ticks: number }
  | { kind: "market" };

export type TimeInForceInput =
  | { kind: "gtc" }
  | { kind: "ioc" }
  | { kind: "fok" }
  | { kind: "gtt"; expires_at_ms: number };

export type IntentKindInput =
  | { kind: "transfer"; to: number; token: number; amount: number }
  | { kind: "cancel"; order_id: number }
  | {
      kind: "place_order";
      market_id: number;
      client_order_id: number;
      side: "bid" | "ask";
      quantity_lots: number;
      order_kind: OrderKindInput;
      time_in_force: TimeInForceInput;
      post_only: boolean;
    }
  | {
      kind: "cancel_order";
      market_id: number;
      client_order_id: number;
    }
  | {
      kind: "replace_order";
      market_id: number;
      target_client_order_id: number;
      replacement_client_order_id: number;
      side: "bid" | "ask";
      quantity_lots: number;
      order_kind: OrderKindInput;
      time_in_force: TimeInForceInput;
      post_only: boolean;
    }
  | {
      kind: "create_sub_policy";
      child_policy_id: number;
      child_grantee_hex: string;
      child_expires_at: number;
      child_terms: PolicyTermsWire;
    }
  | { kind: "revoke_policy"; target_policy_id: number }
  | { kind: "deposit_collateral"; market_id: number; amount_usdc: number }
  | { kind: "withdraw_collateral"; market_id: number; amount_usdc: number };

export interface IntentRequest {
  chain_id: number;
  account_id: number;
  policy_id: number;
  nonce: number;
  expires_at: number;
  predicate?: PredicateInput | null;
  kind: IntentKindInput;
}

export type OwnerActionInput =
  | { kind: "propose_owner"; new_owner_hex: string }
  | { kind: "accept_owner" }
  | { kind: "pause" }
  | { kind: "unpause" }
  | {
      kind: "create_policy";
      policy_id: number;
      grantee_hex: string;
      expires_at: number;
      terms: PolicyTermsWire;
    }
  | { kind: "add_policy"; policy_id: number }
  | { kind: "remove_policy"; policy_id: number }
  | { kind: "revoke_policy"; policy_id: number }
  | { kind: "upgrade"; code_hash_hex: string };

export interface OwnerCallRequest {
  account_id: number;
  chain_id: number;
  nonce: number;
  action: OwnerActionInput;
}

export class Keypair {
  private readonly seed: Uint8Array;
  private readonly privateKey: KeyObject;
  private readonly publicKeyBytesValue: Uint8Array;

  constructor(secretBytes: Uint8Array) {
    if (secretBytes.length !== 32) {
      throw new Error("secret bytes must be 32 bytes");
    }
    this.seed = new Uint8Array(secretBytes);
    this.privateKey = createPrivateKey({
      key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(this.seed)]),
      format: "der",
      type: "pkcs8",
    });
    const spki = createPublicKey(this.privateKey).export({
      format: "der",
      type: "spki",
    }) as Buffer;
    this.publicKeyBytesValue = new Uint8Array(
      spki.subarray(ED25519_SPKI_PREFIX_LENGTH)
    );
  }

  static fromSecretBytes(secretBytes: Uint8Array) {
    return new Keypair(secretBytes);
  }

  static fromSecretHex(secretHex: string) {
    return new Keypair(decodeHexFixed(secretHex, 32));
  }

  publicBytes() {
    return new Uint8Array(this.publicKeyBytesValue);
  }

  publicHex() {
    return encodeHex(this.publicKeyBytesValue);
  }

  secretBytes() {
    return new Uint8Array(this.seed);
  }

  secretHex() {
    return encodeHex(this.seed);
  }

  signBytes(message: Uint8Array) {
    return new Uint8Array(cryptoSign(null, Buffer.from(message), this.privateKey));
  }
}

export function encodeHex(bytes: Uint8Array) {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function decodeHexFixed(input: string, size: number) {
  const normalized = input.startsWith("0x") ? input.slice(2) : input;
  const bytes = Buffer.from(normalized, "hex");
  if (bytes.length !== size) {
    throw new Error(`hex input must decode to ${size} bytes`);
  }
  return new Uint8Array(bytes);
}

export function signIntent(
  signer: Keypair,
  request: IntentRequest
): SignedIntentJson {
  const intentBytes = serializeIntent(request);
  const intentHash = new Uint8Array(createHash("sha256").update(intentBytes).digest());
  const payloadBytes = concatBytes(
    intentHash,
    serializeU64(request.policy_id),
    serializeU64(request.chain_id)
  );
  const signature = signer.signBytes(payloadBytes);

  return {
    intent: intentToJson(request),
    signature_hex: encodeHex(signature),
  };
}

export function signOwnerCall(
  signer: Keypair,
  request: OwnerCallRequest
): SignedOwnerCallJson {
  const signerBytes = signer.publicBytes();
  const callBytes = concatBytes(
    signerBytes,
    serializeU64(request.nonce),
    serializeOwnerAction(request.action)
  );
  const signingBytes = concatBytes(
    serializeU64(request.account_id),
    serializeU64(request.chain_id),
    callBytes
  );
  const signature = signer.signBytes(signingBytes);

  return {
    account_id: request.account_id,
    chain_id: request.chain_id,
    call: {
      signer_hex: encodeHex(signerBytes),
      nonce: request.nonce,
      ...ownerActionToJson(request.action),
    },
    signature_hex: encodeHex(signature),
  };
}

function intentToJson(request: IntentRequest): SignedIntentJson["intent"] {
  return {
    chain_id: request.chain_id,
    account: request.account_id,
    policy_id: request.policy_id,
    nonce: request.nonce,
    expires_at: request.expires_at,
    predicate: predicateToJson(request.predicate ?? null),
    ...intentKindToJson(request.kind),
  };
}

function predicateToJson(predicate: PredicateInput | null) {
  if (!predicate) {
    return null;
  }
  if (predicate.kind === "time_after") {
    return {
      predicate_kind: "time_after",
      not_before_ms: predicate.not_before_ms,
    };
  }
  return {
    predicate_kind: "time_before",
    not_after_ms: predicate.not_after_ms,
  };
}

function intentKindToJson(kind: IntentKindInput): Record<string, unknown> {
  switch (kind.kind) {
    case "transfer":
      return kind;
    case "cancel":
      return kind;
    case "place_order":
      return {
        kind: "place_order",
        market_id: kind.market_id,
        client_order_id: kind.client_order_id,
        side: kind.side,
        quantity_lots: kind.quantity_lots,
        ...orderKindToJson(kind.order_kind),
        time_in_force: timeInForceToJson(kind.time_in_force),
        post_only: kind.post_only,
      };
    case "cancel_order":
      return kind;
    case "replace_order":
      return {
        kind: "replace_order",
        market_id: kind.market_id,
        target_client_order_id: kind.target_client_order_id,
        replacement_client_order_id: kind.replacement_client_order_id,
        side: kind.side,
        quantity_lots: kind.quantity_lots,
        ...orderKindToJson(kind.order_kind),
        time_in_force: timeInForceToJson(kind.time_in_force),
        post_only: kind.post_only,
      };
    case "create_sub_policy":
      return {
        kind: "create_sub_policy",
        child_policy_id: kind.child_policy_id,
        child_grantee_hex: kind.child_grantee_hex,
        child_expires_at: kind.child_expires_at,
        child_terms: kind.child_terms,
      };
    case "revoke_policy":
      return kind;
    case "deposit_collateral":
      return kind;
    case "withdraw_collateral":
      return kind;
  }
}

function orderKindToJson(kind: OrderKindInput): Record<string, unknown> {
  if (kind.kind === "limit") {
    return { order_kind: "limit", price_ticks: kind.price_ticks };
  }
  return { order_kind: "market" };
}

function timeInForceToJson(tif: TimeInForceInput): Record<string, unknown> {
  switch (tif.kind) {
    case "gtc":
      return { tif: "gtc" };
    case "ioc":
      return { tif: "ioc" };
    case "fok":
      return { tif: "fok" };
    case "gtt":
      return { tif: "gtt", expires_at_ms: tif.expires_at_ms };
  }
}

function ownerActionToJson(action: OwnerActionInput): Record<string, unknown> {
  switch (action.kind) {
    case "propose_owner":
      return action;
    case "accept_owner":
      return { kind: "accept_owner" };
    case "pause":
      return { kind: "pause" };
    case "unpause":
      return { kind: "unpause" };
    case "create_policy":
      return action;
    case "add_policy":
      return action;
    case "remove_policy":
      return action;
    case "revoke_policy":
      return action;
    case "upgrade":
      return action;
  }
}

function serializeIntent(request: IntentRequest) {
  return concatBytes(
    serializeU64(request.chain_id),
    serializeU64(request.account_id),
    serializeU64(request.policy_id),
    serializeU64(request.nonce),
    serializeU64(request.expires_at),
    serializeOptional(request.predicate ?? null, serializePredicate),
    serializeIntentKind(request.kind)
  );
}

function serializePredicate(predicate: PredicateInput) {
  switch (predicate.kind) {
    case "time_after":
      return concatBytes([0], serializeU64(predicate.not_before_ms));
    case "time_before":
      return concatBytes([1], serializeU64(predicate.not_after_ms));
  }
}

function serializeIntentKind(kind: IntentKindInput) {
  switch (kind.kind) {
    case "transfer":
      return concatBytes(
        [0],
        serializeU64(kind.to),
        serializeU32(kind.token),
        serializeU64(kind.amount)
      );
    case "cancel":
      return concatBytes([1], serializeU64(kind.order_id));
    case "place_order":
      return concatBytes(
        [2],
        serializeU64(kind.market_id),
        serializeU64(kind.client_order_id),
        serializeOrderSide(kind.side),
        serializeU64(kind.quantity_lots),
        serializeOrderKind(kind.order_kind),
        serializeTimeInForce(kind.time_in_force),
        serializeBool(kind.post_only)
      );
    case "cancel_order":
      return concatBytes(
        [3],
        serializeU64(kind.market_id),
        serializeU64(kind.client_order_id)
      );
    case "replace_order":
      return concatBytes(
        [4],
        serializeU64(kind.market_id),
        serializeU64(kind.target_client_order_id),
        serializeU64(kind.replacement_client_order_id),
        serializeOrderSide(kind.side),
        serializeU64(kind.quantity_lots),
        serializeOrderKind(kind.order_kind),
        serializeTimeInForce(kind.time_in_force),
        serializeBool(kind.post_only)
      );
    case "create_sub_policy":
      return concatBytes(
        [5],
        serializeU64(kind.child_policy_id),
        decodeHexFixed(kind.child_grantee_hex, 32),
        serializeU64(kind.child_expires_at),
        serializePolicyTerms(kind.child_terms)
      );
    case "revoke_policy":
      return concatBytes([6], serializeU64(kind.target_policy_id));
    case "deposit_collateral":
      return concatBytes(
        [7],
        serializeU64(kind.market_id),
        serializeU64(kind.amount_usdc)
      );
    case "withdraw_collateral":
      return concatBytes(
        [8],
        serializeU64(kind.market_id),
        serializeU64(kind.amount_usdc)
      );
  }
}

function serializeOwnerAction(action: OwnerActionInput) {
  switch (action.kind) {
    case "propose_owner":
      return concatBytes([0], decodeHexFixed(action.new_owner_hex, 32));
    case "accept_owner":
      return Uint8Array.from([1]);
    case "pause":
      return Uint8Array.from([2]);
    case "unpause":
      return Uint8Array.from([3]);
    case "create_policy":
      return concatBytes(
        [4],
        serializeU64(action.policy_id),
        decodeHexFixed(action.grantee_hex, 32),
        serializeU64(action.expires_at),
        serializePolicyTerms(action.terms)
      );
    case "add_policy":
      return concatBytes([5], serializeU64(action.policy_id));
    case "remove_policy":
      return concatBytes([6], serializeU64(action.policy_id));
    case "revoke_policy":
      return concatBytes([7], serializeU64(action.policy_id));
    case "upgrade":
      return concatBytes([8], decodeHexFixed(action.code_hash_hex, 32));
  }
}

function serializePolicyTerms(terms: PolicyTermsWire) {
  return concatBytes(
    serializeU128(terms.gas_budget_per_day),
    serializeU128(terms.gas_refill_per_day),
    serializeU32(terms.max_intents_per_second),
    serializeU32(terms.max_intents_per_day),
    serializeU128(terms.max_volume_per_day),
    serializeU16(terms.max_drawdown_pct)
  );
}

function serializeOrderSide(side: "bid" | "ask") {
  return Uint8Array.from([side === "bid" ? 0 : 1]);
}

function serializeOrderKind(kind: OrderKindInput) {
  if (kind.kind === "limit") {
    return concatBytes([0], serializeU64(kind.price_ticks));
  }
  return Uint8Array.from([1]);
}

function serializeTimeInForce(tif: TimeInForceInput) {
  switch (tif.kind) {
    case "gtc":
      return Uint8Array.from([0]);
    case "ioc":
      return Uint8Array.from([1]);
    case "fok":
      return Uint8Array.from([2]);
    case "gtt":
      return concatBytes([3], serializeU64(tif.expires_at_ms));
  }
}

function serializeOptional<T>(
  value: T | null,
  serializer: (value: T) => Uint8Array
) {
  return value == null ? Uint8Array.from([0]) : concatBytes([1], serializer(value));
}

function serializeBool(value: boolean) {
  return Uint8Array.from([value ? 1 : 0]);
}

function serializeU16(value: number) {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value, 0);
  return new Uint8Array(out);
}

function serializeU32(value: number) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value, 0);
  return new Uint8Array(out);
}

function serializeU64(value: BigIntLike) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(toBigInt(value), 0);
  return new Uint8Array(out);
}

function serializeU128(value: BigIntLike) {
  const bigint = toBigInt(value);
  const out = Buffer.alloc(16);
  out.writeBigUInt64LE(bigint & 0xffff_ffff_ffff_ffffn, 0);
  out.writeBigUInt64LE(bigint >> 64n, 8);
  return new Uint8Array(out);
}

function concatBytes(...parts: (Uint8Array | number[])[]) {
  const buffers = parts.map((part) =>
    Buffer.from(Array.isArray(part) ? Uint8Array.from(part) : part)
  );
  return new Uint8Array(Buffer.concat(buffers));
}

function toBigInt(value: BigIntLike) {
  return typeof value === "bigint" ? value : BigInt(value);
}

// --- RFC 027 market-maker program action signing ---------------------------

export const MARKET_MAKER_PROGRAM_ACTION_KIND_DEFINE = "define";
export const MARKET_MAKER_PROGRAM_ACTION_KIND_RETIRE = "retire";
export const MARKET_MAKER_PROGRAM_ACTION_KIND_ENROLL = "enroll";
export const MARKET_MAKER_PROGRAM_ACTION_KIND_EXIT = "exit";

export type MarketMakerIdentityInput =
  | { kind: "account"; account_id: BigIntLike }
  | {
      kind: "delegation";
      delegation_id_hex: string;
      serving_agent: BigIntLike;
    };

export type MarketMakerProgramActionInput =
  | {
      kind: "define";
      name: string;
      markets: BigIntLike[];
      min_uptime_bps: number;
      max_spread_bps: number;
      min_quote_size_micro_usdc: BigIntLike;
      min_two_sided_windows_per_hour: number;
      rebate_multiplier_units: number;
      enrollment_bond_micro_usdc: BigIntLike;
      compliance_window_ms: BigIntLike;
      observation_cadence_ms: BigIntLike;
    }
  | { kind: "retire"; program_id_hex: string }
  | {
      kind: "enroll";
      market_maker_identity: MarketMakerIdentityInput;
      market_id: BigIntLike;
      program_id_hex: string;
      bond_micro_usdc: BigIntLike;
    }
  | {
      kind: "exit";
      market_maker_identity: MarketMakerIdentityInput;
      market_id: BigIntLike;
      program_id_hex: string;
    };

export interface MarketMakerProgramActionRequest {
  chain_id: BigIntLike;
  signer_account_id: BigIntLike;
  action: MarketMakerProgramActionInput;
  timestamp_ms: BigIntLike;
  submitter_nonce?: BigIntLike | null;
}

export interface SignedMarketMakerProgramActionJson {
  chain_id: number;
  signer_account_id: number;
  action_id_hex: string;
  action_hex: string;
  timestamp_ms: number;
  submitter_nonce: number | null;
  signature_hex: string;
}

export function marketMakerProgramActionKind(
  action: MarketMakerProgramActionInput
): typeof MARKET_MAKER_PROGRAM_ACTION_KIND_DEFINE
  | typeof MARKET_MAKER_PROGRAM_ACTION_KIND_RETIRE
  | typeof MARKET_MAKER_PROGRAM_ACTION_KIND_ENROLL
  | typeof MARKET_MAKER_PROGRAM_ACTION_KIND_EXIT {
  switch (action.kind) {
    case "define":
      return MARKET_MAKER_PROGRAM_ACTION_KIND_DEFINE;
    case "retire":
      return MARKET_MAKER_PROGRAM_ACTION_KIND_RETIRE;
    case "enroll":
      return MARKET_MAKER_PROGRAM_ACTION_KIND_ENROLL;
    case "exit":
      return MARKET_MAKER_PROGRAM_ACTION_KIND_EXIT;
  }
}

export function marketMakerProgramActionHex(
  action: MarketMakerProgramActionInput
): string {
  return encodeHex(serializeMarketMakerProgramAction(action));
}

export function deriveMarketMakerProgramId(
  action: MarketMakerProgramActionInput
): Uint8Array {
  if (action.kind !== "define") {
    return marketMakerProgramActionScopeProgramId(action);
  }
  const material = concatBytes(
    serializeString(action.name),
    serializeSortedU64Set(action.markets),
    serializeU16(action.min_uptime_bps),
    serializeU16(action.max_spread_bps),
    serializeU256BigEndian(action.min_quote_size_micro_usdc),
    serializeU16(action.min_two_sided_windows_per_hour),
    serializeU16(action.rebate_multiplier_units),
    serializeU256BigEndian(action.enrollment_bond_micro_usdc),
    serializeU64(action.compliance_window_ms),
    serializeU64(action.observation_cadence_ms)
  );
  return keccak_256(concatBytes(textBytes("mm-program"), material));
}

export function marketMakerProgramActionFingerprint(
  action: MarketMakerProgramActionInput
): Uint8Array {
  return keccak_256(
    concatBytes(
      textBytes("mm-program-action-fingerprint"),
      serializeMarketMakerProgramAction(action)
    )
  );
}

export function deriveMarketMakerProgramActionIdFromNonce(
  actionKind: string,
  scope: Uint8Array,
  nonce: BigIntLike
): Uint8Array {
  return keccak_256(
    concatBytes(
      textBytes("mm-program-action-id-v1"),
      textBytes(actionKind),
      scope,
      serializeU64BigEndian(nonce)
    )
  );
}

export function deriveLegacyMarketMakerProgramActionId(
  action: MarketMakerProgramActionInput,
  timestampMs: BigIntLike
): Uint8Array {
  return keccak_256(
    concatBytes(
      textBytes("legacy-mm-program-action-id"),
      serializeU64BigEndian(timestampMs),
      serializeMarketMakerProgramAction(action)
    )
  );
}

export function marketMakerProgramActionIdForSubmission(
  action: MarketMakerProgramActionInput,
  timestampMs: BigIntLike,
  submitterNonce: BigIntLike | null | undefined
): Uint8Array {
  if (submitterNonce != null) {
    return deriveMarketMakerProgramActionIdFromNonce(
      marketMakerProgramActionKind(action),
      marketMakerProgramActionScope(action),
      submitterNonce
    );
  }
  return deriveLegacyMarketMakerProgramActionId(action, timestampMs);
}

export function marketMakerProgramActionSigningBytes(
  request: MarketMakerProgramActionRequest
): Uint8Array {
  const actionId = marketMakerProgramActionIdForSubmission(
    request.action,
    request.timestamp_ms,
    request.submitter_nonce ?? null
  );
  const bodyHash = marketMakerProgramActionFingerprint(request.action);
  return concatBytes(
    serializeString("0x26:market-maker-program-action:v1"),
    serializeU64(request.chain_id),
    serializeU64(request.signer_account_id),
    actionId,
    serializeString(marketMakerProgramActionKind(request.action)),
    serializeVecBytes(marketMakerProgramActionScope(request.action)),
    serializeU64(request.timestamp_ms),
    serializeOptional(
      request.submitter_nonce ?? null,
      (nonce) => serializeU64(nonce)
    ),
    bodyHash
  );
}

export function signMarketMakerProgramAction(
  signer: Keypair,
  request: MarketMakerProgramActionRequest
): SignedMarketMakerProgramActionJson {
  const actionId = marketMakerProgramActionIdForSubmission(
    request.action,
    request.timestamp_ms,
    request.submitter_nonce ?? null
  );
  const actionHex = marketMakerProgramActionHex(request.action);
  const signingBytes = marketMakerProgramActionSigningBytes(request);
  const signature = signer.signBytes(signingBytes);

  return {
    chain_id: Number(toBigInt(request.chain_id)),
    signer_account_id: Number(toBigInt(request.signer_account_id)),
    action_id_hex: encodeHex(actionId),
    action_hex: actionHex,
    timestamp_ms: Number(toBigInt(request.timestamp_ms)),
    submitter_nonce:
      request.submitter_nonce == null
        ? null
        : Number(toBigInt(request.submitter_nonce)),
    signature_hex: encodeHex(signature),
  };
}

function marketMakerProgramActionScope(
  action: MarketMakerProgramActionInput
): Uint8Array {
  switch (action.kind) {
    case "define":
      return deriveMarketMakerProgramId(action);
    case "retire":
      return decodeHexFixed(action.program_id_hex, 32);
    case "enroll":
    case "exit":
      return concatBytes(
        marketMakerIdentityScopeBytes(action.market_maker_identity),
        serializeU64BigEndian(action.market_id),
        decodeHexFixed(action.program_id_hex, 32)
      );
  }
}

function marketMakerProgramActionScopeProgramId(
  action: MarketMakerProgramActionInput
): Uint8Array {
  switch (action.kind) {
    case "define":
      return deriveMarketMakerProgramId(action);
    case "retire":
    case "enroll":
    case "exit":
      return decodeHexFixed(action.program_id_hex, 32);
  }
}

function marketMakerIdentityScopeBytes(
  identity: MarketMakerIdentityInput
): Uint8Array {
  if (identity.kind === "account") {
    return serializeU64BigEndian(identity.account_id);
  }
  return concatBytes(
    Uint8Array.from([1]),
    decodeHexFixed(identity.delegation_id_hex, 32),
    serializeU64BigEndian(identity.serving_agent)
  );
}

function serializeMarketMakerProgramAction(
  action: MarketMakerProgramActionInput
): Uint8Array {
  switch (action.kind) {
    case "define":
      return concatBytes(
        [0],
        serializeString(action.name),
        serializeSortedU64Set(action.markets),
        serializeU16(action.min_uptime_bps),
        serializeU16(action.max_spread_bps),
        serializeU256BigEndian(action.min_quote_size_micro_usdc),
        serializeU16(action.min_two_sided_windows_per_hour),
        serializeU16(action.rebate_multiplier_units),
        serializeU256BigEndian(action.enrollment_bond_micro_usdc),
        serializeU64(action.compliance_window_ms),
        serializeU64(action.observation_cadence_ms)
      );
    case "retire":
      return concatBytes([1], decodeHexFixed(action.program_id_hex, 32));
    case "enroll":
      return concatBytes(
        [2],
        serializeMarketMakerIdentity(action.market_maker_identity),
        serializeU64(action.market_id),
        decodeHexFixed(action.program_id_hex, 32),
        serializeU256BigEndian(action.bond_micro_usdc)
      );
    case "exit":
      return concatBytes(
        [3],
        serializeMarketMakerIdentity(action.market_maker_identity),
        serializeU64(action.market_id),
        decodeHexFixed(action.program_id_hex, 32)
      );
  }
}

function serializeMarketMakerIdentity(identity: MarketMakerIdentityInput) {
  if (identity.kind === "account") {
    return concatBytes([0], serializeU64(identity.account_id));
  }
  return concatBytes(
    [1],
    decodeHexFixed(identity.delegation_id_hex, 32),
    serializeU64(identity.serving_agent)
  );
}

function serializeString(value: string): Uint8Array {
  const utf8 = textBytes(value);
  return concatBytes(serializeU32(utf8.length), utf8);
}

function serializeVecBytes(value: Uint8Array): Uint8Array {
  return concatBytes(serializeU32(value.length), value);
}

function serializeSortedU64Set(values: BigIntLike[]): Uint8Array {
  // Borsh BTreeSet<u64> is a length-prefixed list of u64 LE values in
  // ascending order. Sorting client-side keeps the wire stable regardless
  // of the caller-provided argument order.
  const sorted = values
    .map((v) => toBigInt(v))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const parts: Uint8Array[] = [serializeU32(sorted.length)];
  for (const v of sorted) {
    parts.push(serializeU64(v));
  }
  return concatBytes(...parts);
}

function serializeU64BigEndian(value: BigIntLike): Uint8Array {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(toBigInt(value), 0);
  return new Uint8Array(out);
}

function serializeU256BigEndian(value: BigIntLike): Uint8Array {
  // Mirrors `market_maker_u256_from_u128` in the Rust SDK: a 32-byte
  // big-endian representation where the value is right-aligned in the
  // low 16 bytes. Values that exceed u128 overflow into the upper bytes
  // following the same big-endian layout.
  const bigint = toBigInt(value);
  if (bigint < 0n) {
    throw new Error("u256 value must be non-negative");
  }
  const out = new Uint8Array(32);
  let remaining = bigint;
  for (let i = 31; i >= 0 && remaining > 0n; i--) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  if (remaining > 0n) {
    throw new Error("u256 value exceeds 32 bytes");
  }
  return out;
}

function textBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "utf8"));
}
