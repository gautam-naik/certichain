import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, StopCircle, Upload } from "lucide-react";

interface QrScannerProps {
  onScanSuccess: (certificateId: string) => void;
}

function extractCertificateIdFromQr(rawText: string): string {
  const trimmed = rawText.trim();
  try {
    const url = new URL(trimmed);
    const paramId = url.searchParams.get("id");
    if (paramId) return paramId.trim().toUpperCase();
  } catch {
    // Not a full URL; check pattern directly
  }
  const match = trimmed.match(/CERT-\d{4}-[A-Z0-9]{6}/i);
  return match ? match[0].toUpperCase() : trimmed.toUpperCase();
}

export function QrScanner({ onScanSuccess }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access is not supported in this browser context. You can upload a QR image below instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          scanFrame();
        }
      }, 100);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Camera permission denied or unavailable (${err.message}). Upload a QR image below instead.`
          : "Unable to access camera."
      );
      setScanning(false);
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const parsedId = extractCertificateIdFromQr(code.data);
          stopCamera();
          onScanSuccess(parsedId);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          onScanSuccess(extractCertificateIdFromQr(code.data));
        } else {
          setError("No readable CertiChain QR code found in the uploaded image.");
        }
      }
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      setError("Unable to decode image file.");
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!scanning ? (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>Start Camera Scanner</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30 transition-colors"
          >
            <StopCircle className="w-4 h-4" />
            <span>Stop Camera</span>
          </button>
        )}

        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-700 bg-slate-900 text-slate-200 hover:border-teal-500/50 cursor-pointer transition-colors">
          <Upload className="w-4 h-4 text-teal-400" />
          <span>Upload QR Code Image</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleQrImageUpload}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200">
          {error}
        </div>
      )}

      {scanning && (
        <div className="relative rounded-xl overflow-hidden border border-teal-500/40 bg-black max-w-md aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 pointer-events-none border-2 border-teal-400/50 m-6 rounded-lg" />
          <p className="absolute bottom-2 inset-x-0 text-center text-xs text-teal-200 bg-black/60 py-1">
            Align certificate QR code within the frame
          </p>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
