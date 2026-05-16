import { keccak_256 } from "@noble/hashes/sha3";

export const EVM_OWNER_PRINCIPAL_PREFIX = "0x26:evm:v1!";
export const EVM_ACTION_DEFAULT_VALID_FOR_MS = 5 * 60_000;
export const EVM_ACTION_MAX_VALID_FOR_MS = 15 * 60_000;

export type BigIntLike = bigint | number | string;

export type EvmDelegationActionInput =
  | {
      kind: "deposit";
      principal: number;
      delegation_id_hex: string;
      amount: BigIntLike;
    }
  | {
      kind: "request_redemption";
      principal: number;
      delegation_id_hex: string;
      shares: BigIntLike;
    }
  | {
      kind: "cancel_redemption";
      principal: number;
      request_id_hex: string;
    };

export type EvmMandateConstraintInput =
  | { kind: "max_notional_per_market"; market: number; limit_usdc: BigIntLike }
  | { kind: "max_notional_total"; limit_usdc: BigIntLike }
  | {
      kind: "max_concentration_in_market_pct";
      market: number;
      pct_bps: number;
    }
  | { kind: "allowed_markets"; set: number[] }
  | { kind: "max_leverage"; mult: number }
  | {
      kind: "max_drawdown_pct_from_peak";
      pct_bps: number;
      window_ms: BigIntLike;
    }
  | { kind: "max_daily_loss_usdc"; limit_usdc: BigIntLike }
  | { kind: "no_position_held_longer_than"; duration_ms: BigIntLike }
  | { kind: "max_trade_size_usdc"; limit_usdc: BigIntLike }
  | { kind: "max_trade_rate_per_minute"; count: number }
  | { kind: "no_same_operator_counterparty" }
  | { kind: "allowed_counterparties"; accounts: number[] };

export type EvmMandateObjectiveInput =
  | { kind: "target_sharpe"; min: BigIntLike; over_ms: BigIntLike }
  | { kind: "target_return_pct"; min_bps: number; over_ms: BigIntLike }
  | { kind: "max_drawdown_pct"; max_bps: number; over_ms: BigIntLike }
  | { kind: "min_trade_count"; count: number; over_ms: BigIntLike }
  | { kind: "max_trade_count"; count: number; over_ms: BigIntLike }
  | { kind: "max_slippage_bps"; limit: number }
  | {
      kind: "max_funding_paid_pct_of_equity";
      pct_bps: number;
      over_ms: BigIntLike;
    };

export type EvmMandateActionInput =
  | {
      kind: "create_mandate";
      agent: number;
      version: number;
      constraints: EvmMandateConstraintInput[];
      objectives?: EvmMandateObjectiveInput[];
      objective_weights?: number[];
      conformance_window_ms: BigIntLike;
      session_keys_hex?: string[];
      expires_at: BigIntLike;
      description_uri?: string | null;
      description_hash_hex?: string | null;
    }
  | { kind: "suspend_mandate"; mandate_id_hex: string }
  | { kind: "resume_mandate"; mandate_id_hex: string }
  | { kind: "revoke_mandate"; mandate_id_hex: string; reason?: string };

export interface SignedEvmDelegationActionJson {
  chain_id: number;
  signer_account_id: number;
  action_id_hex: string;
  action_hex: string;
  timestamp_ms: number;
  submitter_nonce: number;
  valid_until_ms: number;
  signature_hex: string;
}

export interface SignedEvmMandateActionJson {
  chain_id: number;
  owner_hex: string;
  nonce: number;
  valid_until_ms: number;
  action: Record<string, unknown>;
  signature_hex: string;
}

export interface Eip1193Wallet {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface EvmDelegationActionSigningRequest {
  chainId: number;
  action: EvmDelegationActionInput;
  timestampMs: number;
  submitterNonce: number;
  signerAccountId?: number;
  validUntilMs?: number;
  validForMs?: number;
  nowMs?: number;
}

export interface EvmMandateActionSigningRequest {
  chainId: number;
  ownerAddressHex: string;
  nonce: number;
  action: EvmMandateActionInput;
  validUntilMs?: number;
  validForMs?: number;
  nowMs?: number;
}

export interface PreparedEvmDelegationAction {
  signedDelegationAction: Omit<SignedEvmDelegationActionJson, "signature_hex">;
  typedData: Eip712TypedData<"EvmDelegationAction">;
}

export interface PreparedEvmMandateAction {
  signedMandateAction: Omit<SignedEvmMandateActionJson, "signature_hex">;
  typedData: Eip712TypedData<"EvmMandateAction">;
}

export interface Eip712TypedData<TPrimaryType extends string> {
  domain: {
    name: "0x26";
    version: "1";
    chainId: number;
  };
  primaryType: TPrimaryType;
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, string | number>;
}

export function evmOwnerPrincipal(addressHex: string) {
  const address = decodeHexFixed(addressHex, 20);
  return encodeHex(concatBytes(asciiBytes(EVM_OWNER_PRINCIPAL_PREFIX), address));
}

export function walletOwnsPrincipal(addressHex: string, principalHex: string) {
  return evmOwnerPrincipal(addressHex).toLowerCase() === normalizeHex(principalHex);
}

export function delegationActionSignerAccount(action: EvmDelegationActionInput) {
  return action.principal;
}

export function defaultEvmActionValidUntilMs(nowMs = Date.now()) {
  return nowMs + EVM_ACTION_DEFAULT_VALID_FOR_MS;
}

export function resolveEvmActionValidUntilMs(params: {
  nowMs?: number;
  validUntilMs?: number;
  validForMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const validUntilMs =
    params.validUntilMs ??
    nowMs + (params.validForMs ?? EVM_ACTION_DEFAULT_VALID_FOR_MS);
  if (validUntilMs > nowMs + EVM_ACTION_MAX_VALID_FOR_MS) {
    throw new Error("validUntilMs exceeds the 15 minute client-side ceiling");
  }
  return validUntilMs;
}

export function encodeDelegationAction(action: EvmDelegationActionInput) {
  return encodeHex(serializeDelegationAction(action));
}

export function deriveDelegationActionIdFromNonce(
  actionKind: string,
  rawScope: Uint8Array,
  submitterNonce: number
) {
  return encodeHex(
    keccak256Bytes(
      concatBytes(
        asciiBytes("delegation-action-id"),
        asciiBytes(actionKind),
        rawScope,
        serializeU64Be(submitterNonce)
      )
    )
  );
}

export function prepareEvmDelegationAction(
  request: EvmDelegationActionSigningRequest
): PreparedEvmDelegationAction {
  const actionKind = delegationActionKind(request.action);
  const actionBytes = serializeDelegationAction(request.action);
  const actionScope = delegationActionScope(request.action);
  const actionScopeHash = encodeHex(keccak256Bytes(actionScope));
  const actionIdHex = deriveDelegationActionIdFromNonce(
    actionKind,
    actionScope,
    request.submitterNonce
  );
  const signerAccountId =
    request.signerAccountId ?? delegationActionSignerAccount(request.action);
  const validUntilMs = resolveEvmActionValidUntilMs(request);
  const bodyHash = encodeHex(keccak256Bytes(actionBytes));
  const signedDelegationAction = {
    chain_id: request.chainId,
    signer_account_id: signerAccountId,
    action_id_hex: actionIdHex,
    action_hex: encodeHex(actionBytes),
    timestamp_ms: request.timestampMs,
    submitter_nonce: request.submitterNonce,
    valid_until_ms: validUntilMs,
  };
  return {
    signedDelegationAction,
    typedData: {
      domain: eip712Domain(request.chainId),
      primaryType: "EvmDelegationAction",
      types: {
        EIP712Domain: EIP712_DOMAIN_TYPES,
        EvmDelegationAction: [
          { name: "chainId", type: "uint256" },
          { name: "signerAccountId", type: "uint256" },
          { name: "actionId", type: "bytes32" },
          { name: "actionKind", type: "string" },
          { name: "actionScope", type: "bytes32" },
          { name: "timestampMs", type: "uint256" },
          { name: "submitterNonce", type: "uint256" },
          { name: "validUntilMs", type: "uint256" },
          { name: "bodyHash", type: "bytes32" },
        ],
      },
      message: {
        chainId: request.chainId,
        signerAccountId,
        actionId: actionIdHex,
        actionKind,
        actionScope: actionScopeHash,
        timestampMs: request.timestampMs,
        submitterNonce: request.submitterNonce,
        validUntilMs,
        bodyHash,
      },
    },
  };
}

export async function signEvmDelegationAction(
  wallet: Eip1193Wallet,
  signerAddressHex: string,
  request: EvmDelegationActionSigningRequest
): Promise<SignedEvmDelegationActionJson> {
  const prepared = prepareEvmDelegationAction(request);
  const signature = await signTypedData(wallet, signerAddressHex, prepared.typedData);
  return {
    ...prepared.signedDelegationAction,
    signature_hex: signature,
  };
}

export function prepareEvmMandateAction(
  request: EvmMandateActionSigningRequest
): PreparedEvmMandateAction {
  const action = mandateActionToJson(request.action);
  const ownerHex = evmOwnerPrincipal(request.ownerAddressHex);
  const validUntilMs = resolveEvmActionValidUntilMs(request);
  const actionKind = request.action.kind;
  const actionHash = encodeHex(
    keccak256Bytes(serializeMandateAction(request.action, ownerHex))
  );
  const signedMandateAction = {
    chain_id: request.chainId,
    owner_hex: ownerHex,
    nonce: request.nonce,
    valid_until_ms: validUntilMs,
    action,
  };
  return {
    signedMandateAction,
    typedData: {
      domain: eip712Domain(request.chainId),
      primaryType: "EvmMandateAction",
      types: {
        EIP712Domain: EIP712_DOMAIN_TYPES,
        EvmMandateAction: [
          { name: "owner", type: "bytes32" },
          { name: "chainId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "validUntilMs", type: "uint256" },
          { name: "actionKind", type: "string" },
          { name: "actionHash", type: "bytes32" },
        ],
      },
      message: {
        owner: ownerHex,
        chainId: request.chainId,
        nonce: request.nonce,
        validUntilMs,
        actionKind,
        actionHash,
      },
    },
  };
}

export async function signEvmMandateAction(
  wallet: Eip1193Wallet,
  signerAddressHex: string,
  request: EvmMandateActionSigningRequest
): Promise<SignedEvmMandateActionJson> {
  const prepared = prepareEvmMandateAction(request);
  const signature = await signTypedData(wallet, signerAddressHex, prepared.typedData);
  return {
    ...prepared.signedMandateAction,
    signature_hex: signature,
  };
}

function delegationActionKind(action: EvmDelegationActionInput) {
  return action.kind;
}

function delegationActionScope(action: EvmDelegationActionInput) {
  if (action.kind === "cancel_redemption") {
    return decodeHexFixed(action.request_id_hex, 32);
  }
  return serializeU64Be(action.principal);
}

function serializeDelegationAction(action: EvmDelegationActionInput) {
  switch (action.kind) {
    case "deposit":
      return concatBytes(
        [1],
        serializeU64Le(action.principal),
        decodeHexFixed(action.delegation_id_hex, 32),
        serializeU128Le(action.amount)
      );
    case "request_redemption":
      return concatBytes(
        [2],
        serializeU64Le(action.principal),
        decodeHexFixed(action.delegation_id_hex, 32),
        serializeU128Le(action.shares)
      );
    case "cancel_redemption":
      return concatBytes(
        [4],
        serializeU64Le(action.principal),
        decodeHexFixed(action.request_id_hex, 32)
      );
  }
}

function mandateActionToJson(action: EvmMandateActionInput): Record<string, unknown> {
  switch (action.kind) {
    case "create_mandate": {
      const objectives = action.objectives ?? [];
      const objectiveWeights = action.objective_weights ?? [];
      const sessionKeysHex = action.session_keys_hex ?? [];
      const descriptionUri = action.description_uri?.trim() ?? "";
      const createAction: Record<string, unknown> = {
        kind: "create_mandate",
        agent: action.agent,
        version: action.version,
        constraints: action.constraints.map(mandateConstraintToJson),
        conformance_window_ms: Number(action.conformance_window_ms),
        expires_at: Number(action.expires_at),
      };
      if (objectives.length > 0) {
        createAction.objectives = objectives.map(mandateObjectiveToJson);
      }
      if (objectiveWeights.length > 0) {
        createAction.objective_weights = objectiveWeights;
      }
      if (sessionKeysHex.length > 0) {
        createAction.session_keys_hex = sessionKeysHex;
      }
      if (descriptionUri.length > 0) {
        createAction.description_uri = descriptionUri;
      }
      if (action.description_hash_hex) {
        createAction.description_hash_hex = action.description_hash_hex;
      }
      return createAction;
    }
    case "suspend_mandate":
      return { kind: "suspend_mandate", mandate_id_hex: action.mandate_id_hex };
    case "resume_mandate":
      return { kind: "resume_mandate", mandate_id_hex: action.mandate_id_hex };
    case "revoke_mandate":
      return {
        kind: "revoke_mandate",
        mandate_id_hex: action.mandate_id_hex,
        reason: action.reason ?? "owner_revoked",
      };
  }
}

function serializeMandateAction(action: EvmMandateActionInput, ownerHex?: string) {
  switch (action.kind) {
    case "create_mandate":
      if (!ownerHex) {
        throw new Error("create mandate action hashing requires owner_hex");
      }
      return concatBytes(
        [0],
        decodeHexFixed(ownerHex, 32),
        serializeU64Le(action.agent),
        serializeU32Le(action.version),
        serializeVec(action.constraints, serializeMandateConstraint),
        serializeVec(action.objectives ?? [], serializeMandateObjective),
        serializeU8Vec(action.objective_weights ?? []),
        serializeU64Le(action.conformance_window_ms),
        serializeVec(action.session_keys_hex ?? [], (key) => decodeHexFixed(key, 32)),
        serializeU64Le(action.expires_at),
        serializeOptionString(action.description_uri ?? null),
        serializeOptionHexFixed(action.description_hash_hex ?? null, 32)
      );
    case "suspend_mandate":
      return concatBytes([1], decodeHexFixed(action.mandate_id_hex, 32));
    case "resume_mandate":
      return concatBytes([2], decodeHexFixed(action.mandate_id_hex, 32));
    case "revoke_mandate":
      return concatBytes(
        [3],
        decodeHexFixed(action.mandate_id_hex, 32),
        serializeString(action.reason ?? "owner_revoked")
      );
  }
}

function mandateConstraintToJson(constraint: EvmMandateConstraintInput): Record<string, unknown> {
  switch (constraint.kind) {
    case "max_notional_per_market":
      return {
        kind: "max_notional_per_market",
        market: constraint.market,
        limit_usdc: constraint.limit_usdc.toString(),
      };
    case "max_notional_total":
      return {
        kind: "max_notional_total",
        limit_usdc: constraint.limit_usdc.toString(),
      };
    case "max_concentration_in_market_pct":
      return {
        kind: "max_concentration_in_market_pct",
        market: constraint.market,
        pct_bps: constraint.pct_bps,
      };
    case "allowed_markets":
      return { kind: "allowed_markets", set: constraint.set };
    case "max_leverage":
      return { kind: "max_leverage", mult: constraint.mult };
    case "max_drawdown_pct_from_peak":
      return {
        kind: "max_drawdown_pct_from_peak",
        pct_bps: constraint.pct_bps,
        window_ms: Number(constraint.window_ms),
      };
    case "max_daily_loss_usdc":
      return {
        kind: "max_daily_loss_usdc",
        limit_usdc: constraint.limit_usdc.toString(),
      };
    case "no_position_held_longer_than":
      return {
        kind: "no_position_held_longer_than",
        duration_ms: Number(constraint.duration_ms),
      };
    case "max_trade_size_usdc":
      return {
        kind: "max_trade_size_usdc",
        limit_usdc: constraint.limit_usdc.toString(),
      };
    case "max_trade_rate_per_minute":
      return { kind: "max_trade_rate_per_minute", count: constraint.count };
    case "no_same_operator_counterparty":
      return { kind: "no_same_operator_counterparty" };
    case "allowed_counterparties":
      return { kind: "allowed_counterparties", accounts: constraint.accounts };
  }
}

function mandateObjectiveToJson(objective: EvmMandateObjectiveInput): Record<string, unknown> {
  switch (objective.kind) {
    case "target_sharpe":
      return {
        kind: "target_sharpe",
        min: Number(objective.min),
        over_ms: Number(objective.over_ms),
      };
    case "target_return_pct":
      return {
        kind: "target_return_pct",
        min_bps: objective.min_bps,
        over_ms: Number(objective.over_ms),
      };
    case "max_drawdown_pct":
      return {
        kind: "max_drawdown_pct",
        max_bps: objective.max_bps,
        over_ms: Number(objective.over_ms),
      };
    case "min_trade_count":
      return {
        kind: "min_trade_count",
        count: objective.count,
        over_ms: Number(objective.over_ms),
      };
    case "max_trade_count":
      return {
        kind: "max_trade_count",
        count: objective.count,
        over_ms: Number(objective.over_ms),
      };
    case "max_slippage_bps":
      return { kind: "max_slippage_bps", limit: objective.limit };
    case "max_funding_paid_pct_of_equity":
      return {
        kind: "max_funding_paid_pct_of_equity",
        pct_bps: objective.pct_bps,
        over_ms: Number(objective.over_ms),
      };
  }
}

function serializeMandateConstraint(constraint: EvmMandateConstraintInput) {
  switch (constraint.kind) {
    case "max_notional_per_market":
      return concatBytes(
        [0],
        serializeU64Le(constraint.market),
        serializeU256(constraint.limit_usdc)
      );
    case "max_notional_total":
      return concatBytes([1], serializeU256(constraint.limit_usdc));
    case "max_concentration_in_market_pct":
      return concatBytes(
        [2],
        serializeU64Le(constraint.market),
        serializeU32Le(constraint.pct_bps)
      );
    case "allowed_markets":
      return concatBytes([3], serializeSortedU64Set(constraint.set));
    case "max_leverage":
      return concatBytes([4], serializeU32Le(constraint.mult));
    case "max_drawdown_pct_from_peak":
      return concatBytes(
        [5],
        serializeU32Le(constraint.pct_bps),
        serializeU64Le(constraint.window_ms)
      );
    case "max_daily_loss_usdc":
      return concatBytes([6], serializeU256(constraint.limit_usdc));
    case "no_position_held_longer_than":
      return concatBytes([7], serializeU64Le(constraint.duration_ms));
    case "max_trade_size_usdc":
      return concatBytes([8], serializeU256(constraint.limit_usdc));
    case "max_trade_rate_per_minute":
      return concatBytes([9], serializeU32Le(constraint.count));
    case "no_same_operator_counterparty":
      return Uint8Array.from([10]);
    case "allowed_counterparties":
      return concatBytes([11], serializeSortedU64Set(constraint.accounts));
  }
}

function serializeMandateObjective(objective: EvmMandateObjectiveInput) {
  switch (objective.kind) {
    case "target_sharpe":
      return concatBytes([0], serializeI64Le(objective.min), serializeU64Le(objective.over_ms));
    case "target_return_pct":
      return concatBytes(
        [1],
        serializeI32Le(objective.min_bps),
        serializeU64Le(objective.over_ms)
      );
    case "max_drawdown_pct":
      return concatBytes(
        [2],
        serializeU32Le(objective.max_bps),
        serializeU64Le(objective.over_ms)
      );
    case "min_trade_count":
      return concatBytes(
        [3],
        serializeU32Le(objective.count),
        serializeU64Le(objective.over_ms)
      );
    case "max_trade_count":
      return concatBytes(
        [4],
        serializeU32Le(objective.count),
        serializeU64Le(objective.over_ms)
      );
    case "max_slippage_bps":
      return concatBytes([5], serializeU32Le(objective.limit));
    case "max_funding_paid_pct_of_equity":
      return concatBytes(
        [6],
        serializeU32Le(objective.pct_bps),
        serializeU64Le(objective.over_ms)
      );
  }
}

async function signTypedData(
  wallet: Eip1193Wallet,
  signerAddressHex: string,
  typedData: Eip712TypedData<string>
) {
  const result = await wallet.request({
    method: "eth_signTypedData_v4",
    params: [signerAddressHex, JSON.stringify(typedData)],
  });
  if (typeof result !== "string") {
    throw new Error("wallet returned a non-string EIP-712 signature");
  }
  return normalizeHex(result);
}

function eip712Domain(chainId: number) {
  return { name: "0x26" as const, version: "1" as const, chainId };
}

const EIP712_DOMAIN_TYPES = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
];

function serializeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  return concatBytes(serializeU32Le(bytes.length), bytes);
}

function serializeOptionString(value: string | null) {
  return value == null ? Uint8Array.from([0]) : concatBytes([1], serializeString(value));
}

function serializeOptionHexFixed(value: string | null, size: number) {
  return value == null
    ? Uint8Array.from([0])
    : concatBytes([1], decodeHexFixed(value, size));
}

function serializeVec<T>(items: T[], serializeItem: (item: T) => Uint8Array) {
  return concatBytes(serializeU32Le(items.length), ...items.map(serializeItem));
}

function serializeU8Vec(items: number[]) {
  return concatBytes(serializeU32Le(items.length), Uint8Array.from(items));
}

function serializeSortedU64Set(items: number[]) {
  const sorted = [...new Set(items)].sort((left, right) => left - right);
  return serializeVec(sorted, serializeU64Le);
}

function serializeU32Le(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function serializeI32Le(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, true);
  return out;
}

function serializeU64Le(value: BigIntLike) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, toBigInt(value), true);
  return out;
}

function serializeI64Le(value: BigIntLike) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, toBigInt(value), true);
  return out;
}

function serializeU64Be(value: BigIntLike) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, toBigInt(value), false);
  return out;
}

function serializeU128Le(value: BigIntLike) {
  const bigint = toBigInt(value);
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, bigint & 0xffff_ffff_ffff_ffffn, true);
  view.setBigUint64(8, bigint >> 64n, true);
  return out;
}

function serializeU256(value: BigIntLike) {
  let bigint = toBigInt(value);
  if (bigint < 0n || bigint >= 1n << 256n) {
    throw new Error("u256 value out of range");
  }
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(bigint & 0xffn);
    bigint >>= 8n;
  }
  return out;
}

function keccak256Bytes(bytes: Uint8Array) {
  return keccak_256(bytes);
}

function asciiBytes(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(...parts: Array<Uint8Array | number[]>) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    const bytes = Array.isArray(part) ? Uint8Array.from(part) : part;
    out.set(bytes, offset);
    offset += bytes.length;
  }
  return out;
}

function encodeHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function decodeHexFixed(input: string, size: number) {
  const normalized = normalizeHex(input).slice(2);
  if (
    normalized.length !== size * 2 ||
    normalized.length % 2 !== 0 ||
    !/^[0-9a-f]*$/.test(normalized)
  ) {
    throw new Error(`hex input must decode to ${size} bytes`);
  }
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function normalizeHex(input: string) {
  const value = input.startsWith("0x") ? input : `0x${input}`;
  return value.toLowerCase();
}

function toBigInt(value: BigIntLike) {
  return typeof value === "bigint" ? value : BigInt(value);
}
