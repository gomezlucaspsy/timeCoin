import { describe, it, expect } from "vitest";
import { Blockchain } from "../src/blockchain.js";
import { P2PNetwork } from "../src/p2p/network.js";
import { createWallet, buildTransfer } from "../src/wallet.js";
import { getParams } from "../src/constants.js";

async function waitFor(condition: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("P2PNetwork (devnet, two real nodes over loopback TCP)", () => {
  it("gossips a mined block from one node to the other", async () => {
    const chainA = new Blockchain("devnet");
    const chainB = new Blockchain("devnet");
    const p2pA = new P2PNetwork(chainA, { port: 19101 });
    const p2pB = new P2PNetwork(chainB, { port: 19102, seedPeers: ["127.0.0.1:19101"] });

    try {
      p2pA.start();
      p2pB.start();
      await waitFor(() => p2pA.peerCount === 1 && p2pB.peerCount === 1);

      const miner = createWallet();
      const block = chainA.mineNextBlock(miner.address, 5_000_000);
      expect(block).not.toBeNull();
      p2pA.broadcastBlock(block!);

      await waitFor(() => chainB.height === 1);
      expect(chainB.tip.hash).toBe(chainA.tip.hash);
    } finally {
      p2pA.stop();
      p2pB.stop();
    }
  });

  it("relays a mempool transaction between nodes and lets a late joiner catch up via getchain", async () => {
    const chainA = new Blockchain("devnet");
    const chainB = new Blockchain("devnet");
    const p2pA = new P2PNetwork(chainA, { port: 19103 });
    const p2pB = new P2PNetwork(chainB, { port: 19104, seedPeers: ["127.0.0.1:19103"] });

    try {
      p2pA.start();

      const miner = createWallet();
      const params = getParams("devnet");
      // Mine past coinbase maturity on A alone so the miner has spendable funds.
      for (let i = 0; i <= params.coinbaseMaturityBlocks; i++) {
        const b = chainA.mineNextBlock(miner.address, 5_000_000);
        expect(b).not.toBeNull();
      }
      expect(chainA.getBalance(miner.address)).toBeGreaterThan(0n);

      // B joins late, after A already has a chain — it must sync via getchain, not
      // just direct block-by-block gossip.
      p2pB.start();
      await waitFor(() => chainB.height === chainA.height);
      expect(chainB.tip.hash).toBe(chainA.tip.hash);

      const recipient = createWallet();
      const { transaction } = buildTransfer(
        miner,
        chainA.getSpendableUtxos(miner.address),
        recipient.address,
        50_000_000n,
      );

      const result = chainA.submitTransaction(transaction);
      expect(result.accepted).toBe(true);
      p2pA.broadcastTx(transaction);

      await waitFor(() => chainB.mempool.some((t) => t.id === transaction.id));
    } finally {
      p2pA.stop();
      p2pB.stop();
    }
  });
});
