// api/seo-cron.js
// Autonomous SEO Agent — runs daily at 9 AM UAE time (5 AM UTC)
// Configure: "crons": [{"path": "/api/seo-cron", "schedule": "0 5 * * *"}]

import https from "https";

const SUPABASE_URL = "https://ioniqxioapcdgenpksex.supabase.co";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
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
const httpsGet   = (h, p, hd)    => httpsRequest("GET",   h, p, hd, null);
const httpsPost  = (h, p, hd, b) => httpsRequest("POST",  h, p, hd, b);
const httpsPatch = (h, p, hd, b) => httpsRequest("PATCH", h, p, hd, b);
const httpsPut   = (h, p, hd, b) => httpsRequest("PUT",   h, p, hd, b);

// ─── Supabase ─────────────────────────────────────────────────────────────────
const sbH = k => ({ "Content-Type": "application/json", apikey: k, Authorization: `Bearer ${k}`, Prefer: "return=representation" });
const sbGet   = async (path, k) => { const u = new URL(SUPABASE_URL + path); const r = await httpsGet(u.hostname, u.pathname + u.search, sbH(k)); return Array.isArray(r.body) ? r.body : []; };
const sbPost  = async (path, b, k) => { const u = new URL(SUPABASE_URL + path); return httpsPost(u.hostname, u.pathname + u.search, sbH(k), b); };
const sbPatch = async (path, b, k) => { const u = new URL(SUPABASE_URL + path); return httpsPatch(u.hostname, u.pathname + u.search, sbH(k), b); };

// ─── Claude ───────────────────────────────────────────────────────────────────
async function callClaude(apiKey, system, prompt, maxTokens = 3500) {
  const r = await httpsPost("api.anthropic.com", "/v1/messages",
    { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }
  );
  if (r.status !== 200) throw new Error(`Claude ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body.content[0].text;
}

// ─── WordPress helpers ────────────────────────────────────────────────────────
function wpHeaders(user, pass) {
  return { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` };
}
async function wpGet(siteUrl, endpoint, user, pass) {
  const u = new URL(`${siteUrl}/wp-json/${endpoint}`);
  return httpsGet(u.hostname, u.pathname + u.search, wpHeaders(user, pass));
}
async function wpPost(siteUrl, endpoint, body, user, pass) {
  const u = new URL(`${siteUrl}/wp-json/${endpoint}`);
  return httpsPost(u.hostname, u.pathname, wpHeaders(user, pass), body);
}
async function wpPatch(siteUrl, endpoint, body, user, pass) {
  const u = new URL(`${siteUrl}/wp-json/${endpoint}`);
  return httpsPatch(u.hostname, u.pathname, wpHeaders(user, pass), body);
}
async function wpPut(siteUrl, endpoint, body, user, pass) {
  const u = new URL(`${siteUrl}/wp-json/${endpoint}`);
  return httpsPut(u.hostname, u.pathname, wpHeaders(user, pass), body);
}

// ─── Seed keywords ────────────────────────────────────────────────────────────
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

// ─── Generate article ─────────────────────────────────────────────────────────
async function generateArticle(apiKey, keyword, productLinks) {
  // Build internal links block to inject naturally into article
  const linksContext = productLinks.length > 0
    ? `\nNaturally link to these THUGFIT product pages within the article body (use proper anchor text, 2-3 links max):\n${productLinks.map(p => `- ${p.name}: ${p.link}`).join("\n")}`
    : "";

  const raw = await callClaude(apiKey,
    "You are a professional SEO content writer for fitness and UAE market. THUGFIT brand voice: premium, motivational, confident. Write articles that rank on Google AND help readers.",
    `Write a complete SEO-optimised blog article for THUGFIT (premium UAE activewear, thugfit.ae, Dubai).

Target keyword: "${keyword}"
Length: 1200–1500 words
Audience: UAE fitness enthusiasts 18-35${linksContext}

FORMAT (follow exactly):
SEO_TITLE: [max 60 chars, keyword included, ends with | THUGFIT]
META_DESC: [max 155 chars, keyword + UAE + value prop]
SLUG: [kebab-case]
FOCUS_KEYWORD: ${keyword}

---ARTICLE---
# [H1 — punchy headline different from SEO title]

[Intro — keyword in first 100 words]

## [H2]
[~250 words]

## [H2]
[~250 words]

## [H2]
[~250 words]

## [H2]
[~250 words]

## Frequently Asked Questions

**Q: [relevant FAQ]**
A: [2-3 sentences]

**Q: [relevant FAQ]**
A: [answer]

**Q: [relevant FAQ]**
A: [answer]

## Final Thoughts
[100-150 words, natural THUGFIT mention, link to thugfit.ae, motivational CTA]`
  );

  const get = key => { const m = raw.match(new RegExp(`${key}:\\s*(.+)`)); return m ? m[1].trim() : ""; };
  const bodyStart = raw.indexOf("---ARTICLE---");
  const bodyMd = bodyStart > -1 ? raw.slice(bodyStart + 13).trim() : raw;

  const htmlContent = bodyMd
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .split("\n\n").map(p => p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("<ol") ? p : `<p>${p}</p>`).join("\n");

  return {
    title:    get("SEO_TITLE") || `${keyword} | THUGFIT`,
    metaDesc: get("META_DESC"),
    slug:     get("SLUG") || keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    keyword,
    htmlContent,
  };
}

// ─── Publish to WordPress ─────────────────────────────────────────────────────
async function publishToWordPress(config, article) {
  const { wp_url: siteUrl, wp_username: user, wp_app_password: pass, post_status } = config;
  return wpPost(siteUrl, "wp/v2/posts", {
    title: article.title,
    content: article.htmlContent,
    excerpt: article.metaDesc,
    slug: article.slug,
    status: post_status || "draft",
    meta: {
      _yoast_wpseo_title: article.title,
      _yoast_wpseo_metadesc: article.metaDesc,
      _yoast_wpseo_focuskw: article.keyword,
      rank_math_title: article.title,
      rank_math_description: article.metaDesc,
      rank_math_focus_keyword: article.keyword,
    }
  }, user, pass);
}

// ─── Ping search engines ──────────────────────────────────────────────────────
async function pingSearchEngines(siteUrl) {
  const sm  = encodeURIComponent(`${siteUrl}/sitemap.xml`);
  const smi = encodeURIComponent(`${siteUrl}/sitemap_index.xml`);
  const pings = [
    { h: "www.google.com", p: `/ping?sitemap=${sm}` },
    { h: "www.google.com", p: `/ping?sitemap=${smi}` },
    { h: "www.bing.com",   p: `/ping?sitemap=${sm}` },
  ];
  const res = await Promise.allSettled(pings.map(({h, p}) => httpsGet(h, p, { "User-Agent": "ZenLine-SEO/1.0" })));
  return `Pinged ${res.filter(r => r.status === "fulfilled").length}/${pings.length} search engines`;
}

// ─── Google Indexing API ──────────────────────────────────────────────────────
async function submitToGoogleIndexing(serviceKeyJson, postUrl) {
  try {
    const key = typeof serviceKeyJson === "string" ? JSON.parse(serviceKeyJson) : serviceKeyJson;
    if (!key.private_key || !key.client_email) return "Indexing API: invalid key format";

    // Create JWT
    const { createSign } = await import("node:crypto");
    const now = Math.floor(Date.now() / 1000);
    const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email, scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now,
    })).toString("base64url");
    const sigInput = `${header}.${payload}`;
    const sign = createSign("RSA-SHA256");
    sign.update(sigInput);
    const sig = sign.sign(key.private_key, "base64url");
    const jwt = `${sigInput}.${sig}`;

    // Exchange JWT for access token
    const tokenRes = await httpsPost("oauth2.googleapis.com", "/token",
      { "Content-Type": "application/x-www-form-urlencoded" },
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    );
    if (!tokenRes.body?.access_token) return "Indexing API: could not get access token";

    // Submit URL
    const idxRes = await httpsPost("indexing.googleapis.com", "/v3/urlNotifications:publish",
      { "Content-Type": "application/json", Authorization: `Bearer ${tokenRes.body.access_token}` },
      { url: postUrl, type: "URL_UPDATED" }
    );
    return idxRes.status === 200 ? `✓ Submitted to Google Indexing API: ${postUrl}` : `Indexing API: ${idxRes.status}`;
  } catch (e) { return `Indexing API error: ${e.message}`; }
}

// ─── Fetch product links for internal linking ─────────────────────────────────
async function getProductLinks(config) {
  try {
    const r = await wpGet(config.wp_url, "wc/v3/products?per_page=15&status=publish", config.wp_username, config.wp_app_password);
    if (!Array.isArray(r.body)) return [];
    return r.body.map(p => ({ name: p.name, link: p.permalink || `${config.wp_url}/product/${p.slug}` })).filter(p => p.link);
  } catch { return []; }
}

// ─── Apply image alt tags to all products ────────────────────────────────────
async function applyImageAltTags(config, apiKey) {
  const results = [];
  try {
    const r = await wpGet(config.wp_url, "wc/v3/products?per_page=20&status=publish", config.wp_username, config.wp_app_password);
    if (!Array.isArray(r.body)) return ["Could not fetch products for alt tag update"];

    for (const product of r.body.slice(0, 10)) {
      if (!product.images || product.images.length === 0) continue;
      const hasAlt = product.images.every(img => img.alt && img.alt.trim().length > 0);
      if (hasAlt) { results.push(`${product.name}: already has alt tags`); continue; }

      const altText = await callClaude(apiKey,
        "Write concise, SEO-optimised image alt text for UAE e-commerce product images.",
        `Product: "${product.name}" — THUGFIT UAE activewear brand.
Write ${product.images.length} alt text(s), one per line, max 120 chars each. Include product name and UAE where natural. Return ONLY the alt texts, one per line, no numbering.`,
        300
      );
      const alts = altText.trim().split("\n").filter(Boolean);
      const updatedImages = product.images.map((img, i) => ({ ...img, alt: alts[i] || `${product.name} - THUGFIT UAE activewear` }));

      await wpPut(config.wp_url, `wc/v3/products/${product.id}`, { images: updatedImages }, config.wp_username, config.wp_app_password);
      results.push(`${product.name}: ✓ alt tags applied`);
    }
  } catch (e) { results.push(`Alt tag error: ${e.message}`); }
  return results;
}

// ─── Inject schema markup ─────────────────────────────────────────────────────
async function injectSchemaMarkup(config) {
  const results = [];
  try {
    const r = await wpGet(config.wp_url, "wc/v3/products?per_page=20&status=publish", config.wp_username, config.wp_app_password);
    if (!Array.isArray(r.body)) return ["Could not fetch products for schema"];

    for (const product of r.body.slice(0, 10)) {
      const schema = JSON.stringify({
        "@context": "https://schema.org/",
        "@type": "Product",
        name: product.name,
        description: product.description?.replace(/<[^>]*>/g, "").slice(0, 300) || product.name,
        brand: { "@type": "Brand", name: "THUGFIT" },
        offers: {
          "@type": "Offer",
          url: product.permalink || `${config.wp_url}/product/${product.slug}`,
          priceCurrency: "AED",
          price: product.price || "0",
          availability: product.stock_status === "instock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: "THUGFIT" }
        },
        image: product.images?.[0]?.src || "",
      });

      const schemaScript = `\n<!-- THUGFIT Schema -->\n<script type="application/ld+json">${schema}</script>`;
      const currentContent = product.description || "";
      if (!currentContent.includes("application/ld+json")) {
        await wpPut(config.wp_url, `wc/v3/products/${product.id}`,
          { description: currentContent + schemaScript },
          config.wp_username, config.wp_app_password
        );
        results.push(`${product.name}: ✓ schema applied`);
      } else {
        results.push(`${product.name}: schema already present`);
      }
    }
  } catch (e) { results.push(`Schema error: ${e.message}`); }
  return results;
}

// ─── Broken link checker ──────────────────────────────────────────────────────
async function checkBrokenLinks(config) {
  const broken = [];
  try {
    const r = await wpGet(config.wp_url, "wp/v2/posts?per_page=10&status=publish", config.wp_username, config.wp_app_password);
    if (!Array.isArray(r.body)) return [];
    for (const post of r.body) {
      const links = [...(post.content?.rendered || "").matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
      for (const link of links.slice(0, 5)) {
        try {
          const u = new URL(link);
          const res = await httpsGet(u.hostname, u.pathname + u.search, { "User-Agent": "ZenLine-SEO/1.0" });
          if (res.status === 404 || res.status === 410) broken.push({ post: post.title?.rendered, link, status: res.status });
        } catch { broken.push({ post: post.title?.rendered, link, status: "unreachable" }); }
      }
    }
  } catch (e) { /* silent */ }
  return broken;
}

// ─── Log ─────────────────────────────────────────────────────────────────────
const logActivity = (k, e) => sbPost("/rest/v1/seo_activity_log", e, k).catch(() => {});

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const isManual = secret ? auth === `Bearer ${secret}` : true;

  if (!isVercelCron && !isManual && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supaKey    = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  if (!supaKey || !anthropicKey) return res.status(500).json({ error: "Missing env vars" });

  const report = {};

  try {
    // 1. Load config
    const configs = await sbGet("/rest/v1/seo_automation?limit=1", supaKey);
    const config = configs[0];
    if (!config) return res.status(200).json({ skipped: true, reason: "No config" });
    if (!config.is_enabled) return res.status(200).json({ skipped: true, reason: "Automation paused" });
    if (!config.wp_username || !config.wp_app_password) {
      await logActivity(supaKey, { action: "error", status: "failed", error: "WordPress credentials missing" });
      return res.status(200).json({ skipped: true, reason: "WordPress credentials missing" });
    }

    // 2. Pick keyword
    const queue = await sbGet("/rest/v1/seo_keyword_queue?used=eq.false&order=priority.desc,created_at.asc&limit=1", supaKey);
    let keyword, kwId;
    if (queue.length > 0) { keyword = queue[0].keyword; kwId = queue[0].id; }
    else { const d = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000); keyword = SEED_KEYWORDS[d % SEED_KEYWORDS.length]; }

    // 3. Get product links for internal linking
    const productLinks = await getProductLinks(config);
    report.internalLinks = `${productLinks.length} product links available for internal linking`;

    // 4. Generate article (with internal links woven in)
    const article = await generateArticle(anthropicKey, keyword, productLinks.slice(0, 5));

    // 5. Publish to WordPress (with Yoast + Rank Math meta injected)
    const wpResult = await publishToWordPress(config, article);
    const success  = wpResult.status === 201;
    const wpPostId  = wpResult.body?.id;
    const wpPostUrl = wpResult.body?.link || wpResult.body?.guid?.rendered;
    report.published = success;

    // 6. Ping Google + Bing
    report.ping = await pingSearchEngines(config.wp_url || "https://thugfit.ae");

    // 7. Google Indexing API (if service key configured)
    if (config.google_indexing_key && wpPostUrl) {
      report.indexing = await submitToGoogleIndexing(config.google_indexing_key, wpPostUrl);
    }

    // 8. Mark keyword used
    if (kwId) await sbPatch(`/rest/v1/seo_keyword_queue?id=eq.${kwId}`, { used: true, used_at: new Date().toISOString() }, supaKey);

    // 9. Log main activity
    await logActivity(supaKey, {
      action: "blog_published", title: article.title, keyword,
      status: success ? (config.post_status === "publish" ? "published" : "saved as draft") : "failed",
      wp_post_id: wpPostId || null, wp_post_url: wpPostUrl || null,
      error: success ? null : `WP ${wpResult.status}: ${JSON.stringify(wpResult.body).slice(0, 200)}`,
    });

    // 10. Update last_run
    await sbPatch("/rest/v1/seo_automation?limit=1", { last_run: new Date().toISOString() }, supaKey);

    // 11. Weekly tasks (runs on Monday = day 1)
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 1) {
      // Broken link check
      const broken = await checkBrokenLinks(config);
      if (broken.length > 0) {
        await logActivity(supaKey, { action: "broken_links", status: broken.length > 0 ? "issues_found" : "ok", error: JSON.stringify(broken).slice(0, 500) });
      }
      report.brokenLinks = `${broken.length} broken links found`;
    }

    // 12. Monthly tasks (runs on 1st of month)
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth === 1) {
      // Image alt tags
      const altResults = await applyImageAltTags(config, anthropicKey);
      await logActivity(supaKey, { action: "alt_tags", status: "completed", error: altResults.join(" | ").slice(0, 500) });
      report.altTags = altResults;

      // Schema markup
      const schemaResults = await injectSchemaMarkup(config);
      await logActivity(supaKey, { action: "schema_markup", status: "completed", error: schemaResults.join(" | ").slice(0, 500) });
      report.schema = schemaResults;
    }

    return res.status(200).json({ success, keyword, title: article.title, wpPostId, wpPostUrl, report });

  } catch (err) {
    await logActivity(supaKey, { action: "error", status: "failed", error: err.message }).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
