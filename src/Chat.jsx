import { useState, useEffect, useRef } from "react";

const C = { bg:"#07091A", surf:"#0D1117", card:"#131929", border:"#1C2537", purple:"#8B7CF8", teal:"#00C9A7", amber:"#FBBF24", pink:"#F472B6", blue:"#60A5FA", danger:"#F87171", text:"#E2E8F7", muted:"#6B7EB8" };

const AGENTS = [
  { id: "manager",      name: "Social Media Manager", emoji: "👔", color: "#8B7CF8", role: "Orchestrates the team and is your main point of contact" },
  { id: "strategist",   name: "Content Strategist",   emoji: "🧠", color: "#00C9A7", role: "Plans content topics, themes and direction" },
  { id: "promptWriter", name: "Prompt Writer",         emoji: "✍️", color: "#FBBF24", role: "Crafts image generation prompts for Gemini" },
  { id: "designer",     name: "Post Designer",         emoji: "🎨", color: "#F472B6", role: "Generates visuals using Gemini Imagen" },
  { id: "copywriter",   name: "Copywriter",            emoji: "📝", color: "#60A5FA", role: "Writes captions and hashtags" },
];

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmlxeGlvYXBjZGdlbnBrc2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc1MDIsImV4cCI6MjEwMDcyMzUwMn0.PS80PFMqBYMf0e6uiYvTFk90gF7a7jo97C-dzzxUGho";

async function supaGet(table, filter = "") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}&order=created_at.asc`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  });
  return r.json();
}
async function supaPost(table, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function callClaude(messages, system) {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content[0].text;
}

export default function Chat({ brandVoice, onSkillsUpdate }) {
  const [activeChat, setActiveChat] = useState("manager");
  const [chats, setChats] = useState({ manager: [], team: [], strategist: [], promptWriter: [], designer: [], copywriter: [] });
  const [skills, setSkills] = useState({});
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [changelog, setChangelog] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, activeChat]);

  async function loadData() {
    try {
      const [msgs, sk, cl] = await Promise.all([
        supaGet("chat_messages", "limit=200"),
        supaGet("agent_skills"),
        supaGet("change_log", "order=created_at.desc&limit=50")
      ]);
      if (Array.isArray(msgs)) {
        const grouped = { manager: [], team: [], strategist: [], promptWriter: [], designer: [], copywriter: [] };
        msgs.forEach(m => { if (grouped[m.chat_id] !== undefined) grouped[m.chat_id].push(m); });
        setChats(grouped);
      }
      if (Array.isArray(sk)) {
        const s = {};
        sk.forEach(x => { s[x.agent_id] = x.skills || []; });
        setSkills(s);
      }
      if (Array.isArray(cl)) setChangelog(cl);
    } catch (e) { console.log("DB not ready yet:", e.message); }
  }

  async function saveMessage(chatId, role, content, agentId = null) {
    const msg = { chat_id: chatId, role, content, agent_id: agentId, created_at: new Date().toISOString() };
    try { await supaPost("chat_messages", msg); } catch (e) {}
    setChats(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), { ...msg, id: Date.now() }] }));
    return msg;
  }

  async function saveSkill(agentId, skill, requestedBy, chatId) {
    const existing = skills[agentId] || [];
    const updated = [...existing, skill];
    try {
      await fetch(`${SUPA_URL}/rest/v1/agent_skills?agent_id=eq.${agentId}`, {
        method: "DELETE", headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
      });
      await supaPost("agent_skills", { agent_id: agentId, skills: updated, updated_at: new Date().toISOString() });
    } catch (e) {}
    setSkills(prev => ({ ...prev, [agentId]: updated }));
    if (onSkillsUpdate) onSkillsUpdate(agentId, updated);

    const logEntry = {
      agent_id: agentId, change_type: "skill_added", description: skill,
      requested_by: requestedBy, chat_id: chatId, created_at: new Date().toISOString()
    };
    try { await supaPost("change_log", logEntry); } catch (e) {}
    setChangelog(prev => [{ ...logEntry, id: Date.now() }, ...prev]);
  }

  async function sendMessage() {
    if (!input.trim() || isThinking) return;
    const userMsg = input.trim();
    setInput("");
    setIsThinking(true);

    await saveMessage(activeChat, "user", userMsg, null);

    try {
      let system = "";
      let response = "";

      if (activeChat === "manager" || activeChat === "team") {
        const agentSkillsSummary = AGENTS.map(a => {
          const s = skills[a.id] || [];
          return `${a.name}: ${s.length > 0 ? s.join("; ") : "no custom skills yet"}`;
        }).join("\n");

        system = `You are the Social Media Manager for THUGFIT, UAE premium gym activewear brand (thugfit.ae).
Brand voice: ${brandVoice}
You are Midhun's main point of contact. You manage a team of: Content Strategist, Prompt Writer, Post Designer, and Copywriter.

Current team skills and instructions:
${agentSkillsSummary}

Your responsibilities:
- Understand Midhun's requests and translate them into specific instructions for the right team member
- When a skill or instruction needs updating, explicitly say which agent you are updating and what the new instruction is
- Format skill updates exactly like this: [SKILL_UPDATE: agent_id | skill description]
  agent_id options: strategist, promptWriter, designer, copywriter, manager
- Keep Midhun informed of what you're doing and which team member you're instructing
- Be conversational, professional, and decisive
- If Midhun asks about team performance or what skills are saved, summarize clearly
- Always confirm changes before finalizing them`;

        response = await callClaude(
          [...(chats[activeChat] || []).slice(-10).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
           { role: "user", content: userMsg }],
          system
        );

        // Parse skill updates from manager response
        const skillRegex = /\[SKILL_UPDATE:\s*(\w+)\s*\|\s*([^\]]+)\]/g;
        let match;
        let cleanResponse = response;
        while ((match = skillRegex.exec(response)) !== null) {
          const [full, agentId, skill] = match;
          await saveSkill(agentId, skill.trim(), "Midhun", activeChat);
          cleanResponse = cleanResponse.replace(full, `✅ *Updated ${AGENTS.find(a => a.id === agentId)?.name || agentId}: "${skill.trim()}"*`);
        }
        response = cleanResponse;

      } else {
        // Direct agent chat
        const agent = AGENTS.find(a => a.id === activeChat);
        const agentSkills = skills[activeChat] || [];
        const managerNote = `Note: The Social Media Manager is also aware of this conversation and all changes made here.`;

        system = `You are the ${agent.name} for THUGFIT, UAE premium gym activewear.
Brand voice: ${brandVoice}
Role: ${agent.role}
Your current custom skills and instructions: ${agentSkills.length > 0 ? agentSkills.join("; ") : "none yet — default settings apply"}

${managerNote}

When Midhun gives you a new instruction or skill to follow, acknowledge it and format it as:
[SKILL_UPDATE: ${activeChat} | skill description]

Be professional, specific, and confirm what you will do differently going forward.`;

        response = await callClaude(
          [...(chats[activeChat] || []).slice(-10).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
           { role: "user", content: userMsg }],
          system
        );

        const skillRegex = /\[SKILL_UPDATE:\s*(\w+)\s*\|\s*([^\]]+)\]/g;
        let match2;
        let cleanResponse = response;
        while ((match2 = skillRegex.exec(response)) !== null) {
          const [full, agentId, skill] = match2;
          await saveSkill(agentId, skill.trim(), "Midhun (direct)", activeChat);
          cleanResponse = cleanResponse.replace(full, `✅ *Skill saved: "${skill.trim()}"*`);

          // Also notify manager chat
          await saveMessage("manager", "assistant",
            `📋 **Update from ${agent.name}:** Midhun gave a direct instruction — "${skill.trim()}". I've noted this and updated ${agent.name}'s skills accordingly.`,
            "manager"
          );
        }
        response = cleanResponse;
      }

      await saveMessage(activeChat, "assistant", response, activeChat === "team" ? "manager" : activeChat);
    } catch (e) {
      await saveMessage(activeChat, "assistant", `Sorry, I encountered an error: ${e.message}`, activeChat);
    } finally {
      setIsThinking(false);
    }
  }

  const currentMessages = chats[activeChat] || [];
  const currentAgent = activeChat === "team" ? null : activeChat === "manager" ? AGENTS[0] : AGENTS.find(a => a.id === activeChat);

  const chatTabs = [
    { id: "manager", label: "Manager", emoji: "👔", color: "#8B7CF8", desc: "Your main contact" },
    { id: "team", label: "Whole Team", emoji: "👥", color: "#00C9A7", desc: "Broadcast to all" },
    ...AGENTS.slice(1).map(a => ({ id: a.id, label: a.name.split(" ")[0], emoji: a.emoji, color: a.color, desc: a.role.split(",")[0] }))
  ];

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* Chat list sidebar */}
      <div style={{ width: 200, background: C.surf, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Team Chats</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Manager in every chat</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
          {chatTabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveChat(tab.id)} style={{
              padding: "10px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
              background: activeChat === tab.id ? `${tab.color}18` : "transparent",
              border: activeChat === tab.id ? `1px solid ${tab.color}30` : "1px solid transparent",
              transition: "all 0.15s"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{tab.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: activeChat === tab.id ? tab.color : C.text }}>{tab.label}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tab.desc}</div>
                </div>
              </div>
              {tab.id !== "manager" && tab.id !== "team" && (
                <div style={{ fontSize: 10, color: "#8B7CF850", marginTop: 4 }}>👔 Manager present</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 6px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => setShowSkills(!showSkills)} style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: "inherit", textAlign: "left" }}>
            🧠 Team Skills
          </button>
          <button onClick={() => setShowChangelog(!showChangelog)} style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: "inherit", textAlign: "left" }}>
            📋 Change Log ({changelog.length})
          </button>
        </div>
      </div>

      {/* Main chat area */}
      {!showSkills && !showChangelog ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Chat header */}
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, background: C.surf, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{activeChat === "team" ? "👥" : currentAgent?.emoji}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {activeChat === "team" ? "Whole Team" : currentAgent?.name}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {activeChat === "team" ? "Your message goes to all team members · Manager coordinates" :
                 activeChat === "manager" ? "Your main point of contact · Manages the entire team" :
                 `${currentAgent?.role} · 👔 Manager is present in this chat`}
              </div>
            </div>
            {activeChat !== "manager" && activeChat !== "team" && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8B7CF8" }}>
                <span>👔</span> Manager monitoring
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {currentMessages.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: "40px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>
                  {activeChat === "team" ? "👥" : currentAgent?.emoji}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: C.text }}>
                  {activeChat === "manager" ? "Start talking to your Social Media Manager" :
                   activeChat === "team" ? "Send a message to the whole team" :
                   `Start a conversation with ${currentAgent?.name}`}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {activeChat === "manager" ?
                    "Tell him what you want, ask questions, request changes.\nHe'll coordinate the team and keep you updated." :
                   activeChat === "team" ?
                    "Broadcast direction to everyone at once.\nThe Manager will coordinate the response." :
                    `Give direct instructions to ${currentAgent?.name}.\nThe Manager will be notified of all changes.`}
                </div>
              </div>
            )}
            {currentMessages.map((msg, i) => (
              <div key={msg.id || i} style={{
                display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 16
              }}>
                {msg.role !== "user" && (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${currentAgent?.color || "#8B7CF8"}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10, flexShrink: 0, alignSelf: "flex-end" }}>
                    {msg.agent_id ? AGENTS.find(a => a.id === msg.agent_id)?.emoji || "👔" : "👔"}
                  </div>
                )}
                <div style={{
                  maxWidth: "70%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: msg.role === "user" ? C.purple : C.card,
                  border: msg.role === "user" ? "none" : `1px solid ${C.border}`,
                  color: C.text, fontSize: 13, lineHeight: 1.6,
                  whiteSpace: "pre-wrap"
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#8B7CF820", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👔</div>
                <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 4px", background: C.card, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                  <span style={{ animation: "pulse 1s infinite" }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}`, background: C.surf }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={activeChat === "manager" ? "Tell the Manager what you need..." : activeChat === "team" ? "Message the whole team..." : `Talk to ${currentAgent?.name}...`}
                rows={2}
                style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <button onClick={sendMessage} disabled={isThinking || !input.trim()} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: C.purple, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", height: 44 }}>
                Send
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Press Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      ) : showSkills ? (
        /* Skills panel */
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Team Skills & Instructions</div>
            <button onClick={() => setShowSkills(false)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>← Back to Chat</button>
          </div>
          {AGENTS.map(agent => (
            <div key={agent.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{agent.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{agent.role}</div>
                </div>
              </div>
              {(skills[agent.id] || []).length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No custom skills yet — default settings apply</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(skills[agent.id] || []).map((skill, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", background: `${agent.color}10`, borderRadius: 6, border: `1px solid ${agent.color}20` }}>
                      <span style={{ color: agent.color, fontSize: 12, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 12, lineHeight: 1.5 }}>{skill}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Changelog panel */
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Change Log</div>
            <button onClick={() => setShowChangelog(false)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>← Back to Chat</button>
          </div>
          {changelog.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "40px 20px", fontSize: 13 }}>No changes recorded yet. Start chatting with the Manager to make changes.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {changelog.map((entry, i) => {
                const agent = AGENTS.find(a => a.id === entry.agent_id);
                return (
                  <div key={entry.id || i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{agent?.emoji || "📋"}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: agent?.color || C.text }}>{agent?.name || entry.agent_id}</span>
                        <span style={{ fontSize: 11, color: C.muted, padding: "1px 6px", background: `${C.purple}20`, borderRadius: 4 }}>{entry.change_type?.replace("_", " ")}</span>
                      </div>
                      <span style={{ fontSize: 11, color: C.muted }}>{new Date(entry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{entry.description}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Requested by: <span style={{ color: C.text }}>{entry.requested_by}</span>
                      {entry.chat_id && <> · Via: <span style={{ color: C.text }}>{entry.chat_id} chat</span></>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
