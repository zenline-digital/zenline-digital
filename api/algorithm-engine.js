// api/algorithm-engine.js
// Runs competitor analysis + calculates optimal UAE posting schedule
// Called from ZenLine Digital Algorithm Engine page

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
const httpsPatch = (h, p, hd, b) => httpsRequest("PATCH", h, p, hd, b);

function sbH(k) {
  return { "Content-Type": "application/json", apikey: k, Authorization: `Bearer ${k}`, Prefer: "return=representation" };
}

async function callClaude(apiKey, system, prompt, maxTokens = 2000) {
  const r = await httpsPost("api.anthropic.com", "/v1/messages",
    { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }
  );
  if (r.status !== 200) throw new Error(`Claude ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.content[0].text;
}

async function saveGuide(guide, supaKey) {
  // Try PATCH first (update existing)
  const url = new URL(SUPA_URL + "/rest/v1/algorithm_guide?limit=1");
  const patchR = await httpsPatch(url.hostname, url.pathname + url.search, sbH(supaKey), guide);
  if (patchR.status === 404 || (Array.isArray(patchR.body) && patchR.body.length === 0)) {
    // Insert new row
    const insUrl = new URL(SUPA_URL + "/rest/v1/algorithm_guide");
    await httpsPost(insUrl.hostname, insUrl.pathname, sbH(supaKey), guide);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const { step } = req.body || {};

  try {
    // ── STEP 1: Competitor Analysis ─────────────────────────────────────────
    if (step === 1) {
      const result = await callClaude(apiKey,
        "You are an expert Instagram strategist for UAE fitness and activewear brands. Provide data-driven, specific insights.",
        `Analyze these top UAE-relevant fitness/activewear brands on Instagram and identify their posting strategies:
- Gymshark (@gymshark) — UK brand dominating UAE market
- Lululemon (@lululemon) — premium positioning
- Under Armour Middle East (@underarmour)
- Nike Training (@niketraining)
- Adidas UAE (@adidasuae)
- GymNation UAE (@gymna_tion) — local UAE competitor

For each competitor, assess:
1. Estimated posting frequency (posts/week)
2. Content mix % (Reels vs Carousels vs single image)
3. Peak engagement time patterns (based on their follower demographics in Gulf region)
4. Hashtag volume and strategy
5. Caption style (length, tone, CTA type)

Then identify: what are THUGFIT's (@thugfit.ae, UAE premium activewear) biggest opportunities based on gaps these competitors are not covering?

Return JSON only, no markdown:
{
  "competitors": [
    {
      "name": "Gymshark",
      "handle": "@gymshark",
      "posts_per_week": 7,
      "content_mix": {"reels": 65, "carousels": 20, "single": 15},
      "peak_times_gmt4": ["07:00", "19:00"],
      "hashtag_count": 8,
      "caption_style": "Short punchy hooks, motivational",
      "strengths": "High production reels",
      "weakness": "Generic content, not UAE-specific"
    }
  ],
  "opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "recommended_gaps": "Key content angles competitors are missing"
}`, 2500
      );
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      return res.status(200).json({ success: true, data: parsed });
    }

    // ── STEP 2: Algorithm Research ──────────────────────────────────────────
    if (step === 2) {
      const result = await callClaude(apiKey,
        "You are an Instagram algorithm expert with deep knowledge of 2025 best practices for the GCC/UAE market.",
        `Research and provide the current Instagram algorithm best practices specifically for UAE fitness/activewear brands in 2025.

UAE audience context:
- Timezone: GMT+4 (Gulf Standard Time)  
- Work week: Sunday to Thursday
- Weekend: Friday and Saturday
- Peak gym times: 6-9 AM and 5-10 PM
- High smartphone usage during lunch (12-2 PM)
- Ramadan period affects patterns (night shifts to after Iftar)
- Demographic: 18-40 year olds, Arabic and English speaking

Provide:
1. Best posting times for maximum UAE reach (be specific with times in GMT+4)
2. Best days of the week (ranked)
3. Optimal posting frequency per week
4. Content format priorities in 2025 algorithm (Reels vs Carousels vs Posts)
5. Hashtag strategy (count, type mix, placement)
6. Caption best practices (length, hooks, CTAs)
7. Story + Reel frequency recommendations

Return JSON only:
{
  "best_times_by_day": {
    "sunday": ["07:00", "12:30", "19:00"],
    "monday": ["07:00", "12:30", "19:00"],
    "tuesday": ["07:00", "19:00"],
    "wednesday": ["07:00", "12:30", "19:30"],
    "thursday": ["07:00", "12:00", "18:30"],
    "friday": ["09:00", "21:00"],
    "saturday": ["09:00", "17:00", "21:00"]
  },
  "best_days_ranked": ["wednesday", "thursday", "monday", "sunday", "tuesday", "saturday", "friday"],
  "posts_per_week": 7,
  "content_mix": {"reels": 60, "carousels": 25, "single_image": 15},
  "hashtag_count": 10,
  "hashtag_mix": "3 niche (#UAEfitness, #ThugFit), 4 medium (#DubaiGym, #ActivwearUAE), 3 broad (#Fitness, #Gym)",
  "caption_length": "short",
  "caption_formula": "Hook (1 line) → Value/story (2-3 lines) → CTA (1 line)",
  "algorithm_priorities": ["Reels get 3x more reach", "Saves and shares weighted heavily", "Consistent posting rewarded"],
  "uae_specific_tips": ["Post Reels in Arabic + English", "Use location tags Dubai/Abu Dhabi", "Engage within first 30 mins"]
}`, 2000
      );
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      return res.status(200).json({ success: true, data: parsed });
    }

    // ── STEP 3: Build Final Guide + Save ───────────────────────────────────
    if (step === 3) {
      const { competitorData, algorithmData } = req.body;

      const result = await callClaude(apiKey,
        "You are a social media strategist. Create a precise, actionable posting schedule.",
        `Based on competitor analysis and algorithm research, create the final optimized Instagram strategy for THUGFIT.

Competitor insights: ${JSON.stringify(competitorData).slice(0, 1000)}
Algorithm data: ${JSON.stringify(algorithmData).slice(0, 1000)}

Create the final monthly content strategy:
- 30 posts for August 2026
- Distributed across optimal time slots
- Mix of Reels, Carousels, and single posts
- Content themes that fill competitor gaps

Return JSON only:
{
  "best_times": {
    "sunday": ["07:00", "19:00"],
    "monday": ["07:00", "12:30", "19:00"],
    "tuesday": ["07:00", "19:00"],
    "wednesday": ["07:00", "12:30", "19:30"],
    "thursday": ["07:00", "12:00", "18:30"],
    "friday": ["09:00", "21:00"],
    "saturday": ["09:00", "21:00"]
  },
  "posts_per_week": 7,
  "content_mix": {"reels": 60, "carousels": 25, "single_image": 15},
  "hashtag_strategy": "10 hashtags: 3 niche + 4 medium + 3 broad. Place in caption not comments.",
  "caption_formula": "Hook → Value → CTA. Keep under 150 words. Always end with question or CTA.",
  "content_themes": ["UAE fitness lifestyle", "Product showcase (Reels)", "Customer transformation", "Training tips (Carousels)", "Behind scenes THUGFIT"],
  "competitor_gaps": "summary of main opportunities",
  "uae_tips": ["Post in both Arabic and English", "Tag Dubai/Abu Dhabi locations", "Engage comments within 30 mins of posting"],
  "algorithm_notes": "Key 2025 Instagram algorithm facts for UAE market"
}`, 2000
      );
      const guide = JSON.parse(result.replace(/```json|```/g, "").trim());
      guide.generated_at = new Date().toISOString();

      // Save to Supabase
      if (supaKey) {
        const insUrl = new URL(SUPA_URL + "/rest/v1/algorithm_guide");
        // Delete old first
        const delUrl = new URL(SUPA_URL + "/rest/v1/algorithm_guide");
        await httpsRequest("DELETE", delUrl.hostname, delUrl.pathname + "?id=neq.00000000-0000-0000-0000-000000000000", sbH(supaKey), null);
        // Insert new
        await httpsPost(insUrl.hostname, insUrl.pathname, sbH(supaKey), guide);
      }

      return res.status(200).json({ success: true, guide });
    }

    return res.status(400).json({ error: "Invalid step. Use step 1, 2, or 3." });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
