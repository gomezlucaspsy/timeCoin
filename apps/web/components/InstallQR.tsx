"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Floating install trigger that opens a QR code linking to the current
 * deployment, so the marketplace can be scanned open on a phone and added
 * to its home screen (PWA install).
 */
export default function InstallQR() {
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [pageUrl] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!open || !pageUrl) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(pageUrl, {
          width: 240,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, pageUrl]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-black/[.08] bg-white/90 px-4 py-2 text-xs font-medium tracking-tight text-foreground shadow-sm backdrop-blur transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-black/70 dark:hover:bg-white/[.08]"
      >
        {installed ? "Compartir app" : "Instalar app"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-black/[.08] bg-background p-7 text-center shadow-xl dark:border-white/[.145]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold tracking-tight">
              {installed ? "Compartir TimeCoin" : "Instalar TimeCoin"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {installed
                ? "Escaneá con otro celular para abrir esta app y agregarla a su pantalla de inicio."
                : "Escaneá con la cámara de tu celular para abrir la app y agregarla a tu pantalla de inicio."}
            </p>
            <div className="mx-auto my-5 flex h-[216px] w-[216px] items-center justify-center rounded-2xl bg-white p-3">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="Código QR para instalar TimeCoin" width={200} height={200} />
              ) : (
                <span className="text-xs text-zinc-500">Generando QR…</span>
              )}
            </div>
            <p className="mb-5 break-all text-xs text-zinc-500">{pageUrl}</p>
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="mb-2 w-full rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Instalar en este dispositivo
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-full rounded-full border border-black/[.08] px-4 py-3 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
