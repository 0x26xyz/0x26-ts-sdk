import test from "node:test";
import assert from "node:assert/strict";
import {
  AndChainClient,
  Keypair,
  PolicyTermsBuilder,
  signIntent,
  signOwnerCall,
  signMarketMakerProgramAction,
} from "../dist/index.js";

test("signIntent matches the Rust SDK place-order fixture exactly", () => {
  const signer = Keypair.fromSecretHex(
    "0x0909090909090909090909090909090909090909090909090909090909090909"
  );

  const signed = signIntent(signer, {
    chain_id: 1,
    account_id: 22,
    policy_id: 42,
    nonce: 3,
    expires_at: 9_999_999,
    predicate: null,
    kind: {
      kind: "place_order",
      market_id: 7,
      client_order_id: 1,
      side: "ask",
      quantity_lots: 5,
      order_kind: { kind: "limit", price_ticks: 103 },
      time_in_force: { kind: "gtc" },
      post_only: false,
    },
  });

  assert.deepEqual(signed, {
    intent: {
      chain_id: 1,
      account: 22,
      policy_id: 42,
      nonce: 3,
      expires_at: 9_999_999,
      predicate: null,
      kind: "place_order",
      market_id: 7,
      client_order_id: 1,
      side: "ask",
      quantity_lots: 5,
      order_kind: "limit",
      price_ticks: 103,
      time_in_force: { tif: "gtc" },
      post_only: false,
    },
    signature_hex:
      "0xfde35b626edc7fa214d576bb1185282ccd8f00bf01d6bc2641cd77975a1e32c3596685c380c995b054618015f2975b196649801d755b1b537ac0857fc70fda05",
  });
});

test("signIntent matches the Rust SDK collateral fixture exactly", () => {
  const signer = Keypair.fromSecretHex(
    "0x0909090909090909090909090909090909090909090909090909090909090909"
  );

  const signed = signIntent(signer, {
    chain_id: 1,
    account_id: 22,
    policy_id: 42,
    nonce: 9,
    expires_at: 9_999_999,
    predicate: null,
    kind: {
      kind: "deposit_collateral",
      market_id: 7,
      amount_usdc: 1_000,
    },
  });

  assert.deepEqual(signed, {
    intent: {
      chain_id: 1,
      account: 22,
      policy_id: 42,
      nonce: 9,
      expires_at: 9_999_999,
      predicate: null,
      kind: "deposit_collateral",
      market_id: 7,
      amount_usdc: 1_000,
    },
    signature_hex:
      "0x0e3035d4c2919120daa91ea38a40608e7d441b827f02fc7e709431e19317084491bda47cb189a0d13ab46452601eed248270e60f550d2b71c320048c0474ea0e",
  });
});

test("signOwnerCall matches the Rust SDK create-policy fixture exactly", () => {
  const owner = Keypair.fromSecretHex(
    "0x0808080808080808080808080808080808080808080808080808080808080808"
  );
  const grantee = Keypair.fromSecretHex(
    "0x0909090909090909090909090909090909090909090909090909090909090909"
  );
  const terms = new PolicyTermsBuilder()
    .gasBudgetPerDayMicrousdc("10000000")
    .gasRefillPerDayMicrousdc("10000000")
    .maxIntentsPerSecond(5)
    .maxIntentsPerDay(50000)
    .maxVolumePerDayMicrousdc("25000000000")
    .maxDrawdownPct(1500)
    .build();

  const signed = signOwnerCall(owner, {
    account_id: 22,
    chain_id: 1,
    nonce: 1,
    action: {
      kind: "create_policy",
      policy_id: 42,
      grantee_hex: grantee.publicHex(),
      expires_at: 9_999_999,
      terms,
    },
  });

  assert.deepEqual(signed, {
    account_id: 22,
      chain_id: 1,
      call: {
        signer_hex:
          "0x1398f62c6d1a457c51ba6a4b5f3dbd2f69fca93216218dc8997e416bd17d93ca",
        nonce: 1,
        kind: "create_policy",
        policy_id: 42,
        grantee_hex:
          "0xfd1724385aa0c75b64fb78cd602fa1d991fdebf76b13c58ed702eac835e9f618",
        expires_at: 9_999_999,
        terms: {
          gas_budget_per_day: "10000000",
        gas_refill_per_day: "10000000",
        max_intents_per_second: 5,
        max_intents_per_day: 50000,
        max_volume_per_day: "25000000000",
        max_drawdown_pct: 1500,
      },
    },
    signature_hex:
      "0xf8781ae16f04ff1fc119164514f23d65ce6b32a453a87f48c4a1c5aadcddee9bcede6f4b6044ff3ce3fd4282e7907624af4610e74f6f114a0ee6568191c34304",
  });
});

test("submitTypedIntent signs and submits the expected payload", async () => {
  const signer = Keypair.fromSecretHex(
    "0x0909090909090909090909090909090909090909090909090909090909090909"
  );
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
            intent_id_hex: "0xabc",
            class: "direct",
            pending_reason: null,
            next_eligible_at_ms: null,
            current_policy_nonce: 3,
          },
        };
      },
    };
  };

  const client = new AndChainClient("http://127.0.0.1:18545");
  await client.submitTypedIntent(
    signer,
    {
      chain_id: 1,
      account_id: 22,
      policy_id: 42,
      nonce: 3,
      expires_at: 9_999_999,
      predicate: null,
      kind: {
        kind: "place_order",
        market_id: 7,
        client_order_id: 1,
        side: "ask",
        quantity_lots: 5,
        order_kind: { kind: "limit", price_ticks: 103 },
        time_in_force: { kind: "gtc" },
        post_only: false,
      },
    },
    1234
  );

  assert.deepEqual(bodies[0], {
    jsonrpc: "2.0",
    id: 1,
    method: "kombat_submitIntent",
    params: {
      signed_intent: {
        intent: {
          chain_id: 1,
          account: 22,
          policy_id: 42,
          nonce: 3,
          expires_at: 9_999_999,
          predicate: null,
          kind: "place_order",
          market_id: 7,
          client_order_id: 1,
          side: "ask",
          quantity_lots: 5,
          order_kind: "limit",
          price_ticks: 103,
          time_in_force: { tif: "gtc" },
          post_only: false,
        },
        signature_hex:
          "0xfde35b626edc7fa214d576bb1185282ccd8f00bf01d6bc2641cd77975a1e32c3596685c380c995b054618015f2975b196649801d755b1b537ac0857fc70fda05",
      },
      timestamp_ms: 1234,
    },
  });
});

// MM signer fixtures generated from the Rust SDK
// (`cargo test -p and-chain-sdk --test wire_compat` with [41u8;32] signer).

test("signMarketMakerProgramAction matches Rust account-Enroll fixture exactly", () => {
  const signer = Keypair.fromSecretBytes(new Uint8Array(32).fill(41));
  const programId = `0x${"07".repeat(32)}`;

  const signed = signMarketMakerProgramAction(signer, {
    chain_id: 7,
    signer_account_id: 260_001,
    action: {
      kind: "enroll",
      market_maker_identity: { kind: "account", account_id: 260_001 },
      market_id: 7,
      program_id_hex: programId,
      bond_micro_usdc: 10_000_000_000n,
    },
    timestamp_ms: 1_200,
    submitter_nonce: 55,
  });

  assert.deepEqual(signed, {
    chain_id: 7,
    signer_account_id: 260_001,
    action_id_hex:
      "0xd276662f075660f0df97273efc23034b30dd40235e35178ccd1df5d68cb2ed18",
    action_hex:
      "0x0200a1f70300000000000700000000000000070707070707070707070707070707070707070707070707070707070707070700000000000000000000000000000000000000000000000000000002540be400",
    timestamp_ms: 1_200,
    submitter_nonce: 55,
    signature_hex:
      "0xf689d51d715549ae1cbc9834fb788c3ce354b02080284c96d1e766aa5572b42fd5d83f09bb74bc25871e248ce56283f595168e3625238f63b54ea8ee6ff2db0b",
  });
});

test("signMarketMakerProgramAction matches Rust delegation-Enroll fixture exactly", () => {
  const signer = Keypair.fromSecretBytes(new Uint8Array(32).fill(41));
  const delegationId = `0x${"09".repeat(32)}`;
  const programId = `0x${"07".repeat(32)}`;

  const signed = signMarketMakerProgramAction(signer, {
    chain_id: 7,
    signer_account_id: 260_001,
    action: {
      kind: "enroll",
      market_maker_identity: {
        kind: "delegation",
        delegation_id_hex: delegationId,
        serving_agent: 260_001,
      },
      market_id: 7,
      program_id_hex: programId,
      bond_micro_usdc: 10_000_000_000n,
    },
    timestamp_ms: 1_300,
    submitter_nonce: 56,
  });

  assert.equal(
    signed.action_id_hex,
    "0x54df8cabb91b0c33b1eb3534db79a49e79c7f1266c1dde7e013bb90648bc227d"
  );
  assert.equal(
    signed.action_hex,
    "0x02010909090909090909090909090909090909090909090909090909090909090909a1f70300000000000700000000000000070707070707070707070707070707070707070707070707070707070707070700000000000000000000000000000000000000000000000000000002540be400"
  );
  assert.equal(
    signed.signature_hex,
    "0x66d6a7ad4a3d2ca7dcfd5f1598a63ddeb2b05b174319136c907f2cd192e07b24a8278ff37a98e8ad3fda1dc14f1177e3fb221472fdbcdff76eeda07a7e42390a"
  );
});

test("signMarketMakerProgramAction matches Rust Define fixture exactly", () => {
  const signer = Keypair.fromSecretBytes(new Uint8Array(32).fill(41));

  const signed = signMarketMakerProgramAction(signer, {
    chain_id: 7,
    signer_account_id: 260_001,
    action: {
      kind: "define",
      name: "demo-program",
      markets: [7, 11, 13],
      min_uptime_bps: 9500,
      max_spread_bps: 25,
      min_quote_size_micro_usdc: 5_000_000n,
      min_two_sided_windows_per_hour: 50,
      rebate_multiplier_units: 15_000,
      enrollment_bond_micro_usdc: 10_000_000_000n,
      compliance_window_ms: 86_400_000,
      observation_cadence_ms: 5_000,
    },
    timestamp_ms: 1_400,
    submitter_nonce: 57,
  });

  assert.equal(
    signed.action_id_hex,
    "0xea32bb5dfb5a2c36c52d6fa527951ee49fb53ec1af2b625c633a25652eb06340"
  );
  assert.equal(
    signed.action_hex,
    "0x000c00000064656d6f2d70726f6772616d0300000007000000000000000b000000000000000d000000000000001c25190000000000000000000000000000000000000000000000000000000000004c4b403200983a00000000000000000000000000000000000000000000000000000002540be400005c2605000000008813000000000000"
  );
  assert.equal(
    signed.signature_hex,
    "0x1a5e320702056dc18daaac543e0089c25a530215b98e951d53d76831b27c24babc572dce3965c3c85cbee6cf9e93c348c8b097fae10308a0c64866711d38ad0a"
  );
});
