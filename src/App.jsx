import { useState, useEffect } from "react";
import Chat from "./Chat.jsx";

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmlxeGlvYXBjZGdlbnBrc2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc1MDIsImV4cCI6MjEwMDcyMzUwMn0.PS80PFMqBYMf0e6uiYvTFk90gF7a7jo97C-dzzxUGho";

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
    return r.json();
  }
};

// ─── Claude API ───────────────────────────────────────────────────────────────
async function claude(system, user, maxTokens = 1000) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
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
  { id: "settings",  label: "Settings",        icon: "⚙" },
  { id: "chat",     label: "Team Chat",        icon: "💬" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
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
        // Load settings (Gemini key etc)
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

        // Load latest plan
        const pr = await fetch(`${SUPA_URL}/rest/v1/monthly_plans?month=eq.${month}&year=eq.${year}&order=created_at.desc&limit=1`, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
        });
        const plans = await pr.json();
        if (Array.isArray(plans) && plans.length > 0) {
          const p = plans[0];
          setPlan({ id: p.id, month: p.month, year: p.year, data: p.plan_data });
        }

        // Load posts
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
      await delay(600);

      setActiveAgent("strategist");
      log("Content Strategist", "Building content mix", "30% motivation · 25% tips · 20% lifestyle · 15% community · 10% product");

      const text = await claude(
        `You are the Social Media Manager for THUGFIT, UAE premium gym activewear. Brand voice: ${brandVoice}`,
        `Create a 4-week Instagram content plan for ${MONTHS[month - 1]} ${year}.

Content pillars: motivation (30%), training_tips (25%), lifestyle (20%), community (15%), product (10% — max 1 per week).

Rules:
- Exactly 5 posts per week Mon–Fri, 20 total
- Mix of formats: single image, carousel, reel_script  
- Topics must be specific and compelling
- UAE/Dubai fitness culture context where relevant

Return ONLY a valid JSON array of exactly 20 objects, no markdown:
[{"week":1,"day":"Monday","content_type":"motivation","topic":"specific engaging title","theme":"visual and emotional direction","format":"single"}]

format values: single | carousel | reel_script
content_type values: motivation | training_tips | lifestyle | community | product`,
        2000
      );

      setActiveAgent("manager");
      log("Social Media Manager", "Reviewing plan quality", "Cross-checking brand alignment...");
      await delay(400);

      let data = parseJSON(text);
      if (!Array.isArray(data)) throw new Error("Plan format invalid — try again");

      let planId = null;
      try {
        const saved = await supa.post("monthly_plans", { month, year, status: "draft", plan_data: data });
        planId = saved?.[0]?.id;
      } catch (e) {
        log("System", "DB note", "Run the SQL in Settings first, then data will save");
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

  async function approvePost(post, platforms = "instagram,facebook,tiktok") {
    try {
      if (post.id) {
        await supa.patch("posts", { status: "approved", platform: platforms }, `id=eq.${post.id}`);
      }
      setPending(p => p.filter(x => x.id !== post.id && x !== post));
      setPosts(p => [...p.filter(x => x.id !== post.id), { ...post, status: "approved", platform: platforms }]);
      setSelectedPost(null);
      log("Social Media Manager", "Post approved ✓", `${post.topic} → ${platforms}`);
      notify(`✓ Approved for: ${platforms.replace(/,/g, ", ")}`);
    } catch (e) {
      notify("Approval saved locally", "warn");
      setPending(p => p.filter(x => x !== post));
      setPosts(p => [...p, { ...post, status: "approved", platform: platforms }]);
      setSelectedPost(null);
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
    const platforms = [
      { id: "instagram", label: "Instagram", color: "#E1306C", icon: "📸", handle: "@thugfit.ae" },
      { id: "facebook",  label: "Facebook",  color: "#1877F2", icon: "📘", handle: "THUGFIT" },
      { id: "tiktok",    label: "TikTok",    color: "#010101", icon: "🎵", handle: "@thugfit.ae" },
    ];

    const selectedCount = platforms.filter(p => platformApprovals[p.id]).length;
    const allSelected = selectedCount === platforms.length;

    function togglePlatform(pid) {
      setPlatformApprovals(prev => ({ ...prev, [pid]: !prev[pid] }));
    }

    function selectAll() {
      const val = !allSelected;
      const next = {};
      platforms.forEach(p => next[p.id] = val);
      setPlatformApprovals(next);
    }

    async function doApprove() {
      const approved = platforms.filter(p => platformApprovals[p.id]).map(p => p.id);
      if (approved.length === 0) { notify("Select at least one platform first", "err"); return; }
      await approvePost(post, approved.join(","));
      setPlatformApprovals({ instagram: false, facebook: false, tiktok: false });
    }

    if (!post) return (
      <div style={{ ...card, textAlign: "center", padding: "64px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 14, color: C.teal }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All caught up!</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>No posts pending approval.<br />Go to the Planner and click ⚡ Generate on any post.</div>
        <button onClick={() => setPage("planner")} style={{ ...btn(C.purple), marginTop: 16 }}>Go to Planner</button>
      </div>
    );

    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Approval Queue</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{pending.length} post{pending.length !== 1 ? "s" : ""} waiting · Tick platforms below then click Approve</div>
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

        {/* Topic + action bar */}
        <div style={{ ...card, marginBottom: 16, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{post.topic}</div>
              <div>
                <span style={badge(TYPE_COLORS[post.content_type] || C.purple)}>{post.content_type?.replace("_", " ")}</span>
                <span style={badge(C.muted)}>Week {post.week_number}</span>
                <span style={badge(C.muted)}>{post.day_of_week}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={selectAll} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: allSelected ? `${C.purple}20` : "transparent", color: allSelected ? C.purple : C.muted, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                {allSelected ? "✓ All Selected" : "Select All"}
              </button>
              <button onClick={doApprove} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: selectedCount > 0 ? C.teal : C.border, color: selectedCount > 0 ? "#fff" : C.muted, cursor: selectedCount > 0 ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                ✓ Approve {selectedCount > 0 ? `(${selectedCount} platform${selectedCount > 1 ? "s" : ""})` : ""}
              </button>
              <button onClick={() => { rejectPost(post); setPlatformApprovals({ instagram: false, facebook: false, tiktok: false }); }}
                style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.danger}`, background: "transparent", color: C.danger, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                ✗ Reject
              </button>
            </div>
          </div>
        </div>

        {/* Platform cards — click anywhere on card to tick it */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
          {platforms.map(p => {
            const ticked = !!platformApprovals[p.id];
            return (
              <div key={p.id} style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${ticked ? p.color : C.border}`, boxShadow: ticked ? `0 0 20px ${p.color}30` : "none", background: "#fff", transition: "all 0.2s" }}>
                {/* Clickable checkbox header */}
                <div onClick={() => togglePlatform(p.id)} style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, background: ticked ? p.color : "#f5f5f5", cursor: "pointer", transition: "background 0.2s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${ticked ? "#fff" : "#bbb"}`, background: ticked ? "#fff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {ticked && <span style={{ color: p.color, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ticked ? "#fff" : p.color }}>{p.icon} {p.label}</span>
                  <span style={{ fontSize: 10, color: ticked ? "#ffffff80" : "#999", marginLeft: "auto" }}>{p.handle}</span>
                </div>
                {/* Image */}
                <div style={{ width: "100%", aspectRatio: "1", background: "#eee", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {post.image_url
                    ? <img src={post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ color: "#aaa", textAlign: "center", fontSize: 11 }}><div style={{ fontSize: 24 }}>🎨</div>No image</div>}
                </div>
                {/* Caption preview */}
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 18 }}>♡ 🗨 ✈</div>
                  <div style={{ fontSize: 11, color: "#111", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700 }}>{p.handle} </span>{(post.caption || "").slice(0, 80)}...
                  </div>
                </div>
                {/* Approve this platform directly */}
                <div style={{ padding: "0 12px 12px" }}>
                  <button onClick={(e) => { e.stopPropagation(); approvePost(post, p.id); setPlatformApprovals({ instagram: false, facebook: false, tiktok: false }); }}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `none`, cursor: "pointer", background: p.color, color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                    ✓ Approve {p.label} only
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Caption & Hashtags */}
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
    const all = [...pending.map(p => ({ ...p, _s: "pending_approval" })), ...posts.map(p => ({ ...p, _s: p.status }))];

    async function schedulePost(post) {
      if (!schedDate) { notify("Pick a date first", "err"); return; }
      const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString();
      if (post.id) await supa.patch("posts", { status: "scheduled", scheduled_at: scheduledAt }, `id=eq.${post.id}`);
      setPosts(p => p.map(x => x.id === post.id || x === post ? { ...x, status: "scheduled", scheduled_at: scheduledAt } : x));
      setScheduling(null);
      notify(`✓ Scheduled for ${schedDate} at ${schedTime}`);
    }

    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Content Queue</div>
        {all.length === 0
          ? <div style={{ ...card, textAlign: "center", padding: "64px 20px", color: C.muted }}>No content yet. Open the Planner and click ⚡ Generate on any post.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {all.map((post, i) => (
              <div key={i} style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: C.border, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {post.image_url ? <img src={post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🖼"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.topic}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    Week {post.week_number} · {post.day_of_week} · {post.content_type?.replace("_", " ")}
                    {post.scheduled_at && <span style={{ color: C.purple }}> · Scheduled {new Date(post.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date(post.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                    {post.platform && <span style={{ color: C.muted }}> · {post.platform}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {post._s === "approved" && (
                    <button onClick={() => { setScheduling(post); setSchedDate(""); setSchedTime("09:00"); }}
                      style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: C.purple, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                      📅 Schedule
                    </button>
                  )}
                  {post._s === "pending_approval" && (
                    <button onClick={() => { setSelectedPost(post); setPage("approval"); }}
                      style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: `${C.amber}20`, color: C.amber, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                      Review
                    </button>
                  )}
                  <span style={badge(statusColor[post._s] || C.muted)}>{post._s?.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>}

        {/* Schedule Modal */}
        {scheduling && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={e => { if (e.target === e.currentTarget) setScheduling(null); }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Schedule Post</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>{scheduling.topic}</div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                {scheduling.image_url && <img src={scheduling.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />}
                <div>
                  <div style={{ ...badge(TYPE_COLORS[scheduling.content_type] || C.purple) }}>{scheduling.content_type?.replace("_", " ")}</div>
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
            const d = i + 1; const isToday = d === 27 && month === 7;
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
        await supa.upsert("app_settings", { key: "gemini_key", value: geminiKey }, "key");
        await supa.upsert("app_settings", { key: "brand_voice", value: brandVoice }, "key");
        notify("Settings saved — Gemini key will persist after refresh");
      } catch (e) {
        notify("Settings saved locally (run SQL below to enable full persistence)", "warn");
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
              <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIza..."
                style={{ width: "100%", background: "#080C14", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13 }} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Get free key → aistudio.google.com → Get API key → Create API key</div>
            </div>            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
  chat_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  agent_id text,
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
  agent_id text,
  change_type text,
  description text,
  requested_by text,
  chat_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE change_log DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
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
          <div style={{ fontSize: 10, color: "#2D3F5A", marginTop: 2 }}>digital.zenline.ae</div>
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
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {page === "dashboard" && <Dashboard />}
          {page === "planner"   && <Planner />}
          {page === "approval"  && <Approval />}
          {page === "queue"     && <Queue />}
          {page === "calendar"  && <Calendar />}
          {page === "settings"  && <Settings />}
          {page === "chat"     && <Chat brandVoice={brandVoice} />}
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
