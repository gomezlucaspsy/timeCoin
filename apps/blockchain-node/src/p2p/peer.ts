import type { Socket } from "node:net";
import { EventEmitter } from "node:events";
import { encodeMessage, decodeMessage, type P2PMessage } from "./protocol.js";

/**
 * Wraps one TCP socket to a peer: splits the byte stream on newlines (our wire
 * framing) and emits one decoded message at a time. A malformed line disconnects
 * just that peer instead of taking down the node.
 */
export class Peer extends EventEmitter {
  readonly address: string;
  private buffer = "";
  private closed = false;

  constructor(
    private readonly socket: Socket,
    address: string,
  ) {
    super();
    this.address = address;
    socket.setEncoding("utf-8");
    socket.on("data", (chunk: string) => this.onData(chunk));
    socket.on("close", () => this.onClose());
    socket.on("error", () => this.onClose());
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;
      try {
        this.emit("message", decodeMessage(line));
      } catch {
        // Malformed line from this peer: drop just this connection, not the process.
        // (EventEmitter throws synchronously on an unhandled "error" event, so we
        // don't emit one here — closing the socket already fires our "close" handler.)
        this.socket.destroy();
        return;
      }
    }
  }

  private onClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.emit("close");
  }

  send(message: P2PMessage): void {
    if (this.closed || this.socket.destroyed) return;
    this.socket.write(encodeMessage(message));
  }

  disconnect(): void {
    this.socket.destroy();
  }
}
