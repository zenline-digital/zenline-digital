// api/seo-cron.js
// Autonomous SEO Agent — runs automatically every day via Vercel Cron
// Schedule: 0 5 * * * = 9:00 AM UAE time (UTC+4)

import https from "https";

const SUPABASE_URL = "https://ioniqxioapcdgenpksex.supabase.co";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const req = https.request(
      { hostname, path, method, headers: { ...headers, ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}) } },
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
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const httpsGet  = (h, p, hdrs)     => httpsRequest("GET",  h, p, hdrs, null);
const httpsPost = (h, p, hdrs, b)  => httpsRequest("POST", h, p, hdrs, b);
const httpsPatch = (h, p, hdrs, b) => httpsRequest("PATCH", h, p, hdrs, b);

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const sbH = (key) => ({ "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=representation" });

async function sbGet(path, key) {
  const url = new URL(SUPABASE_URL + path);
  const r = await httpsGet(url.hostname, url.pathname + url.search, sbH(key));
  return Array.isArray(r.body) ? r.body : [];
}
async function sbPost(path, body, key) {
  const url = new URL(SUPABASE_URL + path);
  return httpsPost(url.hostname, url.pathname + url.search, sbH(key), body);
}
async function sbPatch(path, body, key) {
  const url = new URL(SUPABASE_URL + path);
  return httpsPatch(url.hostname, url.pathname + url.search, sbH(key), body);
}

// ─── Claude helper ────────────────────────────────────────────────────────────
async function callClaude(apiKey, system, userPrompt, maxTokens = 3500) {
  const r = await httpsPost("api.anthropic.com", "/v1/messages",
    { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: userPrompt }] }
  );
  if (r.status !== 200) throw new Error(`Claude error ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body.content[0].text;
}

// ─── WordPress publisher ──────────────────────────────────────────────────────
async function publishToWordPress(wpUrl, wpUser, wpPass, article, postStatus) {
  const url = new URL(`${wpUrl}/wp-json/wp/v2/posts`);
  const creds = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
  return httpsPost(url.hostname, url.pathname,
    { "Content-Type": "application/json", Authorization: `Basic ${creds}` },
    {
      title: article.title,
      content: article.htmlContent,
      excerpt: article.metaDesc,
      slug: article.slug,
      status: postStatus || "draft",
      // Inject meta tags for Yoast SEO and Rank Math (both covered)
      meta: {
        _yoast_wpseo_title: article.title,
        _yoast_wpseo_metadesc: article.metaDesc,
        rank_math_title: article.title,
        rank_math_description: article.metaDesc,
        _yoast_wpseo_focuskw: article.keyword,
      }
    }
  );
}

// ─── Ping Google & Bing sitemaps ──────────────────────────────────────────────
async function pingSearchEngines(siteUrl) {
  const sitemap = encodeURIComponent(`${siteUrl}/sitemap.xml`);
  const sitemapIndex = encodeURIComponent(`${siteUrl}/sitemap_index.xml`);
  const pings = [
    { host: "www.google.com",  path: `/ping?sitemap=${sitemap}` },
    { host: "www.google.com",  path: `/ping?sitemap=${sitemapIndex}` },
    { host: "www.bing.com",    path: `/ping?sitemap=${sitemap}` },
  ];
  const results = await Promise.allSettled(pings.map(({ host, path }) => httpsGet(host, path, { "User-Agent": "ZenLine-SEO-Bot/1.0" })));
  const pinged = results.filter(r => r.status === "fulfilled").length;
  return `Pinged ${pinged}/${pings.length} search engines`;
}

// ─── Google Indexing API (if service key provided) ────────────────────────────
async function notifyGoogleIndexing(serviceKeyJson, postUrl) {
  try {
    const key = JSON.parse(serviceKeyJson);
    // Build JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600, iat: now,
    })).toString("base64url");
    // Note: Full RS256 signing requires crypto module — skipping if not available
    // This is a placeholder — full implementation needs node:crypto
    return "Google Indexing API: service key detected but RS256 signing not implemented in this build";
  } catch { return "Google Indexing API: skipped (invalid service key)"; }
}

// ─── Keyword seed list ────────────────────────────────────────────────────────
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
  const raw = await callClaude(anthropicKey,
    "You are a professional SEO content writer specialising in fitness, activewear, and the UAE market. Write engaging, well-structured articles that rank on Google AND genuinely help readers. THUGFIT brand voice: premium, motivational, confident.",
    `Write a complete SEO-optimised blog article for THUGFIT (premium UAE activewear brand, thugfit.ae, Dubai).

Target keyword: "${keyword}"
Word count: 1200–1500 words
Audience: UAE fitness enthusiasts aged 18-35

REQUIRED FORMAT:
SEO_TITLE: [max 60 chars, include keyword, end with | THUGFIT]
META_DESC: [max 155 chars, include keyword, clear value prop]
SLUG: [kebab-case-slug]

---ARTICLE---

# [H1 headline]

[Intro paragraph — include keyword in first 100 words]

## [H2]
[Body 200-250 words]

## [H2]
[Body 200-250 words]

## [H2]
[Body 200-250 words]

## [H2]
[Body 200-250 words]

## Frequently Asked Questions

**Q: [relevant question]**
A: [2-3 sentence answer]

**Q: [relevant question]**
A: [answer]

**Q: [relevant question]**
A: [answer]

## Final Thoughts

[Closing 100-150 words with natural THUGFIT mention and CTA]`
  );

  const get = (key) => { const m = raw.match(new RegExp(`${key}:\\s*(.+)`)); return m ? m[1].trim() : ""; };
  const contentStart = raw.indexOf("---ARTICLE---");
  const bodyMd = contentStart > -1 ? raw.slice(contentStart + 13).trim() : raw;

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
    title:       get("SEO_TITLE") || `${keyword} | THUGFIT`,
    metaDesc:    get("META_DESC"),
    slug:        get("SLUG") || keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    keyword,
    htmlContent,
  };
}

// ─── Activity logger ──────────────────────────────────────────────────────────
async function log(key, entry) {
  return sbPost("/rest/v1/seo_activity_log", entry, key).catch(() => {});
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const cronSecret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.authorization || "";
  const isManual = cronSecret ? authHeader === `Bearer ${cronSecret}` : true;
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

    if (!config) return res.status(200).json({ skipped: true, reason: "No SEO automation config found." });
    if (!config.is_enabled) return res.status(200).json({ skipped: true, reason: "Automation is paused." });
    if (!config.wp_username || !config.wp_app_password) {
      await log(supaKey, { action: "error", status: "failed", error: "WordPress credentials not configured" });
      return res.status(200).json({ skipped: true, reason: "WordPress credentials missing." });
    }

    // 2. Pick keyword
    const queue = await sbGet("/rest/v1/seo_keyword_queue?used=eq.false&order=priority.desc,created_at.asc&limit=1", supaKey);
    let keyword, kwId;
    if (queue.length > 0) { keyword = queue[0].keyword; kwId = queue[0].id; }
    else {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      keyword = SEED_KEYWORDS[dayOfYear % SEED_KEYWORDS.length];
    }

    // 3. Generate article
    const article = await generateArticle(anthropicKey, keyword);

    // 4. Publish to WordPress (with Yoast + Rank Math meta tags injected)
    const siteUrl = config.wp_url || "https://thugfit.ae";
    const wpResult = await publishToWordPress(siteUrl, config.wp_username, config.wp_app_password, article, config.post_status || "draft");

    const success = wpResult.status === 201;
    const wpPostId = wpResult.body?.id;
    const wpPostUrl = wpResult.body?.link || wpResult.body?.guid?.rendered;

    // 5. Ping Google + Bing sitemap (regardless of draft/live status)
    const pingResult = await pingSearchEngines(siteUrl);

    // 6. Mark keyword used
    if (kwId) await sbPatch(`/rest/v1/seo_keyword_queue?id=eq.${kwId}`, { used: true, used_at: new Date().toISOString() }, supaKey);

    // 7. Log activity
    await log(supaKey, {
      action: "blog_published",
      title: article.title,
      keyword,
      status: success ? (config.post_status === "publish" ? "published" : "saved as draft") : "failed",
      wp_post_id: wpPostId || null,
      wp_post_url: wpPostUrl || null,
      error: success ? null : `WP ${wpResult.status}: ${JSON.stringify(wpResult.body).slice(0, 200)}`,
    });

    // 8. Update last_run
    await sbPatch("/rest/v1/seo_automation?limit=1", { last_run: new Date().toISOString() }, supaKey);

    return res.status(200).json({ success, keyword, title: article.title, wpPostId, wpPostUrl, pingResult });

  } catch (err) {
    await log(supaKey, { action: "error", status: "failed", error: err.message }).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
