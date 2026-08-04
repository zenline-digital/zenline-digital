import { useState, useEffect } from "react";

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const SB_URL = "https://ioniqxioapcdgenpksex.supabase.co";

async function sbFetch(path, method = "GET", body = null) {
  const key = localStorage.getItem("is_supa_key") || import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
  const h = { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=representation" };
  const r = await fetch(`${SB_URL}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok && r.status !== 204) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `Supabase ${r.status}`); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// ─── UI Components ────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{ width: 56, height: 30, borderRadius: 15, background: on ? "#16a34a" : "#1e1e30", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background .3s", flexShrink: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 4, left: on ? 30 : 4, transition: "left .3s", boxShadow: "0 1px 4px #00000040" }} />
    </div>
  );
}

function Spinner({ size = 18 }) {
  return <div style={{ width: size, height: size, border: `2px solid #7c3aed30`, borderTop: `2px solid #7c3aed`, borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />;
}

function Input({ label, value, onChange, placeholder, type = "text", hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</label>}
      {type === "textarea"
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none" }} />
      }
      {hint && <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main SEO Component ───────────────────────────────────────────────────────
export default function SEO() {
  const [config, setConfig]           = useState(null);
  const [log, setLog]                 = useState([]);
  const [queue, setQueue]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [triggering, setTriggering]   = useState(false);
  const [addingKw, setAddingKw]       = useState(false);
  const [newKw, setNewKw]             = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast]             = useState("");
  const [genKwLoading, setGenKwLoading] = useState(false);

  // Editable config fields
  const [wpUrl, setWpUrl]       = useState("");
  const [wpUser, setWpUser]     = useState("");
  const [wpPass, setWpPass]     = useState("");
  const [postStatus, setPostStatus] = useState("draft");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgs, logs, kws] = await Promise.all([
        sbFetch("/rest/v1/seo_automation?limit=1"),
        sbFetch("/rest/v1/seo_activity_log?order=created_at.desc&limit=30"),
        sbFetch("/rest/v1/seo_keyword_queue?order=created_at.asc&limit=50"),
      ]);
      const cfg = Array.isArray(cfgs) && cfgs[0];
      if (cfg) {
        setConfig(cfg);
        setWpUrl(cfg.wp_url || "https://thugfit.ae");
        setWpUser(cfg.wp_username || "");
        setWpPass(cfg.wp_app_password || "");
        setPostStatus(cfg.post_status || "draft");
      } else {
        // Create initial config
        const created = await sbFetch("/rest/v1/seo_automation", "POST", { is_enabled: false, wp_url: "https://thugfit.ae", post_status: "draft" });
        const newCfg = Array.isArray(created) ? created[0] : created;
        setConfig(newCfg);
      }
      setLog(Array.isArray(logs) ? logs : []);
      setQueue(Array.isArray(kws) ? kws : []);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // ─── Toggle automation ──────────────────────────────────────────────────────
  const toggleAutomation = async (on) => {
    if (!config?.id) return;
    setSaving(true);
    try {
      await sbFetch(`/rest/v1/seo_automation?id=eq.${config.id}`, "PATCH", { is_enabled: on });
      setConfig(prev => ({ ...prev, is_enabled: on }));
      showToast(on ? "✅ Automation started — first article publishes at 9 AM UAE time" : "⏸ Automation paused");
    } catch (e) { showToast("❌ " + e.message); }
    finally { setSaving(false); }
  };

  // ─── Save settings ──────────────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!config?.id) return;
    setSaving(true);
    try {
      await sbFetch(`/rest/v1/seo_automation?id=eq.${config.id}`, "PATCH", {
        wp_url: wpUrl, wp_username: wpUser, wp_app_password: wpPass, post_status: postStatus,
      });
      setConfig(prev => ({ ...prev, wp_url: wpUrl, wp_username: wpUser, wp_app_password: wpPass, post_status: postStatus }));
      setShowSettings(false);
      showToast("✅ Settings saved");
    } catch (e) { showToast("❌ " + e.message); }
    finally { setSaving(false); }
  };

  // ─── Manual trigger ─────────────────────────────────────────────────────────
  const triggerNow = async () => {
    if (!config?.wp_username || !config?.wp_app_password) {
      showToast("⚠ Add WordPress credentials in Settings first"); setShowSettings(true); return;
    }
    setTriggering(true);
    try {
      const secret = localStorage.getItem("is_cron_secret") || "";
      const res = await fetch("/api/seo-cron", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}`, "x-vercel-cron": "1" } });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Published: "${data.title}"`);
        setTimeout(loadAll, 2000);
      } else if (data.skipped) {
        showToast("ℹ " + data.reason);
      } else {
        showToast("❌ " + (data.error || "Unknown error"));
      }
    } catch (e) { showToast("❌ " + e.message); }
    finally { setTriggering(false); }
  };

  // ─── Add keyword to queue ───────────────────────────────────────────────────
  const addKeyword = async () => {
    if (!newKw.trim()) return;
    setAddingKw(true);
    try {
      await sbFetch("/rest/v1/seo_keyword_queue", "POST", { keyword: newKw.trim(), used: false, priority: 8 });
      setNewKw("");
      showToast("✅ Keyword added to queue");
      const kws = await sbFetch("/rest/v1/seo_keyword_queue?order=created_at.asc&limit=50");
      setQueue(Array.isArray(kws) ? kws : []);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setAddingKw(false); }
  };

  // ─── AI generate keywords ───────────────────────────────────────────────────
  const generateKeywords = async () => {
    setGenKwLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: "You are an SEO keyword researcher specialising in UAE e-commerce and activewear.",
          messages: [{ role: "user", content: "Generate 15 high-value SEO keywords for THUGFIT (premium gym activewear brand, thugfit.ae, UAE market — Dubai, Abu Dhabi). Mix of: product keywords, informational, local UAE. Return ONLY a JSON array of keyword strings, nothing else. Example: [\"gym leggings Dubai\",\"men shorts UAE\"]" }],
        }),
      });
      const data = await res.json();
      const text = data.content[0].text.trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const keywords = JSON.parse(clean);
      if (Array.isArray(keywords)) {
        await Promise.all(keywords.map(kw => sbFetch("/rest/v1/seo_keyword_queue", "POST", { keyword: kw, used: false, priority: 5 }).catch(() => {})));
        showToast(`✅ Added ${keywords.length} AI-generated keywords to queue`);
        const kws = await sbFetch("/rest/v1/seo_keyword_queue?order=created_at.asc&limit=50");
        setQueue(Array.isArray(kws) ? kws : []);
      }
    } catch (e) { showToast("❌ " + e.message); }
    finally { setGenKwLoading(false); }
  };

  const removeKeyword = async (id) => {
    try {
      await sbFetch(`/rest/v1/seo_keyword_queue?id=eq.${id}`, "DELETE");
      setQueue(prev => prev.filter(k => k.id !== id));
    } catch (e) { showToast("❌ " + e.message); }
  };

  // ─── Computed ────────────────────────────────────────────────────────────────
  const isOn = config?.is_enabled || false;
  const lastRun = config?.last_run;
  const latestPost = log.find(l => l.action === "blog_published" && l.status !== "failed");
  const pending = queue.filter(k => !k.used).length;
  const published = log.filter(l => l.action === "blog_published" && l.status !== "failed").length;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0d0d16", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "#64748b" }}>
      <Spinner size={24} /> Loading SEO Agent…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d16", color: "#e2e8f0", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#0d0d16;} ::-webkit-scrollbar-thumb{background:#2a2a40;border-radius:3px;}
        select option{background:#0d0d16;color:#e2e8f0;} input::placeholder,textarea::placeholder{color:#3a3a5c;}
        textarea{font-family:inherit;}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 10, padding: "12px 18px", fontSize: 13, color: "#e2e8f0", boxShadow: "0 8px 32px #00000060", maxWidth: 380 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#09090f", borderBottom: "1px solid #1e1e30", padding: "18px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, background: isOn ? "linear-gradient(135deg,#16a34a,#059669)" : "linear-gradient(135deg,#7c3aed,#2563eb)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, transition: "background .5s" }}>🤖</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.4px" }}>SEO Autopilot</div>
          <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 1 }}>THUGFIT · thugfit.ae — Fully Autonomous SEO Agent</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => { setShowSettings(!showSettings); }} style={{ background: "none", border: "1px solid #1e1e30", color: "#4a4a6a", padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            ⚙ Settings
          </button>
          <button onClick={loadAll} style={{ background: "none", border: "1px solid #1e1e30", color: "#4a4a6a", padding: "7px 12px", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>↻</button>
        </div>
      </div>

      <div style={{ padding: "28px", maxWidth: 1000, margin: "0 auto" }}>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 22, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, color: "#e2e8f0" }}>⚙ WordPress Connection</div>
            <div style={{ fontSize: 12, color: "#64748b", background: "#0d0d16", border: "1px solid #1e1e30", borderRadius: 8, padding: "10px 14px", marginBottom: 16, lineHeight: 1.7 }}>
              <strong style={{ color: "#a78bfa" }}>How to get your WordPress Application Password:</strong><br />
              1. Log into thugfit.ae/wp-admin<br />
              2. Go to <strong>Users → Your Profile</strong><br />
              3. Scroll to <strong>Application Passwords</strong> section<br />
              4. Enter name "ZenLine Digital" → click <strong>Add New Application Password</strong><br />
              5. Copy the password shown (only visible once) → paste below
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Input label="WordPress Site URL" value={wpUrl} onChange={e => setWpUrl(e.target.value)} placeholder="https://thugfit.ae" />
              <Input label="WordPress Username" value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="admin or your WP username" />
            </div>
            <Input label="Application Password" type="password" value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
            <Select label="Publish articles as" value={postStatus} onChange={e => setPostStatus(e.target.value)}
              options={[{ value: "draft", label: "Draft — you review before publishing (recommended)" }, { value: "publish", label: "Live immediately — auto-publishes without review" }]} />
            <div style={{ fontSize: 11, color: "#4ade80", background: "#16a34a10", border: "1px solid #16a34a30", borderRadius: 6, padding: "8px 12px", marginBottom: 14 }}>
              💡 Start with "Draft" — you can review each article in WordPress before it goes live. Switch to "Live" when you're happy with the quality.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveSettings} disabled={saving} style={{ padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }}>
                {saving ? "Saving…" : "Save Settings"}
              </button>
              <button onClick={() => setShowSettings(false)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #1e1e30", cursor: "pointer", fontSize: 13, background: "#0d0d16", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Main ON/OFF Card */}
        <div style={{ background: isOn ? "#0a1a0a" : "#13131f", border: "2px solid", borderColor: isOn ? "#16a34a50" : "#1e1e30", borderRadius: 16, padding: 28, marginBottom: 24, transition: "all .4s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: isOn ? "#4ade80" : "#e2e8f0" }}>
                  {isOn ? "🟢 Running" : "⚪ Paused"}
                </div>
                {isOn && <div style={{ fontSize: 11, background: "#16a34a20", color: "#4ade80", border: "1px solid #16a34a40", borderRadius: 20, padding: "3px 10px", fontWeight: 700, animation: "pulse 2s ease-in-out infinite" }}>ACTIVE</div>}
              </div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                {isOn
                  ? `Publishing one SEO article to thugfit.ae every day at 9:00 AM UAE time. ${lastRun ? `Last run: ${timeAgo(lastRun)}.` : "Not yet run."}`
                  : "Turn on to start publishing SEO articles to thugfit.ae automatically every day. No action needed after turning on."}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Toggle on={isOn} onChange={toggleAutomation} disabled={saving} />
              <div style={{ fontSize: 10, color: "#3a3a5c", fontWeight: 600 }}>{isOn ? "ON" : "OFF"}</div>
            </div>
          </div>

          {/* Status row */}
          {isOn && latestPost && (
            <div style={{ marginTop: 18, background: "#0d0d16", border: "1px solid #16a34a30", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 20 }}>📝</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>Latest article</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{latestPost.title}</div>
                <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 2 }}>Keyword: {latestPost.keyword} · {timeAgo(latestPost.created_at)}</div>
              </div>
              {latestPost.wp_post_url && (
                <a href={latestPost.wp_post_url} target="_blank" rel="noreferrer"
                  style={{ background: "#7c3aed20", border: "1px solid #7c3aed40", color: "#a78bfa", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                  View in WP →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Articles Published", value: published, icon: "📄", color: "#4ade80" },
            { label: "Keywords in Queue", value: pending, icon: "🔑", color: "#a78bfa" },
            { label: "Next Post", value: isOn ? "9:00 AM today/tomorrow" : "Paused", icon: "⏰", color: "#fb923c" },
            { label: "Post Status", value: config?.post_status === "publish" ? "Live immediately" : "Draft review", icon: "📤", color: "#60a5fa" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: 20, color }}>{value}</div>
              <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Keyword Queue */}
          <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🔑 Keyword Queue</div>
              <button onClick={generateKeywords} disabled={genKwLoading}
                style={{ background: "#7c3aed20", border: "1px solid #7c3aed40", color: "#a78bfa", padding: "5px 11px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {genKwLoading ? <><Spinner size={12} /> Generating…</> : "✨ AI Generate Keywords"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#3a3a5c", marginBottom: 12 }}>
              Articles are published using these keywords in order. When queue is empty, the agent uses its built-in UAE activewear keyword list.
            </div>
            {/* Add keyword */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="Add a keyword…" onKeyDown={e => e.key === "Enter" && addKeyword()}
                style={{ flex: 1, background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "8px 11px", borderRadius: 7, fontSize: 12, outline: "none" }} />
              <button onClick={addKeyword} disabled={addingKw || !newKw.trim()}
                style={{ padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }}>
                + Add
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {queue.length === 0
                ? <div style={{ color: "#2a2a40", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No keywords in queue — agent uses built-in list</div>
                : queue.map((kw, i) => (
                  <div key={kw.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0d16", border: "1px solid", borderColor: kw.used ? "#1e1e30" : "#2a2a40", borderRadius: 7, padding: "8px 11px", opacity: kw.used ? 0.4 : 1 }}>
                    <span style={{ fontSize: 10, color: "#3a3a5c", minWidth: 18 }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12, color: kw.used ? "#3a3a5c" : "#e2e8f0", textDecoration: kw.used ? "line-through" : "none" }}>{kw.keyword}</span>
                    {kw.used
                      ? <span style={{ fontSize: 9, color: "#16a34a", fontWeight: 700 }}>✓ DONE</span>
                      : <button onClick={() => removeKeyword(kw.id)} style={{ background: "none", border: "none", color: "#3a3a5c", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                    }
                  </div>
                ))
              }
            </div>
          </div>

          {/* Activity Log */}
          <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Activity Log</div>
              <button onClick={triggerNow} disabled={triggering}
                style={{ background: triggering ? "#1a1a2e" : "linear-gradient(135deg,#7c3aed,#2563eb)", border: "none", color: triggering ? "#3a3a5c" : "#fff", padding: "6px 14px", borderRadius: 7, cursor: triggering ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {triggering ? <><Spinner size={13} /> Publishing…</> : "▶ Publish Now"}
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {log.length === 0
                ? <div style={{ color: "#2a2a40", fontSize: 12, textAlign: "center", padding: "30px 0" }}>No activity yet — turn on automation or click "Publish Now"</div>
                : log.map(entry => (
                  <div key={entry.id} style={{ background: "#0d0d16", border: "1px solid", borderColor: entry.status === "failed" ? "#ef444430" : entry.action === "error" ? "#ef444430" : "#1e1e30", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                        {entry.status === "failed" || entry.action === "error" ? "❌" : entry.action === "blog_published" ? "📝" : "ℹ"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {entry.title && <div style={{ fontWeight: 600, fontSize: 12, color: "#e2e8f0", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.title}</div>}
                        {entry.keyword && <div style={{ fontSize: 11, color: "#64748b" }}>🔑 {entry.keyword}</div>}
                        {entry.status && <div style={{ fontSize: 10, color: entry.status === "failed" ? "#f87171" : "#4ade80", marginTop: 3, fontWeight: 600 }}>{entry.status.toUpperCase()}</div>}
                        {entry.error && <div style={{ fontSize: 10, color: "#f87171", marginTop: 3 }}>{entry.error.slice(0, 80)}</div>}
                        {entry.wp_post_url && (
                          <a href={entry.wp_post_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#7c3aed", textDecoration: "none" }}>View in WordPress →</a>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#2a2a40", flexShrink: 0 }}>{timeAgo(entry.created_at)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* How it works */}
        <div style={{ background: "#0d0d14", border: "1px solid #1e1e30", borderRadius: 12, padding: 20, marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#64748b", marginBottom: 14 }}>ℹ How the SEO Autopilot works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[
              { step: "1", title: "Every morning at 9 AM", desc: "The agent wakes up automatically — no action needed from you" },
              { step: "2", title: "Picks a keyword", desc: "Uses your queue first, then falls back to 30 built-in UAE activewear keywords" },
              { step: "3", title: "Writes the article", desc: "Claude writes a 1,200–1,500 word SEO-optimised article about THUGFIT products" },
              { step: "4", title: "Publishes to WordPress", desc: "Sends directly to thugfit.ae/wp-admin — as draft for review or live immediately" },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ textAlign: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, margin: "0 auto 10px" }}>{step}</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 5 }}>{title}</div>
                <div style={{ fontSize: 11, color: "#4a4a6a", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
