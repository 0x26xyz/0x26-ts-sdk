# `@0x26xyz/and-chain-sdk`

Thin TypeScript SDK for the `&` chain JSON-RPC API.

```ts
import { AndChainClient } from "@0x26xyz/and-chain-sdk";

const client = new AndChainClient("https://testnet.0x26.xyz/api");

const chainInfo = await client.chainInfo();
const pressure = await client.getLiquidationPressureSummary();
```

## EVM wallet action helpers

RFC 044 browser flows use EIP-712 signatures; users should never paste
private keys. The SDK prepares typed data, asks an EIP-1193 wallet to
sign, then submits the signed JSON-RPC envelope:

```ts
import { signEvmDelegationAction } from "@0x26xyz/and-chain-sdk";

const signed = await signEvmDelegationAction(window.ethereum, address, {
  chainId: 7,
  action: {
    kind: "deposit",
    principal: accountId,
    delegation_id_hex: delegationId,
    amount: "50000000",
  },
  timestampMs: Date.now(),
  submitterNonce: Date.now(),
});

await client.submitEvmDelegationAction(signed, 1000);
```

`validUntilMs` defaults to five minutes and is capped client-side at
fifteen minutes.
