// api/meta-exchange.js
// Exchanges a short-lived Graph API token for a permanent Page Access Token
// POST with { token: "short-lived-token" }

import https from "https";

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "GET", headers }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const SUPA_URL = "https://ioniqxioapcdgenpksex.supabase.co";

function sbH(k) {
  return { "Content-Type": "application/json", apikey: k, Authorization: `Bearer ${k}`, Prefer: "return=representation" };
}

async function sbPatch(path, body, key) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const url = new URL(SUPA_URL + path);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search,
      method: "PATCH",
      headers: { ...sbH(key), "Content-Length": Buffer.byteLength(bodyStr) }
    }, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const APP_ID = process.env.META_APP_ID || "";
  const APP_SECRET = process.env.META_APP_SECRET || "";
  const PAGE_ID = "1178919721975130";
  const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!APP_ID || !APP_SECRET) {
    return res.status(500).json({ error: "META_APP_ID and META_APP_SECRET env vars not set in Vercel" });
  }

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "token is required" });

  try {
    // Step 1: Exchange short-lived token → long-lived user token (60 days)
    const exchPath = `/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(token)}`;
    const exchResp = await httpsGet("graph.facebook.com", exchPath, {});
    if (!exchResp.body?.access_token) {
      return res.status(400).json({ error: "Token exchange failed", detail: exchResp.body });
    }
    const longLivedUserToken = exchResp.body.access_token;

    // Step 2: Get permanent Page Access Token from long-lived user token
    const pagePath = `/${PAGE_ID}?fields=access_token&access_token=${longLivedUserToken}`;
    const pageResp = await httpsGet("graph.facebook.com", pagePath, {});
    if (!pageResp.body?.access_token) {
      return res.status(400).json({ error: "Could not get Page token", detail: pageResp.body });
    }
    const permanentPageToken = pageResp.body.access_token;

    // Step 3: Save permanent token to Supabase meta_config
    if (supaKey) {
      await sbPatch(`/rest/v1/meta_config?page_id=eq.${PAGE_ID}`, {
        page_access_token: permanentPageToken,
        updated_at: new Date().toISOString()
      }, supaKey);
    }

    return res.status(200).json({
      success: true,
      message: "Permanent Page Access Token saved — never expires!",
      tokenPreview: permanentPageToken.slice(0, 20) + "..."
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
