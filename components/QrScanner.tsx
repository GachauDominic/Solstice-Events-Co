"use client";

import { useEffect, useRef } from "react";

type Props = {
  active: boolean; // pause scanning while a check-in is being processed
  onDecoded: (text: string) => void;
};

const ELEMENT_ID = "qr-reader";

export default function QrScanner({ active, onDecoded }: Props) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode(ELEMENT_ID, /* verbose= */ false);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => onDecoded(decodedText),
          undefined // ignore per-frame decode failures (normal while aiming)
        );
        runningRef.current = true;
      } catch (err) {
        console.error("Could not start camera scanner", err);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (runningRef.current && scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => undefined);
        runningRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause/resume the live decode loop while a scan is being processed, so
  // the same badge held in front of the camera doesn't fire a second
  // check-in request before the first one resolves.
  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || !runningRef.current) return;
    if (!active) {
      scanner.pause(true);
    } else {
      scanner.resume();
    }
  }, [active]);

  return (
    <div>
      <div id={ELEMENT_ID} style={{ borderRadius: 3, overflow: "hidden" }} />
    </div>
  );
}
