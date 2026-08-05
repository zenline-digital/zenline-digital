import { useState, useEffect } from "react";
import Chat from "./Chat.jsx";

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmlxeGlvYXBjZGdlbnBrc2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc1MDIsImV4cCI6MjEwMDcyMzUwMn0.PS80PFMqBYMf0e6uiYvTFk90gF7a7jo97C-dzzxUGho";

const ADMIN_EMAILS = ["midhun@thugfit.ae"];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const TYPE_COLORS = { motivation:"#8B7CF8", training_tips:"#00C9A7", lifestyle:"#F472B6", community:"#FBBF24", product:"#60A5FA" };
const C = { bg:"#07091A", surf:"#0D1117", card:"#131929", border:"#1C2537", purple:"#8B7CF8", teal:"#00C9A7", amber:"#FBBF24", pink:"#F472B6", blue:"#60A5FA", danger:"#F87171", text:"#E2E8F7", muted:"#6B7EB8" };

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const supa = {
  post: async (table, body) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d;
  },
  patch: async (table, body, eq) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${eq}`, {
      method: "PATCH",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    return r.json();
  },
  upsert: async (table, body, onConflict) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || `Supabase error ${r.status}`);
    return d;
  }
};

// ─── Claude API ───────────────────────────────────────────────────────────────
async function claude(system, user, maxTokens = 1000) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  const text = await r.text();
  let d;
  try { d = JSON.parse(text); }
  catch { throw new Error("API error: " + text.slice(0, 120)); }
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  if (!d.content?.[0]?.text) throw new Error("Empty response from API");
  return d.content[0].text;
}

// ─── Gemini Image API ─────────────────────────────────────────────────────────
async function geminiImage(apiKey, prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  const parts = d.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image returned from Gemini — enable billing at console.cloud.google.com");
}

function parseJSON(text) {
  const c = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const m = c.match(/[\[{][\s\S]*[\]}]/);
  return JSON.parse(m ? m[0] : c);
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const btn = (color, outline = false, extra = {}) => ({
  padding: "9px 18px", borderRadius: 8,
  border: outline ? `1px solid ${color}` : "none",
  background: outline ? "transparent" : color,
  color: outline ? color : "#fff",
  cursor: "pointer", fontSize: 13, fontWeight: 600,
  fontFamily: "inherit", transition: "opacity 0.15s", ...extra
});
const btnSm = (color) => ({
  padding: "5px 12px", borderRadius: 6, border: "none",
  background: `${color}20`, color, cursor: "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: "inherit"
});
const badge = (color) => ({
  display: "inline-block", padding: "2px 8px", borderRadius: 4,
  fontSize: 11, fontWeight: 600, background: `${color}20`, color, marginRight: 4
});
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 };

// ─── Agents ───────────────────────────────────────────────────────────────────
const AGENTS = [
  { id: "manager",      name: "Social Media Manager", emoji: "👔", color: C.purple, desc: "Orchestrates team, quality gates" },
  { id: "strategist",   name: "Content Strategist",   emoji: "🧠", color: C.teal,   desc: "Plans topics and direction" },
  { id: "promptWriter", name: "Prompt Writer",         emoji: "✍️", color: C.amber,  desc: "Crafts AI image prompts" },
  { id: "designer",     name: "Post Designer",         emoji: "🎨", color: C.pink,   desc: "Generates visuals via Gemini" },
  { id: "copywriter",   name: "Copywriter",            emoji: "📝", color: C.blue,   desc: "Writes captions & hashtags" },
];

const NAV = [
  { id: "dashboard", label: "Dashboard",       icon: "▤" },
  { id: "planner",   label: "Monthly Planner", icon: "◫" },
  { id: "queue",     label: "Content Queue",   icon: "≡" },
  { id: "approval",  label: "Approvals",       icon: "✓" },
  { id: "calendar",  label: "Calendar",        icon: "⊞" },
  { id: "seo",       label: "Auto SEO",        icon: "🔍" },
  { id: "settings",  label: "Settings",        icon: "⚙" },
  { id: "tasks",     label: "Staff Tasks",      icon: "✅" },
  { id: "chat",      label: "Team Chat",       icon: "💬" },
];



// ─── Platform Login Screen ────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const doLogin = async () => {
    if (!email || !password) { setError("Enter your email and password"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: SUPA_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const data = await r.json();
      if (data.error || data.error_description) throw new Error(data.error_description || data.error);
      localStorage.setItem("zl_session", JSON.stringify({ access_token: data.access_token, user: data.user }));
      onLogin({ access_token: data.access_token, user: data.user });
    } catch(e) {
      setError(e.message.includes("Invalid") ? "Incorrect email or password" : e.message);
    }
    setLoading(false);
  };

  const inp = { width: "100%", background: "#080C14", border: "1px solid #1C2537", borderRadius: 8, padding: "11px 14px", color: "#E2E8F7", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: "#6B7EB8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 7 };

  return (
    <div style={{ minHeight: "100vh", background: "#07091A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`*{box-sizing:border-box} input::placeholder{color:#2D3F5A} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 420, background: "#0D1117", border: "1px solid #1C2537", borderRadius: 20, padding: 44, boxShadow: "0 32px 80px #00000070" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#8B7CF8,#2563eb)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>⚡</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: "#E2E8F7", letterSpacing: "-0.5px" }}>ZenLine Digital</div>
          <div style={{ fontSize: 13, color: "#6B7EB8", marginTop: 6 }}>THUGFIT — Internal Platform</div>
        </div>

        {error && (
          <div style={{ background: "#f8717115", border: "1px solid #f8717140", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#f87171", marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="your@thugfit.ae" style={inp} autoFocus />
        </div>
        <div style={{ marginBottom: 28 }}>
          <label style={lbl}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="••••••••" style={inp} />
        </div>

        <button onClick={doLogin} disabled={loading} style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit", background: loading ? "#1C2537" : "linear-gradient(135deg,#8B7CF8,#2563eb)", color: loading ? "#6B7EB8" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}>
          {loading ? <><div style={{ width: 16, height: 16, border: "2px solid #6B7EB840", borderTop: "2px solid #6B7EB8", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> Signing in…</> : "Sign In →"}
        </button>

        <div style={{ fontSize: 12, color: "#2D3F5A", textAlign: "center", marginTop: 20 }}>
          Contact Midhun for access credentials
        </div>
      </div>
    </div>
  );
}

// ─── Google Business Profile Section ─────────────────────────────────────────
function GBPSection({ showToast, config }) {
  const [gbpTab, setGbpTab]           = useState("manual"); // "manual" | "auto"
  const [postText, setPostText]       = useState("");
  const [generating, setGenerating]   = useState(false);
  const [postTopic, setPostTopic]     = useState("weekly_promo");
  const [copied, setCopied]           = useState(false);
  const [oauthClientId, setOauthClientId]     = useState(localStorage.getItem("gbp_client_id") || "");
  const [oauthSecret, setOauthSecret]         = useState(localStorage.getItem("gbp_client_secret") || "");
  const [oauthConnected, setOauthConnected]   = useState(!!localStorage.getItem("gbp_access_token"));

  const TOPIC_OPTIONS = [
    { value: "weekly_promo",  label: "Weekly Promotion + Sale"      },
    { value: "new_arrivals",  label: "New Arrivals"                 },
    { value: "train_earn",    label: "Train & Earn Programme"       },
    { value: "workout_tip",   label: "Workout Tip + Product"        },
    { value: "bestsellers",   label: "Bestselling Products"         },
    { value: "gcc_shipping",  label: "GCC Shipping (Saudi/Kuwait)"  },
  ];

  const BRAND_CONTEXT = `
THUGFIT — Premium UAE Gym Activewear | thugfit.ae
Founded: 2026 | Based: Dubai, UAE
Customers: 282+ across UAE and GCC (Dubai 43%, Saudi Arabia 12%, Abu Dhabi 9%, Sharjah 5%, + Kuwait, Oman, Qatar, Bahrain)
Orders: 301 total | Average order: AED 115 | July revenue: AED 18,352 (40% growth from June)

TOP SELLING PRODUCTS:
- Fitflex Mens Shorts Green — AED 111 (bestseller #1)
- SprintHint 2-in-1 Shorts White — AED 102
- AeroFit Long Line Sports Bra (Red/Blue/Light Green) — AED 116
- SpinFit High Waist Leggings Green — AED 90
- AgileAura Tank Top Sky Blue — AED 103
- ActivePulse Shorts Black — AED 91
- Airman Armor 3-in-1 Pack — combo deal

CATEGORIES: Men's Shorts, Women's Sports Bras, Women's Leggings, Men's Tank Tops, Combos, Women's T-Shirts, Men's Hoodies

ACTIVE PROMOTIONS:
- 30% welcome discount auto-applied when new customer creates account (no code needed)
- Sitewide sale — most products heavily discounted (original prices crossed out)
- Free UAE shipping on orders above AED 300
- Free GCC shipping on orders above AED 500
- Train & Earn: members get unique code → their followers get 20% off → member earns commission + gets 40% VIP personal discount

SHIPPING:
- Dubai/Sharjah/Abu Dhabi: AED 25, next day
- RAK/Fujairah: AED 30, 1-2 days
- GCC: AED 30-45, 2-4 days
- Same-day dispatch for orders before 12 PM Sun-Thu

DO NOT MENTION: FunkyHues Performance-Stride Sports Bra Black or Leggings Black (out of stock)
`;

  const TOPIC_PROMPTS = {
    weekly_promo: `${BRAND_CONTEXT}
Write a Google Business Profile post about this week's THUGFIT promotions. Mention the 30% welcome discount for new accounts, sitewide sale prices, and free UAE shipping above AED 300. Reference 1-2 specific bestselling products with their real prices. Drive traffic to thugfit.ae.`,

    new_arrivals: `${BRAND_CONTEXT}
Write a Google Business Profile post announcing new arrivals at THUGFIT. Feature these new products: VelocityVibe Womens Pants, Whirlwind Womens T-Shirt, SpinFit High Waist Leggings, THUGFIT Sporty Mens Jacket, VitalVenture Athletic Mens Tank Top, StrikeZone Spaghetti Sports Bra. Mention they're on sale now. Link to thugfit.ae.`,

    train_earn: `${BRAND_CONTEXT}
Write a Google Business Profile post recruiting UAE fitness professionals to join THUGFIT Train & Earn programme. Key points: share your unique code → your followers get 20% off THUGFIT orders → you earn commission on every sale → plus you get 40% off your own personal orders. Apply at thugfit.ae/thugfit-train-earn. Target: personal trainers, gym coaches, fitness influencers.`,

    workout_tip: `${BRAND_CONTEXT}
Write a Google Business Profile post with a practical workout tip for UAE gym-goers (consider Dubai heat, indoor AC gyms, Ramadan fitness, summer training). Naturally connect the tip to wearing quality activewear from THUGFIT. Mention 1 relevant product (e.g. Fitflex Shorts for leg day, AeroFit Bra for cardio). Link to thugfit.ae.`,

    bestsellers: `${BRAND_CONTEXT}
Write a Google Business Profile post showcasing THUGFIT's bestselling products based on real sales data. Feature: Fitflex Mens Shorts (AED 111), AeroFit Long Line Sports Bra (AED 116), SpinFit Leggings (AED 90), SprintHint 2-in-1 Shorts (AED 102). These are proven bestsellers loved by UAE gym-goers. Mention the sitewide sale. Link to thugfit.ae.`,

    gcc_shipping: `${BRAND_CONTEXT}
Write a Google Business Profile post targeting GCC customers beyond Dubai — specifically Saudi Arabia, Kuwait, Oman, Qatar, Bahrain. Highlight that THUGFIT ships across GCC (AED 30-45, 2-4 days), free GCC shipping above AED 500. THUGFIT already has happy customers across 6 GCC countries. Drive traffic to thugfit.ae.`,
  };

  const generatePost = async () => {
    setGenerating(true);
    setPostText("");
    try {
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 600,
          system: "You write Google Business Profile posts for THUGFIT, a real UAE gym activewear brand with proven sales data. Use the exact product names, prices, and facts provided. Posts must feel authentic and specific — not generic. No hashtags. No markdown. Plain text only. Max 250 words.",
          messages: [{ role: "user", content: `${TOPIC_PROMPTS[postTopic]}

Additional requirements:
- 150-250 words, plain text only
- Use REAL product names and prices from the data above
- Mention Dubai/UAE naturally
- Start strong — not with "Welcome", "Hello", or "At THUGFIT"
- End with a clear CTA and thugfit.ae link
- No hashtags, no bullet points, no markdown
- Sound like a real brand, not AI-generated` }]
        })
      });
      const data = await res.json();
      setPostText(data.content[0].text.trim());
    } catch(e) { showToast("❌ " + e.message); }
    finally { setGenerating(false); }
  };

  const copyPost = async () => {
    navigator.clipboard.writeText(postText);
    setCopied(true);
    showToast("✅ Post copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
    // Log so Staff Tasks auto-validates "Post to Google Business Profile"
    await fetch(`${SUPA_URL}/rest/v1/seo_activity_log`, {
      method:"POST", headers:{apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, "Content-Type":"application/json", Prefer:"return=representation"},
      body: JSON.stringify({action:"gbp_post_manual", status:"completed", title:`GBP post copied: ${postTopic}`})
    }).catch(()=>{});
  };

  const saveOAuth = () => {
    localStorage.setItem("gbp_client_id", oauthClientId);
    localStorage.setItem("gbp_client_secret", oauthSecret);
    showToast("✅ OAuth credentials saved");
  };

  const connectGoogle = () => {
    if (!oauthClientId) { showToast("Enter your OAuth Client ID first"); return; }
    const redirectUri = encodeURIComponent("https://zenline-digital.vercel.app/api/gbp-callback");
    const scope = encodeURIComponent("https://www.googleapis.com/auth/business.manage");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.open(url, "_blank");
    showToast("Complete Google login in the new tab — come back here after");
  };

  const sBorder = "1px solid #1e1e30";
  const sCard = { background: "#0d0d16", border: sBorder, borderRadius: 10, padding: 16 };
  const sBtn = (bg, col="#fff", extra={}) => ({ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: bg, color: col, display: "flex", alignItems: "center", gap: 6, ...extra });
  const sInput = { width: "100%", background: "#0d0d16", border: sBorder, color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" };
  const sLabel = { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <div style={{ background: "#13131f", border: sBorder, borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button onClick={() => setGbpTab("manual")} style={{ ...sBtn(gbpTab === "manual" ? "#7c3aed" : "#1e1e30"), padding: "7px 16px", fontSize: 12 }}>
          ✍️ Option B — Staff Posts Daily (Active Now)
        </button>
        <button onClick={() => setGbpTab("auto")} style={{ ...sBtn(gbpTab === "auto" ? "#7c3aed" : "#1e1e30"), padding: "7px 16px", fontSize: 12 }}>
          🤖 Option A — Full Automation (Setup Pending)
        </button>
      </div>

      {/* OPTION B — MANUAL */}
      {gbpTab === "manual" && (
        <div>
          <div style={{ background: "#16a34a10", border: "1px solid #16a34a40", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#4ade80", lineHeight: 1.6 }}>
            ✅ <strong>Active now.</strong> Staff generates a post below, copies it, and pastes it into Google Business Profile. Takes 2 minutes daily. This keeps your GBP active while Option A is being approved by Google.
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={sLabel}>Post Topic</label>
              <select value={postTopic} onChange={e => setPostTopic(e.target.value)} style={sInput}>
                {TOPIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button onClick={generatePost} disabled={generating} style={{ ...sBtn("linear-gradient(135deg,#7c3aed,#2563eb)"), whiteSpace: "nowrap" }}>
              {generating ? <><div style={{ width: 14, height: 14, border: "2px solid #ffffff40", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> Generating…</> : "✨ Generate Post"}
            </button>
          </div>

          {postText && (
            <div>
              <div style={{ ...sCard, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{postText}</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={copyPost} style={{ ...sBtn(copied ? "#16a34a" : "#7c3aed") }}>
                  {copied ? "✅ Copied!" : "📋 Copy Post"}
                </button>
                <a href="https://business.google.com" target="_blank" rel="noreferrer"
                  style={{ ...sBtn("#1e1e30"), textDecoration: "none", color: "#e2e8f0" }}>
                  🌐 Open Google Business →
                </a>
                <button onClick={generatePost} disabled={generating} style={{ ...sBtn("#1e1e30", "#64748b") }}>
                  ↺ Regenerate
                </button>
              </div>

              <div style={{ background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 8, padding: "12px 16px", marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 8 }}>📋 Staff steps (do this after copying):</div>
                {[
                  "Go to business.google.com → sign in with the THUGFIT Google account",
                  "Click your business → Posts (left sidebar) → Create post",
                  "Select 'What's new' → paste the copied text",
                  "Optionally add a photo of a THUGFIT product",
                  "Click 'Post' — done",
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 12, color: "#94a3b8" }}>
                    <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPTION A — FULL AUTO */}
      {gbpTab === "auto" && (
        <div>
          <div style={{ background: "#fb923c10", border: "1px solid #fb923c40", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#fb923c", lineHeight: 1.6 }}>
            ⏳ <strong>Pending Google approval.</strong> Google must review and approve the OAuth app before this works. Typically takes 1–4 weeks. Continue with Option B while waiting.
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 12 }}>One-time setup steps:</div>

          <div style={{ ...sCard, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 10 }}>Step 1 — Enable APIs (do this now)</div>
            {[
              "console.cloud.google.com → Image Studio project",
              "APIs & Services → Library → search 'My Business Account Management API' → Enable",
              "APIs & Services → Library → search 'My Business Business Information API' → Enable",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {s}
              </div>
            ))}
          </div>

          <div style={{ ...sCard, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 10 }}>Step 2 — OAuth Consent Screen</div>
            {[
              "APIs & Services → OAuth consent screen → External → Create",
              "App name: 'ZenLine Digital' | User support email: midhun@thugfit.ae",
              "Add scope: '../auth/business.manage'",
              "Add your email as Test User",
              "Submit for verification (Google reviews this — takes 1-4 weeks)",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {s}
              </div>
            ))}
          </div>

          <div style={{ ...sCard, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 10 }}>Step 3 — Create OAuth Client ID</div>
            {[
              "APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID",
              "Application type: Web application | Name: ZenLine Digital",
              "Authorised redirect URI: https://zenline-digital.vercel.app/api/gbp-callback",
              "Click Create → copy the Client ID and Client Secret",
              "Paste them below and save",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {s}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={sLabel}>OAuth Client ID</label>
            <input value={oauthClientId} onChange={e => setOauthClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" style={sInput} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={sLabel}>OAuth Client Secret</label>
            <input type="password" value={oauthSecret} onChange={e => setOauthSecret(e.target.value)} placeholder="GOCSPX-..." style={sInput} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveOAuth} style={sBtn("linear-gradient(135deg,#7c3aed,#2563eb)")}>Save Credentials</button>
            {oauthClientId && (
              <button onClick={connectGoogle} style={sBtn("#16a34a")}>🔗 Connect Google Account</button>
            )}
          </div>
          {oauthConnected && (
            <div style={{ marginTop: 12, background: "#16a34a10", border: "1px solid #16a34a40", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#4ade80" }}>
              ✅ Google account connected — auto-posting will activate once Google approves the app
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Staff Task Manager ──────────────────────────────────────────────────────
const TASK_SB_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const TASK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmlxeGlvYXBjZGdlbnBrc2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc1MDIsImV4cCI6MjEwMDcyMzUwMn0.PS80PFMqBYMf0e6uiYvTFk90gF7a7jo97C-dzzxUGho";

const STAFF_ACCOUNTS = [
  { email: "midhun@thugfit.ae",   password: "thugfit2026", name: "Midhun",  role: "admin"  },
  { email: "hello@thugfit.ae",    password: "staff2026",   name: "Staff",   role: "staff"  },
  { email: "staff1@thugfit.ae",   password: "staff2026",   name: "Staff 1", role: "staff"  },
  { email: "staff2@thugfit.ae",   password: "staff2026",   name: "Staff 2", role: "staff"  },
];

// ─── Task Validation Config ───────────────────────────────────────────────────
const PHOTO_TASKS = new Set([
  "Check Instagram comments & DMs",
  "Check Facebook comments & messages",
  "Check thugfit.ae orders",
  "Check Train & Earn applications",
  "Send Train & Earn outreach emails",
  "Review Google Search Console",
]);

const AUTO_TASK_CHECKS = {
  "Review AI-generated posts": async () => {
    const r = await fetch(`${SUPA_URL}/rest/v1/posts?or=(status.eq.approved,status.eq.rejected)&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
  "Generate monthly content plan": async () => {
    const m=new Date().getMonth()+1, y=new Date().getFullYear();
    const r = await fetch(`${SUPA_URL}/rest/v1/monthly_plans?month=eq.${m}&year=eq.${y}&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
  "Schedule next week content": async () => {
    const r = await fetch(`${SUPA_URL}/rest/v1/posts?status=eq.scheduled&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
  "Post to Google Business Profile": async () => {
    const today=new Date().toISOString().split("T")[0];
    const r = await fetch(`${SUPA_URL}/rest/v1/seo_activity_log?action=eq.gbp_post_manual&created_at=gte.${today}T00:00:00&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
  "Run Product SEO Scanner": async () => {
    const today=new Date().toISOString().split("T")[0];
    const r = await fetch(`${SUPA_URL}/rest/v1/seo_activity_log?action=eq.product_seo_scan&created_at=gte.${today}T00:00:00&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
  "Run Page Speed Check": async () => {
    const today=new Date().toISOString().split("T")[0];
    const r = await fetch(`${SUPA_URL}/rest/v1/seo_activity_log?action=eq.page_speed_check&created_at=gte.${today}T00:00:00&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
  "Check broken links and 404 errors": async () => {
    const today=new Date().toISOString().split("T")[0];
    const r = await fetch(`${SUPA_URL}/rest/v1/seo_activity_log?action=eq.broken_link_check&created_at=gte.${today}T00:00:00&select=id&limit=1`,
      {headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}});
    const d = await r.json(); return Array.isArray(d) && d.length > 0;
  },
};

async function taskFetch(path, method="GET", body=null) {
  const h = {"Content-Type":"application/json", apikey:TASK_SB_KEY, Authorization:`Bearer ${TASK_SB_KEY}`, Prefer:"return=representation"};
  const r = await fetch(`${TASK_SB_URL}${path}`, {method, headers:h, body:body?JSON.stringify(body):undefined});
  return r.status===204 ? null : r.json().catch(()=>null);
}

const CAT_COLORS = {content:"#8B7CF8", social:"#F472B6", admin:"#FBBF24", seo:"#00C9A7", marketing:"#60A5FA"};
const CAT_ICONS  = {content:"📝", social:"📱", admin:"⚙️", seo:"🔍", marketing:"📧"};

// All tasks a staff member needs to know about — with full instructions
const ALL_TASK_DEFINITIONS = [
  // DAILY TASKS
  { name:"Review AI-generated posts", cat:"content", freq:"daily", priority:1,
    instructions:"Open ZenLine Digital → Approvals tab → review each post waiting → tick platforms you approve → click Approve. If post quality is poor, click Reject and go to Planner to regenerate." },
  { name:"Check Instagram comments & DMs", cat:"social", freq:"daily", priority:2,
    instructions:"Open Instagram → @thugfit.ae → reply to ALL comments within 2 hours. Check DMs and reply to any customer questions. If someone asks about orders, direct them to thugfit.ae or WhatsApp Midhun." },
  { name:"Check Facebook comments & messages", cat:"social", freq:"daily", priority:3,
    instructions:"Open Facebook → THUGFIT page → reply to all comments and messages. Same approach as Instagram — be helpful, professional, on-brand." },
  { name:"Check thugfit.ae orders", cat:"admin", freq:"daily", priority:4,
    instructions:"Go to thugfit.ae/wp-admin → WooCommerce → Orders → filter by Today. Check for any new orders, failed payments, or customer notes. Flag anything unusual to Midhun via WhatsApp." },
  { name:"Check Train & Earn applications", cat:"admin", freq:"daily", priority:5,
    instructions:"Go to thugfit.ae/wp-admin → check for new Train & Earn member applications pending approval. Review the application details. If applicant looks genuine, notify Midhun to approve. Do NOT approve yourself without Midhun confirmation." },
  { name:"Post to Google Business Profile", cat:"marketing", freq:"daily", priority:6,
    instructions:"Open ZenLine Digital → Auto SEO → SEO Tasks → Google Business Profile → Option B tab → select a topic → click Generate Post → copy the text → go to business.google.com → Posts → Create post → paste text → add a product photo if available → click Post." },

  // WEEKLY TASKS (Monday)
  { name:"Send Train & Earn outreach emails", cat:"marketing", freq:"weekly_mon", priority:10,
    instructions:"Open ZenLine Digital → Auto SEO → SEO Tasks → Backlink Outreach Emails → select target type (UAE Fitness Blog / Dubai Gym / Influencer) → click Generate 3 Emails → copy each email → find the target website or Instagram DM → send the email. Do this for at least 3 different targets every Monday." },
  { name:"Review Google Search Console", cat:"seo", freq:"weekly_mon", priority:11,
    instructions:"Go to search.google.com/search-console → select thugfit.ae → note: Total clicks this week, Total impressions, Top 5 search queries. Open ZenLine Digital → Auto SEO → SEO Tasks → Google Search Console Advisor → paste the numbers → click Generate Actions → follow the 5 action items listed." },
  { name:"Check broken links and 404 errors", cat:"seo", freq:"weekly_mon", priority:12,
    instructions:"Open ZenLine Digital → Auto SEO → SEO Tasks → Broken Link Checker → click Scan. If broken links are found, go to thugfit.ae/wp-admin → Posts → find the post mentioned → edit it → remove or update the broken link → Update. Also check Staff Tasks panel for any 404 errors flagged by the system." },
  { name:"Schedule next week content", cat:"content", freq:"weekly_fri", priority:13,
    instructions:"Open ZenLine Digital → Content Queue → find all posts with status Approved → click Schedule on each → pick the date and time for next week (spread across Mon-Fri, post between 7-9 AM or 6-9 PM UAE time for best engagement) → Confirm Schedule." },

  // MONTHLY TASKS (1st of month)
  { name:"Run Product SEO Scanner", cat:"seo", freq:"monthly", priority:20,
    instructions:"Open ZenLine Digital → Auto SEO → SEO Tasks → Product Page SEO Scanner → click Scan Products → wait for AI to generate SEO titles and meta descriptions for all products → review the suggestions → click Apply All to update all products at once in WordPress." },
  { name:"Run Page Speed Check", cat:"seo", freq:"monthly", priority:21,
    instructions:"Open ZenLine Digital → Auto SEO → SEO Tasks → Page Speed Checker → click Check Speed Now → note the mobile and desktop scores → read the 5 fix steps → action each fix in WordPress (the instructions are step-by-step, non-technical). Report scores to Midhun." },
  { name:"Generate monthly content plan", cat:"content", freq:"monthly", priority:22,
    instructions:"Open ZenLine Digital → Dashboard → click Generate Monthly Plan button → wait 30-60 seconds for AI to create the full month plan → go to Monthly Planner → review all 20 posts across 4 weeks → start generating content by clicking ⚡ Generate on each post." },
];

function StaffTaskManager({ platformUser }) {
  const isAdminUser2 = ADMIN_EMAILS.includes(platformUser?.email || "");
  const userEmail = platformUser?.email || "";
  const userName = userEmail.split("@")[0].charAt(0).toUpperCase() + userEmail.split("@")[0].slice(1);
  const userRole = isAdminUser2 ? "admin" : "staff";
  const user = { name: userName, email: userEmail, role: userRole };
  const [loggedIn,   setLoggedIn]   = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass,  setLoginPass]  = useState("");
  const [loginError, setLoginError] = useState("");
  const [view,       setView]       = useState("today");
  const [todayTasks, setTodayTasks] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [reportDays, setReportDays] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [completing, setCompleting] = useState({});
  const [notes,      setNotes]      = useState({});
  const [expanded,   setExpanded]   = useState(null);
  const [toast,      setToast]      = useState("");
  const [proofImages, setProofImages] = useState({});
  const [autoValidating, setAutoValidating] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const dow = new Date().getDay(); // 0=Sun,1=Mon,...5=Fri,6=Sat
  const dom = new Date().getDate();
  const staffIsAdmin = user?.role === "admin";
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),3500); };

  const doLogin = () => {};
  const doLogout = () => {};

  // Determine which tasks apply today
  const getApplicableTasks = () => {
    return ALL_TASK_DEFINITIONS.filter(t => {
      if (t.freq === "daily") return true;
      if (t.freq === "weekly_mon") return dow === 1;
      if (t.freq === "weekly_fri") return dow === 5;
      if (t.freq === "monthly") return dom === 1;
      return false;
    });
  };

  const runAutoValidation = async (tasks) => {
    setAutoValidating(true);
    const updates = [];
    for (const task of tasks) {
      if (task.status === "done") continue;
      const checkFn = AUTO_TASK_CHECKS[task.task_name];
      if (!checkFn) continue;
      try {
        const passed = await checkFn();
        if (passed) {
          await taskFetch(`/rest/v1/staff_task_log?id=eq.${task.id}`, "PATCH", {
            status: "done", completed_at: new Date().toISOString(),
            completed_by: "System", note: "Auto-validated by system",
            auto_validated: true,
          });
          updates.push(task.id);
        }
      } catch {}
    }
    if (updates.length > 0) {
      setTodayTasks(prev => prev.map(t =>
        updates.includes(t.id) ? {...t, status:"done", completed_at:new Date().toISOString(), completed_by:"System", note:"Auto-validated by system", auto_validated:true} : t
      ));
      showToast(`✅ ${updates.length} task${updates.length>1?"s":""} auto-validated`);
    }
    setAutoValidating(false);
  };

  const loadTodayTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const applicable = getApplicableTasks();
      // Check what's already logged for today for this user
      const existing = await taskFetch(`/rest/v1/staff_task_log?due_date=eq.${today}&assigned_to=eq.${encodeURIComponent(user.name)}&order=created_at.asc`);
      const existingNames = (Array.isArray(existing) ? existing : []).map(t => t.task_name);
      // Create missing task records
      const toCreate = applicable.filter(t => !existingNames.includes(t.name));
      if (toCreate.length > 0) {
        await Promise.all(toCreate.map(t => taskFetch("/rest/v1/staff_task_log", "POST", {
          task_name: t.name, description: t.instructions, category: t.cat,
          frequency: t.freq, assigned_to: user.name, due_date: today, status: "pending"
        })));
      }
      // Load final list
      const final = await taskFetch(`/rest/v1/staff_task_log?due_date=eq.${today}&assigned_to=eq.${encodeURIComponent(user.name)}&order=created_at.asc`);
      // Merge with definitions to get instructions if DB doesn't have them
      const merged = (Array.isArray(final) ? final : []).map(t => {
        const def = ALL_TASK_DEFINITIONS.find(d => d.name === t.task_name);
        return { ...t, instructions: t.description || def?.instructions || "" };
      });
      setTodayTasks(merged);
      // Run auto-validation after tasks load
      setTimeout(() => runAutoValidation(merged), 500);
    } catch(e) { showToast("Error loading tasks"); }
    finally { setLoading(false); }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const days = Array.from({length:7}, (_,i) => {
        const d = new Date(); d.setDate(d.getDate()-i);
        return d.toISOString().split("T")[0];
      }).reverse();
      setReportDays(days);
      const all = await taskFetch(`/rest/v1/staff_task_log?due_date=gte.${days[0]}&order=due_date.asc,assigned_to.asc`);
      setReportData(Array.isArray(all) ? all : []);
    } catch(e) { showToast("Error: " + e.message); console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!loggedIn || !user) return;
    if (view === "today") loadTodayTasks();
    else loadReport();
  }, [loggedIn, userEmail, userRole, view]);

  const completeTask = async (task) => {
    setCompleting(p => ({...p, [task.id]: true}));
    try {
      await taskFetch(`/rest/v1/staff_task_log?id=eq.${task.id}`, "PATCH", {
        status: "done", completed_at: new Date().toISOString(),
        completed_by: user.name, note: notes[task.id] || "",
        proof_image: proofImages[task.id] || null, auto_validated: false,
      });
      setTodayTasks(p => p.map(t => t.id===task.id ? {...t, status:"done", completed_at:new Date().toISOString()} : t));
      showToast("✅ Task marked as done");
    } catch(e) { showToast("❌ " + e.message); }
    finally { setCompleting(p => ({...p, [task.id]: false})); }
  };

  const handleProofUpload = (e, taskId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showToast("⚠ Image too large — max 3MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setProofImages(prev => ({...prev, [taskId]: reader.result}));
    reader.readAsDataURL(file);
  };

  const done  = todayTasks.filter(t => t.status==="done").length;
  const total = todayTasks.length;
  const pct   = total > 0 ? Math.round((done/total)*100) : 0;
  const staffList = [...new Set(reportData.map(t => t.assigned_to))].sort();

  const getTasksForStaffDay = (staff, day) => reportData.filter(t => t.assigned_to===staff && t.due_date===day);
  const getDayStatus = tasks => {
    if (!tasks.length) return null;
    const doneCount = tasks.filter(t => t.status==="done").length;
    if (doneCount === tasks.length) return "done";
    if (doneCount === 0) return "none";
    return "partial";
  };

  const s = {
    border: "1px solid #1e1e30",
    card: { background:"#13131f", border:"1px solid #1e1e30", borderRadius:10, padding:16 },
    input: { width:"100%", background:"#0d0d16", border:"1px solid #1e1e30", color:"#e2e8f0", padding:"10px 14px", borderRadius:8, fontSize:13, outline:"none", fontFamily:"inherit" },
    label: { fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:6 },
    btn: (bg, col="#fff") => ({ padding:"10px 20px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit", background:bg, color:col }),
  };



  // MAIN TASK VIEW
  return (
    <div style={{minHeight:"100vh", background:"#07091A", color:"#E2E8F7", fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`*{box-sizing:border-box} input::placeholder{color:#3a3a5c} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {toast && <div style={{position:"fixed",top:20,right:20,zIndex:999,background:"#13131f",border:"1px solid #1e1e30",borderRadius:10,padding:"12px 18px",fontSize:13,color:"#e2e8f0",boxShadow:"0 8px 32px #00000060",maxWidth:360}}>{toast}</div>}

      {/* Header */}
      <div style={{background:"#0D1117", borderBottom:"1px solid #1C2537", padding:"16px 28px", display:"flex", alignItems:"center", gap:14}}>
        <div style={{width:40, height:40, background:"linear-gradient(135deg,#8B7CF8,#2563eb)", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20}}>✅</div>
        <div>
          <div style={{fontWeight:800, fontSize:18}}>Staff Tasks</div>
          <div style={{fontSize:11, color:"#3a3a5c"}}>Logged in as <strong style={{color:"#8B7CF8"}}>{user?.name}</strong> · {user?.role === "admin" ? "Admin" : "Staff"}</div>
        </div>
        <div style={{marginLeft:"auto", display:"flex", gap:8}}>
          <button onClick={()=>setView("today")} style={{...s.btn(view==="today"?"#8B7CF8":"#131929"), padding:"7px 16px", fontSize:12}}>📋 My Tasks</button>
          {staffIsAdmin && <button onClick={()=>setView("report")} style={{...s.btn(view==="report"?"#8B7CF8":"#131929"), padding:"7px 16px", fontSize:12}}>📊 Team Report</button>}

        </div>
      </div>

      <div style={{padding:"24px 28px", maxWidth:900, margin:"0 auto"}}>

        {/* TODAY'S TASKS */}
        {view==="today" && (
          <>
            {/* Progress */}
            <div style={{...s.card, marginBottom:20}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700, fontSize:15}}>
                    {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
                  </div>
                  <div style={{fontSize:12, color:"#6B7EB8", marginTop:2}}>{done} of {total} tasks completed</div>
                </div>
                <div style={{fontWeight:900, fontSize:28, color:pct===100?"#4ade80":pct>60?"#fb923c":"#f87171"}}>{pct}%</div>
              </div>
              <div style={{background:"#07091A", borderRadius:20, height:10, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${pct}%`, background:pct===100?"#16a34a":"linear-gradient(90deg,#8B7CF8,#2563eb)", borderRadius:20, transition:"width .5s"}} />
              </div>
              {pct===100 && <div style={{fontSize:12, color:"#4ade80", marginTop:10, textAlign:"center"}}>🎉 All tasks done for today. Great work!</div>}
            </div>

            {loading ? <div style={{textAlign:"center", padding:40, color:"#6B7EB8"}}>Loading your tasks...</div>
            : todayTasks.length === 0 ? <div style={{...s.card, textAlign:"center", padding:40, color:"#6B7EB8"}}>No tasks scheduled for today.</div>
            : <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {todayTasks.map((task,i) => {
                  const isDone = task.status === "done";
                  const isOpen = expanded === task.id;
                  return (
                    <div key={task.id} style={{background:"#0D1117", border:`1px solid ${isDone?"#16a34a40":"#1C2537"}`, borderRadius:12, overflow:"hidden", opacity:isDone?0.75:1, transition:"all .2s"}}>
                      {/* Task header - always visible */}
                      <div onClick={()=>setExpanded(isOpen?null:task.id)} style={{display:"flex", alignItems:"center", gap:12, padding:"14px 16px", cursor:"pointer"}}>
                        <div style={{width:32, height:32, borderRadius:8, background:`${CAT_COLORS[task.category]||"#8B7CF8"}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0}}>
                          {isDone ? "✅" : CAT_ICONS[task.category]||"📋"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700, fontSize:14, textDecoration:isDone?"line-through":"none", color:isDone?"#3a3a5c":"#E2E8F7"}}>
                            {task.task_name}
                          </div>
                          <div style={{display:"flex", gap:8, marginTop:3, alignItems:"center"}}>
                            <span style={{fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:`${CAT_COLORS[task.category]||"#8B7CF8"}20`, color:CAT_COLORS[task.category]||"#8B7CF8"}}>{task.category}</span>
                            <span style={{fontSize:10, color:"#3a3a5c"}}>{task.frequency==="daily"?"Daily":task.frequency==="weekly_mon"?"Every Monday":task.frequency==="weekly_fri"?"Every Friday":"Monthly"}</span>
                            {isDone && <span style={{fontSize:10, color:"#4ade80", fontWeight:700}}>✓ Done {task.completed_at?new Date(task.completed_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):""}</span>}
                          </div>
                        </div>
                        <div style={{fontSize:12, color:"#3a3a5c"}}>{isOpen?"▲":"▼"}</div>
                      </div>

                      {/* Expanded - instructions + done button */}
                      {isOpen && (
                        <div style={{borderTop:"1px solid #1C2537", padding:"14px 16px", background:"#07091A"}}>
                          {/* Validation type badge */}
                          <div style={{display:"flex", gap:8, marginBottom:10, alignItems:"center"}}>
                            {AUTO_TASK_CHECKS[task.task_name] && (
                              <span style={{fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:10, background:"#2563eb20", color:"#60a5fa", border:"1px solid #2563eb30"}}>
                                🤖 Auto-validates
                              </span>
                            )}
                            {PHOTO_TASKS.has(task.task_name) && (
                              <span style={{fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:10, background:"#f59e0b20", color:"#fbbf24", border:"1px solid #f59e0b30"}}>
                                📸 Screenshot optional
                              </span>
                            )}
                            {task.auto_validated && (
                              <span style={{fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:10, background:"#16a34a20", color:"#4ade80", border:"1px solid #16a34a30"}}>
                                ✅ System verified
                              </span>
                            )}
                          </div>
                          <div style={{fontSize:12, fontWeight:700, color:"#6B7EB8", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em"}}>How to do this:</div>
                          <div style={{fontSize:13, color:"#94a3b8", lineHeight:1.8, marginBottom:14}}>{task.instructions}</div>
                          {!isDone && (
                            <div style={{display:"flex", flexDirection:"column", gap:10}}>
                              {/* Photo upload for proof-required tasks */}
                              {PHOTO_TASKS.has(task.task_name) && (
                                <div style={{background:"#0a0a14", border:"1px solid #f59e0b30", borderRadius:8, padding:"12px 14px"}}>
                                  <div style={{fontSize:12, fontWeight:700, color:"#fbbf24", marginBottom:8}}>📸 Upload proof screenshot (optional but recommended)</div>
                                  {proofImages[task.id] ? (
                                    <div style={{display:"flex", alignItems:"center", gap:10}}>
                                      <img src={proofImages[task.id]} alt="proof" style={{width:80, height:50, objectFit:"cover", borderRadius:6, border:"1px solid #16a34a40"}} />
                                      <div>
                                        <div style={{fontSize:11, color:"#4ade80", fontWeight:700}}>✅ Screenshot uploaded</div>
                                        <button onClick={()=>setProofImages(p=>({...p,[task.id]:null}))} style={{fontSize:10, color:"#f87171", background:"none", border:"none", cursor:"pointer", padding:0, marginTop:2}}>Remove</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"8px 14px", background:"#13131f", border:"1px dashed #f59e0b50", borderRadius:7, width:"fit-content"}}>
                                      <span style={{fontSize:18}}>📷</span>
                                      <span style={{fontSize:12, color:"#94a3b8"}}>Click to upload screenshot</span>
                                      <input type="file" accept="image/*" onChange={e=>handleProofUpload(e,task.id)} style={{display:"none"}} />
                                    </label>
                                  )}
                                </div>
                              )}
                              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                                <input value={notes[task.id]||""} onChange={e=>setNotes(p=>({...p,[task.id]:e.target.value}))} placeholder="Add a note (optional)..." style={{...s.input, flex:1, fontSize:12, padding:"8px 12px"}} />
                                <button onClick={()=>completeTask(task)}
                                  disabled={completing[task.id]}
                                  style={{...s.btn("#16a34a"), padding:"8px 18px", fontSize:12, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6}}>
                                  {completing[task.id]?<div style={{width:14,height:14,border:"2px solid #ffffff40",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>:null}
                                  {completing[task.id]?"Saving...":"✓ Mark as Done"}
                                </button>
                              </div>
                            </div>
                          )}
                          {isDone && (
                            <div style={{display:"flex", flexDirection:"column", gap:6}}>
                              {task.note && <div style={{fontSize:12, color:"#4ade80"}}>Note: {task.note}</div>}
                              {task.proof_image && (
                                <div>
                                  <div style={{fontSize:11, color:"#64748b", marginBottom:4}}>Proof submitted:</div>
                                  <img src={task.proof_image} alt="proof" style={{width:120, height:75, objectFit:"cover", borderRadius:6, border:"1px solid #16a34a40"}} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
          </>
        )}

        {/* TEAM REPORT - Admin only */}
        {view==="report" && staffIsAdmin && (
          <>
            <div style={{fontWeight:700, fontSize:16, marginBottom:6}}>Team Performance — Last 7 Days</div>
            <div style={{fontSize:12, color:"#6B7EB8", marginBottom:20}}>Green = all done · Yellow = partial · Red = not done · — = no tasks that day</div>

            {loading ? <div style={{textAlign:"center", padding:40, color:"#6B7EB8"}}>Loading...</div> : (
              <>
                {/* Stats */}
                <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20}}>
                  {[
                    ["Total Tasks", reportData.length, "#a78bfa"],
                    ["Completed", reportData.filter(t=>t.status==="done").length, "#4ade80"],
                    ["Pending Today", reportData.filter(t=>t.due_date===today&&t.status!=="done").length, "#fb923c"],
                    ["Completion Rate", reportData.length>0?Math.round(reportData.filter(t=>t.status==="done").length/reportData.length*100)+"%":"0%","#60a5fa"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{...s.card}}>
                      <div style={{fontWeight:800, fontSize:22, color:c}}>{v}</div>
                      <div style={{fontSize:11, color:"#4a4a6a", marginTop:4}}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Grid */}
                {staffList.length === 0
                  ? <div style={{...s.card, textAlign:"center", padding:30, color:"#6B7EB8"}}>No task data yet. Staff need to log in and use the system.</div>
                  : (
                    <div style={{background:"#0D1117", border:"1px solid #1C2537", borderRadius:12, overflow:"hidden", marginBottom:20}}>
                      <div style={{display:"grid", gridTemplateColumns:`200px repeat(${reportDays.length},1fr)`, background:"#07091A", borderBottom:"1px solid #1C2537"}}>
                        <div style={{padding:"10px 14px", fontSize:11, fontWeight:700, color:"#6B7EB8", textTransform:"uppercase"}}>Staff</div>
                        {reportDays.map(d => {
                          const dt = new Date(d+"T12:00:00");
                          return <div key={d} style={{padding:"10px 6px", fontSize:11, fontWeight:700, color:d===today?"#8B7CF8":"#6B7EB8", textAlign:"center", borderLeft:"1px solid #1C2537", background:d===today?"#8B7CF810":"transparent"}}>
                            <div>{dt.toLocaleDateString("en-GB",{weekday:"short"})}</div>
                            <div style={{fontSize:9, color:"#3a3a5c"}}>{dt.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                          </div>;
                        })}
                      </div>
                      {staffList.map(staff => (
                        <div key={staff} style={{display:"grid", gridTemplateColumns:`200px repeat(${reportDays.length},1fr)`, borderBottom:"1px solid #1C2537"}}>
                          <div style={{padding:"12px 14px", display:"flex", alignItems:"center", gap:8}}>
                            <div style={{width:28, height:28, borderRadius:"50%", background:"#8B7CF820", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#8B7CF8", flexShrink:0}}>{staff[0]?.toUpperCase()}</div>
                            <span style={{fontSize:12, fontWeight:600, color:"#E2E8F7"}}>{staff}</span>
                          </div>
                          {reportDays.map(day => {
                            const tasks = getTasksForStaffDay(staff, day);
                            const status = getDayStatus(tasks);
                            const doneCount = tasks.filter(t=>t.status==="done").length;
                            const isPast = day < today;
                            const bgColor = !status ? "transparent" : status==="done" ? "#16a34a" : (isPast && status==="none") ? "#ef4444" : "#f59e0b";
                            const icon = !status ? "—" : status==="done" ? "✓" : (isPast && status==="none") ? "✗" : "⏳";
                            return (
                              <div key={day} style={{borderLeft:"1px solid #1C2537", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 4px", background:day===today?"#8B7CF808":"transparent"}}>
                                {!status
                                  ? <span style={{fontSize:11, color:"#2a2a40"}}>—</span>
                                  : <>
                                      <div style={{width:30, height:30, borderRadius:8, background:bgColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff"}}>{icon}</div>
                                      <div style={{fontSize:9, color:"#6B7EB8", marginTop:3}}>{doneCount}/{tasks.length}</div>
                                    </>
                                }
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )
                }

                {/* Today's detail */}
                <div style={{fontWeight:700, fontSize:14, marginBottom:12}}>Today — Task Detail</div>
                {reportData.filter(t=>t.due_date===today).length === 0
                  ? <div style={{...s.card, color:"#6B7EB8", textAlign:"center", fontSize:13}}>No tasks logged today yet</div>
                  : reportData.filter(t=>t.due_date===today).map(task => (
                    <div key={task.id} style={{...s.card, display:"flex", alignItems:"center", gap:12, padding:"10px 14px", marginBottom:8}}>
                      <div style={{width:24, height:24, borderRadius:6, background:task.status==="done"?"#16a34a":task.due_date<today&&task.status!=="done"?"#ef4444":"#f59e0b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0}}>
                        {task.status==="done"?"✓":task.due_date<today?"✗":"⏳"}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13, fontWeight:600}}>{task.task_name}</div>
                        <div style={{fontSize:11, color:"#6B7EB8", marginTop:2}}>{task.assigned_to} · {task.category}</div>
                      </div>
                      <div style={{fontSize:11, fontWeight:700, color:task.status==="done"?"#4ade80":"#f87171", textAlign:"right"}}>
                        {task.status==="done"
                          ? <div>
                              <div>Done {task.completed_at?new Date(task.completed_at).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):""}</div>
                              {task.auto_validated && <div style={{fontSize:9, color:"#60a5fa"}}>🤖 Auto-verified</div>}
                              {task.proof_image && <img src={task.proof_image} alt="proof" style={{width:50,height:32,objectFit:"cover",borderRadius:4,marginTop:4,border:"1px solid #16a34a40",display:"block"}} />}
                            </div>
                          : "PENDING"}
                      </div>
                    </div>
                  ))
                }
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SEO Module (inlined) ────────────────────────────────────────────────────

async function sbFetch(path, method = "GET", body = null) {
  const h = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: "return=representation" };
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok && r.status !== 204) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `Supabase ${r.status}`); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

function Toggle({ on, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{ width: 56, height: 30, borderRadius: 15, background: on ? "#16a34a" : "#1e1e30", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background .3s", flexShrink: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 4, left: on ? 30 : 4, transition: "left .3s", boxShadow: "0 1px 4px #00000040" }} />
    </div>
  );
}

function SeoSpinner({ size = 18 }) {
  return <div style={{ width: size, height: size, border: `2px solid #7c3aed30`, borderTop: `2px solid #7c3aed`, borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />;
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

// ─── Staff Tasks Panel ────────────────────────────────────────────────────────
function StaffTasksPanel({ sbFetch, showToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sbFetch("/rest/v1/seo_staff_tasks?resolved=eq.false&order=created_at.desc&limit=20")
      .then(d => { setTasks(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const resolveTask = async (id) => {
    try {
      await sbFetch(`/rest/v1/seo_staff_tasks?id=eq.${id}`, "PATCH", { resolved: true, resolved_at: new Date().toISOString() });
      setTasks(prev => prev.filter(t => t.id !== id));
      showToast("✅ Task marked as done");
    } catch (e) { showToast("❌ " + e.message); }
  };

  const typeColor = { broken_link: "#f87171", "404_error": "#fb923c", duplicate_content: "#fbbf24" };
  const typeLabel = { broken_link: "🔗 Broken Link", "404_error": "🚫 404 Error", duplicate_content: "📄 Duplicate Content" };

  if (loading || tasks.length === 0) return null;

  return (
    <div style={{ background: "#1a0a0a", border: "2px solid #f8717150", borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 20 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#f87171" }}>Staff Action Required — {tasks.length} issue{tasks.length !== 1 ? "s" : ""}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map(task => (
          <div key={task.id} style={{ background: "#0d0d16", border: `1px solid ${typeColor[task.type] || "#f87171"}30`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: typeColor[task.type] || "#f87171", marginBottom: 4 }}>{typeLabel[task.type] || task.type}</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>{task.description}</div>
              {task.url && <div style={{ fontSize: 10, color: "#3a3a5c", marginTop: 4, wordBreak: "break-all" }}>{task.url}</div>}
              <div style={{ fontSize: 10, color: "#3a3a5c", marginTop: 4 }}>Found: {new Date(task.created_at).toLocaleDateString()}</div>
            </div>
            <button onClick={() => resolveTask(task.id)} style={{ background: "#16a34a20", border: "1px solid #16a34a40", color: "#4ade80", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓ Done</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SEO() {
  const [activeTab, setActiveTab] = useState("autopilot");

  // ── Autopilot state ──────────────────────────────────────────────────────────
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
  const [wpUrl, setWpUrl]             = useState("");
  const [wpUser, setWpUser]           = useState("");
  const [wpPass, setWpPass]           = useState("");
  const [postStatus, setPostStatus]   = useState("draft");
  const [googleApiKey, setGoogleApiKey] = useState("");

  // ── Tasks state ──────────────────────────────────────────────────────────────
  const [taskLoading, setTaskLoading]     = useState(false);
  const [backlinks, setBacklinks]         = useState([]);
  const [blType, setBlType]               = useState("uae_fitness_blog");
  const [products, setProducts]           = useState([]);
  const [productSaving, setProductSaving] = useState({});
  const [speedData, setSpeedData]         = useState(null);
  const [speedLoading, setSpeedLoading]   = useState(false);
  const [gscInput, setGscInput]           = useState("");
  const [gscActions, setGscActions]       = useState("");
  const [gscLoading, setGscLoading]       = useState(false);
  const [openSection, setOpenSection]     = useState("backlink");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorData, setCompetitorData] = useState(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorProgress, setCompetitorProgress] = useState("");
  const [googleIndexingKey, setGoogleIndexingKey] = useState("");
  const [brokenLinks, setBrokenLinks] = useState([]);
  const [brokenLoading, setBrokenLoading] = useState(false);
  const [fixingLinks, setFixingLinks] = useState(false);
  const [fixProgress, setFixProgress] = useState("");
  const [altLoading, setAltLoading] = useState(false);
  const [altResults, setAltResults] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgs, logs, kws] = await Promise.all([
        sbFetch("/rest/v1/seo_automation?order=created_at.asc&limit=1"),
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
        setGoogleApiKey(cfg.google_api_key || "");
        setGoogleIndexingKey(cfg.google_indexing_key || "");
      } else {
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

  const toggleAutomation = async (on) => {
    if (!config?.id) return;
    setSaving(true);
    try {
      await sbFetch(`/rest/v1/seo_automation?id=eq.${config.id}`, "PATCH", { is_enabled: on });
      setConfig(prev => ({ ...prev, is_enabled: on }));
      showToast(on ? "✅ Automation started — first article at 9 AM UAE time" : "⏸ Automation paused");
    } catch (e) { showToast("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const saveSettings = async () => {
    if (!config?.id) return;
    setSaving(true);
    try {
      await sbFetch(`/rest/v1/seo_automation?id=eq.${config.id}`, "PATCH", {
        wp_url: wpUrl, wp_username: wpUser, wp_app_password: wpPass, post_status: postStatus, google_api_key: googleApiKey, google_indexing_key: googleIndexingKey,
      });
      setConfig(prev => ({ ...prev, wp_url: wpUrl, wp_username: wpUser, wp_app_password: wpPass, post_status: postStatus, google_api_key: googleApiKey, google_indexing_key: googleIndexingKey }));
      setShowSettings(false);
      showToast("✅ Settings saved");
    } catch (e) { showToast("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const triggerNow = async () => {
    if (!config?.wp_username || !config?.wp_app_password) { showToast("⚠ Add WordPress credentials in Settings first"); setShowSettings(true); return; }
    setTriggering(true);
    try {
      const res = await fetch("/api/seo-cron", { method: "POST", headers: { "Content-Type": "application/json", "x-vercel-cron": "1" } });
      const data = await res.json();
      if (data.success) { showToast(`✅ Published: "${data.title}"`); setTimeout(loadAll, 2000); }
      else if (data.skipped) { showToast("ℹ " + data.reason); }
      else { showToast("❌ " + (data.error || "Unknown error")); }
    } catch (e) { showToast("❌ " + e.message); }
    finally { setTriggering(false); }
  };

  const addKeyword = async () => {
    if (!newKw.trim()) return;
    setAddingKw(true);
    try {
      await sbFetch("/rest/v1/seo_keyword_queue", "POST", { keyword: newKw.trim(), used: false, priority: 8 });
      setNewKw("");
      showToast("✅ Keyword added");
      const kws = await sbFetch("/rest/v1/seo_keyword_queue?order=created_at.asc&limit=50");
      setQueue(Array.isArray(kws) ? kws : []);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setAddingKw(false); }
  };

  const generateKeywords = async () => {
    setGenKwLoading(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          system: "SEO keyword researcher for UAE e-commerce and activewear.",
          messages: [{ role: "user", content: "Generate 15 high-value SEO keywords for THUGFIT (premium gym activewear, thugfit.ae, UAE). Mix: product, informational, local UAE. Return ONLY a JSON array of strings." }] }) });
      const data = await res.json();
      const keywords = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
      if (Array.isArray(keywords)) {
        await Promise.all(keywords.map(kw => sbFetch("/rest/v1/seo_keyword_queue", "POST", { keyword: kw, used: false, priority: 5 }).catch(() => {})));
        showToast(`✅ Added ${keywords.length} keywords`);
        const kws = await sbFetch("/rest/v1/seo_keyword_queue?order=created_at.asc&limit=50");
        setQueue(Array.isArray(kws) ? kws : []);
      }
    } catch (e) { showToast("❌ " + e.message); }
    finally { setGenKwLoading(false); }
  };

  const removeKeyword = async (id) => {
    try { await sbFetch(`/rest/v1/seo_keyword_queue?id=eq.${id}`, "DELETE"); setQueue(prev => prev.filter(k => k.id !== id)); }
    catch (e) { showToast("❌ " + e.message); }
  };

  // ── Tasks functions ──────────────────────────────────────────────────────────

  const generateBacklinks = async () => {
    setTaskLoading(true);
    setBacklinks([]);
    try {
      const typeLabels = { uae_fitness_blog: "UAE fitness and wellness blog", gym_dubai: "Dubai gym or fitness centre", influencer: "UAE fitness influencer or content creator", news_site: "UAE lifestyle or news website" };
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000,
          system: "You are a professional partnership outreach specialist for UAE fitness brands.",
          messages: [{ role: "user", content: `Write 3 different outreach emails for THUGFIT Train & Earn programme (thugfit.ae/thugfit-train-earn) targeting a ${typeLabels[blType]}.

THUGFIT Train & Earn Programme details:
- Members get a unique AUDIENCE CODE: their network uses it for 20% off all THUGFIT orders
- Members get a personal VIP CODE: 40% off their own personal orders
- Members earn commission on every sale made through their audience code
- Programme page: thugfit.ae/thugfit-train-earn
- No free products are given — this is a genuine earn-by-promoting programme
- Perfect for personal trainers, gym coaches, fitness influencers, gym owners

Each email must:
- Invite them to JOIN the Train & Earn programme
- Explain the earning mechanism clearly (their code → followers buy → they earn)
- Mention the 20% audience discount and 40% personal VIP discount
- Have a specific subject line
- Be under 150 words, personal and human (not spam)
- Include the programme link: thugfit.ae/thugfit-train-earn
- Never promise free products

Return ONLY a JSON array of 3 objects:
[{"subject":"subject line","body":"full email body","partnership_type":"train_and_earn"}]` }] }) });
      const data = await res.json();
      const emails = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
      setBacklinks(Array.isArray(emails) ? emails : []);
      showToast("✅ 3 outreach emails generated");
    } catch (e) { showToast("❌ " + e.message); }
    finally { setTaskLoading(false); }
  };

  const scanProducts = async () => {
    if (!config?.wp_username || !config?.wp_app_password) { showToast("⚠ Add WordPress credentials in Auto SEO settings first"); return; }
    setTaskLoading(true);
    setProducts([]);
    try {
      const creds = btoa(`${config.wp_username}:${config.wp_app_password}`);
      const wpBase = config.wp_url || "https://thugfit.ae";
      const r = await fetch(`${wpBase}/wp-json/wc/v3/products?per_page=20&status=publish`, {
        headers: { Authorization: `Basic ${creds}` }
      });
      if (!r.ok) throw new Error("Could not fetch products — make sure WooCommerce REST API is enabled");
      const prods = await r.json();
      showToast(`✅ Found ${prods.length} products — generating SEO suggestions...`);

      const withSeo = await Promise.all(prods.slice(0, 10).map(async (p) => {
        try {
          const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 300,
              system: "SEO specialist for UAE e-commerce. Write optimised product meta.",
              messages: [{ role: "user", content: `Product: "${p.name}" on thugfit.ae (UAE gym activewear).
Return ONLY JSON: {"seo_title":"max 60 chars with keyword","meta_desc":"max 155 chars, includes keyword and UAE"}` }] }) });
          const d = await res.json();
          const seo = JSON.parse(d.content[0].text.replace(/```json|```/g, "").trim());
          return { ...p, seo_title: seo.seo_title, meta_desc: seo.meta_desc, applied: false };
        } catch { return { ...p, seo_title: p.name + " | THUGFIT UAE", meta_desc: "Premium " + p.name + " available in UAE. Shop THUGFIT activewear at thugfit.ae.", applied: false }; }
      }));
      setProducts(withSeo);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setTaskLoading(false); }
  };

  const applyProductSeo = async (product) => {
    if (!config?.wp_username || !config?.wp_app_password) return;
    setProductSaving(prev => ({ ...prev, [product.id]: true }));
    try {
      const creds = btoa(`${config.wp_username}:${config.wp_app_password}`);
      const wpBase = config.wp_url || "https://thugfit.ae";
      await fetch(`${wpBase}/wp-json/wc/v3/products/${product.id}`, {
        method: "PUT", headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
        body: JSON.stringify({ meta_data: [
          { key: "_yoast_wpseo_title", value: product.seo_title },
          { key: "_yoast_wpseo_metadesc", value: product.meta_desc },
          { key: "rank_math_title", value: product.seo_title },
          { key: "rank_math_description", value: product.meta_desc },
        ]})
      });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, applied: true } : p));
      showToast("✅ SEO applied to " + product.name);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setProductSaving(prev => ({ ...prev, [product.id]: false })); }
  };

  const applyAllProducts = async () => {
    for (const p of products.filter(p => !p.applied)) { await applyProductSeo(p); }
    await sbFetch("/rest/v1/seo_activity_log", "POST", {action:"product_seo_scan", status:"completed", title:"Product SEO scan completed"}).catch(()=>{});
    showToast("✅ All products updated");
  };

  const checkSpeed = async () => {
    setSpeedLoading(true);
    setSpeedData(null);
    try {
      const siteUrl = config?.wp_url || "https://thugfit.ae";
      const [mob, desk] = await Promise.all([
        fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(siteUrl)}&strategy=mobile${googleApiKey ? "&key=" + googleApiKey : ""}`).then(r => r.json()),
        fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(siteUrl)}&strategy=desktop${googleApiKey ? "&key=" + googleApiKey : ""}`).then(r => r.json()),
      ]);

      // Check for API errors
      if (mob.error || desk.error) throw new Error(mob.error?.message || desk.error?.message || "PageSpeed API error");

      const mobRaw  = mob.lighthouseResult?.categories?.performance?.score;
      const deskRaw = desk.lighthouseResult?.categories?.performance?.score;
      const mobScore  = mobRaw  != null ? Math.round(mobRaw  * 100) : null;
      const deskScore = deskRaw != null ? Math.round(deskRaw * 100) : null;
      const failed = mobScore === null && deskScore === null;

      const audits = mob.lighthouseResult?.audits || {};
      const issues = Object.values(audits)
        .filter(a => a.score !== null && a.score < 0.9 && a.description)
        .slice(0, 6)
        .map(a => a.title);

      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 900,
          system: "You are a web performance expert. Give simple, actionable WordPress plugin-based fixes. Write in plain text only — no markdown stars, no hashtags, no bold formatting.",
          messages: [{ role: "user", content: `thugfit.ae is a WooCommerce store on WordPress.
${failed ? "PageSpeed API could not measure the site (may be blocking crawlers or very slow)." : `PageSpeed scores: Mobile ${mobScore}/100, Desktop ${deskScore}/100.`}
${issues.length > 0 ? `Known issues: ${issues.join(", ")}.` : ""}

Give exactly 5 practical fixes a non-developer WordPress admin can do using free plugins or WordPress settings.
Format each fix exactly like this (plain text, no stars or hashtags):

1. Fix Title Here
What to do: One clear sentence explaining exactly where to click and what to do in WordPress.

2. Fix Title Here
What to do: One clear sentence.

(continue for all 5 fixes)` }] }) });
      const d = await res.json();
      setSpeedData({ mobScore, deskScore, failed, fixes: d.content[0].text });
      await sbFetch("/rest/v1/seo_activity_log", "POST", {action:"page_speed_check", status:"completed", title:`Page speed: Mobile ${mobScore}/100, Desktop ${deskScore}/100`}).catch(()=>{});
    } catch (e) { showToast("❌ " + e.message); }
    finally { setSpeedLoading(false); }
  };

  const generateGscActions = async () => {
    if (!gscInput.trim()) { showToast("Describe what you see in GSC first"); return; }
    setGscLoading(true);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800,
          system: "You are an SEO consultant. Give specific, actionable Google Search Console advice for a UAE e-commerce brand.",
          messages: [{ role: "user", content: `thugfit.ae Google Search Console data this week:\n${gscInput}\n\nGive me exactly 5 specific actions to take this week to improve. Number them 1-5. Be specific — tell me exactly what to click, what to change, what to write. No vague advice.` }] }) });
      const d = await res.json();
      setGscActions(d.content[0].text);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setGscLoading(false); }
  };

  const analyzeCompetitor = async () => {
    if (!competitorUrl.trim()) { showToast("Enter a competitor URL first"); return; }
    setCompetitorLoading(true); setCompetitorData(null);
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500,
          system: "You are an SEO competitor analyst for UAE e-commerce brands. Be specific and actionable.",
          messages: [{ role: "user", content: `Analyse this competitor of THUGFIT (UAE gym activewear, thugfit.ae): ${competitorUrl}

Return as JSON only:
{
  "keywords": ["10 specific UAE keywords they rank for that THUGFIT should target"],
  "article_topics": ["5 specific blog article titles THUGFIT should publish to close content gaps — make them ready-to-use titles like 'Best Gym Shorts for Dubai Heat 2026'"],
  "outreach_targets": ["3 specific types of UAE websites/influencers to contact for backlinks — be specific e.g. 'Dubai fitness bloggers on Instagram with 10k-100k followers'"],
  "next_action": "One sentence: the single most important thing THUGFIT should do this week based on this analysis"
}` }] }) });
      const data = await res.json();
      const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
      setCompetitorData(parsed);

      const actions = [];

      // 1. Add keywords to queue
      if (parsed.keywords?.length > 0) {
        await Promise.all(parsed.keywords.map(kw => sbFetch("/rest/v1/seo_keyword_queue", "POST", { keyword: kw, used: false, priority: 7 }).catch(() => {})));
        actions.push(`${parsed.keywords.length} keywords queued`);
      }

      // 2. Add article topics as high-priority keywords
      if (parsed.article_topics?.length > 0) {
        await Promise.all(parsed.article_topics.map(topic => sbFetch("/rest/v1/seo_keyword_queue", "POST", { keyword: topic, used: false, priority: 9 }).catch(() => {})));
        actions.push(`${parsed.article_topics.length} article topics queued`);
      }

      showToast(`✅ Done — ${actions.join(" · ")} — articles will publish automatically`);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setCompetitorLoading(false); }
  };

  const analyzeAllCompetitors = async () => {
    setCompetitorLoading(true); setCompetitorData(null); setCompetitorProgress("AI finding fresh competitors…");

    // Step 1: Ask Claude to find 6 competitors not analysed recently
    let UAE_COMPETITORS_LIST = [];
    try {
      const already = await sbFetch("/rest/v1/seo_activity_log?action=eq.competitor_analysed&order=created_at.desc&limit=30");
      const doneNames = (Array.isArray(already) ? already : []).map(e => e.title).filter(Boolean).join(", ");
      const findRes = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600,
          system: "You find gym activewear and fitness apparel competitors for a UAE brand. Return JSON only.",
          messages: [{ role: "user", content: `Find 6 gym activewear or fitness apparel brands/websites that compete with THUGFIT (thugfit.ae, UAE).
Include a mix of: global brands with UAE presence, GCC-based brands, Middle East fitness retailers, online activewear stores shipping to UAE.
${doneNames ? `Do NOT include these already analysed: ${doneNames}` : "Include well-known and niche brands."}
Return JSON only: [{"name":"Brand Name","url":"https://website.com"}]` }] }) });
      const findData = await findRes.json();
      UAE_COMPETITORS_LIST = JSON.parse(findData.content[0].text.replace(/\`\`\`json|\`\`\`/g,"").trim());
    } catch(e) {
      // Fallback list if AI fails
      UAE_COMPETITORS_LIST = [
        {name:"Squatwolf", url:"https://squatwolf.com"},
        {name:"Gymshark", url:"https://gymshark.com"},
        {name:"2XU", url:"https://2xu.com"},
        {name:"Reebok UAE", url:"https://reebok.com/en-ae"},
        {name:"Puma UAE", url:"https://puma.com/en-ae"},
        {name:"Asics UAE", url:"https://asics.com/ae"},
      ];
    }
    try {
      const results = [];
      let totalKw = 0, totalArt = 0;
      const allOutreach = new Set();

      for (let i = 0; i < UAE_COMPETITORS_LIST.length; i++) {
        const comp = UAE_COMPETITORS_LIST[i];
        setCompetitorProgress(`Analysing ${comp.name} (${i+1}/${UAE_COMPETITORS_LIST.length})…`);
        try {
          const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800,
              system: "SEO competitor analyst for UAE activewear. Be specific. Return JSON only.",
              messages: [{ role: "user", content: `Analyse ${comp.url} as a competitor of THUGFIT (thugfit.ae, UAE gym activewear).
Return JSON only:
{"keywords":["6 UAE keywords they rank for"],"article_topics":["3 specific blog titles THUGFIT should publish"],"outreach_targets":["2 specific UAE backlink sources"],"next_action":"one sentence most important action"}` }] }) });
          const data = await res.json();
          const parsed = JSON.parse(data.content[0].text.replace(/\`\`\`json|\`\`\`/g,"").trim());

          // Queue keywords
          await Promise.all((parsed.keywords||[]).map(kw =>
            sbFetch("/rest/v1/seo_keyword_queue","POST",{keyword:kw,used:false,priority:7}).catch(()=>{})
          ));
          // Queue article topics as high priority
          await Promise.all((parsed.article_topics||[]).map(t =>
            sbFetch("/rest/v1/seo_keyword_queue","POST",{keyword:t,used:false,priority:9}).catch(()=>{})
          ));
          (parsed.outreach_targets||[]).forEach(t => allOutreach.add(t));
          totalKw += (parsed.keywords||[]).length;
          totalArt += (parsed.article_topics||[]).length;
          results.push({name:comp.name, keywords:parsed.keywords||[], next_action:parsed.next_action});
          // Log so next run skips this competitor
          await sbFetch("/rest/v1/seo_activity_log","POST",{action:"competitor_analysed",title:comp.name,status:"completed"}).catch(()=>{});
        } catch { results.push({name:comp.name, keywords:[], next_action:"Analysis failed"}); }
      }

      setCompetitorData({
        competitors: results,
        totalKeywords: totalKw,
        totalArticles: totalArt,
        allOutreachTargets: [...allOutreach],
      });
      showToast(`✅ Done — ${totalKw} keywords + ${totalArt} article topics queued from ${results.length} competitors`);
      // Refresh keyword queue
      const kws = await sbFetch("/rest/v1/seo_keyword_queue?order=created_at.asc&limit=50");
      setQueue(Array.isArray(kws) ? kws : []);
    } catch(e) { showToast("❌ " + e.message); }
    finally { setCompetitorLoading(false); setCompetitorProgress(""); }
  };

  const checkBrokenLinks = async () => {
    if (!config?.wp_username || !config?.wp_app_password) { showToast("⚠ Add WordPress credentials in Settings first"); return; }
    setBrokenLoading(true); setBrokenLinks([]);
    try {
      const wpBase = config.wp_url || "https://thugfit.ae";
      const creds = btoa(`${config.wp_username}:${config.wp_app_password}`);
      const r = await fetch(`${wpBase}/wp-json/wp/v2/posts?per_page=15&status=publish`, { headers: { Authorization: `Basic ${creds}` } });
      const posts = await r.json();
      const found = [];
      for (const post of (Array.isArray(posts) ? posts.slice(0, 8) : [])) {
        const links = [...(post.content?.rendered || "").matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]).slice(0, 8);
        for (const link of links) {
          try {
            const check = await fetch(link, { method: "HEAD", signal: AbortSignal.timeout(5000) });
            if (check.status === 404 || check.status === 410) found.push({ post: post.title?.rendered, link, status: check.status });
          } catch { found.push({ post: post.title?.rendered, link, status: "unreachable" }); }
        }
      }
      setBrokenLinks(found);
      await sbFetch("/rest/v1/seo_activity_log", "POST", {action:"broken_link_check", status:"completed", title:`Broken link scan: ${found.length} issues found`}).catch(()=>{});
      showToast(found.length === 0 ? "✅ No broken links found!" : `⚠ Found ${found.length} broken links`);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setBrokenLoading(false); }
  };

  const fixAllBrokenLinks = async () => {
    if (!config?.wp_username || !config?.wp_app_password) { showToast("⚠ Add WordPress credentials in Settings first"); return; }
    if (brokenLinks.length === 0) { showToast("No broken links to fix"); return; }
    setFixingLinks(true);
    const wpBase = config.wp_url || "https://thugfit.ae";
    const creds = btoa(`${config.wp_username}:${config.wp_app_password}`);
    let fixed = 0, failed = 0;

    // Group broken links by post title
    const byPost = {};
    for (const b of brokenLinks) {
      if (!byPost[b.post]) byPost[b.post] = [];
      byPost[b.post].push(b.link);
    }

    for (const [postTitle, links] of Object.entries(byPost)) {
      setFixProgress(`Fixing "${postTitle.slice(0,40)}…"`);
      try {
        // Find the post by title
        const searchRes = await fetch(`${wpBase}/wp-json/wp/v2/posts?search=${encodeURIComponent(postTitle)}&per_page=5&status=publish`, {
          headers: { Authorization: `Basic ${creds}` }
        });
        const posts = await searchRes.json();
        const post = Array.isArray(posts) ? posts.find(p => p.title?.rendered === postTitle) : null;
        if (!post) { failed++; continue; }

        // Remove all broken links from content — keep anchor text, remove the <a> tag
        let content = post.content?.rendered || "";
        for (const link of links) {
          // Escape special regex chars in URL
          const escaped = link.replace(/[.*+?^${}()|[\]\]/g, "\$&");
          // Remove <a href="brokenlink"...>text</a> → keep text
          content = content.replace(new RegExp(`<a[^>]*href=["']${escaped}["'][^>]*>(.*?)<\/a>`, "gi"), "$1");
        }

        // Update post in WordPress
        const updateRes = await fetch(`${wpBase}/wp-json/wp/v2/posts/${post.id}`, {
          method: "PUT",
          headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        });
        if (updateRes.ok) {
          fixed++;
          // Log to activity log
          await sbFetch("/rest/v1/seo_activity_log", "POST", {
            action: "broken_link_fix", status: "completed",
            title: `Fixed ${links.length} broken link(s) in "${postTitle.slice(0,60)}"`
          }).catch(() => {});
        } else { failed++; }
      } catch { failed++; }
    }

    setBrokenLinks([]);
    setFixingLinks(false);
    setFixProgress("");
    showToast(`✅ Fixed ${fixed} post${fixed !== 1 ? "s" : ""} — ${failed > 0 ? `${failed} failed` : "all clean"}`);
  };

  const triggerAltTags = async () => {
    if (!config?.wp_username || !config?.wp_app_password) { showToast("⚠ Add WordPress credentials in Settings first"); return; }
    setAltLoading(true); setAltResults([]);
    try {
      const res = await fetch("/api/seo-cron", { method: "POST", headers: { "Content-Type": "application/json", "x-vercel-cron": "1", "x-task": "alt_tags" } });
      showToast("✅ Alt tag job triggered — runs in background, check activity log");
      setAltResults(["Alt tag generation triggered — results appear in Activity Log in 1-2 minutes"]);
    } catch (e) { showToast("❌ " + e.message); }
    finally { setAltLoading(false); }
  };

  const copyText = (text) => { navigator.clipboard.writeText(text); showToast("✅ Copied to clipboard"); };

  const scoreColor = (s) => s >= 90 ? "#4ade80" : s >= 50 ? "#fb923c" : "#f87171";

  const isOn = config?.is_enabled || false;
  const lastRun = config?.last_run;
  const latestPost = log.find(l => l.action === "blog_published" && l.status !== "failed");
  const pending = queue.filter(k => !k.used).length;
  const published = log.filter(l => l.action === "blog_published" && l.status !== "failed").length;

  const tabBtn = (id, label) => ({
    padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
    fontFamily: "inherit", background: activeTab === id ? "#7c3aed" : "transparent",
    color: activeTab === id ? "#fff" : "#4a4a6a", transition: "all .2s"
  });

  const sectionBtn = (id, label, icon) => (
    <div onClick={() => setOpenSection(openSection === id ? null : id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: openSection === id ? "#13131f" : "#0d0d16", border: "1px solid", borderColor: openSection === id ? "#7c3aed40" : "#1e1e30", borderRadius: 10, cursor: "pointer", marginBottom: 8, transition: "all .2s" }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 14, color: openSection === id ? "#a78bfa" : "#e2e8f0", flex: 1 }}>{label}</span>
      <span style={{ color: "#3a3a5c", fontSize: 12 }}>{openSection === id ? "▲" : "▼"}</span>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0d0d16", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "#64748b" }}>
      <SeoSpinner size={24} /> Loading SEO Agent…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d16", color: "#e2e8f0", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <style>{`*{box-sizing:border-box;} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:#0d0d16;} ::-webkit-scrollbar-thumb{background:#2a2a40;border-radius:3px;} select option{background:#0d0d16;} input::placeholder,textarea::placeholder{color:#3a3a5c;} textarea{font-family:inherit;}`}</style>

      {toast && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 10, padding: "12px 18px", fontSize: 13, color: "#e2e8f0", boxShadow: "0 8px 32px #00000060", maxWidth: 380 }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: "#09090f", borderBottom: "1px solid #1e1e30", padding: "16px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, background: isOn ? "linear-gradient(135deg,#16a34a,#059669)" : "linear-gradient(135deg,#7c3aed,#2563eb)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🤖</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>SEO Autopilot</div>
          <div style={{ fontSize: 11, color: "#3a3a5c" }}>THUGFIT · thugfit.ae — Fully Autonomous SEO Agent</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: "none", border: "1px solid #1e1e30", color: "#4a4a6a", padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⚙ Settings</button>
          <button onClick={loadAll} style={{ background: "none", border: "1px solid #1e1e30", color: "#4a4a6a", padding: "7px 12px", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>↻</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#09090f", borderBottom: "1px solid #1e1e30", padding: "0 28px", display: "flex", gap: 4 }}>
        <button onClick={() => setActiveTab("autopilot")} style={tabBtn("autopilot", "🤖 Autopilot")}>🤖 Autopilot</button>
        <button onClick={() => setActiveTab("tasks")} style={tabBtn("tasks", "📋 SEO Tasks")}>📋 SEO Tasks</button>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1000, margin: "0 auto" }}>

        {/* ── SETTINGS PANEL ────────────────────────────────────────────────── */}
        {showSettings && (
          <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 22, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>⚙ WordPress Connection</div>
            <div style={{ fontSize: 12, color: "#64748b", background: "#0d0d16", border: "1px solid #1e1e30", borderRadius: 8, padding: "10px 14px", marginBottom: 16, lineHeight: 1.7 }}>
              <strong style={{ color: "#a78bfa" }}>How to get Application Password:</strong><br />
              1. thugfit.ae/wp-admin → Users → click your admin user<br />
              2. Scroll to <strong>Application Passwords</strong> → name it "ZenLine Digital" → Add<br />
              3. Copy the password (shown once only) → paste below
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Site URL</label><input value={wpUrl} onChange={e => setWpUrl(e.target.value)} style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Username</label><input value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="mithzjango@gmail.com" style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }} /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Application Password</label><input type="password" value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }} /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Google API Key <span style={{ color: "#fb923c", fontWeight: 400, fontSize: 10, textTransform: "none" }}>(required for Page Speed checker)</span></label>
              <input type="password" value={googleApiKey} onChange={e => setGoogleApiKey(e.target.value)} placeholder="AIza..." style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }} />
              <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 5 }}>Get free key → console.cloud.google.com → APIs &amp; Services → Credentials → Create API Key → then enable "PageSpeed Insights API"</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Google Indexing API Key <span style={{ color: "#3a3a5c", fontWeight: 400, fontSize: 10, textTransform: "none" }}>(optional — fast-tracks new articles into Google)</span></label>
              <textarea value={googleIndexingKey} onChange={e => setGoogleIndexingKey(e.target.value)} rows={3} placeholder='Paste the full service account JSON here ({"type":"service_account","project_id":...})' style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 11, outline: "none", resize: "vertical", fontFamily: "monospace" }} />
              <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 5 }}>console.cloud.google.com → IAM → Service Accounts → Create → Grant "Indexing API" role → Keys → Add Key → JSON → paste here</div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Publish Articles As</label>
              <select value={postStatus} onChange={e => setPostStatus(e.target.value)} style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}>
                <option value="draft">Draft — you review before publishing (recommended)</option>
                <option value="publish">Live immediately — auto-publishes without review</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveSettings} disabled={saving} style={{ padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }}>{saving ? "Saving…" : "Save Settings"}</button>
              <button onClick={() => setShowSettings(false)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #1e1e30", cursor: "pointer", fontSize: 13, background: "#0d0d16", color: "#64748b" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: AUTOPILOT
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "autopilot" && (
          <>
            {/* ON/OFF Card */}
            <div style={{ background: isOn ? "#0a1a0a" : "#13131f", border: "2px solid", borderColor: isOn ? "#16a34a50" : "#1e1e30", borderRadius: 16, padding: 28, marginBottom: 20, transition: "all .4s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: isOn ? "#4ade80" : "#e2e8f0" }}>{isOn ? "🟢 Running" : "⚪ Paused"}</div>
                    {isOn && <div style={{ fontSize: 11, background: "#16a34a20", color: "#4ade80", border: "1px solid #16a34a40", borderRadius: 20, padding: "3px 10px", fontWeight: 700, animation: "pulse 2s ease-in-out infinite" }}>ACTIVE</div>}
                  </div>
                  <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                    {isOn ? `Publishing one SEO article to thugfit.ae every day at 9:00 AM UAE time. ${lastRun ? `Last run: ${timeAgo(lastRun)}.` : "Not yet run."}` : "Turn on to start publishing SEO articles to thugfit.ae automatically every day."}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <Toggle on={isOn} onChange={toggleAutomation} disabled={saving} />
                  <div style={{ fontSize: 10, color: "#3a3a5c", fontWeight: 600 }}>{isOn ? "ON" : "OFF"}</div>
                </div>
              </div>
              {isOn && latestPost && (
                <div style={{ marginTop: 18, background: "#0d0d16", border: "1px solid #16a34a30", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 20 }}>📝</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>Latest article</div>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{latestPost.title}</div>
                    <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 2 }}>Keyword: {latestPost.keyword} · {timeAgo(latestPost.created_at)}</div>
                  </div>
                  {latestPost.wp_post_url && <a href={latestPost.wp_post_url} target="_blank" rel="noreferrer" style={{ background: "#7c3aed20", border: "1px solid #7c3aed40", color: "#a78bfa", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>View in WP →</a>}
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
              {[["Articles Published", published, "📄", "#4ade80"], ["Keywords in Queue", pending, "🔑", "#a78bfa"], ["Next Post", isOn ? "9:00 AM today/tomorrow" : "Paused", "⏰", "#fb923c"], ["Post Status", config?.post_status === "publish" ? "Live immediately" : "Draft review", "📤", "#60a5fa"]].map(([label, value, icon, color]) => (
                <div key={label} style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Keyword Queue */}
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🔑 Keyword Queue</div>
                  <button onClick={generateKeywords} disabled={genKwLoading} style={{ background: "#7c3aed20", border: "1px solid #7c3aed40", color: "#a78bfa", padding: "5px 11px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {genKwLoading ? <><SeoSpinner size={12} /> Generating…</> : "✨ AI Generate Keywords"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#3a3a5c", marginBottom: 12 }}>Queue empty = agent uses 30 built-in UAE activewear keywords.</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="Add a keyword…" onKeyDown={e => e.key === "Enter" && addKeyword()} style={{ flex: 1, background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "8px 11px", borderRadius: 7, fontSize: 12, outline: "none" }} />
                  <button onClick={addKeyword} disabled={addingKw || !newKw.trim()} style={{ padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }}>+ Add</button>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {queue.length === 0
                    ? <div style={{ color: "#2a2a40", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No keywords — agent uses built-in list</div>
                    : queue.map((kw, i) => (
                      <div key={kw.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 7, padding: "8px 11px", opacity: kw.used ? 0.4 : 1 }}>
                        <span style={{ fontSize: 10, color: "#3a3a5c", minWidth: 18 }}>#{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, color: kw.used ? "#3a3a5c" : "#e2e8f0", textDecoration: kw.used ? "line-through" : "none" }}>{kw.keyword}</span>
                        {kw.used ? <span style={{ fontSize: 9, color: "#16a34a", fontWeight: 700 }}>✓ DONE</span> : <button onClick={() => removeKeyword(kw.id)} style={{ background: "none", border: "none", color: "#3a3a5c", cursor: "pointer", fontSize: 14 }}>×</button>}
                      </div>
                    ))}
                </div>
              </div>

              {/* Activity Log */}
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Activity Log</div>
                  <button onClick={triggerNow} disabled={triggering} style={{ background: triggering ? "#1a1a2e" : "linear-gradient(135deg,#7c3aed,#2563eb)", border: "none", color: triggering ? "#3a3a5c" : "#fff", padding: "6px 14px", borderRadius: 7, cursor: triggering ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {triggering ? <><SeoSpinner size={13} /> Publishing…</> : "▶ Publish Now"}
                  </button>
                </div>
                <div style={{ maxHeight: 310, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {log.length === 0
                    ? <div style={{ color: "#2a2a40", fontSize: 12, textAlign: "center", padding: "30px 0" }}>No activity yet — turn on automation or click "Publish Now"</div>
                    : log.map(entry => (
                      <div key={entry.id} style={{ background: "#0d0d16", border: "1px solid", borderColor: entry.status === "failed" ? "#ef444430" : "#1e1e30", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{entry.status === "failed" || entry.action === "error" ? "❌" : "📝"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {entry.title && <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{entry.title}</div>}
                            {entry.keyword && <div style={{ fontSize: 11, color: "#64748b" }}>🔑 {entry.keyword}</div>}
                            {entry.status && <div style={{ fontSize: 10, color: entry.status === "failed" ? "#f87171" : "#4ade80", marginTop: 3, fontWeight: 600 }}>{entry.status.toUpperCase()}</div>}
                            {entry.error && <div style={{ fontSize: 10, color: "#f87171", marginTop: 3 }}>{entry.error.slice(0, 80)}</div>}
                            {entry.wp_post_url && <a href={entry.wp_post_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#7c3aed", textDecoration: "none" }}>View in WordPress →</a>}
                          </div>
                          <div style={{ fontSize: 10, color: "#2a2a40", flexShrink: 0 }}>{timeAgo(entry.created_at)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Staff Tasks Panel */}
            <StaffTasksPanel sbFetch={sbFetch} showToast={showToast} />

            {/* How it works */}
            <div style={{ background: "#0d0d14", border: "1px solid #1e1e30", borderRadius: 12, padding: 20, marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#64748b", marginBottom: 14 }}>ℹ How the SEO Autopilot works</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                {[["1","Every morning at 9 AM","Runs automatically — no action needed"],["2","Picks a keyword","Your queue first, then built-in UAE list"],["3","Writes the article","1,200–1,500 words with meta tags + Google ping"],["4","Publishes to WordPress","Draft for review or live immediately"]].map(([step,title,desc]) => (
                  <div key={step} style={{ textAlign: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, margin: "0 auto 10px" }}>{step}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 5 }}>{title}</div>
                    <div style={{ fontSize: 11, color: "#4a4a6a", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: SEO TASKS
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tasks" && (
          <div>
            <div style={{ background: "#13131f", border: "1px solid #7c3aed30", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#a78bfa", lineHeight: 1.6 }}>
              💡 These are SEO tasks your team does <strong>weekly or monthly</strong>. Each section generates ready-to-use content — your staff reviews and applies with one click.
            </div>

            {/* ── BACKLINK OUTREACH ─────────────────────────────────────────── */}
            {sectionBtn("backlink", "Backlink Outreach Emails", "🔗")}
            {openSection === "backlink" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                  Backlinks from other UAE websites pointing to thugfit.ae improve your Google ranking. This tool generates ready-to-send outreach emails. Your staff just copies and sends them.
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Target Type</label>
                    <select value={blType} onChange={e => setBlType(e.target.value)} style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none" }}>
                      <option value="uae_fitness_blog">UAE Fitness or Wellness Blog</option>
                      <option value="gym_dubai">Dubai Gym or Fitness Centre</option>
                      <option value="influencer">UAE Fitness Influencer</option>
                      <option value="news_site">UAE Lifestyle or News Website</option>
                    </select>
                  </div>
                  <button onClick={generateBacklinks} disabled={taskLoading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
                    {taskLoading ? <><SeoSpinner size={14} /> Generating…</> : "✨ Generate 3 Emails"}
                  </button>
                </div>
                {backlinks.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {backlinks.map((email, i) => (
                      <div key={i} style={{ background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 10, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>Email {i + 1}</div>
                          <button onClick={() => copyText(`Subject: ${email.subject}\n\n${email.body}`)} style={{ background: "#7c3aed20", border: "1px solid #7c3aed40", color: "#a78bfa", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📋 Copy</button>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Subject: {email.subject}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{email.body}</div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#3a3a5c", textAlign: "center" }}>Copy each email → find the target website's contact page → paste and send</div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRODUCT PAGE SEO ──────────────────────────────────────────── */}
            {sectionBtn("product", "Product Page SEO Scanner", "🛍️")}
            {openSection === "product" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                  Scans your WooCommerce products and generates SEO-optimised titles and meta descriptions for each one. Review the suggestions, then click "Apply" to update your store automatically.
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <button onClick={scanProducts} disabled={taskLoading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                    {taskLoading ? <><SeoSpinner size={14} /> Scanning products…</> : "🔍 Scan Products"}
                  </button>
                  {products.length > 0 && (
                    <button onClick={applyAllProducts} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "#16a34a", color: "#fff" }}>✅ Apply All</button>
                  )}
                </div>
                {products.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {products.map(p => (
                      <div key={p.id} style={{ background: "#0d0d16", border: "1px solid", borderColor: p.applied ? "#16a34a40" : "#2a2a40", borderRadius: 10, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>PRODUCT</div>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>SEO TITLE <span style={{ color: p.seo_title?.length > 60 ? "#f87171" : "#4ade80" }}>({p.seo_title?.length || 0}/60)</span></div>
                            <div style={{ fontSize: 13, color: "#a78bfa", marginBottom: 8, padding: "6px 10px", background: "#7c3aed10", borderRadius: 6 }}>{p.seo_title}</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>META DESCRIPTION <span style={{ color: p.meta_desc?.length > 155 ? "#f87171" : "#4ade80" }}>({p.meta_desc?.length || 0}/155)</span></div>
                            <div style={{ fontSize: 12, color: "#94a3b8", padding: "6px 10px", background: "#0a0a14", borderRadius: 6 }}>{p.meta_desc}</div>
                          </div>
                          <button onClick={() => applyProductSeo(p)} disabled={p.applied || productSaving[p.id]} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: p.applied ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, background: p.applied ? "#16a34a" : "#7c3aed", color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                            {productSaving[p.id] ? <SeoSpinner size={12} /> : p.applied ? "✅ Applied" : "Apply"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PAGE SPEED ────────────────────────────────────────────────── */}
            {sectionBtn("speed", "Page Speed Checker", "⚡")}
            {openSection === "speed" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                  Checks thugfit.ae speed on Google PageSpeed Insights. Slow sites rank lower on Google. This shows your score and gives your team step-by-step fixes.
                </div>
                <button onClick={checkSpeed} disabled={speedLoading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  {speedLoading ? <><SeoSpinner size={14} /> Checking speed…</> : "⚡ Check Speed Now"}
                </button>
                {speedData && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                      {[["📱 Mobile", speedData.mobScore], ["🖥 Desktop", speedData.deskScore]].map(([label, score]) => (
                        <div key={label} style={{ background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 10, padding: 20, textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>{label}</div>
                          {score === null
                            ? <div style={{ fontSize: 18, fontWeight: 700, color: "#fb923c", lineHeight: 1.4 }}>Could not<br />measure</div>
                            : <>
                                <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                                <div style={{ fontSize: 12, color: "#3a3a5c", marginTop: 6 }}>/100 — {score >= 90 ? "Good ✅" : score >= 50 ? "Needs Work ⚠️" : "Poor ❌"}</div>
                              </>
                          }
                        </div>
                      ))}
                    </div>
                    {speedData.failed && (
                      <div style={{ background: "#fb923c10", border: "1px solid #fb923c30", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#fb923c" }}>
                        ⚠ PageSpeed could not fully measure thugfit.ae — the site may be blocking automated crawlers, or loading too slowly to measure. The fixes below still apply.
                      </div>
                    )}
                    <div style={{ background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 14 }}>🛠 Step-by-step fixes for your team:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {speedData.fixes.split(/\n(?=\d+\.)/).filter(s => s.trim()).map((fix, i) => {
                          const lines = fix.trim().split("\n");
                          const title = lines[0].replace(/^\d+\.\s*/, "").trim();
                          const detail = lines.slice(1).join(" ").replace(/^What to do:\s*/i, "").trim();
                          return (
                            <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "#13131f", borderRadius: 8, border: "1px solid #1e1e30" }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 4 }}>{title}</div>
                                {detail && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{detail}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COMPETITOR ANALYSIS ──────────────────────────────────────── */}
            {sectionBtn("competitor", "Competitor Analysis (Auto)", "🔎")}
            {openSection === "competitor" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ background: "#7c3aed10", border: "1px solid #7c3aed30", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#a78bfa", lineHeight: 1.6 }}>
                  🤖 <strong>Fully automatic.</strong> Click the button — AI finds your top UAE activewear competitors, analyses all of them, and queues all keywords + article topics automatically. Articles start publishing tomorrow at 9 AM.
                </div>

                <button onClick={analyzeAllCompetitors} disabled={competitorLoading} style={{ width: "100%", padding: "14px 20px", borderRadius: 10, border: "none", cursor: competitorLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, background: competitorLoading ? "#1e1e30" : "linear-gradient(135deg,#7c3aed,#2563eb)", color: competitorLoading ? "#3a3a5c" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                  {competitorLoading
                    ? <><SeoSpinner size={16} /> {competitorProgress || "Analysing competitors…"}</>
                    : <><span style={{fontSize:18}}>🔎</span> Analyse All Competitors & Queue Everything</>}
                </button>

                {competitorData && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "#16a34a10", border: "1px solid #16a34a40", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#4ade80", marginBottom: 4 }}>✅ Analysis complete — everything queued automatically</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{competitorData.totalKeywords} keywords · {competitorData.totalArticles} article topics · {competitorData.competitors?.length} competitors analysed</div>
                    </div>

                    {/* Per-competitor summary */}
                    {competitorData.competitors?.map((c, i) => (
                      <div key={i} style={{ background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa", marginBottom: 8 }}>🏢 {c.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                          {c.keywords?.slice(0,5).map((kw, j) => <span key={j} style={{ background: "#7c3aed20", color: "#a78bfa", padding: "2px 8px", borderRadius: 20, fontSize: 10 }}>{kw}</span>)}
                          {c.keywords?.length > 5 && <span style={{ color: "#3a3a5c", fontSize: 10, padding: "2px 4px" }}>+{c.keywords.length - 5} more</span>}
                        </div>
                        {c.next_action && <div style={{ fontSize: 11, color: "#4ade80" }}>🎯 {c.next_action}</div>}
                      </div>
                    ))}

                    <div style={{ background: "#fb923c10", border: "1px solid #fb923c30", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#fb923c", marginBottom: 6 }}>🔗 Backlink targets across all competitors:</div>
                      {competitorData.allOutreachTargets?.map((t, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#94a3b8", padding: "3px 0", borderBottom: "1px solid #1e1e30" }}>{i+1}. {t}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── BROKEN LINKS ──────────────────────────────────────────────── */}
            {sectionBtn("broken", "Broken Link Checker", "🔗")}
            {openSection === "broken" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>Scans your published blog posts for broken links (404 errors). Broken links hurt SEO. Staff fixes them in WordPress by editing the post and removing or replacing the broken link.</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <button onClick={checkBrokenLinks} disabled={brokenLoading || fixingLinks} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                    {brokenLoading ? <><SeoSpinner size={14} /> Scanning…</> : "🔍 Scan for Broken Links"}
                  </button>
                  {brokenLinks.length > 0 && (
                    <button onClick={fixAllBrokenLinks} disabled={fixingLinks} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: fixingLinks ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, background: fixingLinks ? "#1e1e30" : "#16a34a", color: fixingLinks ? "#3a3a5c" : "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                      {fixingLinks ? <><SeoSpinner size={14} /> {fixProgress || "Fixing…"}</> : `🔧 Fix All ${brokenLinks.length} Links Automatically`}
                    </button>
                  )}
                </div>
                {brokenLinks.length === 0 && !brokenLoading && <div style={{ fontSize: 12, color: "#3a3a5c", textAlign: "center", padding: "16px 0" }}>Click scan to check your posts</div>}
                {brokenLinks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10, fontWeight: 700 }}>⚠ {brokenLinks.length} broken link{brokenLinks.length !== 1 ? "s" : ""} found — click "Fix All" to remove them automatically:</div>
                    {brokenLinks.map((b, i) => (
                      <div key={i} style={{ background: "#0d0d16", border: "1px solid #ef444430", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>In post: <strong style={{ color: "#e2e8f0" }}>{b.post}</strong></div>
                        <div style={{ fontSize: 12, color: "#f87171", marginBottom: 4, wordBreak: "break-all" }}>{b.link}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171" }}>Status: {b.status}</div>
                        <div style={{ fontSize: 11, color: "#3a3a5c", marginTop: 4 }}>Click "Fix All" above to remove automatically, or manually: WordPress → Posts → Edit → find and remove this link</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── IMAGE ALT TAGS ────────────────────────────────────────────── */}
            {sectionBtn("alttags", "Image Alt Tags (Auto)", "🖼️")}
            {openSection === "alttags" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12, lineHeight: 1.6 }}>All your WooCommerce product images need descriptive alt text for Google Images SEO. This runs automatically every 1st of the month. You can also trigger it manually now.</div>
                <div style={{ background: "#16a34a10", border: "1px solid #16a34a30", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#4ade80" }}>
                  ✅ Runs automatically on the 1st of every month via the daily cron job. No staff action needed.
                </div>
                <button onClick={triggerAltTags} disabled={altLoading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  {altLoading ? <><SeoSpinner size={14} /> Triggering…</> : "🖼️ Run Alt Tags Now"}
                </button>
                {altResults.length > 0 && <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>{altResults[0]}</div>}
              </div>
            )}

            {/* ── GOOGLE BUSINESS PROFILE ──────────────────────────────────── */}
            {sectionBtn("gbp", "Google Business Profile Posts", "📍")}
            {openSection === "gbp" && (
              <GBPSection showToast={showToast} config={config} />
            )}

            {/* ── GOOGLE SEARCH CONSOLE ─────────────────────────────────────── */}
            {sectionBtn("gsc", "Google Search Console Advisor", "📊")}
            {openSection === "gsc" && (
              <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: "0 0 10px 10px", padding: 20, marginBottom: 8, marginTop: -8 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                  Your staff opens Google Search Console, copies what they see (clicks, impressions, top queries), pastes it here — and the AI tells them exactly what to do this week.
                </div>
                <div style={{ background: "#0d0d16", border: "1px solid #2a2a40", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 10 }}>📋 Staff checklist — open Google Search Console and note:</div>
                  {["Total clicks this week vs last week","Total impressions this week vs last week","Top 5 queries (search terms) people used to find thugfit.ae","Any pages with high impressions but low clicks","Any manual actions or coverage errors"].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: "#94a3b8" }}>
                      <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {item}
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Paste what you see in Google Search Console:</label>
                  <textarea value={gscInput} onChange={e => setGscInput(e.target.value)} rows={5} placeholder="e.g. Clicks: 45 (up from 32 last week). Impressions: 1,200. Top queries: thugfit uae, gym leggings dubai, activewear uae..." style={{ width: "100%", background: "#0d0d16", border: "1px solid #1e1e30", color: "#e2e8f0", padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6 }} />
                </div>
                <button onClick={generateGscActions} disabled={gscLoading || !gscInput.trim()} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  {gscLoading ? <><SeoSpinner size={14} /> Analysing…</> : "🧠 Generate This Week's Actions"}
                </button>
                {gscActions && (
                  <div style={{ background: "#0d0d16", border: "1px solid #16a34a30", borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>✅ This week's action plan:</div>
                      <button onClick={() => copyText(gscActions)} style={{ background: "#7c3aed20", border: "1px solid #7c3aed40", color: "#a78bfa", padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📋 Copy</button>
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{gscActions}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("zl_session")); } catch { return null; }
  });
  const [page, setPage]               = useState("dashboard");
  const [plannerWeek, setPlannerWeek] = useState(1);
  const [plan, setPlan]               = useState(null);
  const [posts, setPosts]             = useState([]);
  const [pending, setPending]         = useState([]);
  const [activities, setActivities]   = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [isWorking, setIsWorking]     = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [notice, setNotice]           = useState(null);
  const [geminiKey, setGeminiKey]     = useState("");
  const [brandVoice, setBrandVoice]   = useState("Premium, raw, aspirational. We speak to serious UAE gym-goers who demand elite performance and quality activewear.");
  const [platformApprovals, setPlatformApprovals] = useState({ instagram: false, facebook: false, tiktok: false });
  const month = 7; const year = 2026;

  // ── Load persisted data on startup ──────────────────────────────────────────
  useEffect(() => {
    async function loadSaved() {
      try {
        const sr = await fetch(`${SUPA_URL}/rest/v1/app_settings?select=key,value`, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
        });
        const settings = await sr.json();
        if (Array.isArray(settings)) {
          const gemini = settings.find(s => s.key === "gemini_key");
          if (gemini?.value) setGeminiKey(gemini.value);
          const bv = settings.find(s => s.key === "brand_voice");
          if (bv?.value) setBrandVoice(bv.value);
        }
        const pr = await fetch(`${SUPA_URL}/rest/v1/monthly_plans?month=eq.${month}&year=eq.${year}&order=created_at.desc&limit=1`, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
        });
        const plans = await pr.json();
        if (Array.isArray(plans) && plans.length > 0) {
          const p = plans[0];
          setPlan({ id: p.id, month: p.month, year: p.year, data: p.plan_data });
        }
        const postr = await fetch(`${SUPA_URL}/rest/v1/posts?order=created_at.desc&limit=100`, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
        });
        const savedPosts = await postr.json();
        if (Array.isArray(savedPosts) && savedPosts.length > 0) {
          const approved = savedPosts.filter(p => p.status !== "pending_approval");
          const pendingItems = savedPosts.filter(p => p.status === "pending_approval");
          setPosts(approved);
          setPending(pendingItems);
        }
      } catch (e) {
        console.log("Could not load saved data:", e.message);
      }
    }
    loadSaved();
  }, []);

  function log(agent, action, detail = "") {
    setActivities(p => [{
      id: Date.now() + Math.random(), agent, action, detail,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    }, ...p].slice(0, 40));
  }
  function notify(msg, type = "ok") {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 5000);
  }
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // ── Generate Monthly Plan ────────────────────────────────────────────────────
  async function genPlan() {
    if (isWorking) return;
    setIsWorking(true);
    try {
      setActiveAgent("manager");
      log("Social Media Manager", "Starting monthly plan", `${MONTHS[month - 1]} ${year}`);
      await delay(400);
      setActiveAgent("strategist");
      log("Content Strategist", "Building content mix — weeks 1 & 2", "30% motivation · 25% tips · 20% lifestyle · 15% community · 10% product");

      const prompt = (weeks) =>
        `You are the Social Media Manager for THUGFIT, UAE premium gym activewear. Brand voice: ${brandVoice}

Create an Instagram content plan for weeks ${weeks} of ${MONTHS[month - 1]} ${year}.
Content pillars: motivation (30%), training_tips (25%), lifestyle (20%), community (15%), product (10% — max 1 per week).
Rules: 5 posts per week Mon–Fri, specific compelling UAE/Dubai fitness topics, mix of formats.

Return ONLY a valid JSON array of exactly 10 objects, no markdown:
[{"week":${weeks.split("-")[0]},"day":"Monday","content_type":"motivation","topic":"specific title","theme":"visual direction","format":"single"}]

format values: single | carousel | reel_script
content_type values: motivation | training_tips | lifestyle | community | product`;

      const [text1, text2] = await Promise.all([
        claude(`THUGFIT Social Media Manager`, prompt("1-2"), 1000),
        claude(`THUGFIT Social Media Manager`, prompt("3-4"), 1000)
      ]);

      setActiveAgent("manager");
      log("Social Media Manager", "Reviewing plan quality", "Combining all 4 weeks...");
      await delay(300);

      let part1 = parseJSON(text1);
      let part2 = parseJSON(text2);
      if (Array.isArray(part2)) {
        part2 = part2.map(p => ({ ...p, week: p.week < 3 ? p.week + 2 : p.week }));
      }
      const data = [...(Array.isArray(part1) ? part1 : []), ...(Array.isArray(part2) ? part2 : [])];
      if (data.length === 0) throw new Error("Plan format invalid — try again");

      let planId = null;
      try {
        const saved = await supa.post("monthly_plans", { month, year, status: "draft", plan_data: data });
        planId = saved?.[0]?.id;
      } catch (e) {
        log("System", "DB note", "Run the SQL in Settings to save plans");
      }

      setPlan({ id: planId, month, year, data });
      log("Social Media Manager", "Plan approved ✓", `${data.length} posts planned for ${MONTHS[month - 1]}`);
      notify(`Monthly plan ready — ${data.length} posts across 4 weeks`);
      setPage("planner");
    } catch (e) {
      notify(e.message, "err");
      log("System", "Error", e.message);
    } finally {
      setIsWorking(false);
      setActiveAgent(null);
    }
  }

  // ── Generate Post Content ────────────────────────────────────────────────────
  async function genContent(post) {
    if (!geminiKey) { notify("Add your Gemini API key in Settings first", "err"); return; }
    if (isWorking) return;
    setIsWorking(true);
    try {
      setActiveAgent("strategist");
      log("Content Strategist", "Writing post brief", post.topic);
      const brief = await claude(
        `Content Strategist for THUGFIT, UAE gym activewear. Brand voice: ${brandVoice}. Write focused, evocative content briefs.`,
        `Write a 2-sentence content brief for:
Topic: ${post.topic}
Type: ${post.content_type}
Theme: ${post.theme}
Format: ${post.format}
Include: emotion to trigger, what visuals to show, action to inspire.`
      );

      setActiveAgent("promptWriter");
      log("Prompt Writer", "Crafting image prompt", "Optimising for Gemini Imagen 3...");
      const imgPrompt = await claude(
        "You write precise image prompts for Gemini Imagen 3. Specific composition, lighting, mood, UAE setting. No text overlays, no brand logos. Return prompt only.",
        `Create an Imagen 3 prompt for:
Brief: ${brief}
Style: UAE fitness lifestyle — modern Dubai gym, desert sunrise workout, or city skyline backdrop. Cinematic, high contrast, photorealistic, premium editorial. 1:1 square.
Return ONLY the prompt text.`
      );

      setActiveAgent("designer");
      log("Post Designer", "Generating image", "Calling Gemini Imagen 3...");
      let imageUrl = null;
      try {
        imageUrl = await geminiImage(geminiKey, imgPrompt);
        log("Post Designer", "Image generated ✓", "");
      } catch (e) {
        log("Post Designer", "Image failed", e.message + " — post saved without image");
        notify("Image failed — post saved without image. Check your Gemini key in Settings.", "warn");
      }

      setActiveAgent("copywriter");
      log("Copywriter", "Writing caption & hashtags", "UAE-targeted Instagram copy...");
      const copyText = await claude(
        `Copywriter for THUGFIT, UAE gym activewear. Brand voice: ${brandVoice}. Write authentic, punchy Instagram copy — not salesy.`,
        `Instagram caption and 25 hashtags for:
Topic: ${post.topic}
Type: ${post.content_type}
Brief: ${brief}

Caption: strong hook, 2-3 lines of value/emotion, CTA, 3-5 emojis
Hashtags: UAE fitness, niche fitness, motivational — 25 total

Return JSON only, no markdown:
{"caption":"full caption","hashtags":"#tag1 #tag2 ... 25 tags"}`
      );

      let copy;
      try { copy = parseJSON(copyText); }
      catch { copy = { caption: copyText, hashtags: "#thugfit #uaefitness #dubai #gym #activewear #fitness #gymwear #dubaifit #uaegym #thugfitness #fitnesslifestyle #gymmotivation #fitnessmotivation #workoutmotivation #dubailifestyle #fitnessgear #activewear #gymlife #fitlife #fitnesscommunity #uaefitnesscommunity #premiumactivewear #gymselfie #fitnessfashion #uaesport" }; }

      setActiveAgent("manager");
      log("Social Media Manager", "Quality review ✓", "Post approved — ready for your review");
      await delay(300);

      const postData = {
        plan_id: plan?.id || null, week_number: post.week, day_of_week: post.day,
        platform: "instagram,facebook,tiktok", content_type: post.content_type, topic: post.topic,
        caption: copy.caption, hashtags: copy.hashtags,
        image_prompt: imgPrompt, image_url: imageUrl, status: "pending_approval"
      };
      try {
        const saved = await supa.post("posts", postData);
        postData.id = saved?.[0]?.id;
      } catch (e) { log("System", "DB note", e.message); }

      setPending(p => [...p, postData]);
      notify("Post ready for your approval!");
      setPage("approval");
    } catch (e) {
      notify(e.message, "err");
      log("System", "Error", e.message);
    } finally {
      setIsWorking(false);
      setActiveAgent(null);
    }
  }

  async function approvePost(post, approvedPlatforms) {
    try {
      const allPlatforms = ["instagram", "facebook", "tiktok"];
      const alreadyApproved = (post.approved_platforms || "").split(",").filter(Boolean);
      const newlyApproved = approvedPlatforms.split(",").filter(Boolean);
      const totalApproved = [...new Set([...alreadyApproved, ...newlyApproved])];
      const remaining = allPlatforms.filter(p => !totalApproved.includes(p));

      if (remaining.length === 0) {
        if (post.id) await supa.patch("posts", { status: "approved", platform: totalApproved.join(","), approved_platforms: totalApproved.join(",") }, `id=eq.${post.id}`);
        setPending(p => p.filter(x => x.id !== post.id && x !== post));
        setPosts(p => [...p.filter(x => x.id !== post.id), { ...post, status: "approved", platform: totalApproved.join(","), approved_platforms: totalApproved.join(","), remaining_platforms: "" }]);
        setSelectedPost(null);
        notify(`✓ All platforms approved — moved to Content Queue`);
      } else {
        const updatedPost = { ...post, approved_platforms: totalApproved.join(","), remaining_platforms: remaining.join(","), platform: totalApproved.join(",") };
        if (post.id) await supa.patch("posts", { approved_platforms: totalApproved.join(","), remaining_platforms: remaining.join(",") }, `id=eq.${post.id}`);
        setPending(p => p.map(x => (x.id === post.id || x === post) ? updatedPost : x));
        if (selectedPost === post) setSelectedPost(updatedPost);
        notify(`✓ ${newlyApproved.join(", ")} approved · Still pending: ${remaining.join(", ")}`);
      }
      log("Social Media Manager", "Platform approved", `${newlyApproved.join(", ")} ✓ · Remaining: ${remaining.join(", ") || "none"}`);
    } catch (e) {
      notify("Error: " + e.message, "err");
    }
  }

  function rejectPost(post) {
    if (post.id) supa.patch("posts", { status: "rejected" }, `id=eq.${post.id}`);
    setPending(p => p.filter(x => x !== post));
    setSelectedPost(null);
    notify("Post rejected — regenerate from the Planner");
  }

  // ─── Pages ──────────────────────────────────────────────────────────────────

  function Dashboard() {
    const approved  = posts.filter(p => p.status === "approved").length;
    const scheduled = posts.filter(p => p.status === "scheduled").length;
    const published = posts.filter(p => p.status === "published").length;
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[["Pending Approval", pending.length, C.amber], ["Approved", approved, C.teal], ["Scheduled", scheduled, C.purple], ["Published", published, C.blue]].map(([l, v, c]) => (
            <div key={l} style={{ ...card, padding: "16px 18px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: c, letterSpacing: "-1px" }}>{v}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>AI Team</div>
            {AGENTS.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${a.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: activeAgent === a.id ? `1px solid ${a.color}50` : `1px solid transparent`, transition: "all 0.3s", flexShrink: 0 }}>{a.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: activeAgent === a.id ? a.color : C.text, transition: "color 0.3s" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{activeAgent === a.id ? "● Working..." : a.desc}</div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: activeAgent === a.id ? a.color : C.border, boxShadow: activeAgent === a.id ? `0 0 8px ${a.color}` : "none", transition: "all 0.3s" }} />
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Activity Feed</div>
            <div style={{ maxHeight: 290, overflowY: "auto" }}>
              {activities.length === 0
                ? <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "32px 0", lineHeight: 1.6 }}>No activity yet.<br />Generate your first plan to start.</div>
                : activities.map(a => (
                  <div key={a.id} style={{ padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{a.agent}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{a.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{a.action}{a.detail ? ` — ${a.detail}` : ""}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Quick Actions</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={genPlan} disabled={isWorking} style={btn(C.purple)}>{isWorking ? "⏳ Working..." : "◫ Generate Monthly Plan"}</button>
            <button onClick={() => setPage("approval")} disabled={pending.length === 0} style={btn(C.teal)}>✓ Review Approvals{pending.length > 0 ? ` (${pending.length})` : ""}</button>
            <button onClick={() => setPage("seo")} style={btn("#16a34a")}>🔍 Auto SEO</button>
            <button onClick={() => setPage("settings")} style={btn(C.card, true)}>⚙ Settings</button>
          </div>
        </div>
      </div>
    );
  }

  function Planner() {
    const weekPosts = plan?.data?.filter(p => p.week === plannerWeek) || [];
    if (!plan) return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>Monthly Planner</div><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>No plan generated yet</div></div>
          <button onClick={genPlan} disabled={isWorking} style={btn(C.purple)}>{isWorking ? "⏳ Generating..." : "+ Generate Plan"}</button>
        </div>
        <div style={{ ...card, textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>◫</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No monthly plan yet</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>Your AI team will generate a full month of THUGFIT content —<br />topics, themes, formats, ready to execute one click at a time.</div>
          <button onClick={genPlan} disabled={isWorking} style={btn(C.purple)}>{isWorking ? "⏳ Generating..." : "Generate Monthly Plan"}</button>
        </div>
      </div>
    );
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Monthly Planner</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{MONTHS[plan.month - 1]} {plan.year} — {plan.data?.length || 0} posts planned</div>
          </div>
          <button onClick={genPlan} disabled={isWorking} style={btn(C.purple)}>{isWorking ? "⏳ Generating..." : "↺ Regenerate Plan"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[1, 2, 3, 4].map(w => (
            <button key={w} onClick={() => setPlannerWeek(w)} style={{ padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: plannerWeek === w ? C.purple : C.card, color: plannerWeek === w ? "#fff" : C.muted, transition: "all 0.15s" }}>
              Week {w}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {DAYS.map(day => {
            const p = weekPosts.find(x => x.day === day);
            return (
              <div key={day}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{day.slice(0, 3)}</div>
                {p ? (
                  <div style={{ ...card, padding: 12 }}>
                    <span style={badge(TYPE_COLORS[p.content_type] || C.purple)}>{p.content_type?.replace("_", " ")}</span>
                    <div style={{ fontSize: 12, fontWeight: 600, margin: "8px 0 6px", lineHeight: 1.45 }}>{p.topic}</div>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45, marginBottom: 8 }}>{(p.theme || "").slice(0, 75)}{(p.theme || "").length > 75 ? "..." : ""}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>📐 {p.format}</div>
                    <button onClick={() => genContent(p)} disabled={isWorking} style={btnSm(C.purple)}>{isWorking ? "..." : "⚡ Generate"}</button>
                  </div>
                ) : (
                  <div style={{ ...card, padding: 12, color: C.muted, fontSize: 13, textAlign: "center", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function Approval() {
    const post = selectedPost || pending[0];
    const allPlatforms = [
      { id: "instagram", label: "Instagram", color: "#E1306C", icon: "📸", handle: "@thugfit.ae" },
      { id: "facebook",  label: "Facebook",  color: "#1877F2", icon: "📘", handle: "THUGFIT" },
      { id: "tiktok",    label: "TikTok",    color: "#010101", icon: "🎵", handle: "@thugfit.ae" },
    ];
    const approvedSoFar = (post?.approved_platforms || "").split(",").filter(Boolean);
    const platforms = allPlatforms.filter(p => !approvedSoFar.includes(p.id));
    const selectedCount = platforms.filter(p => platformApprovals[p.id]).length;
    const allSelected = selectedCount === platforms.length && platforms.length > 0;

    function togglePlatform(pid) { setPlatformApprovals(prev => ({ ...prev, [pid]: !prev[pid] })); }
    function selectAll() { const val = !allSelected; const next = {}; platforms.forEach(p => next[p.id] = val); setPlatformApprovals(next); }
    async function doApprove() {
      const approved = platforms.filter(p => platformApprovals[p.id]).map(p => p.id);
      if (approved.length === 0) { notify("Select at least one platform first", "err"); return; }
      await approvePost(post, approved.join(","));
      setPlatformApprovals({ instagram: false, facebook: false, tiktok: false });
    }

    if (!post || platforms.length === 0) return (
      <div style={{ ...card, textAlign: "center", padding: "64px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 14, color: C.teal }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All caught up!</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>No posts pending approval.<br />Go to the Planner and click ⚡ Generate.</div>
        <button onClick={() => setPage("planner")} style={{ ...btn(C.purple), marginTop: 16 }}>Go to Planner</button>
      </div>
    );

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Approval Queue</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{pending.length} post{pending.length !== 1 ? "s" : ""} waiting · Tick platforms then click Approve</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {pending.map((p, i) => (
              <button key={i} onClick={() => { setSelectedPost(p); setPlatformApprovals({ instagram: false, facebook: false, tiktok: false }); }}
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${p === post ? C.purple : C.border}`, background: p === post ? `${C.purple}20` : C.card, color: p === post ? C.purple : C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...card, marginBottom: 16, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{post.topic}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={badge(TYPE_COLORS[post.content_type] || C.purple)}>{post.content_type?.replace("_", " ")}</span>
                <span style={badge(C.muted)}>Week {post.week_number} · {post.day_of_week}</span>
                {approvedSoFar.length > 0 && <span style={badge(C.teal)}>✓ Done: {approvedSoFar.join(", ")}</span>}
                <span style={badge(C.amber)}>Pending: {platforms.map(p => p.label).join(", ")}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={selectAll} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: allSelected ? `${C.purple}20` : "transparent", color: allSelected ? C.purple : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                {allSelected ? "✓ All Selected" : "Select All"}
              </button>
              <button onClick={doApprove} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: selectedCount > 0 ? C.teal : C.border, color: selectedCount > 0 ? "#fff" : C.muted, cursor: selectedCount > 0 ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                ✓ Approve {selectedCount > 0 ? `(${selectedCount})` : ""}
              </button>
              <button onClick={() => { rejectPost(post); setPlatformApprovals({ instagram: false, facebook: false, tiktok: false }); }}
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.danger}`, background: "transparent", color: C.danger, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                ✗ Reject All
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${platforms.length},1fr)`, gap: 16, marginBottom: 16 }}>
          {platforms.map(p => {
            const ticked = !!platformApprovals[p.id];
            return (
              <div key={p.id} style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${ticked ? p.color : C.border}`, boxShadow: ticked ? `0 0 20px ${p.color}30` : "none", background: "#fff", transition: "all 0.2s" }}>
                <div onClick={() => togglePlatform(p.id)} style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, background: ticked ? p.color : "#f5f5f5", cursor: "pointer", transition: "background 0.2s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${ticked ? "#fff" : "#bbb"}`, background: ticked ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {ticked && <span style={{ color: p.color, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ticked ? "#fff" : p.color }}>{p.icon} {p.label}</span>
                  <span style={{ fontSize: 10, color: ticked ? "#ffffff80" : "#999", marginLeft: "auto" }}>{p.handle}</span>
                </div>
                <div style={{ width: "100%", aspectRatio: "1", background: "#eee", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {post.image_url
                    ? <img src={post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ color: "#aaa", textAlign: "center", fontSize: 11 }}><div style={{ fontSize: 24 }}>🎨</div>No image</div>}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 18 }}>♡ 🗨 ✈</div>
                  <div style={{ fontSize: 11, color: "#111", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700 }}>{p.handle} </span>{(post.caption || "").slice(0, 80)}...
                  </div>
                </div>
                <div style={{ padding: "0 12px 12px" }}>
                  <button onClick={(e) => { e.stopPropagation(); approvePost(post, p.id); setPlatformApprovals({ instagram: false, facebook: false, tiktok: false }); }}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", background: p.color, color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                    ✓ Approve {p.label} only
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Caption</div>
            <div style={{ fontSize: 13, lineHeight: 1.65, maxHeight: 120, overflowY: "auto" }}>{post.caption || "No caption"}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Hashtags</div>
            <div style={{ fontSize: 12, color: C.purple, lineHeight: 1.8 }}>{(post.hashtags || "—").slice(0, 200)}</div>
          </div>
        </div>
      </div>
    );
  }

  function Queue() {
    const statusColor = { pending_approval: C.amber, approved: C.teal, scheduled: C.purple, published: C.blue, rejected: C.danger };
    const [scheduling, setScheduling] = useState(null);
    const [schedDate, setSchedDate] = useState("");
    const [schedTime, setSchedTime] = useState("09:00");
    const [expanded, setExpanded] = useState(null);
    const all = [...pending.map(p => ({ ...p, _s: "pending_approval" })), ...posts.map(p => ({ ...p, _s: p.status }))];

    async function schedulePost(post) {
      if (!schedDate) { notify("Pick a date first", "err"); return; }
      const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString();
      if (post.id) await supa.patch("posts", { status: "scheduled", scheduled_at: scheduledAt }, `id=eq.${post.id}`);
      setPosts(p => p.map(x => x.id === post.id || x === post ? { ...x, status: "scheduled", scheduled_at: scheduledAt } : x));
      setScheduling(null);
      notify(`✓ Scheduled for ${schedDate} at ${schedTime}`);
    }

    async function deletePost(post) {
      if (post.id) await supa.patch("posts", { status: "deleted" }, `id=eq.${post.id}`);
      setPosts(p => p.filter(x => x.id !== post.id && x !== post));
      setPending(p => p.filter(x => x.id !== post.id && x !== post));
      setExpanded(null);
      notify("Post deleted from queue");
    }

    async function unschedule(post) {
      if (post.id) await supa.patch("posts", { status: "approved", scheduled_at: null }, `id=eq.${post.id}`);
      setPosts(p => p.map(x => x.id === post.id ? { ...x, status: "approved", scheduled_at: null } : x));
      notify("Post unscheduled — back to approved");
    }

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Content Queue</div>
          <div style={{ fontSize: 12, color: C.muted }}>{all.length} post{all.length !== 1 ? "s" : ""} total</div>
        </div>
        {all.length === 0
          ? <div style={{ ...card, textAlign: "center", padding: "64px 20px", color: C.muted }}>No content yet. Open the Planner and click ⚡ Generate on any post.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {all.map((post, i) => (
              <div key={i}>
                <div style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: C.border, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {post.image_url ? <img src={post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🖼"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.topic}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      Week {post.week_number} · {post.day_of_week} · {post.content_type?.replace("_", " ")}
                      {post.scheduled_at && <span style={{ color: C.purple }}> · {new Date(post.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date(post.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                      {post.platform && <span> · {post.platform}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    {post._s === "approved" && (
                      <button onClick={() => { setScheduling(post); setSchedDate(""); setSchedTime("09:00"); }}
                        style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: `${C.purple}20`, color: C.purple, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                        📅 Schedule
                      </button>
                    )}
                    {post._s === "scheduled" && (
                      <button onClick={() => unschedule(post)}
                        style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: `${C.amber}20`, color: C.amber, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                        ✕ Unschedule
                      </button>
                    )}
                    {post._s === "pending_approval" && (
                      <button onClick={() => { setSelectedPost(post); setPage("approval"); }}
                        style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: `${C.amber}20`, color: C.amber, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                        Review
                      </button>
                    )}
                    <span style={badge(statusColor[post._s] || C.muted)}>{post._s?.replace(/_/g, " ")}</span>
                    <button onClick={() => setExpanded(expanded === i ? null : i)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 14, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ⋯
                    </button>
                  </div>
                </div>
                {expanded === i && (
                  <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: C.muted, flex: 1 }}>
                      {post.caption?.slice(0, 120)}{(post.caption?.length || 0) > 120 ? "..." : ""}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(post._s === "approved" || post._s === "scheduled") && (
                        <button onClick={() => { setSelectedPost(post); setPending(p => [...p, {...post, status:"pending_approval", _s:"pending_approval"}]); setPosts(p => p.filter(x => x !== post)); setPage("approval"); }}
                          style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                          ✏️ Re-review
                        </button>
                      )}
                      <button onClick={() => deletePost(post)}
                        style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${C.danger}`, background: `${C.danger}15`, color: C.danger, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>}

        {scheduling && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={e => { if (e.target === e.currentTarget) setScheduling(null); }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Schedule Post</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{scheduling.topic}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                {scheduling.image_url && <img src={scheduling.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />}
                <div>
                  <span style={badge(TYPE_COLORS[scheduling.content_type] || C.purple)}>{scheduling.content_type?.replace("_", " ")}</span>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Platforms: {scheduling.platform}</div>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Date</div>
                <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  style={{ width: "100%", background: "#080C14", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Time (UAE time)</div>
                <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
                  style={{ width: "100%", background: "#080C14", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => schedulePost(scheduling)} style={{ ...btn(C.purple), flex: 1 }}>📅 Confirm Schedule</button>
                <button onClick={() => setScheduling(null)} style={btn(C.card, true)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function Calendar() {
    const dowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dim = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Calendar</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{MONTHS[month - 1]} {year} — posts will appear here once scheduled</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
          {dowLabels.map(d => <div key={d} style={{ background: C.card, padding: "9px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{d}</div>)}
          {Array(offset).fill(0).map((_, i) => <div key={`e${i}`} style={{ background: "#080B12", minHeight: 72 }} />)}
          {Array(dim).fill(0).map((_, i) => {
            const d = i + 1; const isToday = d === 4 && month === 8;
            return (
              <div key={d} style={{ background: C.card, minHeight: 72, padding: "7px 8px", borderTop: isToday ? `2px solid ${C.purple}` : "2px solid transparent" }}>
                <div style={{ fontSize: 12, color: isToday ? C.purple : C.muted, fontWeight: isToday ? 700 : 400 }}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function Settings() {
    async function saveSettings() {
      try {
        const r1 = await supa.upsert("app_settings", { key: "gemini_key", value: geminiKey }, "key");
        const r2 = await supa.upsert("app_settings", { key: "brand_voice", value: brandVoice }, "key");
        if (r1?.error) throw new Error(r1.error.message);
        if (r2?.error) throw new Error(r2.error.message);
        notify("✅ Settings saved — will persist after refresh");
      } catch (e) {
        notify("❌ Save failed: " + e.message, "err");
      }
    }
    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Settings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>API Connections</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Gemini API Key <span style={{ color: C.amber }}>(required for image generation)</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIza..."
                  style={{ flex: 1, background: "#080C14", border: `1px solid ${geminiKey ? C.teal : C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13 }} />
                {geminiKey && <div style={{ padding: "9px 12px", borderRadius: 8, background: `${C.teal}15`, border: `1px solid ${C.teal}30`, color: C.teal, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Saved</div>}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Get free key → aistudio.google.com → Get API key → Create API key</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "10px 14px", background: `${C.teal}10`, border: `1px solid ${C.teal}30`, borderRadius: 8, fontSize: 12, color: C.teal }}>✓ Claude API connected — content generation active</div>
              <div style={{ padding: "10px 14px", background: `${C.teal}10`, border: `1px solid ${C.teal}30`, borderRadius: 8, fontSize: 12, color: C.teal }}>✓ Supabase connected — ioniqxioapcdgenpksex.supabase.co</div>
              <div style={{ padding: "10px 14px", background: `${geminiKey ? C.teal : C.amber}10`, border: `1px solid ${geminiKey ? C.teal : C.amber}30`, borderRadius: 8, fontSize: 12, color: geminiKey ? C.teal : C.amber }}>
                {geminiKey ? "✓ Gemini API key entered" : "⚠ Gemini API key missing — add above to enable image generation"}
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Brand Voice</div>
            <textarea value={brandVoice} onChange={e => setBrandVoice(e.target.value)} rows={4}
              style={{ width: "100%", background: "#080C14", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, resize: "vertical", lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>All 5 AI agents use this to keep every piece of content on-brand</div>
            <button onClick={saveSettings} style={{ ...btn(C.purple), marginTop: 12 }}>💾 Save Settings</button>
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Database Setup</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Run this SQL once in Supabase → SQL Editor → New query → paste → Run:</div>
            <pre style={{ background: "#080C14", borderRadius: 8, padding: 14, fontFamily: "monospace", fontSize: 11, color: C.teal, lineHeight: 1.9, overflowX: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
{`CREATE TABLE IF NOT EXISTS monthly_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  month integer, year integer,
  status text DEFAULT 'draft',
  plan_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid, week_number integer, day_of_week text,
  platform text DEFAULT 'instagram',
  content_type text, topic text, caption text,
  hashtags text, image_prompt text, image_url text,
  status text DEFAULT 'draft',
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE monthly_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id text NOT NULL, role text NOT NULL,
  content text NOT NULL, agent_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text UNIQUE NOT NULL,
  skills jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text, change_type text, description text,
  requested_by text, chat_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE change_log DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY, value text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- SEO Automation tables
CREATE TABLE IF NOT EXISTS seo_automation (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  is_enabled boolean DEFAULT false,
  wp_url text DEFAULT 'https://thugfit.ae',
  wp_username text, wp_app_password text,
  post_status text DEFAULT 'draft',
  last_run timestamptz
);
CREATE TABLE IF NOT EXISTS seo_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  action text, title text, keyword text,
  status text, wp_post_id int, wp_post_url text, error text
);
CREATE TABLE IF NOT EXISTS seo_keyword_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  keyword text, used boolean DEFAULT false,
  used_at timestamptz, priority int DEFAULT 5
);
ALTER TABLE seo_automation DISABLE ROW LEVEL SECURITY;
ALTER TABLE seo_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keyword_queue DISABLE ROW LEVEL SECURITY;
INSERT INTO seo_automation (is_enabled) VALUES (false) ON CONFLICT DO NOTHING;`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (!session) return <LoginScreen onLogin={s => setSession(s)} />;
  const signOut = () => { localStorage.removeItem("zl_session"); setSession(null); };
  const currentUserEmail = session?.user?.email || "";
  const isAdminUser = ADMIN_EMAILS.includes(currentUserEmail);

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 210, background: C.surf, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>ZenLine</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>Digital Platform</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV.map(item => (
            <div key={item.id} onClick={() => setPage(item.id)} style={{
              display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              background: page === item.id ? `${C.purple}18` : "transparent",
              color: page === item.id ? C.purple : C.muted,
              fontSize: 13, fontWeight: page === item.id ? 600 : 400,
              border: page === item.id ? `1px solid ${C.purple}25` : "1px solid transparent",
              transition: "all 0.15s"
            }}>
              <span style={{ width: 16, textAlign: "center" }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === "approval" && pending.length > 0 && (
                <span style={{ background: C.amber, color: "#000", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{pending.length}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted }}>THUGFIT · ZenLine FZ-LLC</div>
          <div style={{ fontSize: 10, color: "#2D3F5A", marginTop: 2 }}>{currentUserEmail}</div>
          <button onClick={signOut} style={{ marginTop: 8, width: "100%", padding: "6px 0", borderRadius: 6, border: "1px solid #1C2537", background: "transparent", color: "#2D3F5A", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Sign Out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surf, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{NAV.find(n => n.id === page)?.label}</div>
          {isWorking && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.purple }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.purple, animation: "pulse 1.2s infinite" }} />
              AI team working...
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: (page === "seo" || page === "tasks") ? 0 : 24 }}>
          {page === "dashboard" && <Dashboard />}
          {page === "planner"   && <Planner />}
          {page === "approval"  && <Approval />}
          {page === "queue"     && <Queue />}
          {page === "calendar"  && <Calendar />}
          {page === "seo"       && <SEO />}
          {page === "settings"  && <Settings />}
          {page === "tasks"     && <StaffTaskManager platformUser={session?.user} />}
          {page === "chat"      && <Chat brandVoice={brandVoice} />}
        </div>
      </div>

      {/* Toast */}
      {notice && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, padding: "12px 18px", zIndex: 999, maxWidth: 360,
          background: notice.type === "err" ? `${C.danger}18` : `${C.teal}18`,
          border: `1px solid ${notice.type === "err" ? C.danger : C.teal}`,
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          color: notice.type === "err" ? C.danger : C.teal,
          backdropFilter: "blur(12px)"
        }}>
          {notice.msg}
        </div>
      )}
    </div>
  );
}
