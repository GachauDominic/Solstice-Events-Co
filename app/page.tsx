"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
});

type ScanState =
  | { phase: "idle" }
  | { phase: "pending"; checkInId: string }
  | { phase: "checked_in"; attendeeName?: string }
  | { phase: "already_checked_in"; attendeeName?: string }
  | { phase: "failed"; reason?: string };

const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 30000;

export default function KioskPage() {
  const [qrCode, setQrCode] = useState("");
  const [state, setState] = useState<ScanState>({ phase: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function submitScan(scannedCode: string) {
    if (!scannedCode || isProcessingRef.current) return;
    isProcessingRef.current = true;
    let isPolling = false;
    if (pollRef.current) clearInterval(pollRef.current);
    setIsSubmitting(true);
    setQrCode(scannedCode);
    setState({ phase: "pending", checkInId: "submitting" });

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: qrCode.trim() }),
      });
      const data = await res.json();

      if (data.result === "ALREADY_CHECKED_IN") {
        setState({ phase: "already_checked_in", attendeeName: data.attendee?.name });
        return;
      }
      if (data.result === "PENDING" && data.checkInId) {
        isPolling = true;
        setState({ phase: "pending", checkInId: data.checkInId });
        pollRef.current = setInterval(() => pollStatus(data.checkInId), POLL_INTERVAL_MS);
        timeoutRef.current = setTimeout(() => {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            timeoutRef.current = null;
            isProcessingRef.current = false;
            setState({ phase: "failed", reason: "The printer is taking longer than expected." });
          }
        }, POLL_TIMEOUT_MS);
        return;
      }
      setState({ phase: "failed", reason: data.error ?? "We could not read that code." });
    } catch {
      setState({ phase: "failed", reason: "Connection issue. Please try scanning again." });
    } finally {
      setIsSubmitting(false);
      if (!isPolling) isProcessingRef.current = false;
    }
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    submitScan(qrCode.trim());
  }

  async function pollStatus(checkInId: string) {
    try {
      const res = await fetch(`/api/checkin/${checkInId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.checkInStatus === "CONFIRMED") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pollRef.current = null;
        timeoutRef.current = null;
        isProcessingRef.current = false;
        setState({ phase: "checked_in", attendeeName: data.attendeeName });
      } else if (data.checkInStatus === "FAILED") {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pollRef.current = null;
        timeoutRef.current = null;
        isProcessingRef.current = false;
        setState({ phase: "failed", reason: data.failureReason });
      }
    } catch {
      // Keep polling through a transient kiosk network interruption.
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    isProcessingRef.current = false;
    setQrCode("");
    setState({ phase: "idle" });
    inputRef.current?.focus();
  }

  let status: [string, string, string, string];
  if (state.phase === "pending") {
    status = [state.checkInId === "submitting" ? "Reading your pass" : "Printing your badge", "Please keep this screen open for a moment.", "◌", ""];
  } else if (state.phase === "checked_in") {
    status = ["You are checked in", state.attendeeName ? `Welcome, ${state.attendeeName}.` : "Your badge is ready. Enjoy the event!", "✓", ""];
  } else if (state.phase === "already_checked_in") {
    status = ["Already checked in", state.attendeeName ? `${state.attendeeName} has already collected a badge.` : "This pass has already been used.", "!", ""];
  } else if (state.phase === "failed") {
    status = ["We could not finish that", state.reason ?? "Please scan your code again.", "×", "Try again"];
  } else {
    status = ["Ready when you are", "Scan your event QR code to print your badge.", "•", ""];
  }

  return (
    <main className="kiosk">
      <header className="kiosk-header">
        <div className="wordmark"><span className="wordmark-mark">S</span><span>Solstice Events</span></div>
        <span className="header-note">WELCOME DESK / 01</span>
      </header>

      <section className="kiosk-main" aria-labelledby="page-title">
        <p className="eyebrow">The day starts here</p>
        <h1 id="page-title">Welcome to your next bright idea.</h1>
        <p className="intro">Check in below and we will print your event badge while you take in the room.</p>

        <form className="scan-form" onSubmit={handleScan}>
          <input ref={inputRef} value={qrCode} onChange={(e) => setQrCode(e.target.value)} aria-label="Event QR code" placeholder="Scan or enter your QR code" className="scan-input" autoFocus disabled={isSubmitting} />
          <button className="scan-button" type="submit" disabled={isSubmitting || !qrCode.trim()}>{isSubmitting ? "Checking..." : "Check in"}</button>
        </form>

        <div className="camera-scanner" aria-label="Camera QR scanner">
          <QrScanner active={state.phase === "idle" && !isSubmitting} onDecoded={submitScan} />
          <p className="camera-note">Or point your camera at the event QR code.</p>
        </div>

        <div className="status-panel" data-phase={state.phase} role="status" aria-live="polite">
          <div className="status-icon" aria-hidden="true">{status[2]}</div>
          <div className="status-copy"><p className="status-title">{status[0]}</p><p className="status-detail">{status[1]}</p></div>
          {state.phase === "failed" && <button className="retry-button status-action" type="button" onClick={reset}>{status[3]}</button>}
        </div>
      </section>

      <footer className="kiosk-footer"><span className="footer-rule" aria-hidden="true" /><span>Make space for what is next.</span><span>Solstice '24</span></footer>
    </main>
  );
}
