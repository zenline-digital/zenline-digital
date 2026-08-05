// api/meta-post.js
// Posts to Instagram + Facebook when user clicks "Post Now"

import https from "https";

const SUPA_URL  = "https://ioniqxioapcdgenpksex.supabase.co";
const IG_ID     = "17841454838884090";
const FB_PAGE   = "1178919721975130";

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body
      ? (typeof body === "string" ? body : JSON.stringify(body))
      : null;
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
const httpsGet  = (h, p, hd)    => httpsRequest("GET",   h, p, hd, null);
const httpsPost = (h, p, hd, b) => httpsRequest("POST",  h, p, hd, b);

// ── Supabase helpers ──────────────────────────────────────────────────────────
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

// ── Upload base64 image to Supabase Storage ───────────────────────────────────
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
      req.on("error", reject);
      req.write(buffer);
      req.end();
    });
    if (r.status === 200 || r.status === 201) {
      return `${SUPA_URL}/storage/v1/object/public/post-images/${filename}`;
    }
    return null;
  } catch { return null; }
}

// ── Resolve image to a public https:// URL ────────────────────────────────────
async function resolveImage(imageUrl, postId, key) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) return imageUrl;
  if (imageUrl.startsWith("data:image/")) return await uploadImage(imageUrl, postId, key);
  return null;
}

// ── Post to Instagram (2-step: container → publish) ───────────────────────────
async function postInstagram(token, imageUrl, caption) {
  try {
    // Step 1 — create media container
    const params = new URLSearchParams({
      image_url:  imageUrl,
      caption:    caption || "",
      media_type: "IMAGE",
      access_token: token
    });
    const createResp = await httpsPost(
      "graph.facebook.com",
      `/${IG_ID}/media?${params.toString()}`,
      { "Content-Type": "application/json" },
      {}
    );
    if (!createResp.body?.id) {
      return { published: false, error: `Container error: ${JSON.stringify(createResp.body).slice(0, 300)}` };
    }
    const containerId = createResp.body.id;

    // Wait for container to process
    await new Promise(r => setTimeout(r, 3000));

    // Step 2 — publish
    const pubParams = new URLSearchParams({ creation_id: containerId, access_token: token });
    const pubResp = await httpsPost(
      "graph.facebook.com",
      `/${IG_ID}/media_publish?${pubParams.toString()}`,
      { "Content-Type": "application/json" },
      {}
    );
    if (pubResp.body?.id) {
      return { published: true, igPostId: pubResp.body.id };
    }
    return { published: false, error: `Publish error: ${JSON.stringify(pubResp.body).slice(0, 300)}` };
  } catch (e) {
    return { published: false, error: e.message };
  }
}

// ── Post to Facebook Page ─────────────────────────────────────────────────────
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
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, body: d }); }
        });
      });
      req.on("error", reject); req.write(bodyStr); req.end();
    });
    if (resp.body?.id || resp.body?.post_id) {
      return { posted: true, fbPostId: resp.body.id || resp.body.post_id };
    }
    return { posted: false, error: `FB error: ${JSON.stringify(resp.body).slice(0, 300)}` };
  } catch (e) {
    return { posted: false, error: e.message };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supaKey) return res.status(500).json({ error: "Supabase key not configured" });

  const { postId, platforms = ["instagram", "facebook"] } = req.body || {};
  if (!postId) return res.status(400).json({ error: "postId is required" });

  try {
    // Load post
    const posts = await sbGet(`/rest/v1/posts?id=eq.${postId}&select=*`, supaKey);
    if (!posts.length) return res.status(404).json({ error: "Post not found in database" });
    const post = posts[0];

    // Load Meta config
    const configs = await sbGet(`/rest/v1/meta_config?page_id=eq.${FB_PAGE}&limit=1`, supaKey);
    const token   = configs[0]?.page_access_token;
    if (!token) return res.status(400).json({ error: "Meta not connected — go to Settings and connect Meta first" });

    // Build content
    const caption  = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
    const message  = caption || post.topic || "THUGFIT";
    const imageUrl = await resolveImage(post.image_url, postId, supaKey);

    const report = { postId, platforms, imageResolved: !!imageUrl };

    // Post to Instagram
    if (platforms.includes("instagram")) {
      if (imageUrl) {
        report.instagram = await postInstagram(token, imageUrl, caption);
      } else {
        report.instagram = { skipped: true, reason: "No image — Instagram requires an image for feed posts" };
      }
    }

    // Post to Facebook
    if (platforms.includes("facebook")) {
      report.facebook = await postFacebook(token, imageUrl, message);
    }

    // Determine success
    const igOk = !platforms.includes("instagram") || report.instagram?.published || report.instagram?.skipped;
    const fbOk = !platforms.includes("facebook")  || report.facebook?.posted;
    const success = igOk && fbOk;

    // Update post in Supabase
    if (report.instagram?.published || report.facebook?.posted) {
      await sbPatch(`/rest/v1/posts?id=eq.${postId}`, {
        status:      "published",
        published_at: new Date().toISOString(),
        meta_ig_id:  report.instagram?.igPostId || null,
        meta_fb_id:  report.facebook?.fbPostId  || null,
      }, supaKey);
    }

    // Activity log
    await sbPost("/rest/v1/seo_activity_log", {
      action: "meta_post", title: post.topic,
      status: success ? "published" : "partial",
      error:  JSON.stringify(report).slice(0, 500)
    }, supaKey).catch(() => {});

    return res.status(200).json({ success, report });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
