// api/seo-cron.js — Full SEO Automation Agent
// Runs daily 9 AM UAE (0 5 * * *)
// Weekly tasks: Monday | Monthly tasks: 1st of month

import https from "https";

const SUPABASE_URL = "https://ioniqxioapcdgenpksex.supabase.co";

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
const httpsGet   = (h,p,hd)    => httpsRequest("GET",   h,p,hd,null);
const httpsPost  = (h,p,hd,b)  => httpsRequest("POST",  h,p,hd,b);
const httpsPatch = (h,p,hd,b)  => httpsRequest("PATCH", h,p,hd,b);
const httpsPut   = (h,p,hd,b)  => httpsRequest("PUT",   h,p,hd,b);

// ─── Supabase ─────────────────────────────────────────────────────────────────
const sbH = k => ({ "Content-Type":"application/json", apikey:k, Authorization:`Bearer ${k}`, Prefer:"return=representation" });
const sbGet   = async(p,k) => { const u=new URL(SUPABASE_URL+p); const r=await httpsGet(u.hostname,u.pathname+u.search,sbH(k)); return Array.isArray(r.body)?r.body:[]; };
const sbPost  = async(p,b,k) => { const u=new URL(SUPABASE_URL+p); return httpsPost(u.hostname,u.pathname+u.search,sbH(k),b); };
const sbPatch = async(p,b,k) => { const u=new URL(SUPABASE_URL+p); return httpsPatch(u.hostname,u.pathname+u.search,sbH(k),b); };

// ─── Claude ───────────────────────────────────────────────────────────────────
async function callClaude(apiKey, system, prompt, maxTokens=3000) {
  const r = await httpsPost("api.anthropic.com","/v1/messages",
    {"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
    {model:"claude-sonnet-4-6",max_tokens:maxTokens,system,messages:[{role:"user",content:prompt}]}
  );
  if(r.status!==200) throw new Error(`Claude ${r.status}: ${JSON.stringify(r.body).slice(0,200)}`);
  return r.body.content[0].text;
}

// ─── WordPress ────────────────────────────────────────────────────────────────
const wpH = (u,p) => ({"Content-Type":"application/json",Authorization:`Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`});
const wpGet  = (site,ep,u,p) => { const url=new URL(`${site}/wp-json/${ep}`); return httpsGet(url.hostname,url.pathname+url.search,wpH(u,p)); };
const wpPost = (site,ep,b,u,p) => { const url=new URL(`${site}/wp-json/${ep}`); return httpsPost(url.hostname,url.pathname,wpH(u,p),b); };
const wpPut  = (site,ep,b,u,p) => { const url=new URL(`${site}/wp-json/${ep}`); return httpsPut(url.hostname,url.pathname,wpH(u,p),b); };

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

const UAE_COMPETITORS = [
  "https://www.gymshark.com","https://www.fabletics.com",
  "https://www.lululemon.com","https://www.nike.com/ae",
  "https://www.adidas.ae","https://www.underarmour.com",
];

const logActivity = (k,e) => sbPost("/rest/v1/seo_activity_log",e,k).catch(()=>{});
const addStaffTask = (k,t) => sbPost("/rest/v1/seo_staff_tasks",t,k).catch(()=>{});

// ─── Generate article ─────────────────────────────────────────────────────────
async function generateArticle(apiKey, keyword, productLinks=[]) {
  const linksCtx = productLinks.length>0
    ? `\nNaturally link to 2-3 of these THUGFIT products within the article:\n${productLinks.map(p=>`- ${p.name}: ${p.link}`).join("\n")}`
    : "";
  const raw = await callClaude(apiKey,
    "Professional SEO writer for UAE fitness market. THUGFIT brand: premium, motivational, confident.",
    `Write a complete SEO blog article for THUGFIT (thugfit.ae, premium UAE activewear, Dubai).
Target keyword: "${keyword}" | Length: 1200-1500 words | Audience: UAE fitness enthusiasts 18-35${linksCtx}

FORMAT:
SEO_TITLE: [max 60 chars, keyword, ends | THUGFIT]
META_DESC: [max 155 chars, keyword + UAE + value]
SLUG: [kebab-case]

---ARTICLE---
# [H1]
[Intro - keyword in first 100 words]
## [H2]
[~250 words]
## [H2]
[~250 words]
## [H2]
[~250 words]
## [H2]
[~250 words]
## Frequently Asked Questions
**Q: [question]**
A: [answer]
**Q: [question]**
A: [answer]
## Final Thoughts
[100-150 words, THUGFIT mention, link to thugfit.ae]`
  );
  const get = k => { const m=raw.match(new RegExp(`${k}:\\s*(.+)`)); return m?m[1].trim():""; };
  const start = raw.indexOf("---ARTICLE---");
  const md = start>-1 ? raw.slice(start+13).trim() : raw;
  const html = md
    .replace(/^# (.+)$/gm,"<h1>$1</h1>").replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>')
    .split("\n\n").map(p=>p.startsWith("<h")?p:`<p>${p}</p>`).join("\n");
  return {
    title: get("SEO_TITLE")||`${keyword} | THUGFIT`,
    metaDesc: get("META_DESC"),
    slug: get("SLUG")||keyword.toLowerCase().replace(/[^a-z0-9]+/g,"-"),
    keyword, htmlContent: html,
  };
}

// ─── Publish to WordPress ─────────────────────────────────────────────────────
async function publishArticle(config, article) {
  return wpPost(config.wp_url,"wp/v2/posts",{
    title:article.title, content:article.htmlContent, excerpt:article.metaDesc,
    slug:article.slug, status:config.post_status||"draft",
    meta:{
      _yoast_wpseo_title:article.title, _yoast_wpseo_metadesc:article.metaDesc,
      _yoast_wpseo_focuskw:article.keyword,
      rank_math_title:article.title, rank_math_description:article.metaDesc,
      rank_math_focus_keyword:article.keyword,
    }
  },config.wp_username,config.wp_app_password);
}

// ─── Ping search engines ──────────────────────────────────────────────────────
async function pingSearchEngines(siteUrl) {
  const sm=encodeURIComponent(`${siteUrl}/sitemap.xml`);
  const smi=encodeURIComponent(`${siteUrl}/sitemap_index.xml`);
  const results = await Promise.allSettled([
    httpsGet("www.google.com",`/ping?sitemap=${sm}`,{"User-Agent":"ZenLine-SEO/1.0"}),
    httpsGet("www.google.com",`/ping?sitemap=${smi}`,{"User-Agent":"ZenLine-SEO/1.0"}),
    httpsGet("www.bing.com",`/ping?sitemap=${sm}`,{"User-Agent":"ZenLine-SEO/1.0"}),
  ]);
  return `Pinged ${results.filter(r=>r.status==="fulfilled").length}/3 search engines`;
}

// ─── Google Indexing API ──────────────────────────────────────────────────────
async function submitGoogleIndexing(serviceKeyJson, postUrl) {
  try {
    const key = typeof serviceKeyJson==="string" ? JSON.parse(serviceKeyJson) : serviceKeyJson;
    if(!key.private_key||!key.client_email) return "Indexing API: invalid key";
    const {createSign} = await import("node:crypto");
    const now=Math.floor(Date.now()/1000);
    const hdr=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT"})).toString("base64url");
    const pay=Buffer.from(JSON.stringify({iss:key.client_email,scope:"https://www.googleapis.com/auth/indexing",aud:"https://oauth2.googleapis.com/token",exp:now+3600,iat:now})).toString("base64url");
    const sign=createSign("RSA-SHA256"); sign.update(`${hdr}.${pay}`);
    const jwt=`${hdr}.${pay}.${sign.sign(key.private_key,"base64url")}`;
    const tok=await httpsPost("oauth2.googleapis.com","/token",{"Content-Type":"application/x-www-form-urlencoded"},`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`);
    if(!tok.body?.access_token) return "Indexing API: no token";
    const res=await httpsPost("indexing.googleapis.com","/v3/urlNotifications:publish",{"Content-Type":"application/json",Authorization:`Bearer ${tok.body.access_token}`},{url:postUrl,type:"URL_UPDATED"});
    return res.status===200 ? `Submitted to Google: ${postUrl}` : `Indexing API error: ${res.status}`;
  } catch(e) { return `Indexing API: ${e.message}`; }
}

// ─── Get product links for internal linking ───────────────────────────────────
async function getProductLinks(config) {
  try {
    const r=await wpGet(config.wp_url,"wc/v3/products?per_page=15&status=publish",config.wp_username,config.wp_app_password);
    if(!Array.isArray(r.body)) return [];
    return r.body.map(p=>({name:p.name,link:p.permalink||`${config.wp_url}/product/${p.slug}`})).filter(p=>p.link);
  } catch { return []; }
}

// ─── Image alt tags ───────────────────────────────────────────────────────────
async function applyAltTags(config, apiKey) {
  const results=[];
  try {
    const r=await wpGet(config.wp_url,"wc/v3/products?per_page=20&status=publish",config.wp_username,config.wp_app_password);
    if(!Array.isArray(r.body)) return ["Could not fetch products"];
    for(const p of r.body.slice(0,10)) {
      if(!p.images?.length) continue;
      if(p.images.every(i=>i.alt?.trim())) { results.push(`${p.name}: already has alt tags`); continue; }
      const alts=(await callClaude(apiKey,"Write concise SEO alt text for UAE activewear product images. Plain text only, one per line, no numbering.",`Product: "${p.name}" — THUGFIT UAE activewear. Write ${p.images.length} alt text(s), one per line, max 120 chars each.`,300)).trim().split("\n").filter(Boolean);
      const imgs=p.images.map((img,i)=>({...img,alt:alts[i]||`${p.name} - THUGFIT UAE activewear`}));
      await wpPut(config.wp_url,`wc/v3/products/${p.id}`,{images:imgs},config.wp_username,config.wp_app_password);
      results.push(`${p.name}: alt tags applied`);
    }
  } catch(e) { results.push(`Error: ${e.message}`); }
  return results;
}

// ─── Schema markup ────────────────────────────────────────────────────────────
async function applySchema(config) {
  const results=[];
  try {
    const r=await wpGet(config.wp_url,"wc/v3/products?per_page=20&status=publish",config.wp_username,config.wp_app_password);
    if(!Array.isArray(r.body)) return ["Could not fetch products"];
    for(const p of r.body.slice(0,10)) {
      const schema=JSON.stringify({"@context":"https://schema.org/","@type":"Product",name:p.name,description:(p.description||p.name).replace(/<[^>]*>/g,"").slice(0,300),brand:{"@type":"Brand",name:"THUGFIT"},offers:{"@type":"Offer",url:p.permalink||`${config.wp_url}/product/${p.slug}`,priceCurrency:"AED",price:p.price||"0",availability:p.stock_status==="instock"?"https://schema.org/InStock":"https://schema.org/OutOfStock",seller:{"@type":"Organization",name:"THUGFIT"}},image:p.images?.[0]?.src||""});
      const curr=p.description||"";
      if(!curr.includes("application/ld+json")) {
        await wpPut(config.wp_url,`wc/v3/products/${p.id}`,{description:curr+`\n<script type="application/ld+json">${schema}<\/script>`},config.wp_username,config.wp_app_password);
        results.push(`${p.name}: schema applied`);
      } else results.push(`${p.name}: schema already present`);
    }
  } catch(e) { results.push(`Error: ${e.message}`); }
  return results;
}

// ─── 404 monitor ─────────────────────────────────────────────────────────────
async function monitor404(config, supaKey) {
  const errors=[];
  try {
    const [posts,products]=await Promise.all([
      wpGet(config.wp_url,"wp/v2/posts?per_page=20&status=publish",config.wp_username,config.wp_app_password),
      wpGet(config.wp_url,"wc/v3/products?per_page=20&status=publish",config.wp_username,config.wp_app_password),
    ]);
    const urls=[
      ...(Array.isArray(posts.body)?posts.body:[]).map(p=>({type:"post",title:p.title?.rendered,url:p.link})),
      ...(Array.isArray(products.body)?products.body:[]).map(p=>({type:"product",title:p.name,url:p.permalink})),
    ].filter(u=>u.url);
    for(const item of urls.slice(0,30)) {
      try {
        const u=new URL(item.url);
        const r=await httpsGet(u.hostname,u.pathname+u.search,{"User-Agent":"ZenLine-SEO/1.0"});
        if(r.status===404||r.status===410) {
          errors.push({type:item.type,title:item.title,url:item.url,status:r.status});
          await addStaffTask(supaKey,{type:"404_error",description:`${item.type}: "${item.title}" returns ${r.status}`,url:item.url,resolved:false});
        }
      } catch { }
    }
  } catch { }
  return errors;
}

// ─── Broken link checker ──────────────────────────────────────────────────────
async function checkBrokenLinks(config, supaKey) {
  const broken=[];
  try {
    const r=await wpGet(config.wp_url,"wp/v2/posts?per_page=10&status=publish",config.wp_username,config.wp_app_password);
    if(!Array.isArray(r.body)) return [];
    for(const post of r.body) {
      const links=[...(post.content?.rendered||"").matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m=>m[1]).slice(0,6);
      for(const link of links) {
        try {
          const u=new URL(link);
          const res=await httpsGet(u.hostname,u.pathname+u.search,{"User-Agent":"ZenLine-SEO/1.0"});
          if(res.status===404||res.status===410) {
            broken.push({post:post.title?.rendered,link,status:res.status});
            await addStaffTask(supaKey,{type:"broken_link",description:`Broken link in "${post.title?.rendered}": ${link} (${res.status})`,url:link,resolved:false});
          }
        } catch { }
      }
    }
  } catch { }
  return broken;
}

// ─── Duplicate content check ──────────────────────────────────────────────────
async function checkDuplicateContent(config, apiKey, supaKey) {
  try {
    const r=await wpGet(config.wp_url,"wp/v2/posts?per_page=20&status=publish",config.wp_username,config.wp_app_password);
    if(!Array.isArray(r.body)||r.body.length<2) return "Not enough posts to check";
    const titles=r.body.map(p=>({id:p.id,title:p.title?.rendered,url:p.link}));
    const result=await callClaude(apiKey,
      "You are an SEO content auditor. Check for duplicate or very similar content topics.",
      `These are blog posts on thugfit.ae. Identify any that cover nearly the same topic:
${titles.map((t,i)=>`${i+1}. ${t.title}`).join("\n")}
Return JSON only: {"duplicates":[{"titles":["title1","title2"],"recommendation":"what to do"}]}
If none: {"duplicates":[]}`,800
    );
    const parsed=JSON.parse(result.replace(/```json|```/g,"").trim());
    if(parsed.duplicates?.length>0) {
      for(const dup of parsed.duplicates) {
        await addStaffTask(supaKey,{type:"duplicate_content",description:`Potential duplicate: "${dup.titles.join('" and "')}" — ${dup.recommendation}`,url:"",resolved:false});
      }
      return `${parsed.duplicates.length} duplicate content issues found`;
    }
    return "No duplicate content found";
  } catch(e) { return `Duplicate check error: ${e.message}`; }
}

// ─── Auto competitor analysis ─────────────────────────────────────────────────
async function autoCompetitorAnalysis(apiKey, supaKey) {
  try {
    const competitor=UAE_COMPETITORS[new Date().getDate()%UAE_COMPETITORS.length];
    const result=await callClaude(apiKey,
      "SEO competitor analyst for UAE activewear e-commerce.",
      `Analyse ${competitor} as a competitor of THUGFIT (thugfit.ae, UAE gym activewear).
Identify 10 keywords they likely rank for that THUGFIT should target in UAE.
Return JSON only: {"competitor":"${competitor}","keywords":["kw1","kw2"]}`,500
    );
    const parsed=JSON.parse(result.replace(/```json|```/g,"").trim());
    if(Array.isArray(parsed.keywords)&&parsed.keywords.length>0) {
      await Promise.all(parsed.keywords.map(kw=>sbPost("/rest/v1/seo_keyword_queue",{keyword:kw,used:false,priority:6},supaKey).catch(()=>{})));
      return `${parsed.keywords.length} keywords from ${parsed.competitor} added to queue`;
    }
    return "Competitor analysis: no keywords extracted";
  } catch(e) { return `Competitor error: ${e.message}`; }
}

// ─── Google Business Profile post ────────────────────────────────────────────
async function postToGoogleBusiness(config, apiKey) {
  if(!config.gbp_access_token||!config.gbp_location_id) return "GBP: not configured";
  try {
    const text=await callClaude(apiKey,
      "Write a short Google Business Profile post for THUGFIT UAE gym activewear. Under 250 words. No hashtags.",
      "Write a Google Business Profile weekly update for THUGFIT (premium UAE gym activewear, thugfit.ae). Motivational, professional, ends with CTA to visit thugfit.ae.",400
    );
    const r=await httpsPost("mybusinessposts.googleapis.com",
      `/v1/${config.gbp_location_id}/localPosts`,
      {"Content-Type":"application/json",Authorization:`Bearer ${config.gbp_access_token}`},
      {languageCode:"en-US",summary:text.slice(0,1500),callToAction:{actionType:"SHOP",url:"https://thugfit.ae"},topicType:"STANDARD"}
    );
    return r.status===200||r.status===201 ? "GBP post published" : `GBP error: ${r.status}`;
  } catch(e) { return `GBP error: ${e.message}`; }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const isVercelCron = req.headers["x-vercel-cron"]==="1";
  const secret = process.env.CRON_SECRET||"";
  const auth = req.headers.authorization||"";
  const isManual = secret ? auth===`Bearer ${secret}` : true;
  if(!isVercelCron&&!isManual&&process.env.NODE_ENV!=="development")
    return res.status(401).json({error:"Unauthorized"});

  // Support both VITE_ and non-VITE_ key names
  const HARDCODED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmlxeGlvYXBjZGdlbnBrc2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc1MDIsImV4cCI6MjEwMDcyMzUwMn0.PS80PFMqBYMf0e6uiYvTFk90gF7a7jo97C-dzzxUGho";
  const supaKey = process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || HARDCODED_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY||"";

  if(!supaKey||!anthropicKey) {
    return res.status(500).json({
      error:"Missing env vars",
      found:{
        SUPABASE_SERVICE_KEY:!!process.env.SUPABASE_SERVICE_KEY,
        SUPABASE_ANON_KEY:!!process.env.SUPABASE_ANON_KEY,
        VITE_SUPABASE_ANON_KEY:!!process.env.VITE_SUPABASE_ANON_KEY,
        ANTHROPIC_API_KEY:!!process.env.ANTHROPIC_API_KEY,
      }
    });
  }

  const report={};
  const today=new Date();
  const dayOfWeek=today.getDay();
  const dayOfMonth=today.getDate();

  try {
    // 1. Load config
    const configs=await sbGet("/rest/v1/seo_automation?order=created_at.asc&limit=1",supaKey);
    const config=configs[0];
    if(!config) return res.status(200).json({skipped:true,reason:"No config found — set up in ZenLine Digital Auto SEO"});
    if(!config.is_enabled) return res.status(200).json({skipped:true,reason:"Automation is paused"});
    if(!config.wp_username||!config.wp_app_password) {
      await logActivity(supaKey,{action:"error",status:"failed",error:"WordPress credentials missing"});
      return res.status(200).json({skipped:true,reason:"WordPress credentials missing — add in Auto SEO Settings"});
    }

    // 2. Pick keyword
    const queue=await sbGet("/rest/v1/seo_keyword_queue?used=eq.false&order=priority.desc,created_at.asc&limit=1",supaKey);
    let keyword,kwId;
    if(queue.length>0){keyword=queue[0].keyword;kwId=queue[0].id;}
    else{const d=Math.floor((Date.now()-new Date(today.getFullYear(),0,0))/86400000);keyword=SEED_KEYWORDS[d%SEED_KEYWORDS.length];}

    // 3. Get product links for internal linking
    const productLinks=await getProductLinks(config);
    report.internalLinks=`${productLinks.length} product links available`;

    // 4. Generate article
    const article=await generateArticle(anthropicKey,keyword,productLinks.slice(0,5));

    // 5. Publish to WordPress (with Yoast + Rank Math meta)
    const siteUrl=config.wp_url||"https://thugfit.ae";
    const wpResult=await publishArticle(config,article);
    const success=wpResult.status===201;
    const wpPostId=wpResult.body?.id;
    const wpPostUrl=wpResult.body?.link||wpResult.body?.guid?.rendered;
    report.article={success,title:article.title,keyword,wpPostUrl};

    // 6. Ping Google + Bing
    report.ping=await pingSearchEngines(siteUrl);

    // 7. Google Indexing API (if configured)
    if(config.google_indexing_key&&wpPostUrl) {
      report.indexing=await submitGoogleIndexing(config.google_indexing_key,wpPostUrl);
    }

    // 8. Mark keyword used
    if(kwId) await sbPatch(`/rest/v1/seo_keyword_queue?id=eq.${kwId}`,{used:true,used_at:new Date().toISOString()},supaKey);

    // 9. Log activity
    await logActivity(supaKey,{
      action:"blog_published",title:article.title,keyword,
      status:success?(config.post_status==="publish"?"published":"saved as draft"):"failed",
      wp_post_id:wpPostId||null,wp_post_url:wpPostUrl||null,
      error:success?null:`WP ${wpResult.status}: ${JSON.stringify(wpResult.body).slice(0,200)}`,
    });

    // 10. Update last_run
    await sbPatch("/rest/v1/seo_automation?order=created_at.asc&limit=1",{last_run:new Date().toISOString()},supaKey);

    // ── WEEKLY (Monday) ───────────────────────────────────────────────────────
    if(dayOfWeek===1) {
      const broken=await checkBrokenLinks(config,supaKey);
      report.brokenLinks=`${broken.length} broken links found`;
      await logActivity(supaKey,{action:"broken_link_check",status:broken.length>0?"issues_found":"ok",error:broken.length>0?JSON.stringify(broken).slice(0,400):null});

      const errors404=await monitor404(config,supaKey);
      report.monitor404=`${errors404.length} 404 errors found`;
      await logActivity(supaKey,{action:"404_monitor",status:errors404.length>0?"issues_found":"ok",error:errors404.length>0?JSON.stringify(errors404).slice(0,400):null});

      if(config.gbp_access_token) {
        report.gbp=await postToGoogleBusiness(config,anthropicKey);
        await logActivity(supaKey,{action:"gbp_post",status:"completed",error:report.gbp});
      }
    }

    // ── MONTHLY (1st of month) ────────────────────────────────────────────────
    if(dayOfMonth===1) {
      const altResults=await applyAltTags(config,anthropicKey);
      await logActivity(supaKey,{action:"alt_tags",status:"completed",error:altResults.join(" | ").slice(0,500)});
      report.altTags=altResults;

      const schemaResults=await applySchema(config);
      await logActivity(supaKey,{action:"schema_markup",status:"completed",error:schemaResults.join(" | ").slice(0,500)});
      report.schema=schemaResults;

      report.duplicates=await checkDuplicateContent(config,anthropicKey,supaKey);
      await logActivity(supaKey,{action:"duplicate_check",status:"completed",error:report.duplicates});

      report.competitor=await autoCompetitorAnalysis(anthropicKey,supaKey);
      await logActivity(supaKey,{action:"competitor_analysis",status:"completed",error:report.competitor});
    }

    return res.status(200).json({success,keyword,title:article.title,wpPostId,wpPostUrl,report});

  } catch(err) {
    await logActivity(supaKey,{action:"error",status:"failed",error:err.message}).catch(()=>{});
    return res.status(500).json({error:err.message});
  }
}
