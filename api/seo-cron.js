// api/seo-cron.js
// Autonomous SEO Agent — runs automatically every day via Vercel Cron
// Schedule: 0 5 * * * = 9:00 AM UAE time (UTC+4)
// Configure in vercel.json under "crons"

import https from "https";

const SUPABASE_URL = "https://ioniqxioapcdgenpksex.supabase.co";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(bodyStr) } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "GET", headers }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function httpsPatch(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "PATCH", headers: { ...headers, "Content-Length": Buffer.byteLength(bodyStr) } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode }));
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const sbHeaders = (key) => ({
  "Content-Type": "application/json",
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: "return=representation",
});

async function sbGet(path, key) {
  const url = new URL(SUPABASE_URL + path);
  const r = await httpsGet(url.hostname, url.pathname + url.search, sbHeaders(key));
  return Array.isArray(r.body) ? r.body : [];
}

async function sbPost(path, body, key) {
  const url = new URL(SUPABASE_URL + path);
  return httpsPost(url.hostname, url.pathname + url.search, sbHeaders(key), body);
}

async function sbPatch(path, body, key) {
  const url = new URL(SUPABASE_URL + path);
  return httpsPatch(url.hostname, url.pathname + url.search, sbHeaders(key), body);
}

// ─── Claude helper ────────────────────────────────────────────────────────────
async function callClaude(apiKey, system, userPrompt, maxTokens = 3500) {
  const r = await httpsPost(
    "api.anthropic.com",
    "/v1/messages",
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    {
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }
  );
  if (r.status !== 200) throw new Error(`Claude error ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body.content[0].text;
}

// ─── Keyword strategy — THUGFIT UAE ──────────────────────────────────────────
// 30 pre-seeded keywords cycling daily — covers all core SEO needs
const SEED_KEYWORDS = [
  "gym leggings women Dubai","sports bra UAE","men gym shorts Dubai",
  "activewear brand UAE","best gym clothes Dubai","workout leggings Abu Dhabi",
  "THUGFIT activewear review","gym wear women UAE","compression shorts men UAE",
  "affordable gym wear Dubai","high waist leggings UAE","gym tank tops women Dubai",
  "athletic wear online UAE","yoga pants Dubai","running shorts men UAE",
  "gym hoodie UAE","sports shorts women Dubai","fitness wear brand UAE",
  "gym outfit ideas women UAE","men workout clothes Dubai","gym bra Dubai",
  "activewear sale UAE","gym joggers men UAE","sports crop top UAE",
  "gym leggings with pockets UAE","sweat wicking clothes UAE","gym wear for summer Dubai",
  "UAE fitness fashion brand","best leggings for gym UAE","gym clothes online Dubai",
];

// ─── Article generator ────────────────────────────────────────────────────────
async function generateArticle(anthropicKey, keyword) {
  const raw = await callClaude(
    anthropicKey,
    "You are a professional SEO content writer specialising in fitness, activewear, and the UAE market. You write engaging, well-structured articles that rank on Google AND genuinely help readers. Always write with THUGFIT brand voice: premium, motivational, confident.",
    `Write a complete SEO-optimised blog article for THUGFIT (premium UAE activewear brand, thugfit.ae, based in Dubai).

Target keyword: "${keyword}"
Word count: 1200–1500 words
Audience: UAE fitness enthusiasts aged 18-35, gym-goers, athletes
Brand: THUGFIT — premium activewear, shipped across UAE

REQUIRED FORMAT (follow exactly):

SEO_TITLE: [max 60 chars, must include keyword, end with | THUGFIT]
META_DESC: [max 155 chars, include keyword, clear value prop, call to action]
SLUG: [kebab-case-url-slug]

---ARTICLE---

# [H1 headline — different from SEO title, punchy and engaging]

[Introduction paragraph — hook, include keyword naturally in first 100 words]

## [H2 subheading]
[Body paragraph 200-250 words]

## [H2 subheading]
[Body paragraph 200-250 words]

## [H2 subheading]
[Body paragraph 200-250 words]

## [H2 subheading]
[Body paragraph 200-250 words]

## Frequently Asked Questions

**Q: [relevant question about the topic]**
A: [answer 2-3 sentences]

**Q: [relevant question]**
A: [answer]

**Q: [relevant question]**
A: [answer]

## Final Thoughts

[Closing paragraph 100-150 words. Include a natural mention of THUGFIT products and thugfit.ae. End with motivational CTA.]

---

Write genuinely useful content. Include specific tips relevant to UAE climate (hot weather gym wear, indoor AC gyms, etc.). Natural keyword usage — no stuffing.`
  );

  // Parse structured fields
  const get = (key) => {
    const m = raw.match(new RegExp(`${key}:\\s*(.+)`));
    return m ? m[1].trim() : "";
  };

  const contentStart = raw.indexOf("---ARTICLE---");
  const bodyMd = contentStart > -1 ? raw.slice(contentStart + 13).trim() : raw;

  // Markdown → HTML
  const htmlContent = bodyMd
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .split("\n\n")
    .map((p) => (p.startsWith("<h") ? p : `<p>${p}</p>`))
    .join("\n");

  return {
    title: get("SEO_TITLE") || `${keyword} | THUGFIT`,
    metaDesc: get("META_DESC"),
    slug: get("SLUG") || keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    htmlContent,
  };
}

// ─── WordPress publisher ──────────────────────────────────────────────────────
async function publishToWordPress(wpUrl, wpUser, wpPass, article, postStatus) {
  const url = new URL(`${wpUrl}/wp-json/wp/v2/posts`);
  const creds = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
  return httpsPost(
    url.hostname,
    url.pathname,
    { "Content-Type": "application/json", Authorization: `Basic ${creds}` },
    {
      title: article.title,
      content: article.htmlContent,
      excerpt: article.metaDesc,
      slug: article.slug,
      status: postStatus || "draft",
    }
  );
}

// ─── Activity logger ──────────────────────────────────────────────────────────
async function log(key, entry) {
  return sbPost("/rest/v1/seo_activity_log", entry, key).catch(() => {});
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.authorization || "";

  // Allow Vercel cron (no auth header in Vercel cron calls) OR manual trigger with secret
  const isVercelCron = !authHeader && req.headers["x-vercel-cron"] === "1";
  const isManual = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isDev = process.env.NODE_ENV === "development";

  if (!isVercelCron && !isManual && !isDev) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

  if (!supaKey || !anthropicKey) {
    return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY or Supabase key in env vars" });
  }

  try {
    // 1. Load automation config
    const configs = await sbGet("/rest/v1/seo_automation?limit=1", supaKey);
    const config = configs[0];

    if (!config) {
      return res.status(200).json({ skipped: true, reason: "No SEO automation config found. Set it up in ZenLine Digital." });
    }
    if (!config.is_enabled) {
      return res.status(200).json({ skipped: true, reason: "Automation is paused." });
    }
    if (!config.wp_username || !config.wp_app_password) {
      await log(supaKey, { action: "error", status: "failed", error: "WordPress credentials not configured" });
      return res.status(200).json({ skipped: true, reason: "WordPress credentials missing — add them in SEO settings." });
    }

    // 2. Pick keyword — from queue first, then seed list
    const queue = await sbGet("/rest/v1/seo_keyword_queue?used=eq.false&order=priority.desc,created_at.asc&limit=1", supaKey);
    let keyword, kwId;

    if (queue.length > 0) {
      keyword = queue[0].keyword;
      kwId = queue[0].id;
    } else {
      // All queue keywords used — pick from seed list based on day of year
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      keyword = SEED_KEYWORDS[dayOfYear % SEED_KEYWORDS.length];
    }

    // 3. Generate article with Claude
    const article = await generateArticle(anthropicKey, keyword);

    // 4. Publish to WordPress
    const wpResult = await publishToWordPress(
      config.wp_url || "https://thugfit.ae",
      config.wp_username,
      config.wp_app_password,
      article,
      config.post_status || "draft"
    );

    const success = wpResult.status === 201;
    const wpPostId = wpResult.body?.id;
    const wpPostUrl = wpResult.body?.link || wpResult.body?.guid?.rendered;

    // 5. Mark keyword as used
    if (kwId) {
      await sbPatch(`/rest/v1/seo_keyword_queue?id=eq.${kwId}`, { used: true, used_at: new Date().toISOString() }, supaKey);
    }

    // 6. Log activity
    await log(supaKey, {
      action: "blog_published",
      title: article.title,
      keyword,
      status: success ? (config.post_status === "publish" ? "published" : "saved as draft") : "failed",
      wp_post_id: wpPostId || null,
      wp_post_url: wpPostUrl || null,
      error: success ? null : `WP error ${wpResult.status}: ${JSON.stringify(wpResult.body).slice(0, 200)}`,
    });

    // 7. Update last_run timestamp
    await sbPatch("/rest/v1/seo_automation?limit=1", { last_run: new Date().toISOString() }, supaKey);

    return res.status(200).json({ success, keyword, title: article.title, wpPostId, wpPostUrl });

  } catch (err) {
    await log(supaKey, { action: "error", status: "failed", error: err.message }).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
