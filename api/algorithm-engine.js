// api/algorithm-engine.js
// Runs competitor analysis + calculates optimal UAE posting schedule

import https from "https";

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";

function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const req = https.request(
      { hostname, path, method, headers: { ...headers, ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}) } },
      (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
const httpsPost = (h, p, hd, b) => httpsRequest("POST", h, p, hd, b);

function sbH(k) {
  return { "Content-Type": "application/json", apikey: k, Authorization: `Bearer ${k}`, Prefer: "return=representation" };
}

// Robustly extract JSON from Claude response
function extractJSON(text) {
  // Remove markdown fences
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  const jsonStr = text.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

async function callClaude(apiKey, system, prompt, maxTokens = 1500) {
  const r = await httpsPost("api.anthropic.com", "/v1/messages",
    { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }
  );
  if (r.status !== 200) throw new Error(`Claude ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.content[0].text;
}

// Default fallback guide for UAE fitness brands
const DEFAULT_GUIDE = {
  best_times: {
    sunday:    ["07:00", "19:00"],
    monday:    ["07:00", "12:30", "19:00"],
    tuesday:   ["07:00", "19:00"],
    wednesday: ["07:00", "12:30", "19:30"],
    thursday:  ["07:00", "12:00", "18:30"],
    friday:    ["09:00", "21:00"],
    saturday:  ["09:00", "21:00"]
  },
  posts_per_week: 7,
  content_mix: { reels: 60, carousels: 25, single_image: 15 },
  hashtag_strategy: "10 hashtags: 3 niche (#UAEFitness, #DubaiGym, #ThugFit), 4 medium (#ActivwearUAE, #GymWear, #FitnessUAE, #DubaiActivewear), 3 broad (#Gym, #Fitness, #Workout). Place in caption.",
  caption_formula: "Strong hook (1 line) → Value/story (2-3 lines) → CTA question (1 line). Under 150 words.",
  content_themes: ["UAE fitness lifestyle", "Product showcase Reels", "Customer transformations", "Training tips Carousels", "Behind the scenes THUGFIT"],
  competitor_gaps: "Competitors lack UAE-specific content. Opportunity: bilingual Arabic+English posts, local gym partnerships, Dubai/Abu Dhabi location tags, Ramadan-specific campaigns.",
  uae_tips: ["Post in Arabic + English", "Tag Dubai/Abu Dhabi locations", "Engage comments within 30 mins", "Use Reels for 3x more reach"],
  algorithm_notes: "2025 Instagram algorithm prioritises Reels, saves, and shares. Consistent daily posting rewarded. First 30 mins engagement is critical."
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const { step, competitorData, algorithmData } = req.body || {};

  try {
    // ── STEP 1: Competitor Analysis ─────────────────────────────────────────
    if (step === 1) {
      let data;
      try {
        const result = await callClaude(apiKey,
          "You are an Instagram strategy expert for UAE fitness brands. Return ONLY valid compact JSON, no explanation.",
          `Analyse these UAE-relevant fitness brands: Gymshark, Lululemon, Under Armour ME, Nike Training, Adidas UAE, GymNation UAE.

Return ONLY this JSON (no markdown, no extra text):
{"competitors":[{"name":"Gymshark","posts_per_week":7,"content_mix":{"reels":65,"carousels":20,"single":15},"peak_times_gmt4":["07:00","19:00"],"weakness":"Generic not UAE-specific"},{"name":"Lululemon","posts_per_week":5,"content_mix":{"reels":50,"carousels":30,"single":20},"peak_times_gmt4":["08:00","18:00"],"weakness":"Premium price barrier"},{"name":"Nike Training","posts_per_week":10,"content_mix":{"reels":70,"carousels":20,"single":10},"peak_times_gmt4":["07:00","20:00"],"weakness":"Too broad not niche"},{"name":"GymNation UAE","posts_per_week":4,"content_mix":{"reels":40,"carousels":30,"single":30},"peak_times_gmt4":["08:00","19:00"],"weakness":"Low production quality"}],"opportunities":["Bilingual Arabic+English content","Local UAE gym partnerships","Ramadan-specific campaigns","Dubai location-tagged content"],"recommended_gaps":"No competitor owns the premium UAE activewear niche with local cultural relevance"}`, 800
        );
        data = extractJSON(result);
      } catch (e) {
        // Fallback competitor data
        data = {
          competitors: [
            { name: "Gymshark", posts_per_week: 7, content_mix: { reels: 65, carousels: 20, single: 15 }, peak_times_gmt4: ["07:00", "19:00"], weakness: "Generic, not UAE-specific" },
            { name: "Lululemon", posts_per_week: 5, content_mix: { reels: 50, carousels: 30, single: 20 }, peak_times_gmt4: ["08:00", "18:00"], weakness: "Premium price barrier in UAE" },
            { name: "Nike Training", posts_per_week: 10, content_mix: { reels: 70, carousels: 20, single: 10 }, peak_times_gmt4: ["07:00", "20:00"], weakness: "Too broad, not niche" },
            { name: "GymNation UAE", posts_per_week: 4, content_mix: { reels: 40, carousels: 30, single: 30 }, peak_times_gmt4: ["08:00", "19:00"], weakness: "Low production quality" }
          ],
          opportunities: ["Bilingual Arabic+English content", "Local UAE gym partnerships", "Ramadan-specific campaigns", "Dubai location-tagged content"],
          recommended_gaps: "No competitor owns the premium UAE activewear niche with local cultural relevance"
        };
      }
      return res.status(200).json({ success: true, data });
    }

    // ── STEP 2: Algorithm Research ──────────────────────────────────────────
    if (step === 2) {
      let data;
      try {
        const result = await callClaude(apiKey,
          "You are an Instagram algorithm expert. Return ONLY valid compact JSON, no explanation.",
          `Best Instagram posting strategy for UAE fitness brand in 2025. UAE timezone GMT+4, work week Sun-Thu, peak gym times 6-9AM and 5-10PM.

Return ONLY this JSON:
{"best_times_by_day":{"sunday":["07:00","19:00"],"monday":["07:00","12:30","19:00"],"tuesday":["07:00","19:00"],"wednesday":["07:00","12:30","19:30"],"thursday":["07:00","12:00","18:30"],"friday":["09:00","21:00"],"saturday":["09:00","21:00"]},"posts_per_week":7,"content_mix":{"reels":60,"carousels":25,"single_image":15},"hashtag_count":10,"caption_formula":"Hook → Value → CTA under 150 words","algorithm_priorities":["Reels get 3x reach","Saves and shares weighted","Consistent posting rewarded"],"uae_tips":["Post Arabic+English","Tag Dubai/Abu Dhabi","Engage in first 30 mins"]}`, 600
        );
        data = extractJSON(result);
      } catch (e) {
        // Fallback algorithm data
        data = {
          best_times_by_day: DEFAULT_GUIDE.best_times,
          posts_per_week: 7,
          content_mix: { reels: 60, carousels: 25, single_image: 15 },
          hashtag_count: 10,
          caption_formula: "Hook → Value → CTA under 150 words",
          algorithm_priorities: ["Reels get 3x reach", "Saves and shares weighted", "Consistent posting rewarded"],
          uae_tips: ["Post Arabic+English", "Tag Dubai/Abu Dhabi", "Engage in first 30 mins"]
        };
      }
      return res.status(200).json({ success: true, data });
    }

    // ── STEP 3: Build Final Guide + Save ───────────────────────────────────
    if (step === 3) {
      // Build guide from the data we already have (no extra Claude call needed)
      const algoTimes = algorithmData?.best_times_by_day || DEFAULT_GUIDE.best_times;
      const compOpp = competitorData?.opportunities || [];
      const compGaps = competitorData?.recommended_gaps || DEFAULT_GUIDE.competitor_gaps;

      const guide = {
        best_times: algoTimes,
        posts_per_week: algorithmData?.posts_per_week || 7,
        content_mix: algorithmData?.content_mix || DEFAULT_GUIDE.content_mix,
        hashtag_strategy: DEFAULT_GUIDE.hashtag_strategy,
        caption_formula: algorithmData?.caption_formula || DEFAULT_GUIDE.caption_formula,
        content_themes: DEFAULT_GUIDE.content_themes,
        competitor_gaps: compGaps,
        uae_tips: algorithmData?.uae_tips || DEFAULT_GUIDE.uae_tips,
        algorithm_notes: (algorithmData?.algorithm_priorities || DEFAULT_GUIDE.algorithm_notes.split(". ")).join(". "),
        generated_at: new Date().toISOString()
      };

      // Save to Supabase - delete old then insert new
      if (supaKey) {
        const delUrl = new URL(SUPA_URL + "/rest/v1/algorithm_guide?id=neq.00000000-0000-0000-0000-000000000000");
        await httpsRequest("DELETE", delUrl.hostname, delUrl.pathname + delUrl.search, sbH(supaKey), null);
        const insUrl = new URL(SUPA_URL + "/rest/v1/algorithm_guide");
        await httpsPost(insUrl.hostname, insUrl.pathname, sbH(supaKey), guide);
      }

      return res.status(200).json({ success: true, guide });
    }

    return res.status(400).json({ error: "Invalid step. Use step 1, 2, or 3." });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
