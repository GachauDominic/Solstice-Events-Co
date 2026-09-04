"use client";

import { useState } from "react";

type CreatedAttendee = {
  attendee: { id: string; name: string };
  qrDataUrl: string;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedAttendee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/attendees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Could not create attendee. Check the name and try again.");
        return;
      }
      setCreated(data);
      setName("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.stage}>
      <div style={styles.frame}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>SOLSTICE EVENTS CO.</span>
          <h1 style={styles.title}>Register Attendee</h1>
        </header>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="attendee-name">Attendee name</label>
          <input id="attendee-name" required value={name} onChange={(e) => setName(e.target.value)} style={styles.input} autoFocus />
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? "Generating..." : "Create & Generate QR"}
          </button>
        </form>
        {error && <p style={{ color: "var(--coral)" }}>{error}</p>}
        {created && (
          <div style={styles.result}>
            <p style={{ margin: "0 0 12px", fontFamily: "var(--mono)" }}>{created.attendee.name}</p>
            <img src={created.qrDataUrl} alt="Generated badge QR code" width={220} height={220} style={{ borderRadius: 3, background: "#fff", padding: 8 }} />
            <p style={{ marginTop: 12 }}>
              <a href={created.qrDataUrl} download={`${created.attendee.name}-badge.png`} style={{ color: "var(--coral)" }}>
                Download badge QR
              </a>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  stage: { width: "100%", maxWidth: 480 },
  frame: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 4, padding: 32 },
  header: { marginBottom: 24 },
  eyebrow: { fontFamily: "var(--mono)", fontSize: 12, letterSpacing: "0.14em", color: "var(--muted)" },
  title: { margin: "6px 0 0", fontSize: 26, fontWeight: 600 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  label: { display: "block", fontSize: 12, color: "var(--muted)" },
  input: { width: "100%", padding: "10px 12px", background: "var(--ink)", border: "1px solid var(--line)", borderRadius: 3, color: "var(--paper)", fontSize: 14 },
  button: { marginTop: 6, padding: "12px 20px", background: "var(--paper)", color: "var(--ink)", border: "none", borderRadius: 3, fontWeight: 600, cursor: "pointer" },
  result: { marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--line)" },
};
