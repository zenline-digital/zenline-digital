// api/meta-cron.js
// Runs every hour — auto-publishes scheduled posts to Instagram + Facebook
// Add to vercel.json: { "path": "/api/meta-cron", "schedule": "0 * * * *" }

import https from "https";

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";
const IG_USER_ID = "17841454838884090";
const FB_PAGE_ID = "1178919721975130";

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
const httpsGet  = (h, p, hd)    => httpsRequest("GET",  h, p, hd, null);
const httpsPost = (h, p, hd, b) => httpsRequest("POST", h, p, hd, b);

function sbH(k) {
  return { "Content-Type": "application/json", apikey: k, Authorization: `Bearer ${k}`, Prefer: "return=representation" };
}

async function sbGet(path, key) {
  const url = new URL(SUPA_URL + path);
  const r = await httpsGet(url.hostname, url.pathname + url.search, sbH(key));
  return Array.isArray(r.body) ? r.body : [];
}

async function sbPatch(path, body, key) {
  const url = new URL(SUPA_URL + path);
  return httpsRequest("PATCH", url.hostname, url.pathname + url.search, sbH(key), body);
}

async function sbPost(path, body, key) {
  const url = new URL(SUPA_URL + path);
  return httpsPost(url.hostname, url.pathname + url.search, sbH(key), body);
}

async function uploadImageToStorage(base64DataUrl, filename, key) {
  try {
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const storageUrl = new URL(`${SUPA_URL}/storage/v1/object/post-images/${filename}`);
    const r = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: storageUrl.hostname, path: storageUrl.pathname, method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": mimeType, "Content-Length": buffer.length, "x-upsert": "true" }
      }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve({ status: res.statusCode }); } catch { resolve({ status: res.statusCode }); } }); });
      req.on("error", reject); req.write(buffer); req.end();
    });
    if (r.status === 200 || r.status === 201) return `${SUPA_URL}/storage/v1/object/public/post-images/${filename}`;
    return null;
  } catch { return null; }
}

async function resolveImageUrl(imageUrl, postId, supaKey) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) return imageUrl;
  if (imageUrl.startsWith("data:image/")) return await uploadImageToStorage(imageUrl, `post-${postId}-${Date.now()}.jpg`, supaKey);
  return null;
}

async function postToInstagram(pageToken, imageUrl, caption) {
  try {
    const createPath = `/${IG_USER_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${pageToken}`;
    const createResp = await httpsPost("graph.facebook.com", createPath, { "Content-Type": "application/json" }, {});
    if (!createResp.body?.id) return { published: false, error: JSON.stringify(createResp.body).slice(0, 200) };
    await new Promise(r => setTimeout(r, 3000));
    const publishPath = `/${IG_USER_ID}/media_publish?creation_id=${createResp.body.id}&access_token=${pageToken}`;
    const publishResp = await httpsPost("graph.facebook.com", publishPath, { "Content-Type": "application/json" }, {});
    return publishResp.body?.id ? { published: true, igPostId: publishResp.body.id } : { published: false, error: JSON.stringify(publishResp.body).slice(0, 200) };
  } catch (e) { return { published: false, error: e.message }; }
}

async function postToFacebook(pageToken, imageUrl, message) {
  try {
    const endpoint = imageUrl ? `/${FB_PAGE_ID}/photos` : `/${FB_PAGE_ID}/feed`;
    const body = imageUrl
      ? { url: imageUrl, message, published: true, access_token: pageToken }
      : { message, published: true, access_token: pageToken };
    const bodyStr = new URLSearchParams(body).toString();
    const resp = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "graph.facebook.com", path: endpoint, method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(bodyStr) }
      }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
      req.on("error", reject); req.write(bodyStr); req.end();
    });
    return resp.body?.id || resp.body?.post_id ? { posted: true, fbPostId: resp.body.id || resp.body.post_id } : { posted: false, error: JSON.stringify(resp.body).slice(0, 200) };
  } catch (e) { return { posted: false, error: e.message }; }
}

export default async function handler(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const isManual = secret ? auth === `Bearer ${secret}` : true;
  if (!isVercelCron && !isManual && process.env.NODE_ENV !== "development")
    return res.status(401).json({ error: "Unauthorized" });

  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supaKey) return res.status(500).json({ error: "Supabase key not configured" });

  const now = new Date().toISOString();
  const report = { checked: 0, published: 0, failed: 0, skipped: 0 };

  try {
    // Get meta config
    const configs = await sbGet(`/rest/v1/meta_config?page_id=eq.${FB_PAGE_ID}&limit=1`, supaKey);
    const metaConfig = configs[0];
    if (!metaConfig?.page_access_token) {
      return res.status(200).json({ skipped: true, reason: "Meta not connected — configure in Settings" });
    }
    const pageToken = metaConfig.page_access_token;

    // Get all due scheduled posts
    const duePosts = await sbGet(
      `/rest/v1/posts?status=eq.scheduled&scheduled_at=lte.${now}&select=*&limit=20`,
      supaKey
    );
    report.checked = duePosts.length;

    for (const post of duePosts) {
      const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
      const imageUrl = await resolveImageUrl(post.image_url, post.id, supaKey);

      const igResult = imageUrl ? await postToInstagram(pageToken, imageUrl, caption) : { published: false, skipped: true };
      const fbResult = await postToFacebook(pageToken, imageUrl, caption || post.topic || "THUGFIT");

      const success = igResult.published || fbResult.posted;
      if (success) {
        await sbPatch(`/rest/v1/posts?id=eq.${post.id}`, {
          status: "published",
          published_at: new Date().toISOString(),
          meta_ig_id: igResult.igPostId || null,
          meta_fb_id: fbResult.fbPostId || null,
        }, supaKey);
        report.published++;
      } else {
        report.failed++;
      }

      await sbPost("/rest/v1/seo_activity_log", {
        action: "auto_post",
        title: post.topic,
        status: success ? "published" : "failed",
        error: JSON.stringify({ ig: igResult, fb: fbResult }).slice(0, 400)
      }, supaKey).catch(() => {});
    }

    return res.status(200).json({ success: true, report, checkedAt: now });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
