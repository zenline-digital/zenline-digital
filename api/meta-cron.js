// api/meta-cron.js
// Runs every hour — auto-publishes scheduled posts to Instagram + Facebook
// vercel.json cron: { "path": "/api/meta-cron", "schedule": "0 * * * *" }

import https from "https";

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const IG_ID    = "17841454838884090";
const FB_PAGE  = "1178919721975130";

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
const httpsGet  = (h, p, hd)    => httpsRequest("GET",  h, p, hd, null);
const httpsPost = (h, p, hd, b) => httpsRequest("POST", h, p, hd, b);

function sbH(k) {
  return { "Content-Type": "application/json", apikey: k, Authorization: `Bearer ${k}`, Prefer: "return=representation" };
}
async function sbGet(path, key) {
  const u = new URL(SUPA_URL + path);
  const r = await httpsGet(u.hostname, u.pathname + u.search, sbH(key));
  return Array.isArray(r.body) ? r.body : [];
}
async function sbPatch(path, body, key) {
  const u = new URL(SUPA_URL + path);
  return httpsRequest("PATCH", u.hostname, u.pathname + u.search, sbH(key), body);
}
async function sbPost(path, body, key) {
  const u = new URL(SUPA_URL + path);
  return httpsPost(u.hostname, u.pathname + u.search, sbH(key), body);
}

async function uploadImage(base64DataUrl, postId, key) {
  try {
    const m = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) return null;
    const [, mimeType, b64] = m;
    const buffer = Buffer.from(b64, "base64");
    const filename = `post-${postId}-${Date.now()}.jpg`;
    const u = new URL(`${SUPA_URL}/storage/v1/object/post-images/${filename}`);
    const r = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: u.hostname, path: u.pathname, method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": mimeType, "Content-Length": buffer.length, "x-upsert": "true" }
      }, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => resolve({ status: res.statusCode }));
      });
      req.on("error", reject); req.write(buffer); req.end();
    });
    return (r.status === 200 || r.status === 201)
      ? `${SUPA_URL}/storage/v1/object/public/post-images/${filename}`
      : null;
  } catch { return null; }
}

async function resolveImage(imageUrl, postId, key) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) return imageUrl;
  if (imageUrl.startsWith("data:image/")) return await uploadImage(imageUrl, postId, key);
  return null;
}

async function postInstagram(token, imageUrl, caption) {
  try {
    const params = new URLSearchParams({ image_url: imageUrl, caption: caption || "", media_type: "IMAGE", access_token: token });
    const createResp = await httpsPost("graph.facebook.com", `/${IG_ID}/media?${params}`, { "Content-Type": "application/json" }, {});
    if (!createResp.body?.id) return { published: false, error: JSON.stringify(createResp.body).slice(0, 200) };
    await new Promise(r => setTimeout(r, 3000));
    const pubParams = new URLSearchParams({ creation_id: createResp.body.id, access_token: token });
    const pubResp = await httpsPost("graph.facebook.com", `/${IG_ID}/media_publish?${pubParams}`, { "Content-Type": "application/json" }, {});
    return pubResp.body?.id
      ? { published: true, igPostId: pubResp.body.id }
      : { published: false, error: JSON.stringify(pubResp.body).slice(0, 200) };
  } catch (e) { return { published: false, error: e.message }; }
}

async function postFacebook(token, imageUrl, message) {
  try {
    const params = new URLSearchParams({ message, access_token: token });
    if (imageUrl) params.set("url", imageUrl);
    const endpoint = imageUrl ? `/${FB_PAGE}/photos` : `/${FB_PAGE}/feed`;
    const bodyStr  = params.toString();
    const resp = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "graph.facebook.com", path: endpoint, method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(bodyStr) }
      }, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => { try { resolve({ body: JSON.parse(d) }); } catch { resolve({ body: d }); } });
      });
      req.on("error", reject); req.write(bodyStr); req.end();
    });
    return resp.body?.id || resp.body?.post_id
      ? { posted: true, fbPostId: resp.body.id || resp.body.post_id }
      : { posted: false, error: JSON.stringify(resp.body).slice(0, 200) };
  } catch (e) { return { posted: false, error: e.message }; }
}

export default async function handler(req, res) {
  // Allow Vercel cron or manual trigger
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const secret = process.env.CRON_SECRET || "";
  const auth   = (req.headers.authorization || "").replace("Bearer ", "");
  if (!isVercelCron && secret && auth !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supaKey) return res.status(500).json({ error: "Supabase key not configured" });

  const report = { checked: 0, published: 0, failed: 0, skipped: 0, errors: [] };
  const now    = new Date().toISOString();

  try {
    // Load Meta token
    const configs = await sbGet(`/rest/v1/meta_config?page_id=eq.${FB_PAGE}&limit=1`, supaKey);
    const token   = configs[0]?.page_access_token;
    if (!token) return res.status(200).json({ skipped: true, reason: "Meta not connected — configure in Settings" });

    // Get all posts due now
    const duePosts = await sbGet(
      `/rest/v1/posts?status=eq.scheduled&scheduled_at=lte.${now}&select=*&limit=20`,
      supaKey
    );
    report.checked = duePosts.length;
    if (!duePosts.length) return res.status(200).json({ success: true, report, message: "No posts due" });

    for (const post of duePosts) {
      const caption  = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
      const message  = caption || post.topic || "THUGFIT";
      const imageUrl = await resolveImage(post.image_url, post.id, supaKey);

      const [igResult, fbResult] = await Promise.all([
        imageUrl ? postInstagram(token, imageUrl, caption) : Promise.resolve({ skipped: true }),
        postFacebook(token, imageUrl, message)
      ]);

      const success = (igResult.published || igResult.skipped) && fbResult.posted;
      if (success) {
        await sbPatch(`/rest/v1/posts?id=eq.${post.id}`, {
          status:       "published",
          published_at: new Date().toISOString(),
          meta_ig_id:   igResult.igPostId || null,
          meta_fb_id:   fbResult.fbPostId || null,
        }, supaKey);
        report.published++;
      } else {
        report.failed++;
        report.errors.push({ postId: post.id, ig: igResult.error, fb: fbResult.error });
      }

      // Log to activity log
      await sbPost("/rest/v1/seo_activity_log", {
        action: "auto_post", title: post.topic,
        status: success ? "published" : "failed",
        error:  JSON.stringify({ ig: igResult, fb: fbResult }).slice(0, 400)
      }, supaKey).catch(() => {});
    }

    return res.status(200).json({ success: true, report, checkedAt: now });
  } catch (e) {
    return res.status(500).json({ error: e.message, report });
  }
}
