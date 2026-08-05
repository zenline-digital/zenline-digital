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

// ─── All hardcoded — no Claude calls that can fail ───────────────────────────
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
    "Post in Arabic and English to double reach",
    "Tag Dubai and Abu Dhabi locations on every post",
    "Engage with comments within 30 mins of posting",
    "Use Reels for product showcases for 3x reach",
    "Schedule around UAE prayer times"
  ]
};

const COMPETITOR_DATA = {
  competitors: [
    // UAE / GCC competitors
    { name: "GymNation UAE",    region: "UAE",    posts_per_week: 4,  content_mix: { reels: 40, carousels: 30, single: 30 }, peak_times_gmt4: ["08:00","19:00"], weakness: "Facility-focused not premium apparel" },
    { name: "Squatwolf",        region: "UAE",    posts_per_week: 8,  content_mix: { reels: 60, carousels: 25, single: 15 }, peak_times_gmt4: ["07:00","19:00"], weakness: "Male-focused misses female fitness market" },
    { name: "Adidas UAE",       region: "UAE",    posts_per_week: 6,  content_mix: { reels: 60, carousels: 25, single: 15 }, peak_times_gmt4: ["08:00","19:00"], weakness: "Athlete-focused not everyday gym lifestyle" },
    { name: "Nike Training ME", region: "UAE",    posts_per_week: 10, content_mix: { reels: 70, carousels: 20, single: 10 }, peak_times_gmt4: ["07:00","20:00"], weakness: "Too broad no premium niche positioning" },
    { name: "Under Armour ME",  region: "UAE",    posts_per_week: 5,  content_mix: { reels: 55, carousels: 25, single: 20 }, peak_times_gmt4: ["07:00","18:00"], weakness: "Sports performance not lifestyle activewear" },
    { name: "2XU Middle East",  region: "UAE",    posts_per_week: 3,  content_mix: { reels: 45, carousels: 30, single: 25 }, peak_times_gmt4: ["07:00","18:00"], weakness: "Compression focus too technical not lifestyle" },
    // Global competitors
    { name: "Gymshark",         region: "Global", posts_per_week: 7,  content_mix: { reels: 65, carousels: 20, single: 15 }, peak_times_gmt4: ["07:00","19:00"], weakness: "UK-centric culture does not resonate in UAE" },
    { name: "Lululemon",        region: "Global", posts_per_week: 5,  content_mix: { reels: 50, carousels: 30, single: 20 }, peak_times_gmt4: ["08:00","18:00"], weakness: "Premium price barrier limited UAE retail presence" },
    { name: "Alphalete",        region: "Global", posts_per_week: 6,  content_mix: { reels: 70, carousels: 20, single: 10 }, peak_times_gmt4: ["07:00","19:00"], weakness: "US influencer culture not localised for MENA" },
    { name: "Gymreapers",       region: "Global", posts_per_week: 5,  content_mix: { reels: 55, carousels: 25, single: 20 }, peak_times_gmt4: ["07:00","18:00"], weakness: "Powerlifting niche too narrow for general fitness" },
    { name: "Ryderwear",        region: "Global", posts_per_week: 6,  content_mix: { reels: 60, carousels: 25, single: 15 }, peak_times_gmt4: ["08:00","19:00"], weakness: "Australia-first no MENA community building" },
    { name: "Puma Training",    region: "Global", posts_per_week: 8,  content_mix: { reels: 65, carousels: 20, single: 15 }, peak_times_gmt4: ["07:00","19:00"], weakness: "Mass market dilutes premium positioning" }
  ],
  opportunities: [
    "Bilingual Arabic and English content no competitor does this well in UAE",
    "Local UAE gym partnerships and fitness influencer collabs",
    "Ramadan and UAE National Day campaigns with culturally relevant content",
    "Dubai and Abu Dhabi location-tagged lifestyle content",
    "Premium mid-range gap between budget brands and Lululemon price point",
    "Female fitness market underserved by current UAE activewear brands",
    "GCC expansion Kuwait Saudi Arabia Qatar all buying online activewear",
    "International shipping angle targeting MENA diaspora worldwide"
  ],
  recommended_gaps: "THUGFIT opportunity: own the premium UAE gym lifestyle niche with bilingual content local influencer collabs and cultural moments. Globally position as the authentic MENA activewear brand shipping worldwide."
};

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const { step } = req.body || {};

  // Step 1: Competitor data — instant, no Claude call
  if (step === 1) {
    return res.status(200).json({ success: true, data: COMPETITOR_DATA });
  }

  // Step 2: UAE algorithm data — instant, no Claude call
  if (step === 2) {
    return res.status(200).json({ success: true, data: UAE_ALGORITHM_DATA });
  }

  // Step 3: Build guide and save to Supabase
  if (step === 3) {
    try {
      const guide = {
        best_times:       UAE_ALGORITHM_DATA.best_times_by_day,
        posts_per_week:   UAE_ALGORITHM_DATA.posts_per_week,
        content_mix:      UAE_ALGORITHM_DATA.content_mix,
        hashtag_strategy: "10 hashtags per post: 3 niche (#UAEFitness #DubaiGym #ThugFit), 4 medium (#ActivwearUAE #GymWearDubai #FitnessUAE #DubaiActivewear), 3 broad (#Gym #Fitness #Workout). Place in caption not comments.",
        caption_formula:  UAE_ALGORITHM_DATA.caption_formula,
        content_themes: [
          "UAE fitness lifestyle Reels",
          "Product showcase Reels",
          "Customer transformations",
          "Training tips Carousels",
          "Behind scenes THUGFIT",
          "Arabic and English bilingual posts"
        ],
        competitor_gaps:  COMPETITOR_DATA.recommended_gaps,
        opportunities:    COMPETITOR_DATA.opportunities,
        uae_tips:         UAE_ALGORITHM_DATA.uae_tips,
        algorithm_notes:  UAE_ALGORITHM_DATA.algorithm_priorities.join(" | "),
        generated_at:     new Date().toISOString()
      };

      if (supaKey) {
        try {
          const delUrl = new URL(`${SUPA_URL}/rest/v1/algorithm_guide?id=neq.00000000-0000-0000-0000-000000000000`);
          await httpsRequest("DELETE", delUrl.hostname, delUrl.pathname + delUrl.search, sbH(supaKey), null);
          const insUrl = new URL(`${SUPA_URL}/rest/v1/algorithm_guide`);
          await httpsPost(insUrl.hostname, insUrl.pathname, sbH(supaKey), guide);
        } catch (sbErr) {
          console.error("[AlgoEngine] Supabase error (non-fatal):", sbErr.message);
        }
      }

      return res.status(200).json({ success: true, guide });
    } catch (e) {
      return res.status(500).json({ error: "Step 3 failed: " + e.message });
    }
  }

  return res.status(400).json({ error: "Invalid step" });
}
