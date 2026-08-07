import { useState, useEffect, useRef } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmlxeGlvYXBjZGdlbnBrc2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc1MDIsImV4cCI6MjEwMDcyMzUwMn0.PS80PFMqBYMf0e6uiYvTFk90gF7a7jo97C-dzzxUGho";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const TYPE_COLORS = { motivation:"#8B7CF8", training_tips:"#00C9A7", lifestyle:"#F472B6", community:"#FBBF24", product:"#60A5FA" };
const C = { bg:"#07091A", surf:"#0D1117", card:"#131929", border:"#1C2537", purple:"#8B7CF8", teal:"#00C9A7", amber:"#FBBF24", pink:"#F472B6", blue:"#60A5FA", danger:"#F87171", text:"#E2E8F7", muted:"#6B7EB8" };
const SKILL_TRIGGERS = ["always","never","remember","make sure","every time","from now on","don't forget","important:","rule:","must ","should always","please always","note:","going forward","in future"];

// ─── Supabase ─────────────────────────────────────────────────────────────────
const db = {
  get: async (table, qs = "") => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    const d = await r.json();
    if (d?.code || d?.error) throw new Error(d.message || d.error);
    return d;
  },
  post: async (table, body) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (d?.code || d?.error) throw new Error(d.message || d.error);
    return Array.isArray(d) ? d[0] : d;
  },
  patch: async (table, body, filter) => {
    await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  },
  del: async (table, filter) => {
    await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
  }
};

// ─── Claude API (single turn) ─────────────────────────────────────────────────
async function claude(system, user, maxTokens = 1200) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content[0].text;
}

// ─── Claude API (multi-turn chat) ────────────────────────────────────────────
async function claudeChat(system, history, maxTokens = 1500) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: history })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content[0].text;
}

// ─── Gemini Image ─────────────────────────────────────────────────────────────
async function geminiImage(apiKey, prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: "1:1" } })
  });
  const d = await r.json();
  if (d.predictions?.[0]?.bytesBase64Encoded) return `data:image/png;base64,${d.predictions[0].bytesBase64Encoded}`;
  throw new Error(d.error?.message || "No image returned from Gemini");
}

function parseJSON(text) {
  const c = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const m = c.match(/[\[{][\s\S]*[\]}]/);
  return JSON.parse(m ? m[0] : c);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const btn  = (color, outline = false, extra = {}) => ({ padding: "9px 18px", borderRadius: 8, border: outline ? `1px solid ${color}` : "none", background: outline ? "transparent" : color, color: outline ? color : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "opacity 0.15s", ...extra });
const btnSm = (color, extra = {}) => ({ padding: "5px 12px", borderRadius: 6, border: "none", background: `${color}20`, color, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", ...extra });
const badge = (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${color}20`, color, marginRight: 4 });
const card  = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 };
const inp   = { background: "#080C14", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };

// ─── Agents ───────────────────────────────────────────────────────────────────
const AGENTS = [
  { id: "manager",      name: "Social Media Manager", emoji: "👔", color: C.purple, desc: "Orchestrates team, quality gates",   fullDesc: "Orchestrates the team and is your main point of contact" },
  { id: "content",      name: "Content Strategist",   emoji: "🧠", color: C.teal,   desc: "Plans content topics",               fullDesc: "Plans content topics, themes and direction" },
  { id: "promptWriter", name: "Prompt Writer",         emoji: "✍️", color: C.amber,  desc: "Crafts image generation prompts",    fullDesc: "Crafts image generation prompts for Gemini" },
  { id: "designer",     name: "Post Designer",         emoji: "🎨", color: C.pink,   desc: "Generates visuals using Ge...",      fullDesc: "Generates visuals using Gemini Imagen" },
  { id: "copywriter",   name: "Copywriter",            emoji: "📝", color: C.blue,   desc: "Writes captions and hasht...",       fullDesc: "Writes captions and hashtags" },
];
const CHAT_AGENTS = [
  { id: "manager",    name: "Manager",    emoji: "👔", color: C.purple, desc: "Your main contact" },
  { id: "whole_team", name: "Whole Team", emoji: "👥", color: C.muted,  desc: "Broadcast to all" },
  { id: "content",    name: "Content",    emoji: "🧠", color: C.teal,   desc: "Plans content topics" },
  { id: "promptWriter", name: "Prompt",   emoji: "✍️", color: C.amber,  desc: "Crafts image generation pr..." },
  { id: "designer",   name: "Post Designer", emoji: "🎨", color: C.pink,   desc: "Generates visuals via Gemini" },
  { id: "copywriter", name: "Copywriter", emoji: "📝", color: C.blue,   desc: "Writes captions and hasht..." },
];

const SYSTEM_PROMPTS = {
  manager: (skills, bv) => {
    const skillList = skills.length ? skills.map(s => "• " + s.skill).join("\n") : "No custom instructions yet — apply best practices for UAE fitness Instagram growth.";
    return "You are the dedicated Social Media Manager for THUGFIT, a UAE premium gym activewear brand owned by Midhun. This is your full-time role — you have no other identity. You never mention AI, Claude, memory limitations, chat sessions, or platform constraints. You never break character under any circumstances.\n\nYour job: orchestrate the content team, plan strategy, and act as Midhun's right hand for all Instagram growth. Brand voice: " + bv + "\n\nYour standing instructions from Midhun (always follow these):\n" + skillList + "\n\nRules you never break:\n• You are always the THUGFIT Social Media Manager — never an AI assistant\n• You never say you cannot remember things — you have full context of this conversation\n• When asked to create a content plan, output a JSON array with: week, day, content_type, topic, theme, format\n• When asked to generate or create an image, say you are briefing the Post Designer and it will appear shortly — never say you cannot do it\n• Be direct, confident, and action-oriented at all times";
  },
  content: (skills, bv) => {
    const skillList = skills.length ? skills.map(s => "• " + s.skill).join("\n") : "No custom instructions yet — apply best UAE fitness content strategy.";
    return "You are the Content Strategist for THUGFIT, UAE premium gym activewear. You plan content topics, themes and creative direction. You never break character or mention AI limitations. Brand voice: " + bv + "\n\nStanding instructions:\n" + skillList;
  },
  promptWriter: (skills, bv) => {
    const skillList = skills.length ? skills.map(s => "• " + s.skill).join("\n") : "No custom instructions yet.";
    return "You are the Prompt Writer for THUGFIT. You craft precise Gemini Imagen 3 prompts for UAE fitness lifestyle content — modern Dubai gym, desert sunrise workouts, city skyline backdrops. No text overlays, no logos. You never break character. Brand voice: " + bv + "\n\nStanding instructions:\n" + skillList;
  },
  designer: (skills, bv) => {
    const skillList = skills.length ? skills.map(s => "• " + s.skill).join("\n") : "No custom instructions yet.";
    return "You are the Post Designer for THUGFIT, UAE premium gym activewear. Your ONLY job is creating visuals. Gemini Imagen 3 is your tool and it is fully connected. You never mention APIs, integrations, developers, or technical limitations — ever. You never break character. When asked to generate an image, immediately say what you are designing and that it is being rendered now. Brand voice: " + bv + "\n\nStanding instructions:\n" + skillList + "\n\nNon-negotiable rules:\n• NEVER say image generation is not connected or not possible\n• NEVER mention Gemini, APIs, or technical setup\n• NEVER suggest talking to a developer\n• ALWAYS respond as if you are actively creating the image right now\n• Describe your creative vision: lighting, composition, mood, colors\n• UAE fitness aesthetic: Dubai skyline, desert sunrise, premium gym interiors";
  },
  copywriter: (skills, bv) => {
    const skillList = skills.length ? skills.map(s => "• " + s.skill).join("\n") : "No custom instructions yet.";
    return "You are the Copywriter for THUGFIT. You write punchy Instagram captions and strategic hashtags for the UAE fitness audience. You never break character or mention AI limitations. Brand voice: " + bv + "\n\nStanding instructions:\n" + skillList;
  },
  whole_team: (skills, bv) => {
    const skillList = skills.length ? skills.map(s => "• " + s.skill).join("\n") : "No custom instructions yet.";
    return "You are the Social Media Manager for THUGFIT, speaking on behalf of the entire content team. You never break character or mention AI limitations. Brand voice: " + bv + "\n\nTeam-wide instructions:\n" + skillList;
  },
};

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",  label: "Dashboard",       icon: "▤" },
  { id: "algorithm",  label: "Algorithm Engine", icon: "⚡" },
  { id: "planner",    label: "Monthly Planner",  icon: "◫" },
  { id: "queue",      label: "Content Queue",    icon: "≡" },
  { id: "approval",   label: "Approvals",        icon: "✓" },
  { id: "calendar",   label: "Calendar",         icon: "⊞" },
  { id: "autoseo",    label: "Auto SEO",         icon: "🔍" },
  { id: "settings",   label: "Settings",         icon: "⚙" },
  { id: "stafftasks", label: "Staff Tasks",      icon: "✅" },
  { id: "teamchat",   label: "Team Chat",        icon: "💬" },
];

// ═════════════════════════════════════════════════════════════════════════════
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
  const [geminiKey, setGeminiKey]     = useState(() => localStorage.getItem("zld_gemini") || "");
  const [brandVoice, setBrandVoice]   = useState(() => localStorage.getItem("zld_bv") || "Premium, raw, aspirational. We speak to serious UAE gym-goers who demand elite performance and quality activewear.");

  // ── Team Chat state ──────────────────────────────────────────────────────
  const [chatAgentId, setChatAgentId]   = useState("manager");
  const [chatView, setChatView]         = useState("chat");       // "chat" | "skills" | "changelog"
  const [chatMessages, setChatMessages] = useState({});           // { agentId: [{role,content,created_at}] }
  const [loadedAgents, setLoadedAgents] = useState(new Set());    // which agent histories are loaded
  const [allSkills, setAllSkills]       = useState([]);
  const [changeLog, setChangeLog]       = useState([]);
  const chatInputRef                    = useRef(null);
  const [isSending, setIsSending]       = useState(false);
  const [pendingSkill, setPendingSkill] = useState(null);         // { agentId, text }
  const [pendingPlan, setPendingPlan]   = useState(null);         // parsed plan array from chat
  const [tasks, setTasks]               = useState([]);
  const [newTask, setNewTask]           = useState({ title: "", assignee: "manager", priority: "medium" });
  const chatEndRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);
  const month = 7; const year = 2026;

  // ── Persist settings ──────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("zld_gemini", geminiKey); }, [geminiKey]);
  useEffect(() => { localStorage.setItem("zld_bv", brandVoice); }, [brandVoice]);

  // ── Boot: load global data ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await Promise.allSettled([loadSkills(), loadChangeLog(), loadLatestPlan(), loadTasks()]);
      await loadChatHistory("manager"); // pre-load manager chat
    })();
  }, []);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatAgentId, isSending]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  async function loadSkills() {
    try {
      const d = await db.get("agent_skills", "order=created_at.asc");
      setAllSkills(Array.isArray(d) ? d : []);
    } catch (_) {}
  }

  async function loadChangeLog() {
    try {
      const d = await db.get("change_log", "order=created_at.desc&limit=100");
      setChangeLog(Array.isArray(d) ? d : []);
    } catch (_) {}
  }

  async function loadLatestPlan() {
    try {
      const d = await db.get("monthly_plans", `month=eq.${month}&year=eq.${year}&order=created_at.desc&limit=1`);
      if (Array.isArray(d) && d[0]) {
        const row = d[0];
        setPlan({ id: row.id, month: row.month, year: row.year, data: row.plan_data });
      }
    } catch (_) {}
  }

  async function loadTasks() {
    try {
      const d = await db.get("staff_tasks", "order=created_at.desc");
      setTasks(Array.isArray(d) ? d : []);
    } catch (_) {}
  }

  async function loadChatHistory(agentId) {
    if (loadedAgents.has(agentId)) return;
    try {
      const d = await db.get("chat_messages", `agent_id=eq.${agentId}&order=created_at.asc&limit=200`);
      setChatMessages(prev => ({ ...prev, [agentId]: Array.isArray(d) ? d : [] }));
      setLoadedAgents(prev => new Set([...prev, agentId]));
    } catch (_) {
      setChatMessages(prev => ({ ...prev, [agentId]: [] }));
      setLoadedAgents(prev => new Set([...prev, agentId]));
    }
  }

  function switchAgent(id) {
    setChatAgentId(id);
    setChatView("chat");
    setPendingSkill(null);
    setPendingPlan(null);
    loadChatHistory(id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function log(agent, action, detail = "") {
    setActivities(p => [{ id: Date.now() + Math.random(), agent, action, detail, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }, ...p].slice(0, 40));
  }
  function notify(msg, type = "ok") { setNotice({ msg, type }); setTimeout(() => setNotice(null), 5000); }
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ── Change log writer ─────────────────────────────────────────────────────
  async function addChangeLog(agentId, description, changeType = "general") {
    const entry = { agent_id: agentId, description, change_type: changeType, created_at: new Date().toISOString() };
    try {
      const saved = await db.post("change_log", entry);
      setChangeLog(prev => [saved, ...prev].slice(0, 100));
    } catch (_) {
      setChangeLog(prev => [{ ...entry, id: Date.now() }, ...prev].slice(0, 100));
    }
  }

  // ── Skill management ──────────────────────────────────────────────────────
  async function addSkill(agentId, skillText) {
    try {
      const saved = await db.post("agent_skills", { agent_id: agentId, skill: skillText.trim(), used_count: 0 });
      setAllSkills(prev => [...prev, saved]);
      await addChangeLog(agentId, `Skill added: "${skillText.slice(0, 70)}${skillText.length > 70 ? "..." : ""}"`, "skill");
      notify("Skill saved ✓ — will be used in all future generations");
      setPendingSkill(null);
    } catch (_) {
      notify("Couldn't save — run the DB setup SQL in Settings first", "err");
    }
  }

  async function deleteSkill(id) {
    try { await db.del("agent_skills", `id=eq.${id}`); } catch (_) {}
    setAllSkills(prev => prev.filter(s => s.id !== id));
  }

  function detectSkillKeywords(text) {
    const l = text.toLowerCase();
    return SKILL_TRIGGERS.some(k => l.includes(k));
  }

  // ── File attachment handler ───────────────────────────────────────────────
  function handleFileAttach(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPDF   = file.type === "application/pdf";
    const reader  = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setAttachedFile({ base64, mimeType: file.type, name: file.name, previewUrl: isImage ? reader.result : null, isImage, isPDF });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Send chat message ─────────────────────────────────────────────────────
  async function sendMessage() {
    const text = chatInputRef.current?.value?.trim() || "";
    if ((!text && !attachedFile) || isSending) return;
    const agentId = chatAgentId;
    if (chatInputRef.current) chatInputRef.current.value = "";
    setIsSending(true);
    setPendingPlan(null);
    const fileSnap = attachedFile;
    setAttachedFile(null);

    // Build content — text only, or text + image/doc
    let apiContent;
    if (fileSnap) {
      apiContent = [];
      if (fileSnap.isImage) {
        apiContent.push({ type: "image", source: { type: "base64", media_type: fileSnap.mimeType, data: fileSnap.base64 } });
      } else {
        apiContent.push({ type: "document", source: { type: "base64", media_type: fileSnap.mimeType || "application/pdf", data: fileSnap.base64 } });
      }
      if (text) apiContent.push({ type: "text", text });
    } else {
      apiContent = text;
    }

    const userMsg = { role: "user", content: apiContent, agent_id: agentId, created_at: new Date().toISOString(), attachmentPreview: fileSnap?.previewUrl, attachmentName: fileSnap?.name };
    setChatMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), userMsg] }));

    // Save user message to Supabase (text only — no base64)
    const storedText = text || (fileSnap ? `[Attached: ${fileSnap.name}]` : "");
    try { await db.post("chat_messages", { agent_id: agentId, role: "user", content: storedText }); } catch (_) {}

    // Detect skill instruction keywords
    if (detectSkillKeywords(text)) setPendingSkill({ agentId, text });

    // Build history (last 30 messages for context)
    const history = [...(chatMessages[agentId] || []), userMsg].slice(-30).map(m => ({ role: m.role, content: m.content }));

    // Build system prompt with agent skills included
    const agentSkills = allSkills.filter(s => s.agent_id === agentId || s.agent_id === "whole_team");
    const sysFn = SYSTEM_PROMPTS[agentId] || SYSTEM_PROMPTS.manager;
    const systemPrompt = sysFn(agentSkills, brandVoice);

    try {
      const reply = await claudeChat(systemPrompt, history);

      const assistantMsg = { role: "assistant", content: reply, agent_id: agentId, created_at: new Date().toISOString() };
      setChatMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), assistantMsg] }));

      // Save assistant message
      try { await db.post("chat_messages", { agent_id: agentId, role: "assistant", content: reply }); } catch (_) {}

      // Image generation — Manager delegates to Post Designer, or Post Designer generates directly
      const wantsImage = /generate.*image|create.*image|make.*image|show.*image|design.*post|visuali|generate.*visual|create.*visual/i.test(text);
      if (wantsImage && geminiKey) {
        if (agentId === "manager") {
          // Manager delegates to Post Designer
          const delegateMsg = { role: "assistant", content: "Got it — briefing the Post Designer now...", agent_id: agentId, created_at: new Date().toISOString() };
          setChatMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), delegateMsg] }));
          try {
            // Step 1: Prompt Writer crafts the Gemini prompt
            const imgPrompt = await claude(
              "You write precise Gemini Imagen 3 prompts for THUGFIT UAE gym activewear. Cinematic, high contrast, photorealistic, premium editorial. 1:1 square. No text overlays, no logos.",
              `Create a Gemini Imagen 3 image prompt for this request: ${text}
Return ONLY the prompt text.`
            );
            // Step 2: Post Designer generates the image
            const imgUrl = await geminiImage(geminiKey, imgPrompt);
            const imgMsg = { role: "assistant", content: `✅ Post Designer delivered:

_Prompt used: "${imgPrompt.slice(0, 120)}..."_`, agent_id: agentId, created_at: new Date().toISOString(), generatedImage: imgUrl };
            setChatMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), imgMsg] }));
            try { await db.post("chat_messages", { agent_id: agentId, role: "assistant", content: `[Image generated by Post Designer]` }); } catch (_) {}
          } catch (e) {
            const errMsg = { role: "assistant", content: "Post Designer ran into an issue: " + e.message, agent_id: agentId, created_at: new Date().toISOString() };
            setChatMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), errMsg] }));
          }
        } else if (agentId === "designer") {
          // Post Designer generates directly
          try {
            const imgUrl = await geminiImage(geminiKey, reply.slice(0, 800));
            const imgMsg = { role: "assistant", content: "Here's the generated image:", agent_id: agentId, created_at: new Date().toISOString(), generatedImage: imgUrl };
            setChatMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), imgMsg] }));
          } catch (e) { log("Post Designer", "Image gen failed", e.message); }
        }
      }

      // Detect plan in response (JSON array with week+day structure)
      if (agentId === "manager" || agentId === "content" || agentId === "whole_team") {
        try {
          const parsed = parseJSON(reply);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.week && parsed[0]?.day) {
            setPendingPlan(parsed);
          }
        } catch (_) {}
      }

      // Increment used_count for skills that were applied in this generation
      if (agentSkills.length > 0) {
        const now = new Date().toISOString();
        setAllSkills(prev => prev.map(s =>
          agentSkills.find(as => as.id === s.id)
            ? { ...s, used_count: (s.used_count || 0) + 1, last_used: now }
            : s
        ));
        for (const s of agentSkills) {
          try { await db.patch("agent_skills", { used_count: (s.used_count || 0) + 1, last_used: now }, `id=eq.${s.id}`); } catch (_) {}
        }
      }
    } catch (e) {
      notify("Failed to get response: " + e.message, "err");
    } finally {
      setIsSending(false);
    }
  }

  // ── Push chat plan → Monthly Planner ─────────────────────────────────────
  async function pushPlanToPlanner(planData) {
    try {
      let saved;
      try { saved = await db.post("monthly_plans", { month, year, status: "draft", plan_data: planData }); } catch (_) {}
      setPlan({ id: saved?.id, month, year, data: planData });
      setPendingPlan(null);
      await addChangeLog("manager", `Monthly plan (${planData.length} posts) pushed from chat to Planner — ${MONTHS[month - 1]} ${year}`, "plan");
      notify("Plan pushed to Monthly Planner ✓");
      setPage("planner");
    } catch (e) { notify("Error pushing plan: " + e.message, "err"); }
  }

  // ── Generate Monthly Plan (uses all relevant skills) ──────────────────────
  async function genPlan() {
    if (isWorking) return;
    setIsWorking(true);
    try {
      setActiveAgent("manager");
      log("Social Media Manager", "Starting monthly plan", `${MONTHS[month - 1]} ${year}`);
      await delay(500);
      setActiveAgent("content");
      log("Content Strategist", "Building content mix", "30% motivation · 25% tips · 20% lifestyle · 15% community · 10% product");

      const relevantSkills = allSkills.filter(s => ["manager","content","copywriter","whole_team"].includes(s.agent_id));
      const skillsCtx = relevantSkills.length > 0
        ? `\n\nSTANDING TEAM INSTRUCTIONS (must follow in this plan):\n${relevantSkills.map(s => `• ${s.skill}`).join("\n")}`
        : "";

      const text = await claude(
        `You are the Social Media Manager for THUGFIT, UAE premium gym activewear. Brand voice: ${brandVoice}${skillsCtx}`,
        `Create a 4-week Instagram content plan for ${MONTHS[month - 1]} ${year}.

Content pillars: motivation (30%), training_tips (25%), lifestyle (20%), community (15%), product (10% — max 1 per week).

Rules:
- Exactly 5 posts per week Mon–Fri, 20 total
- Mix of formats: single, carousel, reel_script
- Topics must be specific and compelling
- UAE/Dubai fitness culture context where relevant

Return ONLY a valid JSON array of exactly 20 objects, no markdown:
[{"week":1,"day":"Monday","content_type":"motivation","topic":"specific title","theme":"visual direction","format":"single"}]

format values: single | carousel | reel_script
content_type values: motivation | training_tips | lifestyle | community | product`,
        2200
      );

      setActiveAgent("manager");
      log("Social Media Manager", "Reviewing plan quality", "Cross-checking brand alignment...");
      await delay(400);

      const data = parseJSON(text);
      if (!Array.isArray(data)) throw new Error("Plan format invalid — try again");

      let saved;
      try { saved = await db.post("monthly_plans", { month, year, status: "draft", plan_data: data }); }
      catch (e) { log("System", "DB note", "Run SQL in Settings to enable saving"); }

      setPlan({ id: saved?.id, month, year, data });
      await addChangeLog("manager", `Monthly plan generated — ${data.length} posts for ${MONTHS[month - 1]} ${year}`, "plan");
      log("Social Media Manager", "Plan approved ✓", `${data.length} posts planned for ${MONTHS[month - 1]}`);
      notify(`Monthly plan ready — ${data.length} posts across 4 weeks`);
      setPage("planner");
    } catch (e) {
      notify(e.message, "err");
      log("System", "Error", e.message);
    } finally { setIsWorking(false); setActiveAgent(null); }
  }

  // ── Generate Post Content ─────────────────────────────────────────────────
  async function genContent(post) {
    if (!geminiKey) { notify("Add your Gemini API key in Settings first", "err"); return; }
    if (isWorking) return;
    setIsWorking(true);
    try {
      const extraSkills = allSkills.filter(s => ["promptWriter","designer","copywriter","whole_team"].includes(s.agent_id));
      const skillsCtx = extraSkills.length > 0 ? `\n\nTeam instructions:\n${extraSkills.map(s => `• ${s.skill}`).join("\n")}` : "";

      setActiveAgent("content");
      log("Content Strategist", "Writing post brief", post.topic);
      const brief = await claude(
        `Content Strategist for THUGFIT, UAE gym activewear. Brand voice: ${brandVoice}${skillsCtx}`,
        `Write a 2-sentence content brief for: Topic: ${post.topic}, Type: ${post.content_type}, Theme: ${post.theme}, Format: ${post.format}. Include: emotion to trigger, what visuals to show, action to inspire.`
      );

      setActiveAgent("promptWriter");
      log("Prompt Writer", "Crafting image prompt", "Optimising for Gemini Imagen 3...");
      const imgPrompt = await claude(
        `You write precise image prompts for Gemini Imagen 3. UAE fitness lifestyle — modern Dubai gym, desert sunrise workout, city skyline backdrop. Cinematic, high contrast, photorealistic, premium editorial. 1:1 square. No text overlays, no logos.${skillsCtx}`,
        `Create an Imagen 3 prompt for: ${brief}\nReturn ONLY the prompt text.`
      );

      setActiveAgent("designer");
      log("Post Designer", "Generating image", "Calling Gemini Imagen 3...");
      let imageUrl = null;
      try { imageUrl = await geminiImage(geminiKey, imgPrompt); log("Post Designer", "Image generated ✓", ""); }
      catch (e) { log("Post Designer", "Image failed", e.message); notify("Image failed — post saved without image", "warn"); }

      setActiveAgent("copywriter");
      log("Copywriter", "Writing caption & hashtags", "UAE-targeted Instagram copy...");
      const copyText = await claude(
        `Copywriter for THUGFIT. Brand voice: ${brandVoice}${skillsCtx}`,
        `Instagram caption and 25 hashtags for: Topic: ${post.topic}, Type: ${post.content_type}, Brief: ${brief}
Return JSON only: {"caption":"full caption with emojis and CTA","hashtags":"#tag1 #tag2 ... 25 tags"}`
      );

      let copy;
      try { copy = parseJSON(copyText); }
      catch { copy = { caption: copyText, hashtags: "#thugfit #uaefitness #dubai #gym #activewear #fitness #gymwear #dubaifit #uaegym #thugfitness #fitnesslifestyle #gymmotivation #fitnessmotivation #workoutmotivation #dubailifestyle #fitnessgear #gymlife #fitlife #fitnesscommunity #uaefitnesscommunity #premiumactivewear #gymselfie #fitnessfashion #uaesport #thugfitae" }; }

      setActiveAgent("manager");
      log("Social Media Manager", "Quality review ✓", "Post approved — ready for your review");
      await delay(300);

      const postData = {
        plan_id: plan?.id || null, week_number: post.week, day_of_week: post.day,
        platform: "instagram", content_type: post.content_type, topic: post.topic,
        caption: copy.caption, hashtags: copy.hashtags,
        image_prompt: imgPrompt, image_url: imageUrl, status: "pending_approval"
      };
      try { const saved = await db.post("posts", postData); postData.id = saved?.id; } catch (_) {}

      setPending(p => [...p, postData]);
      await addChangeLog("manager", `Post generated: "${post.topic}"`, "content");
      notify("Post ready for your approval!");
      setPage("approval");
    } catch (e) {
      notify(e.message, "err");
      log("System", "Error", e.message);
    } finally { setIsWorking(false); setActiveAgent(null); }
  }

  async function approvePost(post) {
    if (post.id) await db.patch("posts", { status: "approved" }, `id=eq.${post.id}`).catch(() => {});
    setPending(p => p.filter(x => x !== post));
    setPosts(p => [...p, { ...post, status: "approved" }]);
    setSelectedPost(null);
    await addChangeLog("manager", `Post approved: "${post.topic}"`, "approval");
    log("Social Media Manager", "Post approved ✓", post.topic);
    notify("Post approved!");
  }

  function rejectPost(post) {
    if (post.id) db.patch("posts", { status: "rejected" }, `id=eq.${post.id}`).catch(() => {});
    setPending(p => p.filter(x => x !== post));
    setSelectedPost(null);
    notify("Post rejected — regenerate from the Planner");
  }

  async function addTask() {
    if (!newTask.title.trim()) return;
    const taskData = { ...newTask, status: "pending", created_at: new Date().toISOString() };
    try {
      const saved = await db.post("staff_tasks", taskData);
      setTasks(prev => [saved, ...prev]);
    } catch (_) {
      setTasks(prev => [{ ...taskData, id: Date.now() }, ...prev]);
    }
    setNewTask({ title: "", assignee: "manager", priority: "medium" });
  }

  async function completeTask(id) {
    try { await db.patch("staff_tasks", { status: "done" }, `id=eq.${id}`); } catch (_) {}
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: "done" } : t));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Page: Dashboard ────────────────────────────────────────────────────────
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
            <button onClick={() => setPage("autoseo")} style={{ ...btn("#16a34a") }}>🔍 Auto SEO</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Page: Algorithm Engine ─────────────────────────────────────────────────
  function Algorithm() {
    const [algoStep, setAlgoStep]     = useState(0);   // 0=idle 1=competitors 2=algorithm 3=scheduling 4=done
    const [algoGuide, setAlgoGuide]   = useState(() => { try { return JSON.parse(localStorage.getItem("zld_algo_guide") || "null"); } catch { return null; } });
    const approvedPosts = posts.filter(p => p.status === "approved");

    async function runEngine() {
      if (isWorking) return;
      setIsWorking(true);
      try {
        // Step 1 — Scan competitors
        setAlgoStep(1);
        log("Algorithm Engine", "Scanning competitors", "Gymshark, Lululemon, Nike, Adidas UAE, GymNation...");
        const competitorData = await claude(
          "You are an Instagram strategy analyst specialising in UAE fitness brands.",
          `Analyse the Instagram strategies of these UAE/global fitness brands: Gymshark, Lululemon, Nike, Adidas UAE, GymNation.
Return JSON only:
{"competitors":[{"brand":"name","best_times":["7PM","8PM"],"top_formats":["Reels","Carousel"],"post_frequency":"5x/week","hashtag_count":25,"caption_style":"short hook + CTA"}],"gap_opportunities":["list of 3 gaps THUGFIT can exploit"]}`
        );

        // Step 2 — Read Instagram algorithm
        setAlgoStep(2);
        log("Algorithm Engine", "Reading Instagram algorithm", "2026 UAE algorithm — best times, formats, frequency...");
        const algoData = await claude(
          "You are an Instagram algorithm expert for UAE audience.",
          `Based on the 2026 Instagram algorithm and UAE audience behaviour for fitness/activewear brands, provide:
Return JSON only:
{"best_post_times":["6:00 PM","7:00 PM","8:00 PM"],"best_days":["Tuesday","Thursday","Saturday"],"format_priority":["Reels","Carousel","Single"],"optimal_weekly_frequency":5,"hashtag_strategy":{"total":25,"niche":10,"medium":10,"broad":5},"caption_length":"short","hook_style":"question or bold statement","uae_peak_window":"6PM-9PM GST","monthly_refresh":true}`
        );

        let competitors, algo;
        try { competitors = parseJSON(competitorData); } catch { competitors = { competitors: [], gap_opportunities: [] }; }
        try { algo = parseJSON(algoData); } catch { algo = { best_post_times: ["6:00 PM","7:30 PM","8:00 PM"], best_days: ["Tuesday","Thursday","Saturday"], format_priority: ["Reels","Carousel","Single"], optimal_weekly_frequency: 5 }; }

        const guide = { competitors, algo, generated_at: new Date().toISOString() };
        setAlgoGuide(guide);
        localStorage.setItem("zld_algo_guide", JSON.stringify(guide));

        // Step 3 — Auto-schedule all approved posts
        setAlgoStep(3);
        log("Algorithm Engine", "Auto-scheduling approved posts", `Applying optimal UAE times to ${approvedPosts.length} posts...`);

        const peakTimes = algo.best_post_times || ["6:00 PM","7:30 PM","8:00 PM"];
        const peakDays  = algo.best_days || ["Tuesday","Thursday","Saturday"];
        const now = new Date();

        let scheduledCount = 0;
        for (let i = 0; i < approvedPosts.length; i++) {
          const post = approvedPosts[i];
          // Assign next available peak slot
          const daysAhead = i + 1;
          const scheduled = new Date(now);
          scheduled.setDate(now.getDate() + daysAhead);
          const timeStr = peakTimes[i % peakTimes.length];
          const [h, m] = timeStr.replace(" PM","").replace(" AM","").split(":").map(Number);
          scheduled.setHours(timeStr.includes("PM") && h !== 12 ? h + 12 : h, m || 0, 0, 0);

          if (post.id) {
            try { await db.patch("posts", { status: "scheduled", scheduled_at: scheduled.toISOString() }, `id=eq.${post.id}`); } catch (_) {}
          }
          setPosts(prev => prev.map(p => p === post || p.id === post.id ? { ...p, status: "scheduled", scheduled_at: scheduled.toISOString() } : p));
          scheduledCount++;
        }

        setAlgoStep(4);
        await addChangeLog("manager", `Algorithm Engine ran — ${scheduledCount} posts scheduled at UAE peak times`, "general");
        log("Algorithm Engine", "Done ✓", `${scheduledCount} posts scheduled at optimal UAE times`);
        notify(`Algorithm Engine complete — ${scheduledCount} posts scheduled at peak UAE times`);
      } catch (e) {
        notify(e.message, "err");
        log("Algorithm Engine", "Error", e.message);
        setAlgoStep(0);
      } finally { setIsWorking(false); }
    }

    const STEPS = [
      { n: 1, icon: "🔍", title: "Step 1: Scan Competitors", sub: "Analysing Gymshark, Lululemon, Nike, Adidas UAE, GymNation + 1 more" },
      { n: 2, icon: "📊", title: "Step 2: Read Instagram Algorithm", sub: "Current 2026 UAE algorithm — best times, formats, frequency" },
      { n: 3, icon: "📅", title: "Step 3: Auto-Schedule All Posts", sub: "Applying optimal times to your content queue automatically" },
    ];
    const ANALYSES = [
      { icon: "🕐", title: "Best posting times",  sub: "UAE audience peak hours" },
      { icon: "📱", title: "Best content formats", sub: "Reels vs carousels vs posts" },
      { icon: "📅", title: "Weekly frequency",     sub: "How many posts per week" },
      { icon: "#",  title: "Hashtag strategy",     sub: "Size, mix, placement" },
      { icon: "✍️", title: "Caption style",        sub: "Hook, CTA, length" },
      { icon: "🏆", title: "Competitor timing",    sub: "Gap analysis vs rivals" },
    ];

    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Algorithm Engine</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>One click — scans UAE competitors, reads the Instagram algorithm, auto-schedules all your posts at peak times.</div>

        {/* 3 Steps */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {STEPS.map(s => {
            const active = algoStep === s.n;
            const done   = algoStep > s.n || algoStep === 4;
            return (
              <div key={s.n} style={{ ...card, border: `1px solid ${active ? C.purple : done ? C.teal : C.border}`, background: active ? `${C.purple}08` : done ? `${C.teal}08` : C.card, transition: "all 0.4s" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{done ? "✅" : active ? "⏳" : s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: active ? C.purple : done ? C.teal : C.text }}>{s.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{s.sub}</div>
              </div>
            );
          })}
        </div>

        {/* What it analyses */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>What the engine analyses automatically</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {ANALYSES.map(a => (
              <div key={a.title} style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{a.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Output status */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Output — auto-applied to your content queue</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ padding: "14px 16px", background: `${C.teal}10`, border: `1px solid ${C.teal}30`, borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 4 }}>
                {algoStep === 4 || posts.some(p => p.status === "scheduled") ? "✅ All approved posts scheduled" : "⬜ Posts not yet scheduled"}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {posts.filter(p => p.status === "scheduled").length > 0 ? `${posts.filter(p => p.status === "scheduled").length} posts at optimal times` : "At optimal times automatically"}
              </div>
            </div>
            <div style={{ padding: "14px 16px", background: `${C.teal}10`, border: `1px solid ${C.teal}30`, borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 4 }}>
                {algoGuide ? "✅ Algorithm guide saved" : "⬜ Algorithm guide not yet generated"}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {algoGuide ? `Last run: ${new Date(algoGuide.generated_at).toLocaleDateString()}` : "Refreshes monthly automatically"}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, padding: "12px 14px", background: C.surf, borderRadius: 8 }}>
            One click → AI reads the latest Instagram algorithm → finds competitor posting patterns → calculates your best UAE times → schedules everything. Re-run monthly to stay current.
          </div>

          {/* Last run results */}
          {algoGuide?.algo && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "Best days",    value: (algoGuide.algo.best_days || []).slice(0,2).join(" & "), color: C.purple },
                { label: "Peak window",  value: algoGuide.algo.uae_peak_window || "6PM–9PM GST", color: C.teal },
                { label: "Top format",   value: (algoGuide.algo.format_priority || ["Reels"])[0], color: C.amber },
              ].map(r => (
                <div key={r.label} style={{ padding: "10px 12px", background: `${r.color}10`, border: `1px solid ${r.color}25`, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{r.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: r.color }}>{r.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run button */}
        <div>
          <button onClick={runEngine} disabled={isWorking} style={{ ...btn(C.purple), fontSize: 15, padding: "13px 32px", opacity: isWorking ? 0.7 : 1 }}>
            ⚡ {isWorking && algoStep > 0 ? `Running... Step ${algoStep} of 3` : "Run Algorithm Engine"}
          </button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
            Takes about 30–60 seconds · Run once a month · {approvedPosts.length} approved post{approvedPosts.length !== 1 ? "s" : ""} will be scheduled
          </div>
        </div>
      </div>
    );
  }

  // ── Page: Planner ──────────────────────────────────────────────────────────
  function Planner() {
    const weekPosts = plan?.data?.filter(p => p.week === plannerWeek) || [];
    if (!plan) return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>Monthly Planner</div><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>No plan yet</div></div>
          <button onClick={genPlan} disabled={isWorking} style={btn(C.purple)}>{isWorking ? "⏳ Generating..." : "+ Generate Plan"}</button>
        </div>
        <div style={{ ...card, textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>◫</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No monthly plan yet</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>Generate a plan here, or discuss it with the Manager in Team Chat<br />and push it directly — your chat context will be used.</div>
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
          {[1,2,3,4].map(w => (
            <button key={w} onClick={() => setPlannerWeek(w)} style={{ padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: plannerWeek === w ? C.purple : C.card, color: plannerWeek === w ? "#fff" : C.muted }}>Week {w}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {DAYS.map(day => {
            const p = weekPosts.find(x => x.day === day);
            return (
              <div key={day}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{day.slice(0,3)}</div>
                {p ? (
                  <div style={{ ...card, padding: 12 }}>
                    <span style={badge(TYPE_COLORS[p.content_type] || C.purple)}>{p.content_type?.replace("_"," ")}</span>
                    <div style={{ fontSize: 12, fontWeight: 600, margin: "8px 0 6px", lineHeight: 1.45 }}>{p.topic}</div>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45, marginBottom: 8 }}>{(p.theme||"").slice(0,75)}{(p.theme||"").length > 75 ? "..." : ""}</div>
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

  // ── Page: Approval ─────────────────────────────────────────────────────────
  function Approval() {
    const post = selectedPost || pending[0];
    if (!post) return (
      <div style={{ ...card, textAlign: "center", padding: "64px 20px" }}>
        <div style={{ fontSize: 36, marginBottom: 14, color: C.teal }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All caught up!</div>
        <div style={{ fontSize: 13, color: C.muted }}>No posts pending. Go to the Planner and click ⚡ Generate on any post.</div>
      </div>
    );
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>Approval Queue</div><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{pending.length} post{pending.length !== 1 ? "s" : ""} waiting</div></div>
          <div style={{ display: "flex", gap: 6 }}>
            {pending.map((p, i) => (
              <button key={i} onClick={() => setSelectedPost(p)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${p === post ? C.purple : C.border}`, background: p === post ? `${C.purple}20` : C.card, color: p === post ? C.purple : C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{i + 1}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Instagram Preview</div>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
              <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#8B7CF8,#F472B6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 800 }}>T</div>
                <div><div style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>thugfit.ae</div><div style={{ fontSize: 10, color: "#888" }}>{MONTHS[month-1]} · Week {post.week_number}</div></div>
                <div style={{ marginLeft: "auto", color: "#888", fontSize: 18 }}>···</div>
              </div>
              <div style={{ width: "100%", aspectRatio: "1", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {post.image_url ? <img src={post.image_url} alt="Post" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center", color: "#aaa", fontSize: 13 }}><div style={{ fontSize: 28, marginBottom: 8 }}>🎨</div>No image</div>}
              </div>
              <div style={{ padding: "10px 12px 16px" }}>
                <div style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: 22 }}>♡ 🗨 ✈</div>
                <div style={{ fontSize: 12, color: "#000", lineHeight: 1.55 }}><span style={{ fontWeight: 700 }}>thugfit.ae </span>{(post.caption||"").slice(0,200)}</div>
                <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 6, lineHeight: 1.7 }}>{(post.hashtags||"").slice(0,120)}...</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={card}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Topic</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{post.topic}</div>
              <div style={{ marginTop: 8 }}>
                <span style={badge(TYPE_COLORS[post.content_type] || C.purple)}>{post.content_type?.replace("_"," ")}</span>
                <span style={badge(C.muted)}>Week {post.week_number}</span>
                <span style={badge(C.muted)}>{post.day_of_week}</span>
              </div>
            </div>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Caption</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, maxHeight: 160, overflowY: "auto" }}>{post.caption || "No caption generated"}</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Hashtags</div>
              <div style={{ fontSize: 12, color: C.purple, lineHeight: 1.8 }}>{post.hashtags || "—"}</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => approvePost(post)} style={{ ...btn(C.teal), flex: 1 }}>✓ Approve Post</button>
              <button onClick={() => rejectPost(post)} style={btn(C.danger, true)}>✗ Reject</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Page: Queue ────────────────────────────────────────────────────────────
  function Queue() {
    const statusColor = { pending_approval: C.amber, approved: C.teal, scheduled: C.purple, published: C.blue, rejected: C.danger };
    const all = [...pending.map(p => ({ ...p, _s: "pending_approval" })), ...posts.map(p => ({ ...p, _s: p.status }))];
    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Content Queue</div>
        {all.length === 0
          ? <div style={{ ...card, textAlign: "center", padding: "64px 20px", color: C.muted }}>No content yet. Open the Planner and click ⚡ Generate on any post.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {all.map((post, i) => (
              <div key={i} onClick={() => { if (post._s === "pending_approval") { setSelectedPost(post); setPage("approval"); } }}
                style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, cursor: post._s === "pending_approval" ? "pointer" : "default" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: C.border, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {post.image_url ? <img src={post.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🖼"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.topic}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Week {post.week_number} · {post.day_of_week} · {post.content_type?.replace("_"," ")}</div>
                </div>
                <span style={badge(statusColor[post._s] || C.muted)}>{post._s?.replace(/_/g," ")}</span>
              </div>
            ))}
          </div>}
      </div>
    );
  }

  // ── Page: Calendar ─────────────────────────────────────────────────────────
  function Calendar() {
    const dowLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const dim = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    const today = new Date().getDate();
    const currMonth = new Date().getMonth() + 1;
    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Calendar</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{MONTHS[month-1]} {year} — posts appear here once scheduled</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
          {dowLabels.map(d => <div key={d} style={{ background: C.card, padding: "9px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{d}</div>)}
          {Array(offset).fill(0).map((_, i) => <div key={`e${i}`} style={{ background: "#080B12", minHeight: 72 }} />)}
          {Array(dim).fill(0).map((_, i) => {
            const d = i + 1; const isToday = d === today && month === currMonth;
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

  // ── Page: Auto SEO ─────────────────────────────────────────────────────────
  function AutoSEO() {
    const [seoType, setSeoType]       = useState("bio");
    const [seoOutput, setSeoOutput]   = useState("");
    const [seoLoading, setSeoLoading] = useState(false);
    const PROMPTS = {
      bio:       `Write 3 different Instagram bio options for THUGFIT, UAE premium gym activewear. Each under 150 chars, keywords: Dubai gym activewear UAE fitness, CTA, 2-3 strategic emojis. Numbered list.`,
      hashtags:  `Create 5 Instagram hashtag sets (25 tags each) for THUGFIT UAE gym activewear: 1) Broad fitness, 2) UAE/Dubai specific, 3) Activewear/fashion, 4) Motivation/lifestyle, 5) Niche gym community. Label each set clearly.`,
      captions:  `Write 5 Instagram caption templates for THUGFIT UAE gym activewear. Hook + value/story + CTA. Mix: motivation, product benefit, community, lifestyle. Use [PLACEHOLDER] for customisable parts.`,
      keywords:  `List the top 30 SEO keywords THUGFIT should target for UAE gym activewear. Group by: brand, product, location, intent. Include search volume estimates.`,
    };
    async function generate() {
      setSeoLoading(true); setSeoOutput("");
      const seoSkills = allSkills.filter(s => ["copywriter","manager","whole_team"].includes(s.agent_id));
      const seoSkillsCtx = seoSkills.length > 0 ? `\n\nStanding instructions from your team:\n${seoSkills.map(s => `• ${s.skill}`).join("\n")}` : "";
      try { setSeoOutput(await claude(`SEO and social media expert for THUGFIT, UAE premium gym activewear. Brand voice: ${brandVoice}${seoSkillsCtx}`, PROMPTS[seoType])); }
      catch (e) { setSeoOutput("Error: " + e.message); }
      finally { setSeoLoading(false); }
    }
    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Auto SEO</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>AI-powered SEO content for THUGFIT Instagram</div>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Generate</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[["bio","Instagram Bio"],["hashtags","Hashtag Sets"],["captions","Caption Templates"],["keywords","Keywords"]].map(([id, label]) => (
              <button key={id} onClick={() => setSeoType(id)} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${seoType === id ? C.teal : C.border}`, background: seoType === id ? C.teal : "transparent", color: seoType === id ? "#fff" : C.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{label}</button>
            ))}
          </div>
          <button onClick={generate} disabled={seoLoading} style={btn(C.teal)}>{seoLoading ? "⏳ Generating..." : "🔍 Generate"}</button>
        </div>
        {seoOutput && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Result</div>
              <button onClick={() => { navigator.clipboard.writeText(seoOutput); notify("Copied!"); }} style={btnSm(C.teal)}>Copy</button>
            </div>
            <pre style={{ fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{seoOutput}</pre>
          </div>
        )}
      </div>
    );
  }

  // ── Page: Staff Tasks ──────────────────────────────────────────────────────
  function StaffTasks() {
    const priorityColor = { high: C.danger, medium: C.amber, low: C.teal };
    const pendingTasks = tasks.filter(t => t.status !== "done");
    const doneTasks    = tasks.filter(t => t.status === "done");
    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Staff Tasks</div>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add Task</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Task description..." style={{ ...inp, flex: 1, minWidth: 200 }} />
            <select value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))} style={{ ...inp }}>
              {AGENTS.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
            </select>
            <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={{ ...inp }}>
              <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
            </select>
            <button onClick={addTask} style={btn(C.purple)}>+ Add</button>
          </div>
        </div>
        {tasks.length === 0 && <div style={{ ...card, textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 13 }}>No tasks yet. Add one above.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingTasks.map(t => {
            const agent = AGENTS.find(a => a.id === t.assignee);
            return (
              <div key={t.id} style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => completeTask(t.id)} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${C.border}`, background: "transparent", cursor: "pointer", flexShrink: 0 }} title="Mark complete" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{agent?.emoji} {agent?.name}</div>
                </div>
                <span style={badge(priorityColor[t.priority] || C.muted)}>{t.priority}</span>
              </div>
            );
          })}
          {doneTasks.length > 0 && <>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, marginBottom: 4, paddingLeft: 2 }}>COMPLETED</div>
            {doneTasks.slice(0, 5).map(t => (
              <div key={t.id} style={{ ...card, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, opacity: 0.45 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>✓</div>
                <div style={{ fontSize: 13, textDecoration: "line-through", color: C.muted }}>{t.title}</div>
              </div>
            ))}
          </>}
        </div>
      </div>
    );
  }

  // ── Page: Settings ─────────────────────────────────────────────────────────
  function Settings() {
    const SQL = `-- Run this ONCE in Supabase → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS monthly_plans (
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

-- NEW: chat history (persistent across sessions)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- NEW: team skills (accumulated instructions per agent)
CREATE TABLE IF NOT EXISTS agent_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  skill text NOT NULL,
  used_count integer DEFAULT 0,
  last_used timestamptz,
  created_at timestamptz DEFAULT now()
);

-- NEW: change log
CREATE TABLE IF NOT EXISTS change_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text,
  description text NOT NULL,
  change_type text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- NEW: staff tasks
CREATE TABLE IF NOT EXISTS staff_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  assignee text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE monthly_plans  DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts           DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages   DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills    DISABLE ROW LEVEL SECURITY;
ALTER TABLE change_log      DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks     DISABLE ROW LEVEL SECURITY;`;

    return (
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Settings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>API Connections</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Gemini API Key <span style={{ color: C.amber }}>(required for image generation)</span></div>
              <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIza..." style={{ ...inp, width: "100%" }} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Get free key → aistudio.google.com → Get API key → Create API key</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["✓ Claude API connected — all AI generation active", C.teal], [`✓ Supabase connected — ioniqxioapcdgenpksex.supabase.co`, C.teal], [geminiKey ? "✓ Gemini API key entered — images enabled" : "⚠ Gemini API key missing — images disabled", geminiKey ? C.teal : C.amber]].map(([msg, color]) => (
                <div key={msg} style={{ padding: "10px 14px", background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 8, fontSize: 12, color }}>{msg}</div>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Brand Voice</div>
            <textarea value={brandVoice} onChange={e => setBrandVoice(e.target.value)} rows={4} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>All 5 AI agents and team chat use this to keep every piece of content on-brand</div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Database Setup</div>
              <button onClick={() => { navigator.clipboard.writeText(SQL); notify("SQL copied!"); }} style={btnSm(C.teal)}>Copy SQL</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Run this SQL once in Supabase → SQL Editor → New query → paste → Run. This creates all tables including the new ones for chat persistence, skills, and change log.</div>
            <pre style={{ background: "#080C14", borderRadius: 8, padding: 14, fontFamily: "monospace", fontSize: 11, color: C.teal, lineHeight: 1.9, overflowX: "auto", whiteSpace: "pre-wrap", margin: 0 }}>{SQL}</pre>
          </div>
        </div>
      </div>
    );
  }

  // ── Page: Team Chat ────────────────────────────────────────────────────────
  function TeamChat() {
    const msgs         = chatMessages[chatAgentId] || [];
    const currentAgent = CHAT_AGENTS.find(a => a.id === chatAgentId);
    const agentInfo    = AGENTS.find(a => a.id === chatAgentId);

    // ── Sidebar ────────────────────────────────────────────────────────────
    function Sidebar() {
      return (
        <div style={{ width: 220, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Team Chats</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Manager in every chat</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {CHAT_AGENTS.map(a => (
              <div key={a.id} onClick={() => switchAgent(a.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
                background: chatAgentId === a.id && chatView === "chat" ? `${a.color || C.purple}18` : "transparent",
                border: `1px solid ${chatAgentId === a.id && chatView === "chat" ? `${a.color || C.purple}25` : "transparent"}`,
                transition: "all 0.15s"
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${a.color || C.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{a.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.border, flexShrink: 0 }} />
                    Manager present
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
            <button onClick={() => setChatView("skills")} style={{
              width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${chatView === "skills" ? C.purple : C.border}`,
              background: chatView === "skills" ? `${C.purple}15` : "transparent", color: chatView === "skills" ? C.purple : C.muted,
              cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8
            }}>
              <span>📌</span> Team Skills
            </button>
            <button onClick={() => setChatView("changelog")} style={{
              width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${chatView === "changelog" ? C.purple : C.border}`,
              background: chatView === "changelog" ? `${C.purple}15` : "transparent", color: chatView === "changelog" ? C.purple : C.muted,
              cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8
            }}>
              <span>📋</span> Change Log ({changeLog.length})
            </button>
          </div>
        </div>
      );
    }

    // ── Skills view ────────────────────────────────────────────────────────
    if (chatView === "skills") return (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Team Skills & Instructions</div>
            <button onClick={() => setChatView("chat")} style={btnSm(C.purple)}>← Back to Chat</button>
          </div>
          {AGENTS.map(a => {
            const skills   = allSkills.filter(s => s.agent_id === a.id);
            const totalUses = skills.reduce((sum, s) => sum + (s.used_count || 0), 0);
            const lastUsed  = skills.filter(s => s.last_used).sort((x, y) => new Date(y.last_used) - new Date(x.last_used))[0];
            return (
              <div key={a.id} style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: skills.length > 0 ? 14 : 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: `${a.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{a.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{a.fullDesc}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: skills.length > 0 ? C.teal : C.border }}>{skills.length}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{totalUses > 0 ? `${totalUses} uses` : "unused"}</div>
                  </div>
                </div>
                {skills.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {skills.map(s => (
                      <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#080C14", borderRadius: 8, padding: "9px 12px" }}>
                        <div style={{ flex: 1, fontSize: 12, lineHeight: 1.55, color: C.text }}>{s.skill}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {(s.used_count || 0) > 0 && <span style={{ fontSize: 10, color: C.teal, background: `${C.teal}15`, padding: "2px 7px", borderRadius: 4 }}>Used {s.used_count}×</span>}
                          {s.last_used && <span style={{ fontSize: 10, color: C.muted }}>{new Date(s.last_used).toLocaleDateString()}</span>}
                          <button onClick={() => deleteSkill(s.id)} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }} title="Remove skill">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No custom skills yet — default settings apply</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    // ── Changelog view ─────────────────────────────────────────────────────
    const typeColor = { skill: C.purple, plan: C.teal, content: C.blue, approval: C.amber, general: C.muted };
    if (chatView === "changelog") return (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Change Log</div>
            <button onClick={() => setChatView("chat")} style={btnSm(C.purple)}>← Back to Chat</button>
          </div>
          {changeLog.length === 0
            ? <div style={{ ...card, textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: 13 }}>No changes recorded yet. Changes appear automatically as you generate plans, approve posts, and add skills.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {changeLog.map((entry, i) => {
                const agent = AGENTS.find(a => a.id === entry.agent_id);
                const color = typeColor[entry.change_type] || C.muted;
                return (
                  <div key={entry.id || i} style={{ ...card, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{entry.description}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                        {agent && <span>{agent.emoji} {agent.name} · </span>}
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                    <span style={badge(color)}>{entry.change_type}</span>
                  </div>
                );
              })}
            </div>}
        </div>
      </div>
    );

    // ── Chat view ──────────────────────────────────────────────────────────
    return (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Agent header */}
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.surf, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${currentAgent?.color || C.purple}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{currentAgent?.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{agentInfo?.name || currentAgent?.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{agentInfo?.fullDesc || currentAgent?.desc} · Manages the entire team</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{allSkills.filter(s => s.agent_id === chatAgentId).length} skills active</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "48px 0", lineHeight: 1.9 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{currentAgent?.emoji}</div>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Chat with {agentInfo?.name || currentAgent?.name}</div>
                <div>Give instructions, plan content, refine strategy.<br />Everything is saved and remembered across sessions.</div>
              </div>
            )}
            {msgs.map((msg, i) => {
              const isUser = msg.role === "user";
              const textContent = typeof msg.content === "string" ? msg.content : (msg.content?.find?.(c => c.type === "text")?.text || "");
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 6 }}>
                  {msg.attachmentPreview && (
                    <img src={msg.attachmentPreview} alt="ref" style={{ maxWidth: 220, borderRadius: 10, border: `1px solid ${C.border}` }} />
                  )}
                  {msg.attachmentName && !msg.attachmentPreview && (
                    <div style={{ fontSize: 12, color: C.muted, padding: "6px 12px", background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>📄 {msg.attachmentName}</div>
                  )}
                  {msg.generatedImage && (
                    <img src={msg.generatedImage} alt="Generated" style={{ maxWidth: 300, borderRadius: 12, border: `1px solid ${C.border}` }} />
                  )}
                  {textContent ? (
                    <div style={{
                      maxWidth: "72%", padding: "11px 16px",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isUser ? C.purple : C.card,
                      border: isUser ? "none" : `1px solid ${C.border}`,
                      fontSize: 13, lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap"
                    }}>
                      {textContent}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* Pending skill detection prompt */}
            {pendingSkill?.agentId === chatAgentId && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 10 }}>
                <span style={{ fontSize: 14 }}>📌</span>
                <div style={{ flex: 1, fontSize: 12, color: C.amber }}>That looks like a standing instruction — save as a skill for {agentInfo?.name || currentAgent?.name}?</div>
                <button onClick={() => addSkill(chatAgentId, pendingSkill.text)} style={btnSm(C.amber)}>Save Skill</button>
                <button onClick={() => setPendingSkill(null)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            )}

            {/* Plan detected prompt */}
            {pendingPlan && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${C.teal}10`, border: `1px solid ${C.teal}30`, borderRadius: 10 }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <div style={{ flex: 1, fontSize: 12, color: C.teal }}>Content plan detected ({pendingPlan.length} posts) — push directly to Monthly Planner?</div>
                <button onClick={() => pushPlanToPlanner(pendingPlan)} style={btnSm(C.teal)}>Push to Planner</button>
                <button onClick={() => setPendingPlan(null)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            )}

            {isSending && (
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ padding: "11px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px 16px 16px 4px", fontSize: 18, letterSpacing: 4, color: C.muted }}>• • •</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, background: C.surf, flexShrink: 0 }}>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx" onChange={handleFileAttach} style={{ display: "none" }} />
            {attachedFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: `${C.purple}10`, border: `1px solid ${C.purple}30`, borderRadius: 8 }}>
                {attachedFile.previewUrl
                  ? <img src={attachedFile.previewUrl} style={{ height: 36, width: 36, objectFit: "cover", borderRadius: 4 }} />
                  : <span style={{ fontSize: 18 }}>📄</span>}
                <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => fileInputRef.current?.click()} title="Attach image, PDF or document" style={{ ...btnSm(C.muted), alignSelf: "flex-end", padding: "10px 13px", fontSize: 17, borderRadius: 8 }}>📎</button>
              <textarea
                ref={chatInputRef}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Tell the ${agentInfo?.name || currentAgent?.name} what you need...`}
                rows={2}
                style={{ ...inp, flex: 1, resize: "none", lineHeight: 1.5, padding: "10px 14px" }}
              />
              <button onClick={sendMessage} disabled={isSending} style={btn(C.purple, false, { alignSelf: "flex-end", padding: "10px 22px", opacity: isSending ? 0.5 : 1 })}>
                {isSending ? "..." : "Send"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Enter to send · Shift+Enter new line · 📎 attach image / PDF / doc</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Root Render ───────────────────────────────────────────────────────────
  const isChat = page === "teamchat";
  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, overflow: "hidden", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: 210, background: C.surf, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>ZenLine</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>Digital Platform</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          {NAV.map(item => (
            <div key={item.id} onClick={() => { setPage(item.id); if (item.id === "teamchat") loadChatHistory(chatAgentId); }} style={{
              display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              background: page === item.id ? `${C.purple}18` : "transparent",
              color: page === item.id ? C.purple : C.muted,
              fontSize: 13, fontWeight: page === item.id ? 600 : 400,
              border: `1px solid ${page === item.id ? `${C.purple}25` : "transparent"}`,
              transition: "all 0.15s"
            }}>
              <span style={{ width: 16, textAlign: "center" }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === "approval" && pending.length > 0 && (
                <span style={{ background: C.amber, color: "#000", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{pending.length}</span>
              )}
              {item.id === "teamchat" && changeLog.length > 0 && (
                <span style={{ background: `${C.purple}30`, color: C.purple, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{changeLog.length}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted }}>THUGFIT · ZenLine FZ-LLC</div>
          <div style={{ fontSize: 10, color: "#2D3F5A", marginTop: 2 }}>midhun@thugfit.ae</div>
          <button style={{ marginTop: 8, width: "100%", padding: "6px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Sign Out</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!isChat && (
          <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surf, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{NAV.find(n => n.id === page)?.label}</div>
            {isWorking && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.purple }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.purple, animation: "pulse 1s infinite" }} />
                AI team working...
              </div>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflow: isChat ? "hidden" : "auto", ...(isChat ? { display: "flex" } : { padding: 24 }) }}>
          {page === "dashboard"  && <Dashboard />}
          {page === "algorithm"  && <Algorithm />}
          {page === "planner"    && <Planner />}
          {page === "queue"      && <Queue />}
          {page === "approval"   && <Approval />}
          {page === "calendar"   && <Calendar />}
          {page === "autoseo"    && <AutoSEO />}
          {page === "settings"   && <Settings />}
          {page === "stafftasks" && <StaffTasks />}
          {page === "teamchat"   && <TeamChat />}
        </div>
      </div>

      {/* Toast */}
      {notice && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "12px 18px", zIndex: 999, maxWidth: 380, background: notice.type === "err" ? `${C.danger}18` : `${C.teal}18`, border: `1px solid ${notice.type === "err" ? C.danger : C.teal}`, borderRadius: 10, fontSize: 13, fontWeight: 500, color: notice.type === "err" ? C.danger : C.teal, backdropFilter: "blur(12px)" }}>
          {notice.msg}
        </div>
      )}
    </div>
  );
}
