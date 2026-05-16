import type {
  SignedEvmDelegationActionJson,
  SignedEvmMandateActionJson,
} from "./walletActions.js";

export type JsonRpcId = number | string;
export * from "./walletActions.js";

export interface ChainInfoResponse {
  chain_id: number;
  head_height: number;
  head_hash_hex: string;
  committed_state_root_hex: string;
  quarantined_block_count: number;
}

export interface AccountResponse {
  id: number;
  owner_hex: string;
  pending_owner_hex: string | null;
  created_at: number;
  paused: boolean;
  frozen: boolean;
  controllers: number[];
  nonce: number;
  code_hash_hex: string;
  evm_address_hex?: string | null;
}

export interface FaucetFundAccountResponse {
  address_hex: string;
  policy_usdc_balance: string;
  evm_usdc_balance: string;
  evm_usdc_total_supply: string;
  evm_usdc_deposit_tx_hash: string | null;
  state_root_hex: string;
}

export interface WalletBalancesResponse {
  address_hex: string;
  policy_usdc_balance: string;
  evm_usdc_balance: string;
  evm_usdc_total_supply: string;
  next_seq: number;
}

export interface PolicyTermsResponse {
  gas_budget_per_day: string;
  gas_refill_per_day: string;
  max_intents_per_second: number;
  max_intents_per_day: number;
  max_volume_per_day: string;
  max_drawdown_pct: number;
}

export interface PolicyResponse {
  id: number;
  authority_account: number;
  account: number;
  execution_account_id: number;
  execution_scope: {
    kind: "account" | "delegation_trading";
    delegation_id_hex: string | null;
  };
  parent_policy_id: number | null;
  state: "pending_activation" | "active" | "suspended" | "revoked" | "expired";
  next_intent_nonce: number;
  delegation_depth: number;
  revoked_at: number | null;
  terms?: PolicyTermsResponse;
}

export interface SubmitIntentResponse {
  intent_id_hex: string;
  class: string;
  pending_reason: string | null;
  next_eligible_at_ms: number | null;
  current_policy_nonce: number | null;
}

export type TradingOrderKind =
  | { order_kind: "market" }
  | { order_kind: "limit"; price_ticks: number };

export type TradingTimeInForce =
  | { tif: "gtc" }
  | { tif: "ioc" }
  | { tif: "fok" }
  | { tif: "gtt"; expires_at_ms: number };

export type TradingOrderRequest = TradingOrderKind & {
  market_id: number;
  account_id: number;
  client_order_id: number;
  side: "bid" | "ask";
  quantity_lots: number;
  time_in_force: TradingTimeInForce;
  post_only: boolean;
};

export interface PreviewIntentResponse {
  market_id: number;
  account_id: number;
  would_succeed: boolean;
  reason: string | null;
  current_raw_notional: string;
  candidate_raw_notional: string;
  current_notional: string;
  candidate_notional: string;
  required_initial: string;
  equity_for_market: string;
  margin_surplus: string;
}

export type IntentStatusStage = "unknown" | "accepted_direct" | "accepted_conditional" | "promoted" | "executed" | "expired" | "rejected";

export interface IntentStatusResponse {
  intent_id_hex: string;
  stage: IntentStatusStage;
  rejection_reason: string | null;
  order_rejection_reason: string | null;
  pending_reason: string | null;
  next_eligible_at_ms: number | null;
  current_policy_nonce: number | null;
  policy_id: number | null;
  nonce: number | null;
  currently_queued: boolean;
  latest_event_seq: number | null;
  block_height: number | null;
  timestamp_ms: number | null;
}

export interface SubmitOwnerCallResponse {
  accepted: boolean;
  account_id: number;
  chain_id: number;
  nonce: number;
  action: string;
  policy_id: number | null;
  new_owner: string | null;
  code_hash: string | null;
}

export interface DelegationActionSubmissionResponse {
  action_id_hex: string;
  status: "accepted" | "duplicate_pending" | "already_processed" | (string & {});
  pending_delegation_actions: number;
  action_status?: DelegationActionStatusResponse;
  peer_failures?: Array<Record<string, unknown>>;
}

export type DelegationActionStatus = "pending" | "processed" | "unknown" | (string & {});

export interface DelegationActionReceipt {
  kind: string;
  [key: string]: unknown;
}

export interface DelegationActionStatusResponse {
  action_id_hex: string;
  status: DelegationActionStatus;
  action_kind: string | null;
  submitted_at_ms: number | null;
  processed_at_ms: number | null;
  receipt: DelegationActionReceipt | null;
}

// --- RFC 027 market-maker program admin -----------------------------------

export type MarketMakerIdentityParams =
  | { kind: "account"; account_id: number }
  | { kind: "delegation"; delegation_id_hex: string; serving_agent: number };

export interface DefineMarketMakerProgramParams {
  name: string;
  markets: number[];
  min_uptime_bps: number;
  max_spread_bps: number;
  min_quote_size_micro_usdc: string;
  min_two_sided_windows_per_hour: number;
  rebate_multiplier_units: number;
  enrollment_bond_micro_usdc: string;
  compliance_window_ms: number;
  observation_cadence_ms: number;
  timestamp_ms: number;
  submitter_nonce?: number;
  wait_timeout_ms?: number;
}

export interface EnrollMarketMakerProgramParams {
  market_maker?: number;
  market_maker_identity?: MarketMakerIdentityParams;
  market_id: number;
  program_id_hex: string;
  bond_micro_usdc: string;
  timestamp_ms: number;
  submitter_nonce?: number;
  wait_timeout_ms?: number;
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

export interface MarketMakerProgramActionStatusResponse {
  action_id_hex: string;
  status: "pending" | "processed" | "unknown" | (string & {});
  action_kind: string | null;
  submitted_at_ms: number | null;
  processed_at_ms: number | null;
  receipt: Record<string, unknown> | null;
}

export interface MarketMakerProgramActionSubmissionResponse {
  action_id_hex: string;
  status:
    | "accepted"
    | "duplicate_pending"
    | "already_processed"
    | (string & {});
  pending_market_maker_program_actions: number;
  program_id_hex: string | null;
  action_status: MarketMakerProgramActionStatusResponse | null;
  peer_failures: Array<{ validator_id_hex: string; message: string }> | null;
}

export interface MarketMakerProgramResponse {
  program_id_hex: string;
  name: string;
  markets: number[];
  min_uptime_bps: number;
  max_spread_bps: number;
  min_quote_size_micro_usdc: string;
  min_two_sided_windows_per_hour: number;
  rebate_multiplier_units: number;
  enrollment_bond_micro_usdc: string;
  compliance_window_ms: number;
  observation_cadence_ms: number;
  status: "active" | "retired" | (string & {});
  defined_at_ms: number;
  retired_at_ms: number | null;
}

export type MarketMakerEnrollmentStatusName =
  | "active"
  | "grace_period"
  | "non_compliant"
  | "exited"
  | "slashed";

export type MarketMakerBreachKindName =
  | "uptime"
  | "spread"
  | "size"
  | "two_sided_windows";

export interface MarketMakerEnrollmentResponse {
  market_maker_identity: MarketMakerIdentityParams;
  market_id: number;
  program_id_hex: string;
  status: MarketMakerEnrollmentStatusName;
  bond_micro_usdc: string;
  enrolled_at_ms: number;
  last_updated_at_ms: number;
  last_compliance_checked_ms: number;
  lifetime_compliant_rebates_micro_usdc: string;
  lifetime_forfeited_rebates_micro_usdc: string;
  current_compliance: {
    window_start_ms: number;
    window_end_ms: number;
    uptime_bps_current: number;
    avg_spread_bps_current: number;
    median_quote_size_current: string;
    two_sided_windows_last_h: number;
    last_window_breach: MarketMakerBreachKindName | null;
    breach_counter: number;
  };
  [key: string]: unknown;
}

// --- RFC 027 / RFC 054 typed event payloads -------------------------------

export interface MarketMakerProgramDefinedEvent {
  topic: "market_maker_program_defined";
  program_id_hex: string;
  name: string;
  markets: number[];
  rebate_multiplier_units: number;
  compliance_window_ms: number;
  reactivated: boolean;
}

export interface MarketMakerProgramRetiredEvent {
  topic: "market_maker_program_retired";
  program_id_hex: string;
}

export interface MarketMakerProgramActionRejectedEvent {
  topic: "market_maker_program_action_rejected";
  action_kind: string;
  reason: string;
}

export interface MarketMakerEnrolledEvent {
  topic: "market_maker_enrolled";
  market_maker_identity: MarketMakerIdentityParams;
  market_id: number;
  program_id_hex: string;
  bond_micro_usdc: string;
}

export interface MarketMakerEnrollmentExitedEvent {
  topic: "market_maker_enrollment_exited";
  market_maker_identity: MarketMakerIdentityParams;
  market_id: number;
  program_id_hex: string;
  bond_refunded_micro_usdc: string;
}

export interface MmProgramBonusPaidEvent {
  topic: "mm_program_bonus_paid";
  market_maker_identity: MarketMakerIdentityParams;
  economic_account_id: number;
  market_id: number;
  program_id_hex: string;
  requested_bonus_micro_usdc: string;
  paid_bonus_micro_usdc: string;
}

export interface MmProgramBonusForfeitedEvent {
  topic: "mm_program_bonus_forfeited";
  market_maker_identity: MarketMakerIdentityParams;
  economic_account_id: number;
  market_id: number;
  program_id_hex: string;
  forfeited_bonus_micro_usdc: string;
}

export interface MarketMakerEnrollmentGraceEnteredEvent {
  topic: "market_maker_enrollment_grace_entered";
  market_maker_identity: MarketMakerIdentityParams;
  economic_account_id: number;
  market_id: number;
  program_id_hex: string;
  breach: MarketMakerBreachKindName;
}

export interface MarketMakerEnrollmentRecoveredEvent {
  topic: "market_maker_enrollment_recovered";
  market_maker_identity: MarketMakerIdentityParams;
  economic_account_id: number;
  market_id: number;
  program_id_hex: string;
  recovered_from: MarketMakerEnrollmentStatusName;
}

export interface MarketMakerEnrollmentNonCompliantEvent {
  topic: "market_maker_enrollment_non_compliant";
  market_maker_identity: MarketMakerIdentityParams;
  economic_account_id: number;
  market_id: number;
  program_id_hex: string;
  breach_counter: number;
}

export type MarketMakerRuntimeEventKind =
  | MarketMakerProgramDefinedEvent
  | MarketMakerProgramRetiredEvent
  | MarketMakerProgramActionRejectedEvent
  | MarketMakerEnrolledEvent
  | MarketMakerEnrollmentExitedEvent
  | MmProgramBonusPaidEvent
  | MmProgramBonusForfeitedEvent
  | MarketMakerEnrollmentGraceEnteredEvent
  | MarketMakerEnrollmentRecoveredEvent
  | MarketMakerEnrollmentNonCompliantEvent;

export interface BookLevelResponse {
  price_ticks: number;
  total_lots: number;
  order_count: number;
}

export interface OrderBookResponse {
  market_id: number;
  bids: BookLevelResponse[];
  asks: BookLevelResponse[];
}

export interface RestingOrderResponse {
  market_id: number;
  account_id: number;
  client_order_id: number;
  side: "bid" | "ask";
  price_ticks: number;
  remaining_lots: number;
  expires_at_ms: number | null;
  sequence: number;
}

export type MarketStatus = "active" | "paused" | "reduce_only" | "delisted";

export interface PerpetualMarketResponse {
  market_id: number;
  kind: "perpetual";
  status: MarketStatus;
  base_symbol: string;
  quote_asset: number;
  oracle_feed_id: number;
  initial_margin_bps: number;
  maintenance_margin_bps: number;
  max_leverage: number;
  lot_size_microunits: number;
  tick_size_bps: number;
  funding_interval_ms: number;
  oracle_max_staleness_ms: number;
  breaker_price_band_bps: number;
  oracle_min_sources: number;
  oracle_min_confidence: number;
  oracle_min_samples: number;
  oracle_feeder_ids_hex: string[];
  listed_at_ms: number;
  updated_at_ms: number;
}

export interface PositionResponse {
  market_id: number;
  account_id: number;
  side: "flat" | "long" | "short";
  net_lots: number;
  open_notional: string;
  realized_pnl: string;
  average_entry_price_ticks: number | null;
  buy_lots: number;
  sell_lots: number;
  buy_notional: string;
  sell_notional: string;
  last_fill_seq: number | null;
  last_fill_timestamp_ms: number | null;
}

export interface CandleResponse {
  market_id: number;
  interval: string;
  timestamp_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_lots: number;
  trade_count: number;
  first_seq: number;
  last_seq: number;
}

export interface TradeFillResponse {
  market_id: number;
  account_id: number;
  client_order_id: number;
  counterparty_account_id: number;
  counterparty_client_order_id: number;
  /** Hex-encoded mandate id this fill was attributed to (RFC 047), null when
   *  the fill was not driven by a mandate. */
  mandate_id_hex: string | null;
  role: "maker" | "taker";
  side: "buy" | "sell";
  price_ticks: number;
  quantity_lots: number;
  seq: number;
  block_height: number | null;
  timestamp_ms: number;
}

export interface MarketRiskTransition {
  market_id: number;
  account_id: number;
  kind: string;
  source: string;
  seq: number;
  block_height: number | null;
  timestamp_ms: number;
}

export interface MarketStateResponse {
  market_id: number;
  trading_paused: boolean;
  liquidation_candidate_count: number;
  imminent_freeze_count: number;
  max_liquidation_stall_count: number;
  total_liquidation_gap: string;
  worst_liquidation_gap: string;
  suggested_clear_count: number;
  suggested_freeze_count: number;
  suggested_bad_debt_count: number;
  total_suggested_bad_debt: string;
  oracle_max_staleness_ms: number;
  order_price_inputs_ready: boolean;
  liquidation_price_inputs_ready: boolean;
  mark_price_ticks: number | null;
  mark_updated_at_ms: number | null;
  mark_price_stale: boolean | null;
  index_price_ticks: number | null;
  index_updated_at_ms: number | null;
  index_price_stale: boolean | null;
  premium_rate_ppm: number | null;
  indicative_funding_rate_ppm: number | null;
  funding_index: string;
  maker_fee_bps: number;
  maker_rebate_bps: number;
  taker_fee_bps: number;
  fee_vault_balance: string;
  validator_reward_pool_balance: string;
  market_maker_rebate_pool_balance: string;
  treasury_balance: string;
  maintenance_margin_bps: number;
  liquidation_penalty_bps: number;
  liquidator_fee_bps: number;
  insurance_fund_balance: string;
  bad_debt_balance: string;
  /** Decimal-string `u128` of open interest in lots. Absent on chains
   *  older than RFC 046; consumers must treat `undefined` as "no data". */
  open_interest_lots?: string;
  latest_market_risk_transition: MarketRiskTransition | null;
  recent_market_risk_transitions: MarketRiskTransition[];
  top_liquidation_accounts: unknown[];
}

export interface MarketSnapshotResponse {
  market: PerpetualMarketResponse | null;
  state: MarketStateResponse;
  order_book: OrderBookResponse;
  latest_trade: TradeFillResponse | null;
  next_seq: number;
}

export interface AccountTradingStateResponse {
  account_id: number;
  market_id: number | null;
  positions: PositionResponse[];
  open_orders: RestingOrderResponse[];
  risk_summary: AccountRiskSummaryResponse;
  recent_fills: TradeFillResponse[];
  next_seq: number;
}

export interface AccountRiskSummaryResponse {
  account_id: number;
  market_count: number;
  frozen: boolean;
  latest_account_risk_transition: {
    kind: string;
    source: string;
    seq: number;
    block_height: number | null;
    timestamp_ms: number;
  } | null;
  max_liquidation_stall_count: number;
  imminent_freeze_market_count: number;
  worst_market_id: number | null;
  worst_liquidation_gap: string;
  markets_cleared_by_suggested_liquidation: number;
  markets_still_under_after_suggested_liquidation: number;
  markets_freezing_after_suggested_liquidation: number;
  markets_creating_bad_debt_after_suggested_liquidation: number;
  total_suggested_bad_debt: string;
  total_bad_debt: string;
  total_collateral: string;
  total_realized_pnl: string;
  total_unrealized_pnl: string;
  total_equity: string;
  total_open_notional?: string;
  total_initial_margin_required?: string;
  total_maintenance_requirement: string;
  total_liquidation_gap: string;
  total_margin_surplus: string;
  under_maintenance_market_count: number;
}

export interface AccountPnlWindowResponse {
  account_id: number;
  market_id: number | null;
  from_ms: number;
  to_ms: number;
  total_realized_pnl: string;
  funding_paid: string;
  trading_realized_pnl: string;
  fees_paid: string;
  fill_count: number;
  fee_count: number;
  funding_count: number;
  first_seq: number | null;
  last_seq: number | null;
}

export interface AccountEquitySampleResponse {
  block_height: number;
  timestamp_ms: number;
  total_equity: string;
  total_collateral: string;
  total_realized_pnl: string;
  total_unrealized_pnl: string;
  total_maintenance_requirement: string;
  total_liquidation_gap: string;
  total_margin_surplus: string;
  position_count: number;
  under_maintenance: boolean;
}

export interface AccountEquityHistoryResponse {
  account_id: number;
  from_ms: number;
  to_ms: number;
  samples: AccountEquitySampleResponse[];
}

export interface MandateConformanceSampleResponse {
  mandate_id_hex: string;
  block_height: number;
  evaluated_at_ms: number;
  score: number;
  pending_objectives: number;
  state: MandateState;
  prev_score: number | null;
  delta: number | null;
}

export interface MandateConformanceHistoryResponse {
  mandate_id_hex: string;
  samples: MandateConformanceSampleResponse[];
}

export interface RuntimeEventRecord {
  seq: number;
  block_height: number | null;
  timestamp_ms: number;
  kind: Record<string, unknown>;
}

export interface EventCursor {
  next_seq: number;
}

export interface EventPageResponse {
  events: RuntimeEventRecord[];
  next_cursor: EventCursor;
}

export interface EventFilter {
  block_height?: number;
  account_id?: number;
  market_id?: number;
  policy_id?: number;
  intent_id_hex?: string;
  client_order_id?: number;
  topic?: string;
}

export interface EventStreamQuery extends EventFilter {
  fromSeq?: number;
  limit?: number;
  follow?: boolean;
  timeoutMs?: number;
}

export interface ListEventsParams {
  fromSeq?: number;
  beforeSeq?: number;
  limit?: number;
  descending?: boolean;
  filter?: EventFilter;
}

export interface EventStreamHandlers {
  onEvent?: (event: RuntimeEventRecord) => void;
  onCursor?: (cursor: EventCursor) => void;
  onOpen?: () => void;
  onError?: (event: Event) => void;
}

export interface MarketStreamQuery {
  marketId: number;
  fromSeq?: number;
  depth?: number;
  limit?: number;
  follow?: boolean;
  timeoutMs?: number;
}

export interface AccountStreamQuery {
  accountId: number;
  marketId?: number;
  fromSeq?: number;
  depth?: number;
  limit?: number;
  follow?: boolean;
  timeoutMs?: number;
}

export interface WalletStreamQuery {
  addressHex: string;
  fromSeq?: number;
  limit?: number;
  follow?: boolean;
  timeoutMs?: number;
}

export type MarketStreamEventName =
  | "market_snapshot"
  | "mark_price"
  | "index_price"
  | "funding"
  | "trade"
  | "book"
  | "open_interest";
export type AccountStreamEventName = "account_trading_state" | "position" | "order" | "fill" | "collateral" | "risk";
export type WalletStreamEventName = "wallet_balances";

// RFC 043 — Vaults Discovery Surface.
//
// `kind` and `status` are open string types matching the wire shape (see
// RFC 043 §"VaultKind" / §"VaultStatus"). Kept open rather than a closed
// union so newer servers can introduce additional kinds without breaking
// older client deserialization.
export type VaultKind = "delegation" | "supply_borrow_pool" | "cover_pool" | (string & {});
export type VaultStatus =
  | "open"
  | "closed_to_deposits"
  | "winding"
  | "triggered"
  | "paused"
  | "closed"
  | (string & {});

export interface VaultFeeSummary {
  perf_share_units: number;
  headline_apy_bps: number;
  notice_period_secs: number;
}

export interface VaultDiscoveryFlags {
  listed: boolean;
  featured: boolean;
}

export interface VaultDelegationRecord {
  delegation_id_hex: string;
  agent: number;
  mandate_id_hex: string;
  opened_at_ms: number;
  last_updated_at_ms: number;
  winding_started_at_ms: number | null;
  status: string;
  performance_share_units: number;
  crystallization_cadence_ms: number;
  notice_period_ms: number;
  total_shares: string;
  high_water_mark_per_share: string;
  last_crystallized_at_ms: number;
  agent_bond: string;
}

/// Variant-typed details payload. Today only `delegation` is populated;
/// when `SupplyBorrowPool` / `CoverPool` land they add sibling fields.
export interface VaultDetails {
  kind: VaultKind;
  delegation?: VaultDelegationRecord;
}

export interface VaultLiveTradingInfo {
  /** Decimal string: delegation trading accounts are u64 values above JS's safe integer range. */
  trading_account_id: string;
  market_count: number;
  source: string;
  total_collateral_micro_usdc: string;
  total_realized_pnl_micro_usdc: string;
  total_unrealized_pnl_micro_usdc: string;
  total_pnl_micro_usdc: string;
  total_equity_micro_usdc: string;
  total_open_notional_micro_usdc: string;
  total_initial_margin_required_micro_usdc: string;
  total_maintenance_requirement_micro_usdc: string;
  total_margin_surplus_micro_usdc: string;
}

export interface VaultRecord {
  vault_id_hex: string;
  kind: VaultKind;
  display_name: string;
  operator: number | null;
  status: VaultStatus;
  capital_currency: number;
  tvl_native: string;
  tvl_micro_usdc: string;
  shares_outstanding: string | null;
  fee_summary: VaultFeeSummary;
  discovery: VaultDiscoveryFlags;
  real_capital: VaultRealCapitalInfo | null;
  live_trading?: VaultLiveTradingInfo | null;
  details: VaultDetails;
}

export interface VaultRealCapitalInfo {
  mode: RealCapitalMode;
  pilot_min_serving_agent_tier: IdentityTier | null;
  tier0_pilot_exception: boolean;
  deposit_enabled: boolean;
  listed_for_discovery: boolean;
  global_deposit_kill_switch: boolean;
  per_principal_cap_micro_usdc: string;
  total_vault_tvl_cap_micro_usdc: string;
  protocol_cap_micro_usdc: string | null;
  vault_deposited_micro_usdc: string;
  listed_at_block: number;
  last_updated_block: number;
  last_updated_governance_action_hex: string;
}

export interface ListVaultsResponse {
  items: VaultRecord[];
  next_cursor: string | null;
}

export interface GetVaultResponse {
  record: VaultRecord | null;
  present: boolean;
}

export interface ListVaultsParams {
  kind?: VaultKind;
  status?: VaultStatus;
  operator?: number;
  /** `undefined` → server defaults to USDC-only. `[]` → "any currency". */
  currencies?: number[];
  includeUnlisted?: boolean;
  cursor?: string;
  /** Server clamps to [1, 1000]. `0` is rejected with -32602. */
  limit?: number;
}

// RFC 049 — Vault Real-Capital Readiness Gate.
//
// `kombat_listRedemptionRequests` powers the Vault UI's pending-redemption
// list and replaces the request-id paste flow. `kombat_listVaultPositions`
// returns the principal's share/lock/value row for vault dashboards.
// Redemption `status` is computed at read time: `Pending` requests whose
// `ready_at_ms` has been reached are surfaced as `ready`. Cursors are opaque
// hex and stable under each RPC's deterministic ordering.
export type RedemptionRequestStatus =
  | "pending"
  | "ready"
  | "finalized"
  | "cancelled"
  | (string & {});

export interface RedemptionRequestListItem {
  request_id_hex: string;
  vault_id_hex: string;
  kind: "delegation" | (string & {});
  delegation_id_hex: string;
  principal: number;
  shares_requested: string;
  requested_at_ms: number;
  ready_at_ms: number;
  nav_at_request: string;
  status: RedemptionRequestStatus;
}

export interface ListRedemptionRequestsResponse {
  items: RedemptionRequestListItem[];
  next_cursor: string | null;
}

export interface ListRedemptionRequestsParams {
  principal: number;
  vaultIdHex?: string;
  status?: RedemptionRequestStatus;
  cursor?: string;
  /** Server clamps to [1, 1000]. `0` is rejected with -32602. */
  limit?: number;
}

export interface VaultPositionListItem {
  vault_id_hex: string;
  kind: VaultKind;
  delegation_id_hex: string;
  principal: number;
  shares: string;
  locked_shares_for_redemption: string;
  avg_entry_nav_per_share: string;
  principal_deposited_micro_usdc: string;
  authoritative_nav_per_share: string;
  authoritative_nav_source: string;
  indicative_nav_per_share: string;
  indicative_nav_source: string;
  live_trading?: VaultLiveTradingInfo | null;
  live_nav_per_share?: string | null;
  live_estimated_value_micro_usdc?: string | null;
  compensation_claim_micro_usdc: string;
  estimated_value_micro_usdc: string;
  status: VaultStatus;
}

export interface ListVaultPositionsResponse {
  items: VaultPositionListItem[];
  next_cursor: string | null;
}

export interface ListVaultPositionsParams {
  principal: number;
  kind?: VaultKind;
  status?: VaultStatus;
  cursor?: string;
  /** Server clamps to [1, 1000]. `0` is rejected with -32602. */
  limit?: number;
}

export type RealCapitalMode =
  | "disabled"
  | "capped_pilot"
  | "public"
  | (string & {});

export interface RealCapitalListingCaps {
  per_principal_micro_usdc: string;
  total_vault_tvl_micro_usdc: string;
}

export interface RealCapitalListing {
  vault_id_hex: string;
  delegation_id_hex: string;
  serving_agent: number;
  mode: RealCapitalMode;
  pilot_min_serving_agent_tier: IdentityTier | null;
  tier0_pilot_exception: boolean;
  deposit_enabled: boolean;
  listed_for_discovery: boolean;
  caps: RealCapitalListingCaps;
  protocol_cap_micro_usdc: string | null;
  vault_deposited_micro_usdc: string;
  pilot_principal_allowlist: number[] | null;
  listed_at_block: number;
  last_updated_block: number;
  last_updated_governance_action_hex: string;
}

export interface RealCapitalControl {
  global_deposit_kill_switch: boolean;
  last_updated_block: number;
  last_updated_governance_action_hex: string;
  protocol_cap_micro_usdc: string | null;
  total_protocol_delegation_tvl_micro_usdc: string;
}

export interface ListRealCapitalListingsResponse {
  items: RealCapitalListing[];
  next_cursor: string | null;
  control: RealCapitalControl;
}

export interface GetRealCapitalListingResponse {
  listing: RealCapitalListing | null;
  present: boolean;
  control: RealCapitalControl;
}

export interface ListRealCapitalListingsParams {
  agent?: number;
  mode?: RealCapitalMode;
  includeUnlisted?: boolean;
  includeDisabled?: boolean;
  cursor?: string;
  /** Server clamps to [1, 1000]. `0` is rejected with -32602. */
  limit?: number;
}

export type RealCapitalGovernanceAction =
  | {
      kind: "upsert_listing";
      vaultIdHex: string;
      delegationIdHex: string;
      servingAgent: number;
      mode: RealCapitalMode;
      pilotMinServingAgentTier?: IdentityTier | null;
      tier0PilotException?: boolean;
      depositEnabled: boolean;
      listedForDiscovery: boolean;
      perPrincipalMicroUsdc: string;
      totalVaultTvlMicroUsdc: string;
      pilotPrincipalAllowlist?: number[] | null;
    }
  | {
      kind: "set_listing_deposit_enabled";
      vaultIdHex: string;
      depositEnabled: boolean;
    }
  | {
      kind: "set_listing_discovery";
      vaultIdHex: string;
      listedForDiscovery: boolean;
    }
  | {
      kind: "update_protocol_cap";
      totalProtocolTvlMicroUsdc: string | null;
    }
  | {
      kind: "update_global_kill_switch";
      disabled: boolean;
    };

export interface SubmitRealCapitalGovernanceActionParams {
  action: RealCapitalGovernanceAction;
  timestampMs: number;
}

export interface SubmitRealCapitalGovernanceActionResponse {
  action_id_hex: string;
  status: "accepted" | "duplicate_pending" | "already_processed" | (string & {});
  pending_real_capital_governance_actions: number;
}

export type RealCapitalGovernanceActionStatus =
  | "pending"
  | "processed"
  | "rejected"
  | "unknown"
  | (string & {});

export interface RealCapitalGovernanceActionReceipt {
  kind: string;
  [key: string]: unknown;
}

export interface RealCapitalGovernanceActionStatusResponse {
  action_id_hex: string;
  status: RealCapitalGovernanceActionStatus;
  action_kind: string | null;
  submitted_at_ms: number | null;
  processed_at_ms: number | null;
  receipt: RealCapitalGovernanceActionReceipt | null;
}

// RFC 050 / 051 — Identity tiers and TEE attestation reads.
//
// The deployed write surface supports account-signed registration,
// one-field descriptive updates, deletion, and operator-signed
// OperatorSelf registration/refresh/revoke lifecycle.
export type IdentityTier =
  | "tier0_unattested"
  | "tier1_operator_attested"
  | "tier2_tee_attested"
  | (string & {});

export type AttestationKind =
  | "operator_self"
  | "tee_enclave"
  | "third_party"
  | (string & {});

export type TeeVendor =
  | "intel_sgx_dcap"
  | "amd_sev_snp"
  | "aws_nitro"
  | "apple_secure_enclave"
  | (string & {});

export type AgentKind = "unknown" | (string & {});

export interface OperatorSignatureEvidence {
  kind: "operator_signature";
}

export interface TeeQuoteVerifiedEvidence {
  kind: "tee_quote_verified";
  vendor: TeeVendor;
  vendor_root_id_hex: string;
  enclave_id_hex: string;
  signer_hex: string;
  verified_at_block: number;
}

export type AttestationEvidence =
  | OperatorSignatureEvidence
  | TeeQuoteVerifiedEvidence
  | ({ kind: string } & Record<string, unknown>);

export interface AgentIdentityResponse {
  account: number;
  tier: IdentityTier;
  operator: number | null;
  kind: AgentKind;
  display_name: string;
  description: string;
  contact_uri: string | null;
  active_attestation_count: number;
  registered_at_block: number | null;
  registered_at_timestamp_ms: number | null;
  last_updated_block: number | null;
  last_updated_timestamp_ms: number | null;
  virtual_default: boolean;
}

export interface AttestationRecordResponse {
  record_id_hex: string;
  account: number;
  kind: AttestationKind;
  attestor: number;
  claim: Record<string, unknown>;
  evidence: AttestationEvidence;
  issued_at_block: number;
  issued_at_timestamp_ms: number;
  expires_at_timestamp_ms: number;
  revoked_at_block: number | null;
  verified: boolean;
}

export interface ListAttestationsParams {
  account: number;
  kind?: AttestationKind;
  includeRevoked?: boolean;
  includeExpired?: boolean;
  cursor?: string;
  /** Server clamps to [1, 1000]. `0` is rejected with -32602. */
  limit?: number;
}

export interface ListAttestationsResponse {
  items: AttestationRecordResponse[];
  next_cursor: string | null;
  scaffold: boolean;
}

export interface CompositionAccessResponse {
  account: number;
  performance_share_delegator: boolean;
  performance_share_delegatee: boolean;
  reputation_collateral: boolean;
  a2a_contract: boolean;
}

export interface ReputationMultiplierResponse {
  account: number;
  multiplier: string;
}

export interface IdentityActionNonceResponse {
  account: number;
  nonce: number;
}

export type AttestationClaim =
  | {
      kind: "runs_code_hash";
      codeHashHex: string;
      modelHashHex?: string | null;
    }
  | {
      kind: "bound_to_mandate";
      mandateIdHex: string;
    }
  | {
      kind: "runs_code_and_bound_to_mandate";
      codeHashHex: string;
      modelHashHex?: string | null;
      mandateIdHex: string;
    };

export interface IdentityRegisterAction {
  kind: "register";
  account: number;
  displayName: string;
  description: string;
  agentKind?: AgentKind;
  operator?: number | null;
  contactUri?: string | null;
}

export type IdentityDescriptiveUpdate =
  | { field: "display_name"; value: string }
  | { field: "description"; value: string }
  | { field: "kind"; value: AgentKind }
  | { field: "operator"; value: number | null }
  | { field: "contact_uri"; value: string | null };

export interface IdentityUpdateDescriptiveAction {
  kind: "update_descriptive";
  account: number;
  update: IdentityDescriptiveUpdate;
}

export interface IdentityRegisterOperatorAttestationAction {
  kind: "register_operator_attestation";
  attestor: number;
  subject: number;
  claim: AttestationClaim;
  expiresAtTimestampMs: number;
}

export interface IdentityRefreshOperatorAttestationAction {
  kind: "refresh_operator_attestation";
  attestor: number;
  recordIdHex: string;
  newExpiresAtTimestampMs: number;
}

export interface IdentityRevokeAttestationAction {
  kind: "revoke_attestation";
  revoker: number;
  recordIdHex: string;
}

export interface IdentityDeleteAction {
  kind: "delete";
  account: number;
}

export type IdentityAction =
  | IdentityRegisterAction
  | IdentityUpdateDescriptiveAction
  | IdentityRegisterOperatorAttestationAction
  | IdentityRefreshOperatorAttestationAction
  | IdentityRevokeAttestationAction
  | IdentityDeleteAction;

export interface SignedIdentityAction {
  chainId: number;
  account: number;
  nonce: number;
  action: IdentityAction;
  signatureHex: string;
}

export interface SubmitIdentityActionParams {
  signedIdentityAction: SignedIdentityAction;
  timestampMs: number;
}

export interface IdentityRegisterTeeAttestationAction {
  kind: "register_tee_attestation";
  attestor: number;
  subject: number;
  claim: AttestationClaim;
  expiresAtTimestampMs: number;
  quoteHex: string;
  nonceHex: string;
  freshnessAnchorBlock: number;
  vendor: TeeVendor;
}

export interface IdentityRefreshTeeAttestationAction {
  kind: "refresh_tee_attestation";
  attestor: number;
  recordIdHex: string;
  newExpiresAtTimestampMs: number;
  quoteHex: string;
  nonceHex: string;
  freshnessAnchorBlock: number;
}

export type TeeAttestationAction =
  | IdentityRegisterTeeAttestationAction
  | IdentityRefreshTeeAttestationAction;

export type TeeAttestationSigners =
  | {
      kind: "self_attest";
      attestorNonce: number;
      attestorSignatureHex: string;
    }
  | {
      kind: "operator_attest";
      attestorNonce: number;
      attestorSignatureHex: string;
      subjectNonce: number;
      subjectSignatureHex: string;
    };

export interface SignedTeeAttestationAction {
  chainId: number;
  action: TeeAttestationAction;
  signers: TeeAttestationSigners;
}

export interface SubmitTeeAttestationParams {
  signedTeeAttestationAction: SignedTeeAttestationAction;
  timestampMs: number;
}

export interface ListVendorRootsParams {
  vendor?: TeeVendor;
  includeInactive?: boolean;
}

export interface VendorRootRecord {
  vendor: TeeVendor;
  root_id_hex: string;
  valid_from_block: number;
  valid_until_block: number | null;
}

export type PendingVendorGovernanceAction =
  | {
      kind: "introduce_vendor_root";
      vendor: TeeVendor;
      root_id_hex: string;
      activates_at_block: number;
      governance_action_hex: string;
    }
  | {
      kind: "revoke_vendor_root";
      vendor: TeeVendor;
      root_id_hex: string;
      deactivates_at_block: number;
      governance_action_hex: string | null;
    }
  | {
      kind: "update_vendor_cap_profile";
      vendor: TeeVendor;
      cap_multiplier: string;
      composition_eligibility: boolean;
      activates_at_block: number;
      governance_action_hex: string;
    }
  | ({ kind: string } & Record<string, unknown>);

export interface ListVendorRootsResponse {
  vendor: TeeVendor | null;
  roots: VendorRootRecord[];
  pending_governance_actions: PendingVendorGovernanceAction[];
  tee_attestation_enabled: boolean;
  scaffold: boolean;
}

export interface VendorCapProfileResponse {
  vendor: TeeVendor;
  cap_multiplier: string;
  composition_eligibility: boolean;
  tee_attestation_enabled: boolean;
  scaffold: boolean;
}

// Mandate read surface (RFC 005 / 006 / 007 / 047). Open string state types
// match the wire shape; constraints / objectives use the stable chain
// discriminators so UI callers can render cells exhaustively.
export type MandateState =
  | "draft"
  | "active"
  | "breached"
  | "suspended"
  | "expired"
  | "revoked"
  | (string & {});

export interface MandateConformance {
  score: number;
  last_evaluated_at_ms: number;
  pending_objectives: number;
  latest_delta?: number | null;
}

export type MandateConstraint =
  | { kind: "max_notional_per_market"; market: number; limit_usdc: string }
  | { kind: "max_notional_total"; limit_usdc: string }
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
      window_ms: number;
    }
  | { kind: "max_daily_loss_usdc"; limit_usdc: string }
  | { kind: "no_position_held_longer_than"; duration_ms: number }
  | { kind: "max_trade_size_usdc"; limit_usdc: string }
  | { kind: "max_trade_rate_per_minute"; count: number }
  | { kind: "no_same_operator_counterparty" }
  | { kind: "allowed_counterparties"; accounts: number[] };

export type MandateObjective =
  | { kind: "target_sharpe"; min: number; over_ms: number }
  | { kind: "target_return_pct"; min_bps: number; over_ms: number }
  | { kind: "max_drawdown_pct"; max_bps: number; over_ms: number }
  | { kind: "min_trade_count"; count: number; over_ms: number }
  | { kind: "max_trade_count"; count: number; over_ms: number }
  | { kind: "max_slippage_bps"; limit: number }
  | {
      kind: "max_funding_paid_pct_of_equity";
      pct_bps: number;
      over_ms: number;
    };

export interface MandateRecord {
  mandate_id_hex: string;
  owner_hex: string;
  agent: number;
  version: number;
  state: MandateState;
  constraints: MandateConstraint[];
  objectives: MandateObjective[];
  objective_weights: number[];
  conformance_window_ms: number;
  policies: number[];
  session_keys_hex: string[];
  activated_at: number | null;
  expires_at: number | null;
  description_uri: string | null;
  description_hash_hex: string | null;
  conformance: MandateConformance;
}

export interface ListMandatesParams {
  agent?: number;
  ownerHex?: string;
  state?: MandateState;
  limit?: number;
}

export interface TypedStreamHandlers<TName extends string = string> {
  onOpen?: () => void;
  onEvent?: (name: TName, payload: Record<string, unknown>) => void;
  onCursor?: (cursor: EventCursor) => void;
  onError?: (event: Event) => void;
}

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

function attestationClaimToWire(claim: AttestationClaim): Record<string, unknown> {
  switch (claim.kind) {
    case "runs_code_hash": {
      const wire: Record<string, unknown> = {
        kind: "runs_code_hash",
        code_hash_hex: claim.codeHashHex
      };
      if (claim.modelHashHex !== undefined) wire.model_hash_hex = claim.modelHashHex;
      return wire;
    }
    case "bound_to_mandate":
      return {
        kind: "bound_to_mandate",
        mandate_id_hex: claim.mandateIdHex
      };
    case "runs_code_and_bound_to_mandate": {
      const wire: Record<string, unknown> = {
        kind: "runs_code_and_bound_to_mandate",
        code_hash_hex: claim.codeHashHex,
        mandate_id_hex: claim.mandateIdHex
      };
      if (claim.modelHashHex !== undefined) wire.model_hash_hex = claim.modelHashHex;
      return wire;
    }
  }
}

function identityActionToWire(action: IdentityAction): Record<string, unknown> {
  switch (action.kind) {
    case "register": {
      const wire: Record<string, unknown> = {
        kind: "register",
        account: action.account,
        display_name: action.displayName,
        description: action.description
      };
      if (action.agentKind !== undefined) wire.agent_kind = action.agentKind;
      if (action.operator !== undefined) wire.operator = action.operator;
      if (action.contactUri !== undefined) wire.contact_uri = action.contactUri;
      return wire;
    }
    case "update_descriptive":
      return {
        kind: "update_descriptive",
        account: action.account,
        update: action.update
      };
    case "register_operator_attestation":
      return {
        kind: "register_operator_attestation",
        attestor: action.attestor,
        subject: action.subject,
        claim: attestationClaimToWire(action.claim),
        expires_at_timestamp_ms: action.expiresAtTimestampMs
      };
    case "refresh_operator_attestation":
      return {
        kind: "refresh_operator_attestation",
        attestor: action.attestor,
        record_id_hex: action.recordIdHex,
        new_expires_at_timestamp_ms: action.newExpiresAtTimestampMs
      };
    case "revoke_attestation":
      return {
        kind: "revoke_attestation",
        revoker: action.revoker,
        record_id_hex: action.recordIdHex
      };
    case "delete":
      return {
        kind: "delete",
        account: action.account
      };
  }
}

function signedIdentityActionToWire(
  signedAction: SignedIdentityAction
): Record<string, unknown> {
  return {
    chain_id: signedAction.chainId,
    account: signedAction.account,
    nonce: signedAction.nonce,
    action: identityActionToWire(signedAction.action),
    signature_hex: signedAction.signatureHex
  };
}

function teeAttestationActionToWire(
  action: TeeAttestationAction
): Record<string, unknown> {
  switch (action.kind) {
    case "register_tee_attestation":
      return {
        kind: "register_tee_attestation",
        attestor: action.attestor,
        subject: action.subject,
        claim: attestationClaimToWire(action.claim),
        expires_at_timestamp_ms: action.expiresAtTimestampMs,
        quote_hex: action.quoteHex,
        nonce_hex: action.nonceHex,
        freshness_anchor_block: action.freshnessAnchorBlock,
        vendor: action.vendor
      };
    case "refresh_tee_attestation":
      return {
        kind: "refresh_tee_attestation",
        attestor: action.attestor,
        record_id_hex: action.recordIdHex,
        new_expires_at_timestamp_ms: action.newExpiresAtTimestampMs,
        quote_hex: action.quoteHex,
        nonce_hex: action.nonceHex,
        freshness_anchor_block: action.freshnessAnchorBlock
      };
  }
}

function teeAttestationSignersToWire(
  signers: TeeAttestationSigners
): Record<string, unknown> {
  switch (signers.kind) {
    case "self_attest":
      return {
        kind: "self_attest",
        attestor_nonce: signers.attestorNonce,
        attestor_signature_hex: signers.attestorSignatureHex
      };
    case "operator_attest":
      return {
        kind: "operator_attest",
        attestor_nonce: signers.attestorNonce,
        attestor_signature_hex: signers.attestorSignatureHex,
        subject_nonce: signers.subjectNonce,
        subject_signature_hex: signers.subjectSignatureHex
      };
  }
}

function signedTeeAttestationActionToWire(
  signedAction: SignedTeeAttestationAction
): Record<string, unknown> {
  return {
    chain_id: signedAction.chainId,
    action: teeAttestationActionToWire(signedAction.action),
    signers: teeAttestationSignersToWire(signedAction.signers)
  };
}

function realCapitalGovernanceActionToWire(
  action: RealCapitalGovernanceAction
): Record<string, unknown> {
  switch (action.kind) {
    case "upsert_listing": {
      const body: Record<string, unknown> = {
        kind: "upsert_listing",
        vault_id_hex: action.vaultIdHex,
        delegation_id_hex: action.delegationIdHex,
        serving_agent: action.servingAgent,
        mode: action.mode,
        tier0_pilot_exception: action.tier0PilotException ?? false,
        deposit_enabled: action.depositEnabled,
        listed_for_discovery: action.listedForDiscovery,
        per_principal_micro_usdc: action.perPrincipalMicroUsdc,
        total_vault_tvl_micro_usdc: action.totalVaultTvlMicroUsdc
      };
      if (action.pilotMinServingAgentTier !== undefined) {
        body.pilot_min_serving_agent_tier = action.pilotMinServingAgentTier;
      }
      if (action.pilotPrincipalAllowlist !== undefined) {
        body.pilot_principal_allowlist = action.pilotPrincipalAllowlist;
      }
      return body;
    }
    case "set_listing_deposit_enabled":
      return {
        kind: "set_listing_deposit_enabled",
        vault_id_hex: action.vaultIdHex,
        deposit_enabled: action.depositEnabled
      };
    case "set_listing_discovery":
      return {
        kind: "set_listing_discovery",
        vault_id_hex: action.vaultIdHex,
        listed_for_discovery: action.listedForDiscovery
      };
    case "update_protocol_cap": {
      return {
        kind: "update_protocol_cap",
        total_protocol_tvl_micro_usdc: action.totalProtocolTvlMicroUsdc
      };
    }
    case "update_global_kill_switch":
      return {
        kind: "update_global_kill_switch",
        disabled: action.disabled
      };
  }
}

export class AndChainRpcError extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "AndChainRpcError";
    this.code = code;
    this.data = data;
  }
}

export class AndChainBrowserClient {
  private readonly defaultHeaders: HeadersInit;

  constructor(
    private readonly baseUrl: string,
    options: { defaultHeaders?: HeadersInit; bearerToken?: string; marketDataUrl?: string } = {}
  ) {
    this.defaultHeaders = {
      ...(options.defaultHeaders ?? {}),
      ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {})
    };
    this.marketDataUrl = options.marketDataUrl ?? `${this.baseUrl.replace(/\/$/, "")}/market-data`;
  }

  private readonly marketDataUrl: string;

  chainInfo() {
    return this.call<ChainInfoResponse>("kombat_chainInfo");
  }

  createAccount(
    accountId: number,
    ownerHex: string,
    codeHashHex: string,
    timestampMs: number,
    evmAddressHex?: string
  ) {
    return this.call<AccountResponse>("kombat_createAccount", {
      account_id: accountId,
      owner_hex: ownerHex,
      code_hash_hex: codeHashHex,
      timestamp_ms: timestampMs,
      evm_address_hex: evmAddressHex
    });
  }

  getAccountByEvmAddress(addressHex: string) {
    return this.call<AccountResponse | null>("kombat_getAccountByEvmAddress", {
      address_hex: addressHex
    });
  }

  faucetFundAccount(params: {
    addressHex: string;
    policyUsdc?: string;
    evmUsdc?: string;
    waitTimeoutMs?: number;
  }) {
    return this.call<FaucetFundAccountResponse>("kombat_faucetFundAccount", {
      address_hex: params.addressHex,
      policy_usdc: params.policyUsdc,
      evm_usdc: params.evmUsdc,
      wait_timeout_ms: params.waitTimeoutMs
    });
  }

  getWalletBalances(addressHex: string) {
    return this.call<WalletBalancesResponse>("kombat_getWalletBalances", {
      address_hex: addressHex
    });
  }

  getPolicy(policyId: number) {
    return this.call<PolicyResponse>("kombat_getPolicy", {
      policy_id: policyId
    });
  }

  async nextIntentNonce(policyId: number) {
    const policy = await this.getPolicy(policyId);
    return policy.next_intent_nonce;
  }

  submitOwnerCall(signedOwnerCall: Record<string, unknown>, timestampMs: number) {
    return this.call<SubmitOwnerCallResponse>("kombat_submitOwnerCall", {
      signed_owner_call: signedOwnerCall,
      timestamp_ms: timestampMs
    });
  }

  submitEvmOwnerCall(signedOwnerCall: Record<string, unknown>, timestampMs: number) {
    return this.call<SubmitOwnerCallResponse>("kombat_submitEvmOwnerCall", {
      signed_owner_call: signedOwnerCall,
      timestamp_ms: timestampMs
    });
  }

  /// Owner-scoped mandate-action nonce. RFC 044 verification requires
  /// `signed_mandate_action.nonce` to equal `mandate_action_nonce(owner)`
  /// at submission time. Browser flows call this just before signing.
  async getMandateActionNonce(ownerHex: string): Promise<number> {
    const result = await this.call<{ owner_hex: string; nonce: number }>(
      "kombat_getMandateActionNonce",
      { owner_hex: ownerHex }
    );
    return result.nonce;
  }

  submitEvmMandateAction(
    signedMandateAction: SignedEvmMandateActionJson,
    timestampMs: number
  ) {
    return this.call<MandateRecord>("kombat_submitEvmMandateAction", {
      signed_mandate_action: signedMandateAction,
      timestamp_ms: timestampMs
    });
  }

  submitEvmDelegationAction(
    signedDelegationAction: SignedEvmDelegationActionJson,
    waitTimeoutMs?: number
  ) {
    return this.call<DelegationActionSubmissionResponse>(
      "kombat_submitEvmDelegationAction",
      {
        signed_delegation_action: signedDelegationAction,
        wait_timeout_ms: waitTimeoutMs
      }
    );
  }

  getDelegationActionStatus(actionIdHex: string) {
    return this.call<DelegationActionStatusResponse>(
      "kombat_getDelegationActionStatus",
      { action_id_hex: actionIdHex }
    );
  }

  defineMarketMakerProgram(params: DefineMarketMakerProgramParams) {
    return this.call<MarketMakerProgramActionSubmissionResponse>(
      "kombat_defineMarketMakerProgram",
      params
    );
  }

  enrollMarketMakerProgram(params: EnrollMarketMakerProgramParams) {
    return this.call<MarketMakerProgramActionSubmissionResponse>(
      "kombat_enrollMarketMakerProgram",
      params
    );
  }

  submitSignedMarketMakerProgramAction(
    signedMarketMakerProgramAction: SignedMarketMakerProgramActionJson,
    waitTimeoutMs?: number
  ) {
    return this.call<MarketMakerProgramActionSubmissionResponse>(
      "kombat_submitSignedMarketMakerProgramAction",
      {
        signed_market_maker_program_action: signedMarketMakerProgramAction,
        wait_timeout_ms: waitTimeoutMs
      }
    );
  }

  getMarketMakerProgramActionStatus(actionIdHex: string) {
    return this.call<MarketMakerProgramActionStatusResponse>(
      "kombat_getMarketMakerProgramActionStatus",
      { action_id_hex: actionIdHex }
    );
  }

  getMarketMakerProgram(programIdHex: string) {
    return this.call<MarketMakerProgramResponse | null>(
      "kombat_getMarketMakerProgram",
      { program_id_hex: programIdHex }
    );
  }

  getMarketMakerEnrollment(
    marketMaker: number,
    marketId: number,
    programIdHex: string
  ) {
    return this.call<MarketMakerEnrollmentResponse | null>(
      "kombat_getMarketMakerEnrollment",
      {
        market_maker: marketMaker,
        market_id: marketId,
        program_id_hex: programIdHex
      }
    );
  }

  getMarketMakerEnrollmentByIdentity(
    marketMakerIdentity: MarketMakerIdentityParams,
    marketId: number,
    programIdHex: string
  ) {
    return this.call<MarketMakerEnrollmentResponse | null>(
      "kombat_getMarketMakerEnrollment",
      {
        market_maker_identity: marketMakerIdentity,
        market_id: marketId,
        program_id_hex: programIdHex
      }
    );
  }

  submitIntent(signedIntent: Record<string, unknown>, timestampMs: number) {
    return this.call<SubmitIntentResponse>("kombat_submitIntent", {
      signed_intent: signedIntent,
      timestamp_ms: timestampMs
    });
  }

  previewIntent(
    order: TradingOrderRequest,
    params: { replaceClientOrderId?: number; timestampMs?: number } = {}
  ) {
    return this.call<PreviewIntentResponse>("kombat_previewIntent", {
      order,
      replace_client_order_id: params.replaceClientOrderId,
      timestamp_ms: params.timestampMs
    });
  }

  getIntentStatus(intentIdHex: string) {
    return this.call<IntentStatusResponse>("kombat_getIntentStatus", {
      intent_id_hex: intentIdHex
    });
  }

  listPerpetualMarkets(params: { status?: MarketStatus; limit?: number } = {}) {
    return this.call<PerpetualMarketResponse[]>("kombat_listPerpetualMarkets", {
      status: params.status,
      limit: params.limit
    });
  }

  getMarketState(marketId: number) {
    return this.call<MarketStateResponse>("kombat_getMarketState", {
      market_id: marketId
    });
  }

  getOrderBook(marketId: number, depth: number) {
    return this.call<OrderBookResponse>("kombat_getOrderBook", {
      market_id: marketId,
      depth
    });
  }

  getCandles(params: {
    marketId: number;
    interval: "1m" | "5m" | "15m" | "1h" | "1d";
    from: number;
    to: number;
    limit?: number;
  }) {
    return this.call<CandleResponse[]>("kombat_getCandles", {
      market_id: params.marketId,
      interval: params.interval,
      from: params.from,
      to: params.to,
      limit: params.limit
    });
  }

  async getMarketDataCandles(params: {
    marketId: number;
    interval: "1m" | "5m" | "15m" | "1h" | "1d";
    from: number;
    to: number;
    limit?: number;
  }) {
    const url = new URL(`${this.marketDataUrl.replace(/\/$/, "")}/candles`, "http://localhost");
    url.searchParams.set("market_id", String(params.marketId));
    url.searchParams.set("interval", params.interval);
    url.searchParams.set("from_ms", String(params.from));
    url.searchParams.set("to_ms", String(params.to));
    if (params.limit != null) url.searchParams.set("limit", String(params.limit));
    const requestUrl = /^https?:\/\//i.test(this.marketDataUrl) ? url.toString() : `${url.pathname}${url.search}`;
    const response = await fetch(requestUrl, { headers: this.defaultHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as CandleResponse[];
  }

  getMarketSnapshot(marketId: number, params: { depth?: number } = {}) {
    return this.call<MarketSnapshotResponse>("kombat_getMarketSnapshot", {
      market_id: marketId,
      depth: params.depth
    });
  }

  getAccountTradingState(accountId: number, params: { marketId?: number; depth?: number; fillLimit?: number } = {}) {
    return this.call<AccountTradingStateResponse>("kombat_getAccountTradingState", {
      account_id: accountId,
      market_id: params.marketId,
      depth: params.depth,
      fill_limit: params.fillLimit
    });
  }

  getAccountPnlWindow(accountId: number, params: { fromMs: number; toMs?: number; marketId?: number }) {
    return this.call<AccountPnlWindowResponse>("kombat_getAccountPnlWindow", {
      account_id: accountId,
      from_ms: params.fromMs,
      to_ms: params.toMs,
      market_id: params.marketId
    });
  }

  getAccountEquityHistory(accountId: number, params: { fromMs: number; toMs: number; limit?: number }) {
    return this.call<AccountEquityHistoryResponse>("kombat_getAccountEquityHistory", {
      account_id: accountId,
      from_ms: params.fromMs,
      to_ms: params.toMs,
      limit: params.limit
    });
  }

  getMandateConformanceHistory(mandateIdHex: string, params: { limit?: number } = {}) {
    return this.call<MandateConformanceHistoryResponse>("kombat_getMandateConformanceHistory", {
      mandate_id_hex: mandateIdHex,
      limit: params.limit
    });
  }

  getOpenOrders(marketId: number, accountId: number, limit: number) {
    return this.call<RestingOrderResponse[]>("kombat_getOpenOrders", {
      market_id: marketId,
      account_id: accountId,
      limit
    });
  }

  listPositions(accountId: number, params: { includeFlat?: boolean; limit?: number } = {}) {
    return this.call<PositionResponse[]>("kombat_listPositions", {
      account_id: accountId,
      include_flat: params.includeFlat,
      limit: params.limit
    });
  }

  listEvents(params: ListEventsParams = {}) {
    return this.call<EventPageResponse>("kombat_listEvents", {
      from_seq: params.fromSeq,
      before_seq: params.beforeSeq,
      limit: params.limit,
      descending: params.descending,
      filter: params.filter
    });
  }

  // RFC 043 — Vaults Discovery Surface.

  listVaults(params: ListVaultsParams = {}) {
    const body: Record<string, unknown> = {};
    if (params.kind !== undefined) body.kind = params.kind;
    if (params.status !== undefined) body.status = params.status;
    if (params.operator !== undefined) body.operator = params.operator;
    if (params.currencies !== undefined) body.currencies = params.currencies;
    if (params.includeUnlisted) body.include_unlisted = true;
    if (params.cursor !== undefined) body.cursor = params.cursor;
    if (params.limit !== undefined) body.limit = params.limit;
    return this.call<ListVaultsResponse>("kombat_listVaults", body);
  }

  getVault(vaultIdHex: string) {
    return this.call<GetVaultResponse>("kombat_getVault", {
      vault_id_hex: vaultIdHex
    });
  }

  // RFC 049 — Vault Real-Capital Readiness Gate.

  listRedemptionRequests(params: ListRedemptionRequestsParams) {
    const body: Record<string, unknown> = { principal: params.principal };
    if (params.vaultIdHex !== undefined) body.vault_id_hex = params.vaultIdHex;
    if (params.status !== undefined) body.status = params.status;
    if (params.cursor !== undefined) body.cursor = params.cursor;
    if (params.limit !== undefined) body.limit = params.limit;
    return this.call<ListRedemptionRequestsResponse>(
      "kombat_listRedemptionRequests",
      body
    );
  }

  listVaultPositions(params: ListVaultPositionsParams) {
    const body: Record<string, unknown> = { principal: params.principal };
    if (params.kind !== undefined) body.kind = params.kind;
    if (params.status !== undefined) body.status = params.status;
    if (params.cursor !== undefined) body.cursor = params.cursor;
    if (params.limit !== undefined) body.limit = params.limit;
    return this.call<ListVaultPositionsResponse>(
      "kombat_listVaultPositions",
      body
    );
  }

  listRealCapitalListings(params: ListRealCapitalListingsParams = {}) {
    const body: Record<string, unknown> = {};
    if (params.agent !== undefined) body.agent = params.agent;
    if (params.mode !== undefined) body.mode = params.mode;
    if (params.includeUnlisted) body.include_unlisted = true;
    if (params.includeDisabled) body.include_disabled = true;
    if (params.cursor !== undefined) body.cursor = params.cursor;
    if (params.limit !== undefined) body.limit = params.limit;
    return this.call<ListRealCapitalListingsResponse>(
      "kombat_listRealCapitalListings",
      body
    );
  }

  getRealCapitalListing(vaultIdHex: string) {
    return this.call<GetRealCapitalListingResponse>(
      "kombat_getRealCapitalListing",
      { vault_id_hex: vaultIdHex }
    );
  }

  submitRealCapitalGovernanceAction(
    params: SubmitRealCapitalGovernanceActionParams
  ) {
    return this.call<SubmitRealCapitalGovernanceActionResponse>(
      "kombat_submitRealCapitalGovernanceAction",
      {
        action: realCapitalGovernanceActionToWire(params.action),
        timestamp_ms: params.timestampMs
      }
    );
  }

  getRealCapitalGovernanceActionStatus(actionIdHex: string) {
    return this.call<RealCapitalGovernanceActionStatusResponse>(
      "kombat_getRealCapitalGovernanceActionStatus",
      { action_id_hex: actionIdHex }
    );
  }

  // RFC 050 / 051 — Identity tiers and TEE attestation reads.

  getAgentIdentity(account: number) {
    return this.call<AgentIdentityResponse>("kombat_getAgentIdentity", {
      account
    });
  }

  listAttestations(params: ListAttestationsParams) {
    const body: Record<string, unknown> = { account: params.account };
    if (params.kind !== undefined) body.kind = params.kind;
    if (params.includeRevoked !== undefined) body.include_revoked = params.includeRevoked;
    if (params.includeExpired !== undefined) body.include_expired = params.includeExpired;
    if (params.cursor !== undefined) body.cursor = params.cursor;
    if (params.limit !== undefined) body.limit = params.limit;
    return this.call<ListAttestationsResponse>("kombat_listAttestations", body);
  }

  getCompositionAccess(account: number) {
    return this.call<CompositionAccessResponse>("kombat_getCompositionAccess", {
      account
    });
  }

  getReputationMultiplier(account: number) {
    return this.call<ReputationMultiplierResponse>("kombat_getReputationMultiplier", {
      account
    });
  }

  getIdentityActionNonce(account: number) {
    return this.call<IdentityActionNonceResponse>("kombat_getIdentityActionNonce", {
      account
    });
  }

  getIdentityAttestorNonce(account: number) {
    return this.call<IdentityActionNonceResponse>("kombat_getIdentityAttestorNonce", {
      account
    });
  }

  submitIdentityAction(params: SubmitIdentityActionParams) {
    return this.call<AgentIdentityResponse>("kombat_submitIdentityAction", {
      signed_identity_action: signedIdentityActionToWire(params.signedIdentityAction),
      timestamp_ms: params.timestampMs
    });
  }

  submitTeeAttestation(params: SubmitTeeAttestationParams) {
    return this.call<AgentIdentityResponse>("kombat_submitTeeAttestation", {
      signed_tee_attestation_action: signedTeeAttestationActionToWire(
        params.signedTeeAttestationAction
      ),
      timestamp_ms: params.timestampMs
    });
  }

  listVendorRoots(params: ListVendorRootsParams = {}) {
    const body: Record<string, unknown> = {};
    if (params.vendor !== undefined) body.vendor = params.vendor;
    if (params.includeInactive !== undefined) body.include_inactive = params.includeInactive;
    return this.call<ListVendorRootsResponse>("kombat_listVendorRoots", body);
  }

  getVendorCapProfile(vendor: TeeVendor) {
    return this.call<VendorCapProfileResponse>("kombat_getVendorCapProfile", {
      vendor
    });
  }

  // Mandate reads.

  listMandates(params: ListMandatesParams = {}) {
    const body: Record<string, unknown> = {};
    if (params.agent !== undefined) body.agent = params.agent;
    if (params.ownerHex !== undefined) body.owner_hex = params.ownerHex;
    if (params.state !== undefined) body.state = params.state;
    if (params.limit !== undefined) body.limit = params.limit;
    return this.call<MandateRecord[]>("kombat_listMandates", body);
  }

  getMandate(mandateIdHex: string) {
    return this.call<MandateRecord | null>("kombat_getMandate", {
      mandate_id_hex: mandateIdHex
    });
  }

  buildEventStreamUrl(query: EventStreamQuery = {}) {
    const baseUrl = this.baseUrl.replace(/\/$/, "");
    const url = new URL(`${baseUrl}/events`, "http://localhost");
    if (query.fromSeq != null) url.searchParams.set("from_seq", String(query.fromSeq));
    if (query.limit != null) url.searchParams.set("limit", String(query.limit));
    if (query.account_id != null) url.searchParams.set("account_id", String(query.account_id));
    if (query.market_id != null) url.searchParams.set("market_id", String(query.market_id));
    if (query.policy_id != null) url.searchParams.set("policy_id", String(query.policy_id));
    if (query.intent_id_hex != null) url.searchParams.set("intent_id_hex", query.intent_id_hex);
    if (query.client_order_id != null) url.searchParams.set("client_order_id", String(query.client_order_id));
    if (query.topic != null) url.searchParams.set("topic", query.topic);
    if (query.follow != null) url.searchParams.set("follow", String(query.follow));
    if (query.timeoutMs != null) url.searchParams.set("timeout_ms", String(query.timeoutMs));
    return /^https?:\/\//i.test(baseUrl) ? url.toString() : `${url.pathname}${url.search}`;
  }

  buildMarketStreamUrl(query: MarketStreamQuery) {
    const baseUrl = this.baseUrl.replace(/\/$/, "");
    const url = new URL(`${baseUrl}/market-data/markets/stream`, "http://localhost");
    url.searchParams.set("market_id", String(query.marketId));
    if (query.fromSeq != null) url.searchParams.set("from_seq", String(query.fromSeq));
    if (query.depth != null) url.searchParams.set("depth", String(query.depth));
    if (query.limit != null) url.searchParams.set("limit", String(query.limit));
    if (query.follow != null) url.searchParams.set("follow", String(query.follow));
    if (query.timeoutMs != null) url.searchParams.set("timeout_ms", String(query.timeoutMs));
    return /^https?:\/\//i.test(baseUrl) ? url.toString() : `${url.pathname}${url.search}`;
  }

  buildAccountStreamUrl(query: AccountStreamQuery) {
    const baseUrl = this.baseUrl.replace(/\/$/, "");
    const url = new URL(`${baseUrl}/market-data/accounts/stream`, "http://localhost");
    url.searchParams.set("account_id", String(query.accountId));
    if (query.marketId != null) url.searchParams.set("market_id", String(query.marketId));
    if (query.fromSeq != null) url.searchParams.set("from_seq", String(query.fromSeq));
    if (query.depth != null) url.searchParams.set("depth", String(query.depth));
    if (query.limit != null) url.searchParams.set("limit", String(query.limit));
    if (query.follow != null) url.searchParams.set("follow", String(query.follow));
    if (query.timeoutMs != null) url.searchParams.set("timeout_ms", String(query.timeoutMs));
    return /^https?:\/\//i.test(baseUrl) ? url.toString() : `${url.pathname}${url.search}`;
  }

  buildWalletStreamUrl(query: WalletStreamQuery) {
    const baseUrl = this.baseUrl.replace(/\/$/, "");
    const url = new URL(`${baseUrl}/market-data/wallets/stream`, "http://localhost");
    url.searchParams.set("address_hex", query.addressHex);
    if (query.fromSeq != null) url.searchParams.set("from_seq", String(query.fromSeq));
    if (query.limit != null) url.searchParams.set("limit", String(query.limit));
    if (query.follow != null) url.searchParams.set("follow", String(query.follow));
    if (query.timeoutMs != null) url.searchParams.set("timeout_ms", String(query.timeoutMs));
    return /^https?:\/\//i.test(baseUrl) ? url.toString() : `${url.pathname}${url.search}`;
  }

  openEventStream(handlers: EventStreamHandlers, query: EventStreamQuery = {}) {
    const source = new EventSource(this.buildEventStreamUrl(query));
    source.addEventListener("open", () => handlers.onOpen?.());
    source.addEventListener("cursor", (event) => {
      if (!(event instanceof MessageEvent)) return;
      handlers.onCursor?.(JSON.parse(event.data) as EventCursor);
    });
    source.addEventListener("error", (event) => handlers.onError?.(event));

    const topics = [
      "account_created",
      "account_updated",
      "intent_accepted",
      "intent_promoted",
      "intent_executed",
      "intent_expired",
      "intent_rejected",
      "order_accepted",
      "order_filled",
      "fee_charged",
      "fee_revenue_distributed",
      "market_listed",
      "market_status_updated",
      "market_trading_state_updated",
      "oracle_config_updated",
      "position_updated",
      "mark_price_updated",
      "index_price_updated",
      "funding_index_updated",
      "funding_applied",
      "collateral_deposited",
      "collateral_withdrawn",
      "risk_state_updated",
      "liquidation_candidate_updated",
      "insurance_fund_updated",
      "bad_debt_updated",
      "bad_debt_recovered",
      "solvency_breached",
      "liquidation_executed",
      "liquidation_outcome",
      "liquidation_escalation_updated",
      "order_replaced",
      "order_cancelled",
      "mandate_conformance_evaluated",
      "market_maker_program_defined",
      "market_maker_program_retired",
      "market_maker_program_action_rejected",
      "market_maker_enrolled",
      "market_maker_enrollment_exited",
      "mm_program_bonus_paid",
      "mm_program_bonus_forfeited",
      "market_maker_enrollment_grace_entered",
      "market_maker_enrollment_recovered",
      "market_maker_enrollment_non_compliant",
      "policy_created",
      "policy_revoked"
    ];

    for (const topic of topics) {
      source.addEventListener(topic, (event) => {
        if (!(event instanceof MessageEvent)) return;
        handlers.onEvent?.(JSON.parse(event.data) as RuntimeEventRecord);
      });
    }

    return source;
  }

  openMarketStream(query: MarketStreamQuery, handlers: TypedStreamHandlers<MarketStreamEventName> = {}) {
    return this.openTypedSseStream(
      this.buildMarketStreamUrl(query),
      ["market_snapshot", "mark_price", "index_price", "funding", "trade", "book", "open_interest"],
      handlers
    );
  }

  openAccountStream(query: AccountStreamQuery, handlers: TypedStreamHandlers<AccountStreamEventName> = {}) {
    return this.openTypedSseStream(
      this.buildAccountStreamUrl(query),
      ["account_trading_state", "position", "order", "fill", "collateral", "risk"],
      handlers
    );
  }

  openWalletStream(query: WalletStreamQuery, handlers: TypedStreamHandlers<WalletStreamEventName> = {}) {
    return this.openTypedSseStream(this.buildWalletStreamUrl(query), ["wallet_balances"], handlers);
  }

  private async call<T>(method: string, params?: unknown): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.defaultHeaders
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params: params ?? {}
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if ("error" in payload) {
      throw new AndChainRpcError(payload.error.code, payload.error.message, payload.error.data);
    }
    return payload.result;
  }

  private openTypedSseStream<TName extends string>(
    url: string,
    eventNames: readonly TName[],
    handlers: TypedStreamHandlers<TName>
  ) {
    const source = new EventSource(url);
    source.addEventListener("open", () => handlers.onOpen?.());
    source.addEventListener("cursor", (event) => {
      if (!(event instanceof MessageEvent)) return;
      handlers.onCursor?.(JSON.parse(event.data) as EventCursor);
    });
    source.addEventListener("error", (event) => handlers.onError?.(event));
    for (const name of eventNames) {
      source.addEventListener(name, (event) => {
        if (!(event instanceof MessageEvent)) return;
        handlers.onEvent?.(name, JSON.parse(event.data) as Record<string, unknown>);
      });
    }
    return source;
  }
}
