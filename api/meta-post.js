// api/meta-post.js
// Posts content to Instagram and/or Facebook
// Called from App.jsx when user clicks "Post Now" or by cron for scheduled posts

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
const httpsGet  = (h, p, hd)    => httpsRequest("GET",   h, p, hd, null);
const httpsPost = (h, p, hd, b) => httpsRequest("POST",  h, p, hd, b);

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

// Upload base64 image to Supabase Storage, return public URL
async function uploadImageToStorage(base64DataUrl, filename, key) {
  try {
    // Strip data URL prefix: "data:image/jpeg;base64,..."
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    const storageUrl = new URL(`${SUPA_URL}/storage/v1/object/post-images/${filename}`);
    const uploadResp = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: storageUrl.hostname,
        path: storageUrl.pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": mimeType,
          "Content-Length": buffer.length,
          "x-upsert": "true"
        }
      }, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
      });
      req.on("error", reject);
      req.write(buffer);
      req.end();
    });

    if (uploadResp.status === 200 || uploadResp.status === 201) {
      return `${SUPA_URL}/storage/v1/object/public/post-images/${filename}`;
    }
    console.log("Storage upload failed:", uploadResp.status, uploadResp.body);
    return null;
  } catch (e) {
    console.log("Storage upload error:", e.message);
    return null;
  }
}

// Get a valid public image URL (upload to storage if needed)
async function resolveImageUrl(imageUrl, postId, supaKey) {
  if (!imageUrl) return null;
  // Already a valid public URL
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) return imageUrl;
  // Base64 data URL — upload to Supabase Storage
  if (imageUrl.startsWith("data:image/")) {
    const filename = `post-${postId}-${Date.now()}.jpg`;
    return await uploadImageToStorage(imageUrl, filename, supaKey);
  }
  return null;
}

// Post to Instagram (2-step: create container → publish)
async function postToInstagram(pageToken, imageUrl, caption) {
  const results = { created: false, published: false, error: null };
  try {
    // Step 1: Create media container
    const createPath = `/${IG_USER_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${pageToken}`;
    const createResp = await httpsPost("graph.facebook.com", createPath, { "Content-Type": "application/json" }, {});
    if (!createResp.body?.id) {
      results.error = `Container creation failed: ${JSON.stringify(createResp.body).slice(0, 200)}`;
      return results;
    }
    results.created = true;
    const containerId = createResp.body.id;

    // Wait 2 seconds for container to be ready
    await new Promise(r => setTimeout(r, 2000));

    // Step 2: Publish container
    const publishPath = `/${IG_USER_ID}/media_publish?creation_id=${containerId}&access_token=${pageToken}`;
    const publishResp = await httpsPost("graph.facebook.com", publishPath, { "Content-Type": "application/json" }, {});
    if (publishResp.body?.id) {
      results.published = true;
      results.igPostId = publishResp.body.id;
    } else {
      results.error = `Publish failed: ${JSON.stringify(publishResp.body).slice(0, 200)}`;
    }
  } catch (e) {
    results.error = e.message;
  }
  return results;
}

// Post to Facebook Page
async function postToFacebook(pageToken, imageUrl, message) {
  const results = { posted: false, error: null };
  try {
    let endpoint, body;
    if (imageUrl) {
      // Post with photo
      endpoint = `/${FB_PAGE_ID}/photos`;
      body = { url: imageUrl, message, published: true, access_token: pageToken };
    } else {
      // Text-only post
      endpoint = `/${FB_PAGE_ID}/feed`;
      body = { message, published: true, access_token: pageToken };
    }
    const bodyStr = new URLSearchParams(body).toString();
    const resp = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "graph.facebook.com",
        path: endpoint,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(bodyStr) }
      }, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
      });
      req.on("error", reject);
      req.write(bodyStr);
      req.end();
    });
    if (resp.body?.id || resp.body?.post_id) {
      results.posted = true;
      results.fbPostId = resp.body.id || resp.body.post_id;
    } else {
      results.error = `Facebook post failed: ${JSON.stringify(resp.body).slice(0, 200)}`;
    }
  } catch (e) {
    results.error = e.message;
  }
  return results;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supaKey) return res.status(500).json({ error: "Supabase key not configured" });

  const { postId, platforms = ["instagram", "facebook"] } = req.body || {};
  if (!postId) return res.status(400).json({ error: "postId is required" });

  try {
    // Load post from Supabase
    const posts = await sbGet(`/rest/v1/posts?id=eq.${postId}&select=*`, supaKey);
    if (!posts.length) return res.status(404).json({ error: "Post not found" });
    const post = posts[0];

    // Load meta_config
    const configs = await sbGet(`/rest/v1/meta_config?page_id=eq.${FB_PAGE_ID}&limit=1`, supaKey);
    const metaConfig = configs[0];
    if (!metaConfig?.page_access_token) {
      return res.status(400).json({ error: "Meta Page Access Token not configured — connect in Settings first" });
    }
    const pageToken = metaConfig.page_access_token;

    // Build caption/message
    const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
    const message = caption || post.topic || "THUGFIT";

    // Resolve image URL (upload to storage if base64)
    const imageUrl = await resolveImageUrl(post.image_url, postId, supaKey);

    const report = { postId, platforms, imageResolved: !!imageUrl };

    // Post to Instagram
    if (platforms.includes("instagram")) {
      if (imageUrl) {
        const igResult = await postToInstagram(pageToken, imageUrl, caption);
        report.instagram = igResult;
      } else {
        report.instagram = { skipped: true, reason: "No valid image URL — Instagram requires an image" };
      }
    }

    // Post to Facebook
    if (platforms.includes("facebook")) {
      const fbResult = await postToFacebook(pageToken, imageUrl, message);
      report.facebook = fbResult;
    }

    // Check overall success
    const igOk = !platforms.includes("instagram") || report.instagram?.published || report.instagram?.skipped;
    const fbOk = !platforms.includes("facebook") || report.facebook?.posted;
    const success = igOk && fbOk;

    // Update post status in Supabase
    if (success || report.facebook?.posted || report.instagram?.published) {
      await sbPatch(`/rest/v1/posts?id=eq.${postId}`, {
        status: "published",
        published_at: new Date().toISOString(),
        meta_ig_id: report.instagram?.igPostId || null,
        meta_fb_id: report.facebook?.fbPostId || null,
      }, supaKey);
    }

    // Log activity
    await sbPost("/rest/v1/seo_activity_log", {
      action: "meta_post",
      title: post.topic,
      status: success ? "published" : "partial",
      error: JSON.stringify(report).slice(0, 500)
    }, supaKey).catch(() => {});

    return res.status(200).json({ success, report });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
