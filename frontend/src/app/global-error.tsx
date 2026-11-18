'use client';

/** Last-resort boundary (rendered inside its own <html>): keeps the failure
 * readable even when the whole document tree throws. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#ffffff', color: '#0A1128' }}>
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>This page hit an unexpected error</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4b5563' }}>
            Try again, and if it keeps happening, send the details below to the VaceUp team.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, background: '#f3f4f6', padding: 16, borderRadius: 12 }}>
            {error.message || 'Unknown error'}
            {error.digest ? ` (ref: ${error.digest})` : ''}
          </pre>
          <button
            type="button"
            onClick={reset}
            style={{ background: '#FFC72C', color: '#0A1128', fontWeight: 700, border: 0, borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
