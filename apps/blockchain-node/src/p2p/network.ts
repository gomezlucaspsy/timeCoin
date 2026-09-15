import { createServer, connect, type Server, type Socket } from "node:net";
import type { Blockchain } from "../blockchain.js";
import type { Block } from "../block.js";
import type { Transaction } from "../transaction.js";
import { Peer } from "./peer.js";
import type { P2PMessage } from "./protocol.js";

const RECONNECT_DELAY_MS = 5_000;
const PING_INTERVAL_MS = 30_000;
const SEEN_CACHE_LIMIT = 5_000;

/** Bounded FIFO set: remembers recently-seen hashes/ids so gossip doesn't loop forever. */
class SeenCache {
  private readonly set = new Set<string>();
  private readonly order: string[] = [];

  hasSeen(key: string): boolean {
    return this.set.has(key);
  }

  add(key: string): void {
    if (this.set.has(key)) return;
    this.set.add(key);
    this.order.push(key);
    if (this.order.length > SEEN_CACHE_LIMIT) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.set.delete(oldest);
    }
  }
}

export interface P2PNetworkOptions {
  port: number;
  /** "host:port" strings this node dials out to on startup and reconnects to on drop. */
  seedPeers?: string[];
  onChainChanged?: () => void;
  log?: (message: string) => void;
}

/**
 * Minimal peer-to-peer layer: TCP + newline-delimited JSON, static seed-peer list
 * (no DHT/discovery), longest-valid-chain gossip. Enough for a real multi-node
 * testnet; not Bitcoin's full inv/getdata protocol.
 */
export class P2PNetwork {
  private readonly peers = new Map<Peer, { height: number; tipHash: string }>();
  private server: Server | null = null;
  private readonly seenBlocks = new SeenCache();
  private readonly seenTxs = new SeenCache();
  private readonly log: (message: string) => void;
  private pingTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly chain: Blockchain,
    private readonly options: P2PNetworkOptions,
  ) {
    this.log = options.log ?? (() => {});
  }

  start(): void {
    this.server = createServer((socket) => this.handleSocket(socket, "inbound"));
    this.server.listen(this.options.port, () => {
      this.log(`P2P listening on port ${this.options.port}`);
    });
    for (const address of this.options.seedPeers ?? []) {
      this.dial(address);
    }
    this.pingTimer = setInterval(() => {
      for (const peer of this.peers.keys()) peer.send({ type: "ping" });
    }, PING_INTERVAL_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    for (const peer of this.peers.keys()) peer.disconnect();
    this.server?.close();
  }

  get peerCount(): number {
    return this.peers.size;
  }

  peerSummaries(): Array<{ address: string; height: number; tipHash: string }> {
    return [...this.peers.entries()].map(([peer, info]) => ({ address: peer.address, ...info }));
  }

  private dial(address: string): void {
    if (this.stopped) return;
    const [host, portStr] = address.split(":");
    const port = Number(portStr);
    const socket = connect({ host, port }, () => {
      this.log(`Connected to peer ${address}`);
    });
    socket.on("error", () => {
      // handled by the retry loop below; swallow so it doesn't crash the process
    });
    const peer = this.handleSocket(socket, "outbound", address);
    peer.once("close", () => {
      if (this.stopped) return;
      setTimeout(() => this.dial(address), RECONNECT_DELAY_MS);
    });
  }

  private handleSocket(socket: Socket, direction: "inbound" | "outbound", knownAddress?: string): Peer {
    const address = knownAddress ?? `${socket.remoteAddress}:${socket.remotePort}`;
    const peer = new Peer(socket, address);

    peer.on("message", (message: P2PMessage) => this.onMessage(peer, message));
    peer.on("close", () => {
      this.peers.delete(peer);
      this.log(`Peer disconnected: ${address}`);
    });

    peer.send({
      type: "version",
      network: this.chain.network,
      height: this.chain.height,
      tipHash: this.chain.tip.hash,
    });

    this.log(`${direction === "inbound" ? "Inbound" : "Outbound"} peer connecting: ${address}`);
    return peer;
  }

  private onMessage(peer: Peer, message: P2PMessage): void {
    switch (message.type) {
      case "version": {
        if (message.network !== this.chain.network) {
          this.log(`Rejecting peer ${peer.address}: network mismatch (${message.network})`);
          peer.disconnect();
          return;
        }
        this.peers.set(peer, { height: message.height, tipHash: message.tipHash });
        peer.send({ type: "verack" });
        if (message.height > this.chain.height) {
          peer.send({ type: "getchain" });
        }
        return;
      }
      case "verack":
        return;
      case "getchain":
        peer.send({ type: "chain", blocks: this.chain.chain });
        return;
      case "chain": {
        const result = this.chain.replaceChainIfBetter(message.blocks);
        if (result.replaced) {
          this.log(`Adopted longer chain from ${peer.address}: height ${this.chain.height}`);
          this.options.onChainChanged?.();
          this.broadcastBlock(this.chain.tip, peer);
        }
        return;
      }
      case "block":
        this.handleIncomingBlock(peer, message.block);
        return;
      case "tx":
        this.handleIncomingTx(peer, message.tx);
        return;
      case "ping":
        peer.send({ type: "pong" });
        return;
      case "pong":
        return;
    }
  }

  private handleIncomingBlock(from: Peer, block: Block): void {
    if (this.seenBlocks.hasSeen(block.hash)) return;
    this.seenBlocks.add(block.hash);

    const result = this.chain.acceptBlock(block);
    if (result.accepted) {
      this.log(`Accepted block ${block.header.height} (${block.hash.slice(0, 12)}…) from ${from.address}`);
      this.options.onChainChanged?.();
      this.broadcastBlock(block, from);
      return;
    }

    // Doesn't extend our tip directly — could be a fork or we're behind. Ask the
    // sender for their whole chain and let replaceChainIfBetter decide.
    from.send({ type: "getchain" });
  }

  private handleIncomingTx(from: Peer, tx: Transaction): void {
    if (this.seenTxs.hasSeen(tx.id)) return;
    this.seenTxs.add(tx.id);

    const result = this.chain.submitTransaction(tx);
    if (result.accepted) {
      this.broadcastTx(tx, from);
    }
  }

  /** Announce a locally-mined or newly-adopted block to every peer except `exclude`. */
  broadcastBlock(block: Block, exclude?: Peer): void {
    this.seenBlocks.add(block.hash);
    for (const peer of this.peers.keys()) {
      if (peer !== exclude) peer.send({ type: "block", block });
    }
  }

  /** Relay a locally-submitted transaction to every peer except `exclude`. */
  broadcastTx(tx: Transaction, exclude?: Peer): void {
    this.seenTxs.add(tx.id);
    for (const peer of this.peers.keys()) {
      if (peer !== exclude) peer.send({ type: "tx", tx });
    }
  }
}
