"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NavTabs from "@/components/NavTabs";
import QrScanner from "@/components/QrScanner";
import { loadOrCreateWallet, importWallet, buildTransfer, type WalletKeys } from "@/lib/timecoin/wallet";
import { getStatus, getBalance, getUtxos, submitTransaction, mineBlock, type NodeStatus } from "@/lib/timecoin/client";
import { formatUnits } from "@/lib/timecoin/format";

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletKeys | null>(() =>
    typeof window === "undefined" ? null : loadOrCreateWallet(),
  );
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [nodeError, setNodeError] = useState<string | null>(null);

  const [mining, setMining] = useState(false);
  const [mineMessage, setMineMessage] = useState<string | null>(null);

  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const [receiveQr, setReceiveQr] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState(false);

  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
      setNodeError(null);
      if (wallet?.address) {
        const b = await getBalance(wallet.address);
        setBalance(b);
      }
    } catch (err) {
      setNodeError(
        err instanceof Error
          ? `No se pudo conectar al nodo TimeCoin (${err.message}). ¿Está corriendo "npm run dev" en apps/blockchain-node?`
          : "No se pudo conectar al nodo TimeCoin.",
      );
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet?.address) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling refresh, not a props->state mirror
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [wallet?.address, refresh]);

  async function handleMine() {
    if (!wallet?.address) return;
    setMining(true);
    setMineMessage(null);
    try {
      const block = await mineBlock(wallet.address, 5_000_000);
      setMineMessage(`Bloque #${block.header.height} minado. Hash ${block.hash.slice(0, 16)}…`);
      await refresh();
    } catch (err) {
      setMineMessage(err instanceof Error ? err.message : "No se pudo minar el bloque.");
    } finally {
      setMining(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet?.address) return;
    setSending(true);
    setSendMessage(null);
    try {
      if (!status) throw new Error("Todavía no cargó el estado de la red");
      const amountUnits = parseAmountToUnits(sendAmount, BigInt(status.unitsPerCoin));
      const utxos = await getUtxos(wallet.address);
      const tx = buildTransfer(wallet, utxos, sendTo.trim(), amountUnits);
      const result = await submitTransaction(tx);
      setSendMessage(`Transacción enviada al mempool: ${result.txId.slice(0, 16)}…`);
      setSendTo("");
      setSendAmount("");
      await refresh();
    } catch (err) {
      setSendMessage(err instanceof Error ? err.message : "No se pudo enviar la transacción.");
    } finally {
      setSending(false);
    }
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportError(null);
    try {
      const w = importWallet(importKey.trim());
      setWallet(w);
      setImportKey("");
      setBalance(null);
    } catch {
      setImportError("Frase semilla o clave privada inválida.");
    }
  }

  async function copyAddress() {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copySeedPhrase() {
    if (!wallet?.seedPhrase) return;
    await navigator.clipboard.writeText(wallet.seedPhrase);
    setSeedCopied(true);
    setTimeout(() => setSeedCopied(false), 1500);
  }

  async function openReceive() {
    if (!wallet?.address) return;
    const QRCode = await import("qrcode");
    const url = await QRCode.toDataURL(wallet.address, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
    setReceiveQr(url);
    setShowReceive(true);
  }

  function handleScanned(value: string) {
    setSendTo(value.trim());
    setScanning(false);
  }

  const unitsPerCoin = status ? BigInt(status.unitsPerCoin) : 100_000_000n;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TimeCoin
        </Link>
        <NavTabs />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {status ? `${status.network} · bloque ${status.height}` : "conectando…"}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Mi wallet TimeCoin</h1>

        {nodeError && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {nodeError}
          </div>
        )}

        {wallet && !wallet.seedPhrase && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Esta wallet no tiene frase de respaldo (se creó con el sistema anterior). Para no
            arriesgarte a perder el acceso, considerá crear una wallet nueva más abajo y transferirle
            el saldo.
          </div>
        )}

        {wallet && (
          <section className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Dirección</span>
              <div className="flex gap-2">
                <button
                  onClick={openReceive}
                  className="rounded-full px-3 py-1 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                >
                  Recibir (QR)
                </button>
                <button
                  onClick={copyAddress}
                  className="rounded-full px-3 py-1 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                >
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
            <p className="mt-1 break-all font-mono text-sm">{wallet.address}</p>

            <div className="mt-6">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Saldo</span>
              <p className="mt-1 text-4xl font-semibold tracking-tight">
                {balance !== null ? formatUnits(balance, unitsPerCoin) : "…"}{" "}
                <span className="text-lg font-normal text-zinc-500 dark:text-zinc-400">TIME</span>
              </p>
            </div>
          </section>
        )}

        {status && (
          <section className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm dark:border-white/[.08] dark:bg-zinc-950">
            <h2 className="mb-3 font-medium">Estado de la red</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-zinc-600 dark:text-zinc-400">
              <dt>Altura</dt>
              <dd className="text-right text-zinc-900 dark:text-zinc-100">{status.height}</dd>
              <dt>Dificultad</dt>
              <dd className="text-right text-zinc-900 dark:text-zinc-100">{status.difficulty.toFixed(6)}</dd>
              <dt>Recompensa próximo bloque</dt>
              <dd className="text-right text-zinc-900 dark:text-zinc-100">
                {formatUnits(BigInt(status.nextBlockReward), unitsPerCoin)} TIME
              </dd>
              <dt>Suministro circulante</dt>
              <dd className="text-right text-zinc-900 dark:text-zinc-100">
                {formatUnits(BigInt(status.circulatingSupply), unitsPerCoin)} / {formatUnits(BigInt(status.maxSupply), unitsPerCoin)}
              </dd>
              <dt>Mempool</dt>
              <dd className="text-right text-zinc-900 dark:text-zinc-100">{status.mempoolSize} tx</dd>
            </dl>
          </section>
        )}

        <section className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
          <h2 className="mb-3 font-medium">Minar</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Prueba de trabajo real: tu navegador le pide al nodo que busque un nonce válido y, si lo
            encuentra, te acredita la recompensa del bloque a esta dirección.
          </p>
          <button
            onClick={handleMine}
            disabled={mining || !wallet?.address}
            className="flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {mining ? "Minando…" : "Minar bloque"}
          </button>
          {mineMessage && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{mineMessage}</p>}
        </section>

        <section className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
          <h2 className="mb-3 font-medium">Enviar TimeCoin</h2>
          <form onSubmit={handleSend} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Dirección de destino"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                required
                className="flex-1 rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm font-mono dark:border-white/[.145]"
              />
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="shrink-0 rounded-lg border border-black/[.08] px-3 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Escanear QR
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Monto (TIME)"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              required
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
            />
            <button
              type="submit"
              disabled={sending || !wallet?.address}
              className="flex h-11 items-center justify-center self-start rounded-full border border-black/[.08] px-6 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </form>
          {sendMessage && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{sendMessage}</p>}
        </section>

        <section className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.08] dark:bg-zinc-950">
          <h2 className="mb-3 font-medium">Frase de respaldo</h2>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Son 12 palabras que reconstruyen tu wallet en cualquier dispositivo. Anotalas en papel y
            guardalas en un lugar seguro — quien las tenga controla el saldo, y si las perdés vos,
            nadie puede recuperarlas por vos.
          </p>
          {wallet?.seedPhrase ? (
            <>
              <button
                onClick={() => setShowSeedPhrase((v) => !v)}
                className="mb-3 rounded-full px-3 py-1 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.08]"
              >
                {showSeedPhrase ? "Ocultar" : "Mostrar"}
              </button>
              {showSeedPhrase && (
                <div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                    {wallet.seedPhrase.split(" ").map((word, i) => (
                      <div key={i} className="rounded-md bg-white px-2 py-1.5 text-sm dark:bg-zinc-800">
                        <span className="mr-1.5 text-xs text-zinc-400">{i + 1}.</span>
                        <span className="font-mono">{word}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={copySeedPhrase}
                    className="mt-3 rounded-full border border-black/[.08] px-4 py-1.5 text-xs font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    {seedCopied ? "Copiada" : "Copiar frase"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Esta wallet fue creada con clave hex, antes de que existiera la frase de respaldo.
            </p>
          )}

          <form onSubmit={handleImport} className="mt-6 flex flex-col gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.08]">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Importar otra wallet (frase de 12 palabras o clave privada)
            </label>
            <input
              type="text"
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              placeholder="palabra1 palabra2 … palabra12"
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm font-mono dark:border-white/[.145]"
            />
            {importError && <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>}
            <button
              type="submit"
              disabled={!importKey.trim()}
              className="flex h-10 items-center justify-center self-start rounded-full border border-black/[.08] px-5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Importar
            </button>
          </form>
        </section>
      </main>

      {showReceive && wallet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
          onClick={() => setShowReceive(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-black/[.08] bg-background p-7 text-center shadow-xl dark:border-white/[.145]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold tracking-tight">Recibir TimeCoin</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Mostrá este código para que te transfieran directo a tu dirección.
            </p>
            <div className="mx-auto my-5 flex h-[216px] w-[216px] items-center justify-center rounded-2xl bg-white p-3">
              {receiveQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receiveQr} alt="Código QR de tu dirección TimeCoin" width={200} height={200} />
              ) : (
                <span className="text-xs text-zinc-500">Generando QR…</span>
              )}
            </div>
            <p className="mb-5 break-all font-mono text-xs text-zinc-500">{wallet.address}</p>
            <button
              onClick={() => setShowReceive(false)}
              className="w-full rounded-full border border-black/[.08] px-4 py-3 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {scanning && <QrScanner onScan={handleScanned} onClose={() => setScanning(false)} />}
    </div>
  );
}

function parseAmountToUnits(input: string, unitsPerCoin: bigint): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Monto inválido");
  const [whole, frac = ""] = trimmed.split(".");
  const decimals = unitsPerCoin.toString().length - 1;
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * unitsPerCoin + BigInt(fracPadded || "0");
}
