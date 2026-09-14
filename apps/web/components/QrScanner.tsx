"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export default function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameId = 0;
    let stopped = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            onScan(code.data);
            return;
          }
        }
      }
      if (!stopped) frameId = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        frameId = requestAnimationFrame(tick);
      } catch {
        setError("No se pudo acceder a la cámara. Revisá los permisos del navegador.");
      }
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot scan; parent unmounts us on result
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-5">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        {error ? (
          <p className="p-6 text-center text-sm text-white">{error}</p>
        ) : (
          <video ref={videoRef} className="w-full" muted playsInline />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="mt-4 text-sm text-white/80">Apuntá la cámara al código QR de la dirección.</p>
      <button
        onClick={onClose}
        className="mt-4 rounded-full bg-white px-6 py-2 text-sm font-medium text-black"
      >
        Cancelar
      </button>
    </div>
  );
}
