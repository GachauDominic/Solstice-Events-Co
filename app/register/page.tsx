"use client";

import { useEffect, useState } from "react";

type Attendee = {
  id: string;
  name: string;
  qrCode: string;
  qrImage: string | null;
  status: string;
  revokedAt: string | null;
  createdAt?: string;
};

type CreatedAttendee = {
  attendee: { id: string; name: string };
  qrDataUrl: string;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedAttendee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [printing, setPrinting] = useState<{ name: string; qrImage: string } | null>(null);

  async function loadAttendees() {
    try {
      const res = await fetch("/api/attendees");
      const data = await res.json();
      if (res.ok) setAttendees(data.attendees ?? []);
    } catch {
      // Non-fatal - the list is a convenience view, registration still works.
    }
  }

  useEffect(() => {
    loadAttendees();
  }, []);

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
      loadAttendees();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint(name: string, qrImage: string) {
    setPrinting({ name, qrImage });
    // Let the printable node render before invoking the browser print
    // dialog - it's the only thing visible under the @media print rule.
    requestAnimationFrame(() => window.print());
  }

  return (
    <main style={styles.stage}>
      <style>{`
        .print-only { position: absolute; left: -9999px; top: -9999px; }
        @media print {
          body * { visibility: hidden; }
          #printable-badge, #printable-badge * { visibility: visible; }
          #printable-badge.print-only { position: fixed; left: 0; top: 0; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        }
      `}</style>

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
            <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
              <a href={created.qrDataUrl} download={`${created.attendee.name}-badge.png`} style={{ color: "var(--coral)" }}>
                Download badge QR
              </a>
              <button
                type="button"
                onClick={() => handlePrint(created.attendee.name, created.qrDataUrl)}
                style={{ ...styles.button, padding: "4px 12px", marginTop: 0 }}
              >
                Print badge
              </button>
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
              Saved - this badge can be downloaded or reprinted anytime from the list below.
            </p>
          </div>
        )}
      </div>

      <div style={{ ...styles.frame, marginTop: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>Registered attendees</h2>
        {attendees.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No attendees yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {attendees.map((a) => (
              <li key={a.id} style={styles.row}>
                {a.qrImage && (
                  <img src={a.qrImage} alt={`${a.name} badge QR`} width={48} height={48} style={{ borderRadius: 3, background: "#fff", padding: 4 }} />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 14 }}>{a.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                    {a.revokedAt ? "Revoked" : a.status}
                  </p>
                </div>
                {a.qrImage && (
                  <>
                    <a href={a.qrImage} download={`${a.name}-badge.png`} style={{ color: "var(--coral)", fontSize: 13 }}>
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => handlePrint(a.name, a.qrImage!)}
                      style={{ ...styles.button, padding: "4px 12px", marginTop: 0, fontSize: 13 }}
                    >
                      Print
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {printing && (
        <div id="printable-badge" className="print-only">
          <p style={{ fontFamily: "var(--mono)", fontSize: 16, marginBottom: 12 }}>{printing.name}</p>
          <img src={printing.qrImage} alt={`${printing.name} badge QR`} width={280} height={280} />
        </div>
      )}
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
  row: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" },
};
