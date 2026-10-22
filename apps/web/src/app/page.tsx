export default function Home() {
  return (
    <main style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 24, padding: 32,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 48, color: "var(--color-accent)" }}>◆</div>
      <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>DayMark</h1>
      <p style={{ fontSize: 18, color: "var(--color-text-muted)", maxWidth: 480, lineHeight: 1.6 }}>
        A focused Mac workspace for Markdown notes, daily planning, tasks and your calendar.
        Your notes stay in a folder you control.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {process.env.NEXT_PUBLIC_MANAGER_RELEASE_URL ? (
          <a
            href={process.env.NEXT_PUBLIC_MANAGER_RELEASE_URL}
            style={{
              padding: "12px 28px", background: "var(--color-accent)",
              borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 16,
              textDecoration: "none",
            }}
          >
            Download for Mac
          </a>
        ) : (
          <span style={{ padding: "12px 28px", color: "var(--color-text-muted)" }}>
            Mac release in progress
          </span>
        )}
        <a
          href="/docs"
          style={{
            padding: "12px 28px", background: "var(--color-bg-elevated)",
            borderRadius: 8, color: "var(--color-text)", fontWeight: 600, fontSize: 16,
            textDecoration: "none", border: "1px solid var(--color-border)",
          }}
        >
          View Docs
        </a>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16, maxWidth: 800, width: "100%", marginTop: 40,
      }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{
            background: "var(--color-bg-elevated)", borderRadius: 10,
            padding: 20, border: "1px solid var(--color-border)",
            textAlign: "left",
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

const FEATURES = [
  { icon: "📅", title: "Daily Notes",        desc: "A fresh page every day. Write, plan, and reflect in your own markdown." },
  { icon: "✓",  title: "Smart Task Views",   desc: "See overdue, today, and upcoming tasks across all your notes at once." },
  { icon: "🔗", title: "Wiki-Links",         desc: "[[Link]] between notes to build a connected knowledge graph." },
  { icon: "☁",  title: "Your Files",         desc: "Store your Markdown vault locally or in your iCloud Drive folder." },
  { icon: "✦",  title: "Optional AI",       desc: "Bring your own Gemini key. A note is sent only when you ask." },
  { icon: "◉",  title: "Graph View",         desc: "Visualize your note connections with an interactive force graph." },
  { icon: "🎤", title: "Voice Notes",        desc: "Record voice memos and get instant transcription." },
];
