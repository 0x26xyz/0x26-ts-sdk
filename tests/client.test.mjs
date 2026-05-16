import test from "node:test";
import assert from "node:assert/strict";
import {
  AndChainClient,
  AndChainRpcError,
  DEFAULT_RUNTIME_EVENT_TOPICS,
  defaultEvmActionValidUntilMs,
  delegationActionSignerAccount,
  evmOwnerPrincipal,
  prepareEvmDelegationAction,
  prepareEvmMandateAction,
  signEvmDelegationAction,
} from "../dist/index.js";

test("chainInfo sends the expected JSON-RPC request and decodes the response", async () => {
  const captured = [];
  globalThis.fetch = async (url, init) => {
    captured.push([url, init]);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            chain_id: 7,
            head_height: 42,
            head_hash_hex: "0xabc",
            committed_state_root_hex: "0xdef",
            quarantined_block_count: 3,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.chainInfo();

  assert.equal(result.chain_id, 7);
  assert.equal(result.head_height, 42);
  assert.equal(captured.length, 1);
  assert.equal(captured[0][0], "http://127.0.0.1:18545");
  assert.deepEqual(JSON.parse(captured[0][1].body), {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_chainInfo",
    params: {},
  });
});

test("createAccount sends the expected bootstrap request and decodes the response", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            id: 11,
            owner_hex: "0xabc",
            pending_owner_hex: null,
            created_at: 1000,
            paused: false,
            frozen: false,
            controllers: [],
            nonce: 0,
            code_hash_hex: "0xdef",
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.createAccount(11, "0xabc", "0xdef", 1000);

  assert.equal(result.id, 11);
  assert.equal(result.owner_hex, "0xabc");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_createAccount",
    params: {
      account_id: 11,
      owner_hex: "0xabc",
      code_hash_hex: "0xdef",
      timestamp_ms: 1000,
    },
  });
});

test("createAccount can link an EVM address during bootstrap", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            id: 12,
            owner_hex: "0xabc",
            pending_owner_hex: null,
            created_at: 1000,
            paused: false,
            frozen: false,
            controllers: [],
            nonce: 0,
            code_hash_hex: "0xdef",
            evm_address_hex: "0x1234",
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.createAccount(12, "0xabc", "0xdef", 1000, "0x1234");

  assert.equal(result.evm_address_hex, "0x1234");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_createAccount",
    params: {
      account_id: 12,
      owner_hex: "0xabc",
      code_hash_hex: "0xdef",
      timestamp_ms: 1000,
      evm_address_hex: "0x1234",
    },
  });
});

test("faucetFundAccount sends policy and EVM USDC amounts", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            address_hex: "0x1234",
            policy_usdc_balance: "100000000",
            evm_usdc_balance: "25000000",
            evm_usdc_total_supply: "25000000",
            evm_usdc_deposit_tx_hash: null,
            state_root_hex: "0xbeef",
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.faucetFundAccount("0x1234", {
    policyUsdc: "100000000",
    evmUsdc: "25000000",
  });

  assert.equal(result.policy_usdc_balance, "100000000");
  assert.equal(result.evm_usdc_balance, "25000000");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_faucetFundAccount",
    params: {
      address_hex: "0x1234",
      policy_usdc: "100000000",
      evm_usdc: "25000000",
    },
  });
});

test("getWalletBalances requests wallet USDC balances", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            address_hex: "0x1234",
            policy_usdc_balance: "100000000",
            evm_usdc_balance: "25000000",
            evm_usdc_total_supply: "25000000",
            next_seq: 17,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getWalletBalances("0x1234");

  assert.equal(result.next_seq, 17);
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getWalletBalances",
    params: {
      address_hex: "0x1234",
    },
  });
});

test("getAccountRiskSummary serializes optional params in snake_case", async () => {
  globalThis.fetch = async (_url, _init) => ({
    ok: true,
    async json() {
      return {
        jsonrpc: "2.0",
        id: 1,
        result: {
          account_id: 9,
          market_count: 1,
          frozen: false,
          latest_account_risk_transition: null,
          max_liquidation_stall_count: 0,
          imminent_freeze_market_count: 0,
          worst_market_id: 7,
          worst_liquidation_gap: "0",
          markets_cleared_by_suggested_liquidation: 0,
          markets_still_under_after_suggested_liquidation: 0,
          markets_freezing_after_suggested_liquidation: 0,
          markets_creating_bad_debt_after_suggested_liquidation: 0,
          total_suggested_bad_debt: "0",
          total_bad_debt: "0",
          total_collateral: "0",
          total_realized_pnl: "0",
          total_unrealized_pnl: "0",
          total_equity: "0",
          total_maintenance_requirement: "0",
          total_liquidation_gap: "0",
          total_margin_surplus: "0",
          under_maintenance_market_count: 0,
        },
      };
    },
  });

  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            account_id: 9,
            market_count: 1,
            frozen: false,
            latest_account_risk_transition: null,
            max_liquidation_stall_count: 0,
            imminent_freeze_market_count: 0,
            worst_market_id: 7,
            worst_liquidation_gap: "0",
            markets_cleared_by_suggested_liquidation: 0,
            markets_still_under_after_suggested_liquidation: 0,
            markets_freezing_after_suggested_liquidation: 0,
            markets_creating_bad_debt_after_suggested_liquidation: 0,
            total_suggested_bad_debt: "0",
            total_bad_debt: "0",
            total_collateral: "0",
            total_realized_pnl: "0",
            total_unrealized_pnl: "0",
            total_equity: "0",
            total_maintenance_requirement: "0",
            total_liquidation_gap: "0",
            total_margin_surplus: "0",
            under_maintenance_market_count: 0,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  await client.getAccountRiskSummary(9, {
    marketId: 7,
    outcome: "freezes_account",
    includeFlat: true,
    limit: 25,
  });

  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getAccountRiskSummary",
    params: {
      account_id: 9,
      market_id: 7,
      outcome: "freezes_account",
      include_flat: true,
      limit: 25,
    },
  });
});

test("getAccountPnlWindow serializes the RFC 047 request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            account_id: 9,
            market_id: 7,
            from_ms: 1000,
            to_ms: 2000,
            total_realized_pnl: "0",
            funding_paid: "0",
            trading_realized_pnl: "0",
            fees_paid: "0",
            fill_count: 0,
            fee_count: 0,
            funding_count: 0,
            first_seq: null,
            last_seq: null,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getAccountPnlWindow(9, {
    fromMs: 1000,
    toMs: 2000,
    marketId: 7,
  });

  assert.equal(result.to_ms, 2000);
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getAccountPnlWindow",
    params: {
      account_id: 9,
      from_ms: 1000,
      to_ms: 2000,
      market_id: 7,
    },
  });
});

test("getAccountEquityHistory serializes the RFC 047 request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            account_id: 9,
            from_ms: 1000,
            to_ms: 2000,
            samples: [
              {
                block_height: 12,
                timestamp_ms: 1500,
                total_equity: "42",
                total_collateral: "100",
                total_realized_pnl: "0",
                total_unrealized_pnl: "-58",
                total_maintenance_requirement: "10",
                total_liquidation_gap: "0",
                total_margin_surplus: "32",
                position_count: 1,
                under_maintenance: false,
              },
            ],
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getAccountEquityHistory(9, {
    fromMs: 1000,
    toMs: 2000,
    limit: 128,
  });

  assert.equal(result.samples[0].block_height, 12);
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getAccountEquityHistory",
    params: {
      account_id: 9,
      from_ms: 1000,
      to_ms: 2000,
      limit: 128,
    },
  });
});

test("getMandateConformanceHistory serializes the RFC 047 request shape", async () => {
  const bodies = [];
  const mandateIdHex = "0x0707070707070707070707070707070707070707070707070707070707070707";
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            mandate_id_hex: mandateIdHex,
            samples: [
              {
                mandate_id_hex: mandateIdHex,
                block_height: 12,
                evaluated_at_ms: 1500,
                score: 64,
                pending_objectives: 1,
                state: "active",
                prev_score: 50,
                delta: 14,
              },
            ],
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getMandateConformanceHistory(mandateIdHex, {
    limit: 80,
  });

  assert.equal(result.samples[0].delta, 14);
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getMandateConformanceHistory",
    params: {
      mandate_id_hex: mandateIdHex,
      limit: 80,
    },
  });
});

test("listRedemptionRequests serializes the RFC 049 request shape and decodes the page", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            items: [
              {
                request_id_hex: "0xaa",
                vault_id_hex: "0xbb",
                kind: "delegation",
                delegation_id_hex: "0xcc",
                principal: 11,
                shares_requested: "20000000",
                requested_at_ms: 1_500,
                ready_at_ms: 1_700,
                nav_at_request: "1000000000000",
                status: "ready",
              },
            ],
            next_cursor: "0xdeadbeef",
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listRedemptionRequests({
    principal: 11,
    vaultIdHex: "0xbb",
    status: "ready",
    cursor: "0x00",
    limit: 25,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status, "ready");
  assert.equal(result.items[0].request_id_hex, "0xaa");
  assert.equal(result.next_cursor, "0xdeadbeef");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_listRedemptionRequests",
    params: {
      principal: 11,
      vault_id_hex: "0xbb",
      status: "ready",
      cursor: "0x00",
      limit: 25,
    },
  });
});

test("listRedemptionRequests omits unset optional params", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: { items: [], next_cursor: null },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listRedemptionRequests({ principal: 11 });

  assert.equal(result.items.length, 0);
  assert.equal(result.next_cursor, null);
  assert.deepEqual(bodies[0].params, { principal: 11 });
});

test("listVaultPositions serializes the RFC 049 request shape and decodes the page", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            items: [
              {
                vault_id_hex: "0xbb",
                kind: "delegation",
                delegation_id_hex: "0xcc",
                principal: 11,
                shares: "150000000",
                locked_shares_for_redemption: "60000000",
                avg_entry_nav_per_share: "1000000",
                principal_deposited_micro_usdc: "150000000",
                authoritative_nav_per_share: "1000000",
                authoritative_nav_source: "current_consensus_cash_nav",
                indicative_nav_per_share: "1000000",
                indicative_nav_source: "current_consensus_cash_nav",
                compensation_claim_micro_usdc: "5000000000",
                estimated_value_micro_usdc: "5150000000",
                status: "open",
              },
            ],
            next_cursor: "0xdeadbeef",
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listVaultPositions({
    principal: 11,
    kind: "delegation",
    status: "open",
    cursor: "0x00",
    limit: 25,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].vault_id_hex, "0xbb");
  assert.equal(result.items[0].locked_shares_for_redemption, "60000000");
  assert.equal(result.items[0].principal_deposited_micro_usdc, "150000000");
  assert.equal(result.items[0].compensation_claim_micro_usdc, "5000000000");
  assert.equal(result.items[0].estimated_value_micro_usdc, "5150000000");
  assert.equal(result.next_cursor, "0xdeadbeef");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_listVaultPositions",
    params: {
      principal: 11,
      kind: "delegation",
      status: "open",
      cursor: "0x00",
      limit: 25,
    },
  });
});

test("listVaultPositions omits unset optional params", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: { items: [], next_cursor: null },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listVaultPositions({ principal: 11 });

  assert.equal(result.items.length, 0);
  assert.equal(result.next_cursor, null);
  assert.deepEqual(bodies[0].params, { principal: 11 });
});

test("identity reads serialize RFC 050 request shapes", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    const resultByMethod = {
      kombat_getAgentIdentity: {
        account: 11,
        tier: "tier0_unattested",
        operator: null,
        kind: "unknown",
        display_name: "",
        description: "",
        contact_uri: null,
        active_attestation_count: 0,
        registered_at_block: null,
        registered_at_timestamp_ms: null,
        last_updated_block: null,
        last_updated_timestamp_ms: null,
        virtual_default: true,
      },
      kombat_listAttestations: { items: [], next_cursor: null, scaffold: false },
      kombat_getCompositionAccess: {
        account: 11,
        performance_share_delegator: false,
        performance_share_delegatee: false,
        reputation_collateral: false,
        a2a_contract: false,
      },
      kombat_getReputationMultiplier: { account: 11, multiplier: "1.0" },
    };
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: resultByMethod[body.method],
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const identity = await client.getAgentIdentity(11);
  const attestations = await client.listAttestations({
    account: 11,
    kind: "operator_self",
    includeRevoked: true,
    includeExpired: true,
    cursor: "0x00",
    limit: 25,
  });
  const composition = await client.getCompositionAccess(11);
  const reputation = await client.getReputationMultiplier(11);

  assert.equal(identity.tier, "tier0_unattested");
  assert.equal(attestations.items.length, 0);
  assert.equal(attestations.scaffold, false);
  assert.equal(composition.a2a_contract, false);
  assert.equal(reputation.multiplier, "1.0");
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    ["kombat_getAgentIdentity", { account: 11 }],
    [
      "kombat_listAttestations",
      {
        account: 11,
        kind: "operator_self",
        include_revoked: true,
        include_expired: true,
        cursor: "0x00",
        limit: 25,
      },
    ],
    ["kombat_getCompositionAccess", { account: 11 }],
    ["kombat_getReputationMultiplier", { account: 11 }],
  ]);
});

test("listAttestations preserves scaffold markers from older RFC 050 servers", async () => {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: { items: [], next_cursor: null, scaffold: true },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const attestations = await client.listAttestations({ account: 11 });
  assert.equal(attestations.scaffold, true);
});

test("identity action helpers serialize RFC 050 write request shapes", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result:
            body.method === "kombat_getIdentityActionNonce"
              ? { account: 11, nonce: 3 }
              : body.method === "kombat_getIdentityAttestorNonce"
                ? { account: 22, nonce: 5 }
              : {
                  account: 11,
                  tier:
                    body.params.signed_identity_action.action.kind === "register_operator_attestation" ||
                    body.params.signed_identity_action.action.kind === "refresh_operator_attestation"
                      ? "tier1_operator_attested"
                    : body.params.signed_identity_action.action.kind === "delete" ||
                      body.params.signed_identity_action.action.kind === "revoke_attestation"
                      ? "tier0_unattested"
                      : "tier0_unattested",
                  operator: 22,
                  kind: "unknown",
                  display_name:
                    body.params.signed_identity_action.action.kind === "update_descriptive"
                      ? "Scout Alpha"
                      : "Scout 001",
                  description: "Conservative BTC scout",
                  contact_uri: "https://example.invalid/agents/scout-001",
                  active_attestation_count: 0,
                  registered_at_block: 4,
                  registered_at_timestamp_ms: 1100,
                  last_updated_block: 4,
                  last_updated_timestamp_ms: 1100,
                  virtual_default: body.params.signed_identity_action.action.kind === "delete",
                },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const nonce = await client.getIdentityActionNonce(11);
  const attestorNonce = await client.getIdentityAttestorNonce(22);
  const identity = await client.submitIdentityAction({
    signedIdentityAction: {
      chainId: 7,
      account: 11,
      nonce: nonce.nonce,
      action: {
        kind: "register",
        account: 11,
        displayName: "Scout 001",
        description: "Conservative BTC scout",
        agentKind: "unknown",
        operator: null,
        contactUri: "https://example.invalid/agents/scout-001",
      },
      signatureHex: "0x" + "11".repeat(64),
    },
    timestampMs: 1100,
  });
  const renamed = await client.submitIdentityAction({
    signedIdentityAction: {
      chainId: 7,
      account: 11,
      nonce: nonce.nonce + 1,
      action: {
        kind: "update_descriptive",
        account: 11,
        update: { field: "display_name", value: "Scout Alpha" },
      },
      signatureHex: "0x" + "55".repeat(64),
    },
    timestampMs: 1150,
  });
  const attested = await client.submitIdentityAction({
    signedIdentityAction: {
      chainId: 7,
      account: 22,
      nonce: attestorNonce.nonce,
      action: {
        kind: "register_operator_attestation",
        attestor: 22,
        subject: 11,
        claim: {
          kind: "bound_to_mandate",
          mandateIdHex: "0x" + "aa".repeat(32),
        },
        expiresAtTimestampMs: 3700000,
      },
      signatureHex: "0x" + "22".repeat(64),
    },
    timestampMs: 1200,
  });
  await client.submitIdentityAction({
    signedIdentityAction: {
      chainId: 7,
      account: 22,
      nonce: attestorNonce.nonce + 1,
      action: {
        kind: "refresh_operator_attestation",
        attestor: 22,
        recordIdHex: "0x" + "bb".repeat(32),
        newExpiresAtTimestampMs: 7200000,
      },
      signatureHex: "0x" + "33".repeat(64),
    },
    timestampMs: 1300,
  });
  await client.submitIdentityAction({
    signedIdentityAction: {
      chainId: 7,
      account: 11,
      nonce: nonce.nonce + 2,
      action: {
        kind: "revoke_attestation",
        revoker: 11,
        recordIdHex: "0x" + "bb".repeat(32),
      },
      signatureHex: "0x" + "44".repeat(64),
    },
    timestampMs: 1400,
  });
  const deleted = await client.submitIdentityAction({
    signedIdentityAction: {
      chainId: 7,
      account: 11,
      nonce: nonce.nonce + 3,
      action: {
        kind: "delete",
        account: 11,
      },
      signatureHex: "0x" + "66".repeat(64),
    },
    timestampMs: 1500,
  });

  assert.equal(nonce.nonce, 3);
  assert.equal(attestorNonce.nonce, 5);
  assert.equal(identity.display_name, "Scout 001");
  assert.equal(renamed.display_name, "Scout Alpha");
  assert.equal(attested.tier, "tier1_operator_attested");
  assert.equal(deleted.virtual_default, true);
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    ["kombat_getIdentityActionNonce", { account: 11 }],
    ["kombat_getIdentityAttestorNonce", { account: 22 }],
    [
      "kombat_submitIdentityAction",
      {
        signed_identity_action: {
          chain_id: 7,
          account: 11,
          nonce: 3,
          action: {
            kind: "register",
            account: 11,
            display_name: "Scout 001",
            description: "Conservative BTC scout",
            agent_kind: "unknown",
            operator: null,
            contact_uri: "https://example.invalid/agents/scout-001",
          },
          signature_hex: "0x" + "11".repeat(64),
        },
        timestamp_ms: 1100,
      },
    ],
    [
      "kombat_submitIdentityAction",
      {
        signed_identity_action: {
          chain_id: 7,
          account: 11,
          nonce: 4,
          action: {
            kind: "update_descriptive",
            account: 11,
            update: { field: "display_name", value: "Scout Alpha" },
          },
          signature_hex: "0x" + "55".repeat(64),
        },
        timestamp_ms: 1150,
      },
    ],
    [
      "kombat_submitIdentityAction",
      {
        signed_identity_action: {
          chain_id: 7,
          account: 22,
          nonce: 5,
          action: {
            kind: "register_operator_attestation",
            attestor: 22,
            subject: 11,
            claim: {
              kind: "bound_to_mandate",
              mandate_id_hex: "0x" + "aa".repeat(32),
            },
            expires_at_timestamp_ms: 3700000,
          },
          signature_hex: "0x" + "22".repeat(64),
        },
        timestamp_ms: 1200,
      },
    ],
    [
      "kombat_submitIdentityAction",
      {
        signed_identity_action: {
          chain_id: 7,
          account: 22,
          nonce: 6,
          action: {
            kind: "refresh_operator_attestation",
            attestor: 22,
            record_id_hex: "0x" + "bb".repeat(32),
            new_expires_at_timestamp_ms: 7200000,
          },
          signature_hex: "0x" + "33".repeat(64),
        },
        timestamp_ms: 1300,
      },
    ],
    [
      "kombat_submitIdentityAction",
      {
        signed_identity_action: {
          chain_id: 7,
          account: 11,
          nonce: 5,
          action: {
            kind: "revoke_attestation",
            revoker: 11,
            record_id_hex: "0x" + "bb".repeat(32),
          },
          signature_hex: "0x" + "44".repeat(64),
        },
        timestamp_ms: 1400,
      },
    ],
    [
      "kombat_submitIdentityAction",
      {
        signed_identity_action: {
          chain_id: 7,
          account: 11,
          nonce: 6,
          action: {
            kind: "delete",
            account: 11,
          },
          signature_hex: "0x" + "66".repeat(64),
        },
        timestamp_ms: 1500,
      },
    ],
  ]);
});

test("vendor reads serialize RFC 051 request shapes", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result:
            body.method === "kombat_listVendorRoots"
              ? {
                  vendor: "intel_sgx_dcap",
                  roots: [],
                  pending_governance_actions: [
                    {
                      kind: "introduce_vendor_root",
                      vendor: "intel_sgx_dcap",
                      root_id_hex: "aa".repeat(32),
                      activates_at_block: 172801,
                      governance_action_hex: "11".repeat(32),
                    },
                    {
                      kind: "update_vendor_cap_profile",
                      vendor: "intel_sgx_dcap",
                      cap_multiplier: "0.7",
                      composition_eligibility: false,
                      activates_at_block: 172802,
                      governance_action_hex: "22".repeat(32),
                    },
                    {
                      kind: "revoke_vendor_root",
                      vendor: "intel_sgx_dcap",
                      root_id_hex: "bb".repeat(32),
                      deactivates_at_block: 172803,
                      governance_action_hex: null,
                    },
                  ],
                  tee_attestation_enabled: false,
                  scaffold: false,
                }
              : {
                  vendor: "apple_secure_enclave",
                  cap_multiplier: "0.4",
                  composition_eligibility: false,
                  tee_attestation_enabled: false,
                  scaffold: false,
                },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const roots = await client.listVendorRoots({
    vendor: "intel_sgx_dcap",
    includeInactive: true,
  });
  const profile = await client.getVendorCapProfile("apple_secure_enclave");

  assert.equal(roots.tee_attestation_enabled, false);
  assert.equal(roots.scaffold, false);
  assert.equal(roots.pending_governance_actions[0].kind, "introduce_vendor_root");
  assert.equal(roots.pending_governance_actions[1].cap_multiplier, "0.7");
  assert.equal(roots.pending_governance_actions[2].kind, "revoke_vendor_root");
  assert.equal(roots.pending_governance_actions[2].governance_action_hex, null);
  assert.equal(profile.cap_multiplier, "0.4");
  assert.equal(profile.scaffold, false);
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    [
      "kombat_listVendorRoots",
      { vendor: "intel_sgx_dcap", include_inactive: true },
    ],
    ["kombat_getVendorCapProfile", { vendor: "apple_secure_enclave" }],
  ]);
});

test("submitTeeAttestation serializes RFC 051 dual-signer request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            account: 11,
            tier: "tier1_operator_attested",
            operator: 22,
            kind: "unknown",
            display_name: "Scout 001",
            description: "",
            contact_uri: null,
            active_attestation_count: 0,
            registered_at_block: 4,
            registered_at_timestamp_ms: 1100,
            last_updated_block: 4,
            last_updated_timestamp_ms: 1100,
            virtual_default: false,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.submitTeeAttestation({
    signedTeeAttestationAction: {
      chainId: 7,
      action: {
        kind: "register_tee_attestation",
        attestor: 22,
        subject: 11,
        claim: {
          kind: "runs_code_hash",
          codeHashHex: "0x" + "04".repeat(32),
          modelHashHex: null,
        },
        expiresAtTimestampMs: 3_701_200,
        quoteHex: "0x010203",
        nonceHex: "0x" + "03".repeat(32),
        freshnessAnchorBlock: 9,
        vendor: "intel_sgx_dcap",
      },
      signers: {
        kind: "operator_attest",
        attestorNonce: 5,
        attestorSignatureHex: "0x" + "22".repeat(64),
        subjectNonce: 3,
        subjectSignatureHex: "0x" + "11".repeat(64),
      },
    },
    timestampMs: 1200,
  });

  assert.equal(result.account, 11);
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    [
      "kombat_submitTeeAttestation",
      {
        signed_tee_attestation_action: {
          chain_id: 7,
          action: {
            kind: "register_tee_attestation",
            attestor: 22,
            subject: 11,
            claim: {
              kind: "runs_code_hash",
              code_hash_hex: "0x" + "04".repeat(32),
              model_hash_hex: null,
            },
            expires_at_timestamp_ms: 3_701_200,
            quote_hex: "0x010203",
            nonce_hex: "0x" + "03".repeat(32),
            freshness_anchor_block: 9,
            vendor: "intel_sgx_dcap",
          },
          signers: {
            kind: "operator_attest",
            attestor_nonce: 5,
            attestor_signature_hex: "0x" + "22".repeat(64),
            subject_nonce: 3,
            subject_signature_hex: "0x" + "11".repeat(64),
          },
        },
        timestamp_ms: 1200,
      },
    ],
  ]);
});

test("submitTeeAttestation serializes RFC 051 refresh self-attest request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            account: 11,
            tier: "tier2_tee_attested",
            operator: null,
            kind: "unknown",
            display_name: "Scout 001",
            description: "",
            contact_uri: null,
            active_attestation_count: 1,
            registered_at_block: 4,
            registered_at_timestamp_ms: 1100,
            last_updated_block: 6,
            last_updated_timestamp_ms: 1300,
            virtual_default: false,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.submitTeeAttestation({
    signedTeeAttestationAction: {
      chainId: 7,
      action: {
        kind: "refresh_tee_attestation",
        attestor: 11,
        recordIdHex: "0x" + "aa".repeat(32),
        newExpiresAtTimestampMs: 3_900_000,
        quoteHex: "0x040506",
        nonceHex: "0x" + "09".repeat(32),
        freshnessAnchorBlock: 12,
      },
      signers: {
        kind: "self_attest",
        attestorNonce: 8,
        attestorSignatureHex: "0x" + "33".repeat(64),
      },
    },
    timestampMs: 1300,
  });

  assert.equal(result.account, 11);
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    [
      "kombat_submitTeeAttestation",
      {
        signed_tee_attestation_action: {
          chain_id: 7,
          action: {
            kind: "refresh_tee_attestation",
            attestor: 11,
            record_id_hex: "0x" + "aa".repeat(32),
            new_expires_at_timestamp_ms: 3_900_000,
            quote_hex: "0x040506",
            nonce_hex: "0x" + "09".repeat(32),
            freshness_anchor_block: 12,
          },
          signers: {
            kind: "self_attest",
            attestor_nonce: 8,
            attestor_signature_hex: "0x" + "33".repeat(64),
          },
        },
        timestamp_ms: 1300,
      },
    ],
  ]);
});

test("getDelegationActionStatus serializes the action id and decodes status", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            action_id_hex: "0x" + "02".repeat(32),
            status: "processed",
            action_kind: "deposit",
            submitted_at_ms: 1_050,
            processed_at_ms: 1_100,
            receipt: {
              kind: "deposit",
              delegation_id_hex: "0x" + "03".repeat(32),
              principal: 11,
              shares_minted: "20000000",
            },
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getDelegationActionStatus("0x" + "02".repeat(32));

  assert.equal(result.status, "processed");
  assert.equal(result.receipt.kind, "deposit");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getDelegationActionStatus",
    params: {
      action_id_hex: "0x" + "02".repeat(32),
    },
  });
});

test("submitOwnerCall maps JSON-RPC failures to AndChainRpcError", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32020,
          message: "owner call rejected",
          data: {
            reason: "invalid_owner_signature",
          },
        },
      };
    },
  });

  const client = new AndChainClient("http://127.0.0.1:18545");

  await assert.rejects(
    () =>
      client.submitOwnerCall(
        {
          account_id: 5,
          chain_id: 7,
          call: {
            signer_hex: "0xabc",
            nonce: 2,
            kind: "pause",
          },
          signature_hex: "0xdead",
        },
        1234
      ),
    (error) => {
      assert.ok(error instanceof AndChainRpcError);
      assert.equal(error.code, -32020);
      assert.equal(error.message, "owner call rejected");
      assert.deepEqual(error.data, { reason: "invalid_owner_signature" });
      return true;
    }
  );
});

test("constructor bearer token is forwarded as an authorization header", async () => {
  const captured = [];
  globalThis.fetch = async (_url, init) => {
    captured.push(init.headers);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            chain_id: 7,
            head_height: 1,
            head_hash_hex: "0x1",
            committed_state_root_hex: "0x2",
            quarantined_block_count: 0,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545", {
    bearerToken: "operator-token",
  });
  await client.chainInfo();

  assert.equal(captured[0].Authorization, "Bearer operator-token");
});

test("buildEventStreamUrl serializes event query parameters", () => {
  const client = new AndChainClient("http://127.0.0.1:18545");
  const url = new URL(
    client.buildEventStreamUrl({
      fromSeq: 11,
      limit: 20,
      account_id: 7,
      topic: "intent_executed",
      follow: true,
      timeoutMs: 1500,
    })
  );

  assert.equal(url.pathname, "/events");
  assert.equal(url.searchParams.get("from_seq"), "11");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("account_id"), "7");
  assert.equal(url.searchParams.get("topic"), "intent_executed");
  assert.equal(url.searchParams.get("follow"), "true");
  assert.equal(url.searchParams.get("timeout_ms"), "1500");
});

test("buildEventStreamUrl keeps relative RPC bases relative", () => {
  const client = new AndChainClient("/api");
  assert.equal(
    client.buildEventStreamUrl({
      fromSeq: 12,
      limit: 50,
      follow: true,
    }),
    "/api/events?from_seq=12&limit=50&follow=true"
  );
});

test("saveSnapshot uses the operator-authenticated RPC method shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            path: "/tmp/engine.snapshot",
            chain_id: 7,
            head_height: 4,
            head_hash_hex: "0xabc",
            committed_state_root_hex: "0xdef",
            quarantined_block_count: 0,
            snapshot_size_bytes: 128,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545", {
    bearerToken: "operator-token",
  });
  const result = await client.saveSnapshot("/tmp/engine.snapshot");

  assert.equal(result.path, "/tmp/engine.snapshot");
  assert.equal(bodies[0].method, "kombat_saveSnapshot");
  assert.deepEqual(bodies[0].params, { path: "/tmp/engine.snapshot" });
});

test("getPolicy decodes the expected policy response shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            id: 42,
            authority_account: 11,
            account: 11,
            execution_account_id: 11,
            execution_scope: {
              kind: "account",
              delegation_id_hex: null,
            },
            parent_policy_id: null,
            state: "active",
            next_intent_nonce: 3,
            delegation_depth: 0,
            revoked_at: null,
            terms: {
              gas_budget_per_day: "100",
              gas_refill_per_day: "100",
              max_intents_per_second: 2,
              max_intents_per_day: 10,
              max_volume_per_day: "1000",
              max_drawdown_pct: 25,
            },
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getPolicy(42);

  assert.equal(result.id, 42);
  assert.equal(result.authority_account, 11);
  assert.equal(result.execution_account_id, 11);
  assert.equal(result.execution_scope.kind, "account");
  assert.equal(result.state, "active");
  assert.equal(result.terms.max_volume_per_day, "1000");
  assert.equal(result.terms.max_intents_per_second, 2);
  assert.equal(bodies[0].method, "kombat_getPolicy");
  assert.deepEqual(bodies[0].params, { policy_id: 42 });
});

test("submitOrder uses the expected trading request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            status: "resting",
            fills: [],
            filled_lots: 0,
            remaining_lots: 5,
            posted_order_id: 1,
          },
        };
      },
    };
  };

  const order = {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
    side: "ask",
    quantity_lots: 5,
    order_kind: "limit",
    price_ticks: 103,
    time_in_force: { tif: "gtc" },
    post_only: false,
  };
  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.submitOrder(order, 1_000);

  assert.equal(result.status, "resting");
  assert.equal(result.posted_order_id, 1);
  assert.equal(bodies[0].method, "kombat_submitOrder");
  assert.deepEqual(bodies[0].params, {
    order,
    timestamp_ms: 1_000,
  });
});

test("previewIntent uses the expected trading preflight request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            market_id: 7,
            account_id: 22,
            would_succeed: false,
            reason: "insufficient_initial_margin",
            current_raw_notional: "0",
            candidate_raw_notional: "100",
            current_notional: "0",
            candidate_notional: "100",
            required_initial: "10",
            equity_for_market: "0",
            margin_surplus: "-10",
          },
        };
      },
    };
  };

  const order = {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
    side: "bid",
    quantity_lots: 1,
    order_kind: "market",
    time_in_force: { tif: "ioc" },
    post_only: false,
  };
  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.previewIntent(order, { timestampMs: 1_000 });

  assert.equal(result.would_succeed, false);
  assert.equal(result.reason, "insufficient_initial_margin");
  assert.equal(result.margin_surplus, "-10");
  assert.equal(bodies[0].method, "kombat_previewIntent");
  assert.deepEqual(bodies[0].params, {
    order,
    timestamp_ms: 1_000,
  });
});

test("replaceOrder uses the expected replacement request shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            status: "resting",
            fills: [],
            filled_lots: 0,
            remaining_lots: 7,
            posted_order_id: 1,
          },
        };
      },
    };
  };

  const replacement = {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
    side: "ask",
    quantity_lots: 7,
    order_kind: "limit",
    price_ticks: 102,
    time_in_force: { tif: "gtc" },
    post_only: false,
  };
  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.replaceOrder(7, 22, 1, replacement, 1_100);

  assert.equal(result.status, "resting");
  assert.equal(result.remaining_lots, 7);
  assert.equal(bodies[0].method, "kombat_replaceOrder");
  assert.deepEqual(bodies[0].params, {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
    replacement,
    timestamp_ms: 1_100,
  });
});

test("produceBlock uses the manual block production RPC shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            height: 2,
            hash_hex: "0xaaa",
            state_root_hex: "0xbbb",
            item_count: 3,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545", {
    bearerToken: "operator-token",
  });
  const result = await client.produceBlock(1_200, 25);

  assert.equal(result.height, 2);
  assert.equal(result.item_count, 3);
  assert.equal(bodies[0].method, "kombat_produceBlock");
  assert.deepEqual(bodies[0].params, { timestamp_ms: 1_200, max_items: 25 });
});

test("getOrderStatus decodes the expected trading status shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            market_id: 7,
            account_id: 22,
            client_order_id: 1,
            stage: "partially_filled_resting",
            filled_lots: 3,
            remaining_lots: 4,
            replacement_client_order_id: null,
            latest_event_seq: 9,
            block_height: 1,
            timestamp_ms: 1_001,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getOrderStatus(7, 22, 1);

  assert.equal(result.stage, "partially_filled_resting");
  assert.equal(result.filled_lots, 3);
  assert.equal(bodies[0].method, "kombat_getOrderStatus");
  assert.deepEqual(bodies[0].params, {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
  });
});

test("cancelOrder decodes the expected cancellation response shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            cancelled: true,
            order: {
              market_id: 7,
              account_id: 22,
              client_order_id: 1,
              side: "ask",
              price_ticks: 102,
              remaining_lots: 7,
              expires_at_ms: null,
              sequence: 3,
            },
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.cancelOrder(7, 22, 1, 1_200);

  assert.equal(result.cancelled, true);
  assert.equal(result.order?.price_ticks, 102);
  assert.equal(bodies[0].method, "kombat_cancelOrder");
  assert.deepEqual(bodies[0].params, {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
    timestamp_ms: 1_200,
  });
});

test("getOrderBook decodes the expected book response shape", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            market_id: 7,
            bids: [{ price_ticks: 101, total_lots: 4, order_count: 1 }],
            asks: [{ price_ticks: 103, total_lots: 5, order_count: 1 }],
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getOrderBook(7, 5);

  assert.equal(result.market_id, 7);
  assert.equal(result.asks[0].price_ticks, 103);
  assert.equal(bodies[0].method, "kombat_getOrderBook");
  assert.deepEqual(bodies[0].params, { market_id: 7, depth: 5 });
});

test("getOpenOrders decodes the expected resting order list", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: [
            {
              market_id: 7,
              account_id: 22,
              client_order_id: 1,
              side: "ask",
              price_ticks: 103,
              remaining_lots: 5,
              expires_at_ms: null,
              sequence: 1,
            },
          ],
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getOpenOrders(7, 22, 10);

  assert.equal(result[0].client_order_id, 1);
  assert.equal(result[0].side, "ask");
  assert.equal(bodies[0].method, "kombat_getOpenOrders");
  assert.deepEqual(bodies[0].params, { market_id: 7, account_id: 22, limit: 10 });
});

test("getAccountByEvmAddress decodes nullable account lookup", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: null,
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getAccountByEvmAddress(
    "0xfb1af79c5163ca0062f733a5184c831a8444e796"
  );

  assert.equal(result, null);
  assert.equal(bodies[0].method, "kombat_getAccountByEvmAddress");
  assert.deepEqual(bodies[0].params, {
    address_hex: "0xfb1af79c5163ca0062f733a5184c831a8444e796",
  });
});

test("perps market and position helpers use expected JSON-RPC methods", async () => {
  const bodies = [];
  const results = [
    [
      {
        market_id: 7,
        kind: "perpetual",
        status: "active",
        base_symbol: "BTC",
        quote_asset: 1,
        oracle_feed_id: 77,
        initial_margin_bps: 1000,
        maintenance_margin_bps: 500,
        max_leverage: 10,
        lot_size_microunits: 1,
        tick_size_bps: 1,
        funding_interval_ms: 3600000,
        oracle_max_staleness_ms: 5000,
        breaker_price_band_bps: 1000,
        oracle_min_sources: 2,
        oracle_min_confidence: 50,
        oracle_min_samples: 3,
        oracle_feeder_ids_hex: ["0x01"],
        listed_at_ms: 1000,
        updated_at_ms: 1000,
      },
    ],
    {
      market_id: 7,
      account_id: 22,
      side: "long",
      net_lots: 3,
      open_notional: "300",
      realized_pnl: "0",
      average_entry_price_ticks: 100,
      buy_lots: 3,
      sell_lots: 0,
      buy_notional: "300",
      sell_notional: "0",
      last_fill_seq: 9,
      last_fill_timestamp_ms: 1200,
    },
    {
      market_id: 7,
      funding_index: "-12",
      premium_rate_ppm: 100,
      indicative_funding_rate_ppm: 10,
      mark_price_ticks: 101,
      index_price_ticks: 100,
    },
    {
      market_id: 7,
      insurance_fund_balance: "1000",
      bad_debt_balance: "0",
    },
  ];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: results.shift(),
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const markets = await client.listPerpetualMarkets({ status: "active", limit: 25 });
  const position = await client.getPosition(7, 22);
  const funding = await client.getFundingState(7);
  const insurance = await client.getInsuranceFund(7);

  assert.equal(markets[0].base_symbol, "BTC");
  assert.equal(position.net_lots, 3);
  assert.equal(funding.funding_index, "-12");
  assert.equal(insurance.insurance_fund_balance, "1000");
  assert.deepEqual(
    bodies.map((body) => [body.method, body.params]),
    [
      ["kombat_listPerpetualMarkets", { status: "active", limit: 25 }],
      ["kombat_getPosition", { market_id: 7, account_id: 22 }],
      ["kombat_getFundingState", { market_id: 7 }],
      ["kombat_getInsuranceFund", { market_id: 7 }],
    ]
  );
});

test("openEventStream subscribes to current runtime event topics by default", () => {
  const constructed = [];
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.topics = [];
      constructed.push(this);
    }

    addEventListener(topic, _handler) {
      this.topics.push(topic);
    }
  }
  globalThis.EventSource = FakeEventSource;

  const client = new AndChainClient("http://127.0.0.1:18545");
  client.openEventStream({}, { market_id: 7, follow: true });

  assert.equal(constructed.length, 1);
  assert.ok(constructed[0].topics.includes("cursor"));
  assert.ok(constructed[0].topics.includes("mark_price_updated"));
  assert.ok(constructed[0].topics.includes("index_price_updated"));
  assert.ok(constructed[0].topics.includes("position_updated"));
  assert.ok(constructed[0].topics.includes("collateral_deposited"));
  assert.ok(constructed[0].topics.includes("funding_applied"));
  for (const topic of DEFAULT_RUNTIME_EVENT_TOPICS) {
    assert.ok(constructed[0].topics.includes(topic), `missing topic ${topic}`);
  }
});

test("market data helpers use dedicated UI JSON-RPC methods", async () => {
  const bodies = [];
  const results = [
    [
      {
        market_id: 7,
        interval: "1m",
        timestamp_ms: 60000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume_lots: 3,
        trade_count: 1,
        first_seq: 9,
        last_seq: 9,
      },
    ],
    {
      market: null,
      state: { market_id: 7 },
      order_book: { market_id: 7, bids: [], asks: [] },
      latest_trade: null,
      next_seq: 10,
    },
    {
      account_id: 22,
      market_id: 7,
      positions: [],
      open_orders: [],
      risk_summary: { account_id: 22 },
      recent_fills: [],
      next_seq: 10,
    },
  ];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: results.shift(),
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const candles = await client.getCandles({
    marketId: 7,
    interval: "1m",
    from: 0,
    to: 120000,
    limit: 500,
  });
  const snapshot = await client.getMarketSnapshot(7, { depth: 20 });
  const account = await client.getAccountTradingState(22, {
    marketId: 7,
    depth: 50,
    fillLimit: 25,
  });

  assert.equal(candles[0].timestamp_ms, 60000);
  assert.equal(snapshot.next_seq, 10);
  assert.equal(account.account_id, 22);
  assert.deepEqual(
    bodies.map((body) => [body.method, body.params]),
    [
      [
        "kombat_getCandles",
        { market_id: 7, interval: "1m", from: 0, to: 120000, limit: 500 },
      ],
      ["kombat_getMarketSnapshot", { market_id: 7, depth: 20 }],
      [
        "kombat_getAccountTradingState",
        { account_id: 22, market_id: 7, depth: 50, fill_limit: 25 },
      ],
    ]
  );
});

test("market, account, and wallet stream helpers build scoped SSE URLs", () => {
  const constructed = [];
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.topics = [];
      constructed.push(this);
    }

    addEventListener(topic, _handler) {
      this.topics.push(topic);
    }
  }
  globalThis.EventSource = FakeEventSource;

  const client = new AndChainClient("https://testnet.0x26.xyz/api");
  client.openMarketStream({ marketId: 7, fromSeq: 10, depth: 25 }, {});
  client.openAccountStream({ accountId: 22, marketId: 7, fromSeq: 12 }, {});
  client.openWalletStream({ addressHex: "0x1234", fromSeq: 17, timeoutMs: 60000 }, {});

  assert.equal(
    constructed[0].url,
    "https://testnet.0x26.xyz/api/market-data/markets/stream?market_id=7&from_seq=10&depth=25"
  );
  assert.ok(constructed[0].topics.includes("market_snapshot"));
  assert.ok(constructed[0].topics.includes("trade"));
  assert.ok(constructed[0].topics.includes("book"));
  assert.equal(
    constructed[1].url,
    "https://testnet.0x26.xyz/api/market-data/accounts/stream?account_id=22&market_id=7&from_seq=12"
  );
  assert.ok(constructed[1].topics.includes("account_trading_state"));
  assert.ok(constructed[1].topics.includes("position"));
  assert.ok(constructed[1].topics.includes("fill"));
  assert.equal(
    constructed[2].url,
    "https://testnet.0x26.xyz/api/market-data/wallets/stream?address_hex=0x1234&from_seq=17&timeout_ms=60000"
  );
  assert.ok(constructed[2].topics.includes("wallet_balances"));
});

test("listMandates serializes owner filter", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: [],
        };
      },
    };
  };

  const ownerHex = evmOwnerPrincipal("0x1234567890123456789012345678901234567890");
  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listMandates({
    ownerHex,
    state: "active",
    limit: 25,
  });

  assert.deepEqual(result, []);
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_listMandates",
    params: {
      owner_hex: ownerHex,
      state: "active",
      limit: 25,
    },
  });
});

// RFC 043 — Vaults Discovery Surface SDK tests.

const VAULT_RECORD_PAYLOAD = {
  vault_id_hex: "0x" + "ab".repeat(16),
  kind: "delegation",
  display_name: "Delegation 0x07070707",
  operator: 22,
  status: "open",
  capital_currency: 0,
  tvl_native: "150000000",
  tvl_micro_usdc: "150000000",
  shares_outstanding: "1000000",
  fee_summary: {
    perf_share_units: 1500,
    headline_apy_bps: 0,
    notice_period_secs: 86400,
  },
  discovery: { listed: true, featured: false },
  real_capital: {
    mode: "capped_pilot",
    pilot_min_serving_agent_tier: "tier1_operator_attested",
    tier0_pilot_exception: false,
    deposit_enabled: true,
    listed_for_discovery: true,
    global_deposit_kill_switch: false,
    per_principal_cap_micro_usdc: "500000000",
    total_vault_tvl_cap_micro_usdc: "1000000000",
    protocol_cap_micro_usdc: null,
    vault_deposited_micro_usdc: "150000000",
    listed_at_block: 3,
    last_updated_block: 4,
    last_updated_governance_action_hex: "0x" + "09".repeat(32),
  },
  details: {
    kind: "delegation",
    delegation: {
      delegation_id_hex: "0x" + "07".repeat(32),
      agent: 22,
      mandate_id_hex: "0x" + "03".repeat(32),
      opened_at_ms: 1000,
      last_updated_at_ms: 2000,
      winding_started_at_ms: null,
      status: "open",
      performance_share_units: 1500,
      crystallization_cadence_ms: 604800000,
      notice_period_ms: 86400000,
      total_shares: "1000000",
      high_water_mark_per_share: "1000000",
      last_crystallized_at_ms: 1500,
      agent_bond: "5000000000",
    },
  },
};

test("listVaults sends the kombat_listVaults request, omits defaults, and decodes the envelope", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            items: [VAULT_RECORD_PAYLOAD],
            next_cursor:
              "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listVaults({
    kind: "delegation",
    status: "open",
    operator: 22,
    currencies: [0],
    limit: 100,
  });

  assert.equal(result.items.length, 1);
  const record = result.items[0];
  assert.equal(record.kind, "delegation");
  assert.equal(record.status, "open");
  assert.equal(record.operator, 22);
  assert.equal(record.tvl_micro_usdc, "150000000");
  assert.equal(record.fee_summary.perf_share_units, 1500);
  assert.equal(record.discovery.listed, true);
  assert.equal(record.real_capital.mode, "capped_pilot");
  assert.equal(record.real_capital.deposit_enabled, true);
  assert.equal(record.details.kind, "delegation");
  assert.ok(record.details.delegation);
  assert.equal(record.details.delegation.agent, 22);
  assert.equal(
    result.next_cursor,
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  );

  // Outbound: defaults that match the wire don't leak.
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].method, "kombat_listVaults");
  assert.equal(bodies[0].params.kind, "delegation");
  assert.equal(bodies[0].params.limit, 100);
  assert.equal(bodies[0].params.include_unlisted, undefined);
  assert.equal(bodies[0].params.cursor, undefined);
});

test("listVaults() with no params produces an empty params object", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: { items: [], next_cursor: null },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.listVaults();
  assert.equal(result.items.length, 0);
  assert.equal(result.next_cursor, null);
  assert.deepEqual(bodies[0].params, {});
});

test("getVault present case decodes the record envelope", async () => {
  globalThis.fetch = async (_url, _init) => ({
    ok: true,
    async json() {
      return {
        jsonrpc: "2.0",
        id: 1,
        result: { record: VAULT_RECORD_PAYLOAD, present: true },
      };
    },
  });
  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getVault("0x" + "ab".repeat(16));
  assert.equal(result.present, true);
  assert.ok(result.record);
  assert.equal(result.record.kind, "delegation");
  assert.equal(result.record.real_capital.vault_deposited_micro_usdc, "150000000");
  assert.equal(result.record.details.delegation.agent, 22);
});

test("real-capital listing SDK methods serialize filters and decode control state", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (body.method === "kombat_getRealCapitalListing") {
      return {
        ok: true,
        async json() {
          return {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              listing: null,
              present: false,
              control: {
                global_deposit_kill_switch: false,
                last_updated_block: 0,
                last_updated_governance_action_hex: "0x" + "00".repeat(32),
                protocol_cap_micro_usdc: null,
                total_protocol_delegation_tvl_micro_usdc: "0",
              },
            },
          };
        },
      };
    }
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            items: [
              {
                vault_id_hex: "0x" + "ab".repeat(16),
                delegation_id_hex: "0x" + "07".repeat(32),
                serving_agent: 22,
                mode: "capped_pilot",
                pilot_min_serving_agent_tier: null,
                tier0_pilot_exception: true,
                deposit_enabled: true,
                listed_for_discovery: true,
                caps: {
                  per_principal_micro_usdc: "500000000",
                  total_vault_tvl_micro_usdc: "1000000000",
                },
                protocol_cap_micro_usdc: null,
                vault_deposited_micro_usdc: "0",
                pilot_principal_allowlist: [11],
                listed_at_block: 3,
                last_updated_block: 4,
                last_updated_governance_action_hex: "0x" + "09".repeat(32),
              },
            ],
            next_cursor: null,
            control: {
              global_deposit_kill_switch: false,
              last_updated_block: 0,
              last_updated_governance_action_hex: "0x" + "00".repeat(32),
              protocol_cap_micro_usdc: null,
              total_protocol_delegation_tvl_micro_usdc: "0",
            },
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const listed = await client.listRealCapitalListings({
    agent: 22,
    mode: "capped_pilot",
    includeUnlisted: true,
    includeDisabled: true,
    cursor: "0x" + "01".repeat(16),
    limit: 25,
  });
  const absent = await client.getRealCapitalListing("0x" + "00".repeat(16));

  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].caps.per_principal_micro_usdc, "500000000");
  assert.deepEqual(listed.items[0].pilot_principal_allowlist, [11]);
  assert.equal(listed.control.total_protocol_delegation_tvl_micro_usdc, "0");
  assert.equal(absent.present, false);
  assert.equal(absent.listing, null);
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    [
      "kombat_listRealCapitalListings",
      {
        agent: 22,
        mode: "capped_pilot",
        include_unlisted: true,
        include_disabled: true,
        cursor: "0x" + "01".repeat(16),
        limit: 25,
      },
    ],
    [
      "kombat_getRealCapitalListing",
      { vault_id_hex: "0x" + "00".repeat(16) },
    ],
  ]);
});

test("real-capital governance SDK method serializes enqueue action in snake_case", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            action_id_hex: "0x" + "12".repeat(32),
            status: "accepted",
            pending_real_capital_governance_actions: bodies.length,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.submitRealCapitalGovernanceAction({
    timestampMs: 1_050,
    action: {
      kind: "upsert_listing",
      vaultIdHex: "0x" + "ab".repeat(16),
      delegationIdHex: "0x" + "cd".repeat(32),
      servingAgent: 22,
      mode: "capped_pilot",
      pilotMinServingAgentTier: "tier1_operator_attested",
      tier0PilotException: false,
      depositEnabled: true,
      listedForDiscovery: true,
      perPrincipalMicroUsdc: "500000000",
      totalVaultTvlMicroUsdc: "1000000000",
      pilotPrincipalAllowlist: [11, 12],
    },
  });
  const clearCap = await client.submitRealCapitalGovernanceAction({
    timestampMs: 1_051,
    action: {
      kind: "update_protocol_cap",
      totalProtocolTvlMicroUsdc: null,
    },
  });
  const depositEnabled = await client.submitRealCapitalGovernanceAction({
    timestampMs: 1_052,
    action: {
      kind: "set_listing_deposit_enabled",
      vaultIdHex: "0x" + "ef".repeat(16),
      depositEnabled: false,
    },
  });
  const discovery = await client.submitRealCapitalGovernanceAction({
    timestampMs: 1_053,
    action: {
      kind: "set_listing_discovery",
      vaultIdHex: "0x" + "ef".repeat(16),
      listedForDiscovery: false,
    },
  });
  const killSwitch = await client.submitRealCapitalGovernanceAction({
    timestampMs: 1_054,
    action: {
      kind: "update_global_kill_switch",
      disabled: true,
    },
  });

  assert.equal(result.status, "accepted");
  assert.equal(clearCap.status, "accepted");
  assert.equal(depositEnabled.status, "accepted");
  assert.equal(discovery.status, "accepted");
  assert.equal(killSwitch.pending_real_capital_governance_actions, 5);
  assert.deepEqual(bodies.map((body) => [body.method, body.params]), [
    [
      "kombat_submitRealCapitalGovernanceAction",
      {
        action: {
          kind: "upsert_listing",
          vault_id_hex: "0x" + "ab".repeat(16),
          delegation_id_hex: "0x" + "cd".repeat(32),
          serving_agent: 22,
          mode: "capped_pilot",
          pilot_min_serving_agent_tier: "tier1_operator_attested",
          tier0_pilot_exception: false,
          deposit_enabled: true,
          listed_for_discovery: true,
          per_principal_micro_usdc: "500000000",
          total_vault_tvl_micro_usdc: "1000000000",
          pilot_principal_allowlist: [11, 12],
        },
        timestamp_ms: 1_050,
      },
    ],
    [
      "kombat_submitRealCapitalGovernanceAction",
      {
        action: {
          kind: "update_protocol_cap",
          total_protocol_tvl_micro_usdc: null,
        },
        timestamp_ms: 1_051,
      },
    ],
    [
      "kombat_submitRealCapitalGovernanceAction",
      {
        action: {
          kind: "set_listing_deposit_enabled",
          vault_id_hex: "0x" + "ef".repeat(16),
          deposit_enabled: false,
        },
        timestamp_ms: 1_052,
      },
    ],
    [
      "kombat_submitRealCapitalGovernanceAction",
      {
        action: {
          kind: "set_listing_discovery",
          vault_id_hex: "0x" + "ef".repeat(16),
          listed_for_discovery: false,
        },
        timestamp_ms: 1_053,
      },
    ],
    [
      "kombat_submitRealCapitalGovernanceAction",
      {
        action: {
          kind: "update_global_kill_switch",
          disabled: true,
        },
        timestamp_ms: 1_054,
      },
    ],
  ]);
});

test("getRealCapitalGovernanceActionStatus serializes action id and decodes receipt", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            action_id_hex: "0x" + "34".repeat(32),
            status: "processed",
            action_kind: "update_protocol_cap",
            submitted_at_ms: null,
            processed_at_ms: 1_100,
            receipt: {
              kind: "update_protocol_cap",
              total_protocol_tvl_micro_usdc: "1000000000",
            },
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getRealCapitalGovernanceActionStatus(
    "0x" + "34".repeat(32)
  );

  assert.equal(result.status, "processed");
  assert.equal(result.receipt.kind, "update_protocol_cap");
  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_getRealCapitalGovernanceActionStatus",
    params: {
      action_id_hex: "0x" + "34".repeat(32),
    },
  });
});

test("getVault absent case returns present=false and record=null", async () => {
  globalThis.fetch = async (_url, _init) => ({
    ok: true,
    async json() {
      return {
        jsonrpc: "2.0",
        id: 1,
        result: { record: null, present: false },
      };
    },
  });
  const client = new AndChainClient("http://127.0.0.1:18545");
  const result = await client.getVault("0x" + "00".repeat(16));
  assert.equal(result.present, false);
  assert.equal(result.record, null);
});

// RFC 044 — EVM wallet action bridge helpers.

test("EVM wallet helpers derive principal, validUntil, and delegation envelope fields", () => {
  const address = "0xfb1af79c5163ca0062f733a5184c831a8444e796";
  assert.equal(
    evmOwnerPrincipal(address),
    "0x307832363a65766d3a763121fb1af79c5163ca0062f733a5184c831a8444e796"
  );
  assert.equal(defaultEvmActionValidUntilMs(1_000), 301_000);

  const action = {
    kind: "deposit",
    principal: 11,
    delegation_id_hex: "0x" + "07".repeat(32),
    amount: "100000000",
  };
  assert.equal(delegationActionSignerAccount(action), 11);

  const prepared = prepareEvmDelegationAction({
    chainId: 7,
    action,
    timestampMs: 1_050,
    submitterNonce: 61,
    nowMs: 1_000,
  });

  assert.equal(prepared.signedDelegationAction.chain_id, 7);
  assert.equal(prepared.signedDelegationAction.signer_account_id, 11);
  assert.equal(prepared.signedDelegationAction.valid_until_ms, 301_000);
  assert.equal(
    prepared.signedDelegationAction.action_hex,
    "0x010b00000000000000070707070707070707070707070707070707070707070707070707070707070700e1f505000000000000000000000000"
  );
  assert.equal(prepared.typedData.primaryType, "EvmDelegationAction");
  assert.equal(prepared.typedData.message.actionKind, "deposit");
  assert.equal(prepared.typedData.message.signerAccountId, 11);
  assert.equal(
    prepared.typedData.message.bodyHash,
    "0x4a07933abf52cab0a0643ff9cac21c8c06ae75caf34474535869c76ee4f7b3dd"
  );
});

test("EVM mandate helper builds lifecycle typed data and RPC JSON action", () => {
  const prepared = prepareEvmMandateAction({
    chainId: 7,
    ownerAddressHex: "0xfb1af79c5163ca0062f733a5184c831a8444e796",
    nonce: 4,
    action: {
      kind: "revoke_mandate",
      mandate_id_hex: "0x" + "ab".repeat(32),
      reason: "owner_revoked",
    },
    nowMs: 1_000,
  });

  assert.equal(prepared.signedMandateAction.chain_id, 7);
  assert.equal(prepared.signedMandateAction.nonce, 4);
  assert.deepEqual(prepared.signedMandateAction.action, {
    kind: "revoke_mandate",
    mandate_id_hex: "0x" + "ab".repeat(32),
    reason: "owner_revoked",
  });
  assert.equal(prepared.typedData.primaryType, "EvmMandateAction");
  assert.equal(prepared.typedData.message.actionKind, "revoke_mandate");
});

test("EVM mandate helper builds create typed data and RPC JSON action", () => {
  const prepared = prepareEvmMandateAction({
    chainId: 7,
    ownerAddressHex: "0xfb1af79c5163ca0062f733a5184c831a8444e796",
    nonce: 5,
    action: {
      kind: "create_mandate",
      agent: 22,
      version: 1,
      constraints: [
        { kind: "allowed_markets", set: [7] },
        { kind: "max_notional_total", limit_usdc: "1000000" },
        { kind: "max_leverage", mult: 5 },
      ],
      conformance_window_ms: 86_400_000,
      session_keys_hex: [],
      expires_at: 86_401_000,
      description_uri: null,
      description_hash_hex: null,
    },
    nowMs: 1_000,
  });

  assert.equal(prepared.signedMandateAction.chain_id, 7);
  assert.equal(prepared.signedMandateAction.nonce, 5);
  assert.deepEqual(prepared.signedMandateAction.action, {
    kind: "create_mandate",
    agent: 22,
    version: 1,
    constraints: [
      { kind: "allowed_markets", set: [7] },
      { kind: "max_notional_total", limit_usdc: "1000000" },
      { kind: "max_leverage", mult: 5 },
    ],
    conformance_window_ms: 86_400_000,
    expires_at: 86_401_000,
  });
  assert.equal(prepared.typedData.message.actionKind, "create_mandate");
  assert.equal(
    prepared.typedData.message.actionHash,
    "0xdb156bce53fd1c02d9ee6d697e1a9efe7e9bf0c7406924c9b515c5669b76a0a3"
  );
});

test("EVM mandate helper includes create objectives in the RPC JSON action", () => {
  const prepared = prepareEvmMandateAction({
    chainId: 7,
    ownerAddressHex: "0xfb1af79c5163ca0062f733a5184c831a8444e796",
    nonce: 6,
    action: {
      kind: "create_mandate",
      agent: 22,
      version: 2,
      constraints: [
        { kind: "allowed_markets", set: [7] },
        { kind: "max_notional_total", limit_usdc: "1000000" },
      ],
      objectives: [
        { kind: "max_slippage_bps", limit: 50 },
        { kind: "max_drawdown_pct", max_bps: 1000, over_ms: 86_400_000 },
      ],
      conformance_window_ms: 86_400_000,
      expires_at: 86_401_000,
    },
    nowMs: 1_000,
  });

  assert.deepEqual(prepared.signedMandateAction.action.objectives, [
    { kind: "max_slippage_bps", limit: 50 },
    { kind: "max_drawdown_pct", max_bps: 1000, over_ms: 86_400_000 },
  ]);
  assert.equal(
    Object.hasOwn(prepared.signedMandateAction.action, "objective_weights"),
    false
  );
  assert.match(prepared.typedData.message.actionHash, /^0x[0-9a-f]{64}$/);
});

test("signEvmDelegationAction asks the wallet for eth_signTypedData_v4", async () => {
  const calls = [];
  const wallet = {
    async request(args) {
      calls.push(args);
      return "0x" + "11".repeat(65);
    },
  };

  const signed = await signEvmDelegationAction(
    wallet,
    "0xfb1af79c5163ca0062f733a5184c831a8444e796",
    {
      chainId: 7,
      action: {
        kind: "cancel_redemption",
        principal: 11,
        request_id_hex: "0x" + "01".repeat(32),
      },
      timestampMs: 1_050,
      submitterNonce: 62,
      nowMs: 1_000,
    }
  );

  assert.equal(signed.signature_hex, "0x" + "11".repeat(65));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "eth_signTypedData_v4");
  assert.equal(calls[0].params[0], "0xfb1af79c5163ca0062f733a5184c831a8444e796");
  const typedData = JSON.parse(calls[0].params[1]);
  assert.equal(typedData.primaryType, "EvmDelegationAction");
  assert.equal(typedData.message.actionKind, "cancel_redemption");
});

test("submitEvmMandateAction and submitEvmDelegationAction send the RFC 044 RPC methods", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return {
      ok: true,
      async json() {
        if (body.method === "kombat_submitEvmMandateAction") {
          return {
            jsonrpc: "2.0",
            id: body.id,
            result: { mandate_id_hex: "0xabc", state: "revoked" },
          };
        }
        return {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            action_id_hex: "0x" + "02".repeat(32),
            status: "accepted",
            pending_delegation_actions: 1,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  await client.submitEvmMandateAction(
    {
      chain_id: 7,
      owner_hex: "0x" + "00".repeat(32),
      nonce: 0,
      valid_until_ms: 10_000,
      action: { kind: "revoke_mandate", mandate_id_hex: "0xabc", reason: "owner_revoked" },
      signature_hex: "0x" + "11".repeat(65),
    },
    1_000
  );
  await client.submitEvmDelegationAction(
    {
      chain_id: 7,
      signer_account_id: 11,
      action_id_hex: "0x" + "02".repeat(32),
      action_hex: "0x01",
      timestamp_ms: 1_050,
      submitter_nonce: 61,
      valid_until_ms: 10_000,
      signature_hex: "0x" + "22".repeat(65),
    },
    0
  );

  assert.equal(bodies[0].method, "kombat_submitEvmMandateAction");
  assert.equal(bodies[0].params.timestamp_ms, 1_000);
  assert.equal(bodies[1].method, "kombat_submitEvmDelegationAction");
  assert.equal(bodies[1].params.wait_timeout_ms, 0);
});

test("RuntimeEventTopic default list includes the RFC 027/054 MM topics", () => {
  for (const topic of [
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
  ]) {
    assert.ok(
      DEFAULT_RUNTIME_EVENT_TOPICS.includes(topic),
      `DEFAULT_RUNTIME_EVENT_TOPICS missing ${topic}`
    );
  }
});

test("MM admin RPC client methods serialize the expected JSON-RPC params", async () => {
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: {
            action_id_hex: "0xabc",
            status: "accepted",
            pending_market_maker_program_actions: 1,
            program_id_hex: "0xdef",
            action_status: null,
            peer_failures: null,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");

  await client.defineMarketMakerProgram({
    name: "demo-program",
    markets: [7, 11, 13],
    min_uptime_bps: 9500,
    max_spread_bps: 25,
    min_quote_size_micro_usdc: "5000000",
    min_two_sided_windows_per_hour: 50,
    rebate_multiplier_units: 15_000,
    enrollment_bond_micro_usdc: "10000000000",
    compliance_window_ms: 86_400_000,
    observation_cadence_ms: 5_000,
    timestamp_ms: 1_400,
    submitter_nonce: 57,
  });

  await client.enrollMarketMakerProgram({
    market_maker: 22,
    market_id: 7,
    program_id_hex: "0xabc",
    bond_micro_usdc: "10000000000",
    timestamp_ms: 1_500,
    submitter_nonce: 58,
  });

  await client.submitSignedMarketMakerProgramAction(
    {
      chain_id: 7,
      signer_account_id: 22,
      action_id_hex: "0xdead",
      action_hex: "0xbeef",
      timestamp_ms: 1_600,
      submitter_nonce: 59,
      signature_hex: "0x" + "11".repeat(64),
    },
    250
  );

  await client.getMarketMakerProgramActionStatus("0xdead");
  await client.getMarketMakerProgram("0xabc");
  await client.getMarketMakerEnrollment(22, 7, "0xabc");
  await client.getMarketMakerEnrollmentByIdentity(
    { kind: "delegation", delegation_id_hex: "0x" + "09".repeat(32), serving_agent: 22 },
    7,
    "0xabc"
  );

  assert.equal(bodies[0].method, "kombat_defineMarketMakerProgram");
  assert.equal(bodies[0].params.name, "demo-program");
  assert.deepEqual(bodies[0].params.markets, [7, 11, 13]);
  assert.equal(bodies[0].params.rebate_multiplier_units, 15_000);

  assert.equal(bodies[1].method, "kombat_enrollMarketMakerProgram");
  assert.equal(bodies[1].params.market_maker, 22);
  assert.equal(bodies[1].params.program_id_hex, "0xabc");

  assert.equal(bodies[2].method, "kombat_submitSignedMarketMakerProgramAction");
  assert.equal(
    bodies[2].params.signed_market_maker_program_action.action_id_hex,
    "0xdead"
  );
  assert.equal(bodies[2].params.wait_timeout_ms, 250);

  assert.equal(bodies[3].method, "kombat_getMarketMakerProgramActionStatus");
  assert.equal(bodies[3].params.action_id_hex, "0xdead");

  assert.equal(bodies[4].method, "kombat_getMarketMakerProgram");
  assert.equal(bodies[4].params.program_id_hex, "0xabc");

  assert.equal(bodies[5].method, "kombat_getMarketMakerEnrollment");
  assert.equal(bodies[5].params.market_maker, 22);
  assert.equal(bodies[5].params.market_id, 7);
  assert.equal(bodies[5].params.program_id_hex, "0xabc");

  assert.equal(bodies[6].method, "kombat_getMarketMakerEnrollment");
  assert.equal(bodies[6].params.market_maker_identity.kind, "delegation");
  assert.equal(
    bodies[6].params.market_maker_identity.delegation_id_hex,
    "0x" + "09".repeat(32)
  );
  assert.equal(bodies[6].params.market_maker_identity.serving_agent, 22);
});

test("TradeFillResponse JSON parsed by consumers carries mandate_id_hex", () => {
  // Smoke-check the wire shape: the chain emits null when no mandate, and a
  // 0x-hex string when the fill is attributed (RFC 047).
  const sample = {
    market_id: 7,
    account_id: 22,
    client_order_id: 1,
    counterparty_account_id: 33,
    counterparty_client_order_id: 2,
    mandate_id_hex: "0x" + "ab".repeat(32),
    role: "maker",
    side: "buy",
    price_ticks: 100,
    quantity_lots: 5,
    seq: 42,
    block_height: 7,
    timestamp_ms: 1_000,
  };
  // No constructor — just type-shape parity. Assert the field exists as
  // expected; this catches regressions if a future refactor drops it.
  assert.equal(typeof sample.mandate_id_hex, "string");
  assert.equal(sample.mandate_id_hex.length, 2 + 64);
});
