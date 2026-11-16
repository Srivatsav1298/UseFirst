"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, RefreshCw, SwitchCamera } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";

type Controls = { stop: () => void };

export function BarcodeScanner({
  onDetect,
  paused = false,
  continuous = false,
}: {
  onDetect: (raw: string) => void;
  paused?: boolean;
  continuous?: boolean;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const pausedRef = useRef(paused);
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  pausedRef.current = paused;

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (preferredId?: string) => {
      setError(null);
      setStatus("starting");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const { BrowserMultiFormatReader, BrowserCodeReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        const available = await BrowserCodeReader.listVideoInputDevices();
        setDevices(available.map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` })));
        const selected = preferredId || deviceId || available[0]?.deviceId;
        setDeviceId(selected);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 1500 });
        controlsRef.current = await reader.decodeFromVideoDevice(selected, videoRef.current!, (result) => {
          if (!result || pausedRef.current) return;
          const value = result.getText();
          const now = Date.now();
          if (lastRef.current.value === value && now - lastRef.current.at < 2500) return;
          lastRef.current = { value, at: now };
          onDetect(value);
        });
        setStatus("running");
      } catch (err) {
        stop();
        setStatus("error");
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") setError(t("scan.permissionDenied"));
        else if (name === "NotFoundError" || name === "OverconstrainedError") setError(t("scan.cameraUnavailable"));
        else setError(t("scan.permissionDenied"));
      }
    },
    [deviceId, onDetect, stop, t],
  );

  useEffect(() => stop, [stop]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-200 bg-ink">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          aria-label={t("scan.scanning")}
        />
        {status === "running" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="relative h-36 w-64 max-w-[75%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,18,0.35)]">
              <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-forest-300" />
            </div>
          </div>
        ) : null}
        {status !== "running" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-white">
            {status === "starting" ? (
              <Loader2 className="h-8 w-8 animate-spin text-sage-300" aria-hidden="true" />
            ) : (
              <Camera className="h-8 w-8 text-sage-300" aria-hidden="true" />
            )}
            <p className="max-w-xs text-sm text-stone-300">
              {status === "error" ? error : t("scan.permissionBody")}
            </p>
            {status === "error" ? (
              <Button variant="secondary" onClick={() => start()}>
                <RefreshCw className="h-4 w-4" /> {t("common.retry")}
              </Button>
            ) : status === "idle" ? (
              <Button variant="secondary" onClick={() => start()}>
                <Camera className="h-4 w-4" /> {t("scan.startCamera")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {status === "running" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {continuous ? t("scan.tab.continuous") : t("scan.scanning")}
          </p>
          <div className="flex gap-2">
            {devices.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const index = devices.findIndex((d) => d.deviceId === deviceId);
                  const next = devices[(index + 1) % devices.length];
                  stop();
                  void start(next.deviceId);
                }}
              >
                <SwitchCamera className="h-4 w-4" /> {t("scan.switchCamera")}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={stop}>
              <CameraOff className="h-4 w-4" /> {t("scan.stopCamera")}
            </Button>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <p className="text-xs text-stone-500">{t("scan.permissionBody")}</p>
      ) : null}
    </div>
  );
}
