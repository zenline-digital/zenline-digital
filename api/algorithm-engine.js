// api/algorithm-engine.js
import https from "https";

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";

function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const req = https.request(
      { hostname, path, method, headers: { ...headers, ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}) } },
      (res) => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
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

function extractJSON(text) {
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found in Claude response");
  return JSON.parse(text.slice(start, end + 1));
}

async function callClaude(apiKey, system, prompt, maxTokens) {
  const r = await httpsPost(
    "api.anthropic.com", "/v1/messages",
    { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }
  );
  if (r.status !== 200) throw new Error(`Claude API error ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  if (!r.body?.content?.[0]?.text) throw new Error("Unexpected Claude response format");
  return r.body.content[0].text;
}

const UAE_ALGORITHM_DATA = {
  best_times_by_day: {
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
  hashtag_count: 10,
  caption_formula: "Strong hook (1 line) + value/story (2-3 lines) + CTA question (1 line). Max 150 words.",
  algorithm_priorities: [
    "Reels get 3x more organic reach than static posts",
    "Saves and shares are weighted more than likes",
    "Consistent daily posting is rewarded by the algorithm",
    "First 30 minutes of engagement determines post reach",
    "Carousel posts get shown again to non-engagers"
  ],
  uae_tips: [
    "Post in Arabic + English to double reach",
    "Tag Dubai / Abu Dhabi locations on every post",
    "Engage with comments within 30 mins of posting",
    "Use Reels for product showcases — 3x reach",
    "Schedule around UAE prayer times (avoid Fajr/Isha)"
  ]
};

const FALLBACK_COMPETITORS = {
  competitors: [
    { name: "Gymshark", posts_per_week: 7, content_mix: { reels: 65, carousels: 20, single: 15 }, peak_times_gmt4: ["07:00", "19:00"], weakness: "Generic content — not UAE-specific" },
    { name: "Lululemon", posts_per_week: 5, content_mix: { reels: 50, carousels: 30, single: 20 }, peak_times_gmt4: ["08:00", "18:00"], weakness: "Premium price barrier — weak UAE positioning" },
    { name: "Nike Training", posts_per_week: 10, content_mix: { reels: 70, carousels: 20, single: 10 }, peak_times_gmt4: ["07:00", "20:00"], weakness: "Too broad — no niche activewear focus" },
    { name: "Adidas UAE", posts_per_week: 6, content_mix: { reels: 60, carousels: 25, single: 15 }, peak_times_gmt4: ["08:00", "19:00"], weakness: "Athlete-focused — not gym-goer lifestyle" },
    { name: "GymNation UAE", posts_per_week: 4, content_mix: { reels: 40, carousels: 30, single: 30 }, peak_times_gmt4: ["08:00", "19:00"], weakness: "Low production quality — facility-focused not apparel" },
    { name: "Under Armour ME", posts_per_week: 5, content_mix: { reels: 55, carousels: 25, single: 20 }, peak_times_gmt4: ["07:00", "18:00"], weakness: "Sports performance — not lifestyle activewear" }
  ],
  opportunities: [
    "Bilingual Arabic + English content (no competitor does this well)",
    "Local UAE gym partnerships and shoutouts",
    "Ramadan + UAE National Day campaigns",
    "Dubai/Abu Dhabi location-tagged content",
    "Premium activewear lifestyle content (gap in market)"
  ],
  recommended_gaps: "No competitor owns the premium UAE gym activewear niche with local cultural relevance. THUGFIT opportunity: bilingual content, UAE fitness influencer collabs, Dubai gym culture content."
};

export default async function handler(req, res) {
  console.log("=== ALGORITHM ENGINE CALLED ===");
  console.log("Method:", req.method);
  console.log("Body:", JSON.stringify(req.body || {}));

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey  = process.env.ANTHROPIC_API_KEY || "";
  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  console.log("ANTHROPIC_API_KEY present:", !!apiKey, "| length:", apiKey.length);
  console.log("Supabase key present:", !!supaKey, "| length:", supaKey.length);

  if (!apiKey) {
    console.error("FATAL: ANTHROPIC_API_KEY missing from Vercel env vars");
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured in Vercel" });
  }

  const { step, competitorData, algorithmData } = req.body || {};
  console.log("Step received:", step);

  // ── STEP 1 ────────────────────────────────────────────────────────────────
  if (step === 1) {
    console.log("Running Step 1: Competitor analysis");
    let data = FALLBACK_COMPETITORS;
    try {
      const result = await callClaude(
        apiKey,
        "You are an Instagram strategy expert for UAE fitness brands. Return ONLY raw JSON, no markdown, no explanation.",
        `Analyse 6 UAE-relevant fitness/activewear brands on Instagram. For each identify: posts per week, content mix (% reels/carousels/single), best posting times GMT+4, and their key weakness for the UAE market. Also identify THUGFIT's top 3 market opportunities.

Respond with ONLY this JSON structure, no other text:
{"competitors":[{"name":"Gymshark","posts_per_week":7,"content_mix":{"reels":65,"carousels":20,"single":15},"peak_times_gmt4":["07:00","19:00"],"weakness":"Generic not UAE-specific"},{"name":"Lululemon","posts_per_week":5,"content_mix":{"reels":50,"carousels":30,"single":20},"peak_times_gmt4":["08:00","18:00"],"weakness":"Price barrier"},{"name":"Nike Training","posts_per_week":10,"content_mix":{"reels":70,"carousels":20,"single":10},"peak_times_gmt4":["07:00","20:00"],"weakness":"Too broad"},{"name":"Adidas UAE","posts_per_week":6,"content_mix":{"reels":60,"carousels":25,"single":15},"peak_times_gmt4":["08:00","19:00"],"weakness":"Athlete focus not lifestyle"},{"name":"GymNation UAE","posts_per_week":4,"content_mix":{"reels":40,"carousels":30,"single":30},"peak_times_gmt4":["08:00","19:00"],"weakness":"Low quality"},{"name":"Under Armour ME","posts_per_week":5,"content_mix":{"reels":55,"carousels":25,"single":20},"peak_times_gmt4":["07:00","18:00"],"weakness":"Performance not lifestyle"}],"opportunities":["Bilingual Arabic+English content","Local UAE gym partnerships","Ramadan campaigns"],"recommended_gaps":"THUGFIT opportunity summary here"}`,
        700
      );
      console.log("Step 1 Claude response received, length:", result.length);
      data = extractJSON(result);
      console.log("Step 1 JSON parsed OK");
    } catch (e) {
      console.error("Step 1 Claude failed, using fallback. Error:", e.message);
    }
    return res.status(200).json({ success: true, data });
  }

  // ── STEP 2 ────────────────────────────────────────────────────────────────
  if (step === 2) {
    console.log("Running Step 2: Returning hardcoded UAE data");
    return res.status(200).json({ success: true, data: UAE_ALGORITHM_DATA });
  }

  // ── STEP 3 ────────────────────────────────────────────────────────────────
  if (step === 3) {
    console.log("Running Step 3: Building guide and saving to Supabase");
    try {
      const comp = competitorData || FALLBACK_COMPETITORS;
      const algo = algorithmData  || UAE_ALGORITHM_DATA;

      const guide = {
        best_times:       algo.best_times_by_day || UAE_ALGORITHM_DATA.best_times_by_day,
        posts_per_week:   algo.posts_per_week     || 7,
        content_mix:      algo.content_mix        || UAE_ALGORITHM_DATA.content_mix,
        hashtag_strategy: "10 hashtags per post: 3 niche (#UAEFitness #DubaiGym #ThugFit), 4 medium (#ActivwearUAE #GymWearDubai #FitnessUAE #DubaiActivewear), 3 broad (#Gym #Fitness #Workout). Place in caption not comments.",
        caption_formula:  algo.caption_formula    || UAE_ALGORITHM_DATA.caption_formula,
        content_themes:   ["UAE fitness lifestyle Reels", "Product showcase Reels", "Customer transformations", "Training tips Carousels", "Behind scenes THUGFIT", "Arabic+English bilingual posts"],
        competitor_gaps:  comp.recommended_gaps   || FALLBACK_COMPETITORS.recommended_gaps,
        opportunities:    comp.opportunities      || FALLBACK_COMPETITORS.opportunities,
        uae_tips:         algo.uae_tips           || UAE_ALGORITHM_DATA.uae_tips,
        algorithm_notes:  (algo.algorithm_priorities || UAE_ALGORITHM_DATA.algorithm_priorities).join(" | "),
        generated_at:     new Date().toISOString()
      };

      console.log("Guide object built. Attempting Supabase save. Key present:", !!supaKey);

      if (supaKey) {
        try {
          const delUrl = new URL(`${SUPA_URL}/rest/v1/algorithm_guide?id=neq.00000000-0000-0000-0000-000000000000`);
          await httpsRequest("DELETE", delUrl.hostname, delUrl.pathname + delUrl.search, sbH(supaKey), null);
          console.log("Old rows deleted from algorithm_guide");
          const insUrl = new URL(`${SUPA_URL}/rest/v1/algorithm_guide`);
          const insertResult = await httpsPost(insUrl.hostname, insUrl.pathname, sbH(supaKey), guide);
          console.log("Supabase insert status:", insertResult.status);
        } catch (sbErr) {
          console.error("Supabase save failed (non-fatal):", sbErr.message);
        }
      } else {
        console.warn("No Supabase key found — guide not persisted to DB");
      }

      return res.status(200).json({ success: true, guide });
    } catch (e) {
      console.error("Step 3 fatal error:", e.message);
      console.error("Stack:", e.stack);
      return res.status(500).json({ error: "Step 3 failed: " + e.message });
    }
  }

  console.error("Invalid step:", step);
  return res.status(400).json({ error: "Invalid step — must be 1, 2, or 3" });
}
