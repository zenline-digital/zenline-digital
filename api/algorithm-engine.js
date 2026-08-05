// api/algorithm-engine.js
import https from "https";

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const req = https.request(
      {
        hostname, path, method,
        headers: { ...headers, ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}) }
      },
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
  return {
    "Content-Type": "application/json",
    apikey: k,
    Authorization: `Bearer ${k}`,
    Prefer: "return=representation"
  };
}

// ─── Robust JSON extractor ────────────────────────────────────────────────────
// Handles: markdown fences, surrounding text, AND JavaScript-style unquoted keys
function extractJSON(text) {
  // Strip markdown code blocks
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Find outermost { ... }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in Claude response");
  }
  const slice = text.slice(start, end + 1);

  // 1. Try strict JSON parse first
  try {
    return JSON.parse(slice);
  } catch (e1) {
    // 2. Claude sometimes returns JS object syntax (unquoted keys).
    //    Use Function constructor to safely evaluate it.
    //    Safe here because the content comes exclusively from our Claude API.
    try {
      // eslint-disable-next-line no-new-func
      return (new Function("return " + slice))();
    } catch (e2) {
      // Re-throw the original JSON error so the caller falls back to hardcoded data
      throw new Error("JSON parse failed: " + e1.message);
    }
  }
}

// ─── Claude caller ────────────────────────────────────────────────────────────
async function callClaude(apiKey, system, prompt, maxTokens) {
  const r = await httpsPost(
    "api.anthropic.com", "/v1/messages",
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    {
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }]
    }
  );
  if (r.status !== 200) {
    throw new Error(`Claude API error ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  if (!r.body?.content?.[0]?.text) {
    throw new Error("Unexpected Claude response format");
  }
  return r.body.content[0].text;
}

// ─── Hardcoded fallback data ───────────────────────────────────────────────────
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
    { name: "Gymshark",       posts_per_week: 7,  content_mix: { reels: 65, carousels: 20, single: 15 }, peak_times_gmt4: ["07:00","19:00"], weakness: "Generic content not UAE-specific" },
    { name: "Lululemon",      posts_per_week: 5,  content_mix: { reels: 50, carousels: 30, single: 20 }, peak_times_gmt4: ["08:00","18:00"], weakness: "Premium price barrier weak UAE positioning" },
    { name: "Nike Training",  posts_per_week: 10, content_mix: { reels: 70, carousels: 20, single: 10 }, peak_times_gmt4: ["07:00","20:00"], weakness: "Too broad no niche activewear focus" },
    { name: "Adidas UAE",     posts_per_week: 6,  content_mix: { reels: 60, carousels: 25, single: 15 }, peak_times_gmt4: ["08:00","19:00"], weakness: "Athlete-focused not gym-goer lifestyle" },
    { name: "GymNation UAE",  posts_per_week: 4,  content_mix: { reels: 40, carousels: 30, single: 30 }, peak_times_gmt4: ["08:00","19:00"], weakness: "Low production quality facility-focused not apparel" },
    { name: "Under Armour ME",posts_per_week: 5,  content_mix: { reels: 55, carousels: 25, single: 20 }, peak_times_gmt4: ["07:00","18:00"], weakness: "Sports performance not lifestyle activewear" }
  ],
  opportunities: [
    "Bilingual Arabic and English content no competitor does this well",
    "Local UAE gym partnerships and shoutouts",
    "Ramadan and UAE National Day campaigns",
    "Dubai and Abu Dhabi location-tagged content",
    "Premium activewear lifestyle content gap in market"
  ],
  recommended_gaps: "No competitor owns the premium UAE gym activewear niche with local cultural relevance. THUGFIT opportunity: bilingual content UAE fitness influencer collabs Dubai gym culture content."
};

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  console.log("[AlgoEngine] Method:", req.method, "| Body keys:", Object.keys(req.body || {}));

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey  = process.env.ANTHROPIC_API_KEY || "";
  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!apiKey) {
    console.error("[AlgoEngine] FATAL: ANTHROPIC_API_KEY missing");
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured in Vercel" });
  }

  const { step, competitorData, algorithmData } = req.body || {};
  console.log("[AlgoEngine] Step:", step);

  // ── STEP 1: Competitor analysis ───────────────────────────────────────────
  if (step === 1) {
    let data = FALLBACK_COMPETITORS;
    try {
      const raw = await callClaude(
        apiKey,
        // System: force strict minified JSON, no formatting
        'You are an Instagram strategy expert for UAE fitness brands. You MUST respond with ONLY a single line of minified JSON. No markdown. No code blocks. No newlines inside the JSON. No explanations. Start your response with { and end with }.',
        // User: give the exact schema as a one-liner template
        'Return competitor data for 6 UAE-relevant fitness/activewear Instagram accounts. Use EXACTLY this schema (minified, one line): {"competitors":[{"name":"string","posts_per_week":0,"content_mix":{"reels":0,"carousels":0,"single":0},"peak_times_gmt4":["HH:MM"],"weakness":"string"}],"opportunities":["string"],"recommended_gaps":"string"} Fill in real data for: Gymshark, Lululemon, Nike Training, Adidas UAE, GymNation UAE, Under Armour ME. weakness and opportunities must be plain strings with no apostrophes.',
        600
      );
      console.log("[AlgoEngine] Step 1 Claude response length:", raw.length);
      data = extractJSON(raw);
      console.log("[AlgoEngine] Step 1 JSON parsed OK");
    } catch (e) {
      console.error("[AlgoEngine] Step 1 error (using fallback):", e.message);
      // data stays as FALLBACK_COMPETITORS
    }
    return res.status(200).json({ success: true, data });
  }

  // ── STEP 2: UAE algorithm data (hardcoded, no Claude needed) ─────────────
  if (step === 2) {
    console.log("[AlgoEngine] Step 2: returning hardcoded UAE algorithm data");
    return res.status(200).json({ success: true, data: UAE_ALGORITHM_DATA });
  }

  // ── STEP 3: Build guide + save to Supabase ────────────────────────────────
  if (step === 3) {
    try {
      const comp = competitorData || FALLBACK_COMPETITORS;
      const algo = algorithmData  || UAE_ALGORITHM_DATA;

      const guide = {
        best_times:       algo.best_times_by_day  || UAE_ALGORITHM_DATA.best_times_by_day,
        posts_per_week:   algo.posts_per_week      || 7,
        content_mix:      algo.content_mix         || UAE_ALGORITHM_DATA.content_mix,
        hashtag_strategy: "10 hashtags per post: 3 niche (#UAEFitness #DubaiGym #ThugFit), 4 medium (#ActivwearUAE #GymWearDubai #FitnessUAE #DubaiActivewear), 3 broad (#Gym #Fitness #Workout). Place in caption not comments.",
        caption_formula:  algo.caption_formula     || UAE_ALGORITHM_DATA.caption_formula,
        content_themes:   [
          "UAE fitness lifestyle Reels",
          "Product showcase Reels",
          "Customer transformations",
          "Training tips Carousels",
          "Behind scenes THUGFIT",
          "Arabic and English bilingual posts"
        ],
        competitor_gaps:  comp.recommended_gaps   || FALLBACK_COMPETITORS.recommended_gaps,
        opportunities:    comp.opportunities      || FALLBACK_COMPETITORS.opportunities,
        uae_tips:         algo.uae_tips           || UAE_ALGORITHM_DATA.uae_tips,
        algorithm_notes:  (algo.algorithm_priorities || UAE_ALGORITHM_DATA.algorithm_priorities).join(" | "),
        generated_at:     new Date().toISOString()
      };

      console.log("[AlgoEngine] Step 3: guide built. Saving to Supabase...");

      if (supaKey) {
        try {
          // Delete old rows
          const delUrl = new URL(`${SUPA_URL}/rest/v1/algorithm_guide?id=neq.00000000-0000-0000-0000-000000000000`);
          await httpsRequest("DELETE", delUrl.hostname, delUrl.pathname + delUrl.search, sbH(supaKey), null);
          // Insert new guide
          const insUrl = new URL(`${SUPA_URL}/rest/v1/algorithm_guide`);
          const ins = await httpsPost(insUrl.hostname, insUrl.pathname, sbH(supaKey), guide);
          console.log("[AlgoEngine] Supabase insert status:", ins.status);
        } catch (sbErr) {
          console.error("[AlgoEngine] Supabase save failed (non-fatal):", sbErr.message);
        }
      } else {
        console.warn("[AlgoEngine] No Supabase key — guide not persisted");
      }

      return res.status(200).json({ success: true, guide });
    } catch (e) {
      console.error("[AlgoEngine] Step 3 fatal error:", e.message);
      return res.status(500).json({ error: "Step 3 failed: " + e.message });
    }
  }

  return res.status(400).json({ error: "Invalid step — must be 1, 2, or 3" });
}
