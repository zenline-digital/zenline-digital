import { useState, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CLAUDE_PROXY = "/api/claude";
const BRAND = { name:"THUGFIT", site:"https://thugfit.ae", industry:"Activewear / Gym Clothing", market:"UAE — Dubai, Abu Dhabi, Sharjah", desc:"Premium gym activewear brand for fitness enthusiasts in the UAE" };

// ─── Claude API helper ────────────────────────────────────────────────────────
async function claude(userPrompt, systemPrompt="You are a world-class SEO strategist.", maxTokens=4000) {
  const res = await fetch(CLAUDE_PROXY, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:maxTokens,
      system:systemPrompt,
      messages:[{role:"user",content:userPrompt}],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function copy(text, setCopied) {
  navigator.clipboard.writeText(text).then(()=>{setCopied(true); setTimeout(()=>setCopied(false),2000);});
}

function CopyBtn({text, label="Copy"}) {
  const [copied,setCopied]=useState(false);
  return (
    <button onClick={()=>copy(text,setCopied)}
      style={{padding:"5px 12px",borderRadius:6,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,
        background:copied?"#16a34a20":"#7c3aed20",borderColor:copied?"#16a34a":"#7c3aed",color:copied?"#4ade80":"#a78bfa",transition:"all .2s"}}>
      {copied?"✓ Copied":label}
    </button>
  );
}

function Spinner() {
  return <div style={{width:18,height:18,border:"2px solid #7c3aed30",borderTop:"2px solid #7c3aed",borderRadius:"50%",animation:"spin .8s linear infinite",display:"inline-block",flexShrink:0}}/>;
}

function Section({title,children}) {
  return (
    <div style={{background:"#13131f",border:"1px solid #1e1e30",borderRadius:12,padding:20,marginBottom:16}}>
      {title&&<div style={{fontWeight:700,fontSize:14,color:"#e2e8f0",marginBottom:14}}>{title}</div>}
      {children}
    </div>
  );
}

function OutBox({label,content,lang=""}) {
  return content?(
    <div style={{marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</span>
        <CopyBtn text={content}/>
      </div>
      <pre style={{background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:8,padding:14,fontSize:12,color:"#e2e8f0",overflowX:"auto",whiteSpace:"pre-wrap",lineHeight:1.6,margin:0,maxHeight:400,overflowY:"auto"}}>
        {content}
      </pre>
    </div>
  ):null;
}

function Input({label,value,onChange,placeholder,type="text",hint}) {
  return (
    <div style={{marginBottom:14}}>
      {label&&<label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{label}</label>}
      {type==="textarea"
        ?<textarea value={value} onChange={onChange} placeholder={placeholder} rows={4}
            style={{width:"100%",background:"#0d0d16",border:"1px solid #1e1e30",color:"#e2e8f0",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",resize:"vertical",lineHeight:1.5}}/>
        :<input type={type} value={value} onChange={onChange} placeholder={placeholder}
            style={{width:"100%",background:"#0d0d16",border:"1px solid #1e1e30",color:"#e2e8f0",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none"}}/>
      }
      {hint&&<div style={{fontSize:11,color:"#3a3a5c",marginTop:4}}>{hint}</div>}
    </div>
  );
}

function Select({label,value,onChange,options}) {
  return (
    <div style={{marginBottom:14}}>
      {label&&<label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{label}</label>}
      <select value={value} onChange={onChange}
        style={{width:"100%",background:"#0d0d16",border:"1px solid #1e1e30",color:"#e2e8f0",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none"}}>
        {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  );
}

function GenBtn({onClick,loading,label}) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{padding:"11px 24px",borderRadius:9,border:"none",cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:700,
        background:loading?"#1a1a2e":"linear-gradient(135deg,#7c3aed,#2563eb)",color:loading?"#3a3a5c":"#fff",display:"flex",alignItems:"center",gap:8,transition:"opacity .2s"}}>
      {loading&&<Spinner/>} {label}
    </button>
  );
}

// ─── Tab 1: Keyword Research ──────────────────────────────────────────────────
function KeywordsTab() {
  const [focus,setFocus]=useState("");
  const [competitors,setCompetitors]=useState("gymsharkarabia.com, adidas.ae, nikerunning.com");
  const [season,setSeason]=useState("current");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState("");
  const [error,setError]=useState("");

  const generate = async () => {
    setLoading(true); setError(""); setResult("");
    try {
      const prompt = `Do a comprehensive keyword research for ${BRAND.name} (${BRAND.desc}, ${BRAND.market}).

Brand website: ${BRAND.site}
Focus area: ${focus||"general activewear — leggings, sports bras, shorts, gym wear"}
Key competitors: ${competitors}
Timing: ${season==="current"?"current season":"all year round"}

Provide a full keyword strategy with these sections:

## 1. PRIMARY KEYWORDS (10 keywords)
Table with: Keyword | Search Intent | Priority (High/Med/Low) | Why It Matters

## 2. LONG-TAIL KEYWORDS (20 keywords)
Table with: Keyword | Search Intent | Content Type to Target

## 3. LOCAL UAE SEO KEYWORDS (10 keywords)
Table with: Keyword | City/Location Focus | Priority

## 4. CONTENT GAP OPPORTUNITIES (5 topics)
Topics competitors are ranking for but THUGFIT is not — with recommended content format

## 5. QUICK WIN KEYWORDS (5 keywords)
Low competition, high relevance keywords THUGFIT can rank for quickly

## 6. SEASONAL KEYWORDS (if relevant)
Keywords relevant to UAE fitness seasons (Ramadan fitness, summer gym, etc.)

Format everything clearly with tables and headings. Be specific to the UAE market and activewear industry.`;

      const out = await claude(prompt, "You are an expert SEO strategist specialising in the Middle East e-commerce and fashion/activewear market. You have deep knowledge of UAE consumer search behaviour and Google trends in the region.");
      setResult(out);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="🔍 Keyword Research">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Input label="Focus Area (optional)" value={focus} onChange={e=>setFocus(e.target.value)} placeholder="e.g. women's leggings, gym shorts..."/>
          <Input label="Competitor Websites" value={competitors} onChange={e=>setCompetitors(e.target.value)} placeholder="site1.com, site2.com"/>
        </div>
        <Select label="Timing" value={season} onChange={e=>setSeason(e.target.value)}
          options={[{value:"current",label:"Current Season"},{value:"yearly",label:"Year Round"}]}/>
        <GenBtn onClick={generate} loading={loading} label="🔍 Generate Keyword Strategy"/>
        {error&&<div style={{marginTop:10,color:"#f87171",fontSize:13}}>⚠ {error}</div>}
      </Section>
      {result&&<Section title="Keyword Strategy">
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><CopyBtn text={result} label="Copy All"/></div>
        <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</div>
      </Section>}
    </div>
  );
}

// ─── Tab 2: Blog Generator ────────────────────────────────────────────────────
function BlogTab() {
  const [keyword,setKeyword]=useState("");
  const [type,setType]=useState("how-to");
  const [words,setWords]=useState("1500");
  const [audience,setAudience]=useState("UAE fitness enthusiasts, gym-goers aged 18-35");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");
  // WordPress publish
  const [wpUrl,setWpUrl]=useState(()=>localStorage.getItem("seo_wp_url")||"https://thugfit.ae");
  const [wpUser,setWpUser]=useState(()=>localStorage.getItem("seo_wp_user")||"");
  const [wpPass,setWpPass]=useState(()=>localStorage.getItem("seo_wp_pass")||"");
  const [publishing,setPublishing]=useState(false);
  const [pubResult,setPubResult]=useState("");
  const [showWpSettings,setShowWpSettings]=useState(false);

  const saveWpSettings = () => {
    localStorage.setItem("seo_wp_url",wpUrl);
    localStorage.setItem("seo_wp_user",wpUser);
    localStorage.setItem("seo_wp_pass",wpPass);
    setShowWpSettings(false);
  };

  const generate = async () => {
    if (!keyword.trim()) { setError("Enter a target keyword"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const typeMap = {"how-to":"how-to guide","listicle":"listicle / list article","product":"product showcase","comparison":"comparison article","informational":"informational / educational"};
      const prompt = `Write a complete, SEO-optimised blog article for ${BRAND.name} (${BRAND.site}).

Target keyword: "${keyword}"
Article type: ${typeMap[type]||type}
Target word count: ~${words} words
Target audience: ${audience}
Brand voice: Premium, motivational, fitness-focused, UAE/Dubai market

REQUIRED OUTPUT FORMAT — provide ALL of these sections:

---ARTICLE START---

SEO_TITLE: [write the SEO title tag — max 60 chars, include keyword]
META_DESC: [write the meta description — max 155 chars, include keyword, compelling CTA]
SLUG: [URL slug for this post]

# [H1 — Main Article Title — include keyword naturally]

[Opening paragraph — hook the reader, include keyword in first 100 words]

## [H2 subheading]
[Content...]

## [H2 subheading]
[Content...]

[Continue with proper H2/H3 structure, approximately ${words} words total]

## Frequently Asked Questions

**Q: [question 1]**
A: [answer]

**Q: [question 2]**
A: [answer]

**Q: [question 3]**
A: [answer]

## Conclusion
[Wrap up + CTA mentioning THUGFIT products and thugfit.ae]

---ARTICLE END---

Make it genuinely useful, not generic. Include specific advice relevant to UAE fitness culture. Use the keyword "${keyword}" naturally throughout (aim for ~1.5% density). Do NOT keyword-stuff.`;

      const out = await claude(prompt, "You are a professional SEO content writer specialising in fitness, activewear, and Middle East markets. You write articles that rank on Google AND genuinely help readers.", 4096);
      
      // Parse SEO fields
      const titleMatch = out.match(/SEO_TITLE:\s*(.+)/);
      const metaMatch  = out.match(/META_DESC:\s*(.+)/);
      const slugMatch  = out.match(/SLUG:\s*(.+)/);
      const bodyStart  = out.indexOf("# ");
      const body       = bodyStart>-1 ? out.slice(bodyStart) : out;
      
      setResult({
        raw: out,
        title: titleMatch?titleMatch[1].trim():`${keyword} | THUGFIT`,
        meta:  metaMatch?metaMatch[1].trim():"",
        slug:  slugMatch?slugMatch[1].trim().toLowerCase().replace(/\s+/g,"-"):"",
        body,
      });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const publishToWP = async () => {
    if (!wpUser||!wpPass) { setPubResult("❌ Add WordPress credentials first (click ⚙ above)"); return; }
    if (!result) return;
    setPublishing(true); setPubResult("");
    try {
      const creds = btoa(`${wpUser}:${wpPass}`);
      // Convert markdown-ish content to basic HTML
      const htmlContent = result.body
        .replace(/^# (.+)$/gm,"<h1>$1</h1>")
        .replace(/^## (.+)$/gm,"<h2>$1</h2>")
        .replace(/^### (.+)$/gm,"<h3>$1</h3>")
        .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
        .replace(/\*(.+?)\*/g,"<em>$1</em>")
        .replace(/\n\n/g,"</p><p>")
        .replace(/^/,"<p>").replace(/$/,"</p>");

      const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Basic ${creds}`},
        body:JSON.stringify({
          title: result.title,
          content: htmlContent,
          excerpt: result.meta,
          slug: result.slug,
          status:"draft", // draft first — user publishes from WP dashboard
          meta:{yoast_wpseo_title:result.title, yoast_wpseo_metadesc:result.meta},
        }),
      });
      if (!res.ok) {
        const e=await res.json();
        throw new Error(e.message||`WordPress error ${res.status}`);
      }
      const data = await res.json();
      setPubResult(`✅ Draft created! View in WordPress: ${wpUrl}/wp-admin/post.php?post=${data.id}&action=edit`);
    } catch(e) { setPubResult(`❌ ${e.message}`); }
    finally { setPublishing(false); }
  };

  return (
    <div>
      <Section title="✍️ AI Blog Generator">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Input label="Target Keyword *" value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder='e.g. "best gym leggings Dubai"'/>
          <Select label="Article Type" value={type} onChange={e=>setType(e.target.value)}
            options={[{value:"how-to",label:"How-To Guide"},{value:"listicle",label:"Listicle (Top 10...)"},{value:"product",label:"Product Showcase"},{value:"comparison",label:"Comparison Article"},{value:"informational",label:"Informational / Educational"}]}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Select label="Word Count" value={words} onChange={e=>setWords(e.target.value)}
            options={["1000","1500","2000","2500"].map(v=>({value:v,label:`~${v} words`}))}/>
          <Input label="Target Audience" value={audience} onChange={e=>setAudience(e.target.value)} placeholder="Who is this article for?"/>
        </div>
        <GenBtn onClick={generate} loading={loading} label="✍️ Generate Blog Article"/>
        {error&&<div style={{marginTop:10,color:"#f87171",fontSize:13}}>⚠ {error}</div>}
      </Section>

      {result&&<>
        {/* SEO Fields */}
        <Section title="SEO Fields">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Title Tag <span style={{color:result.title.length>60?"#f87171":"#4ade80"}}>({result.title.length}/60)</span></div>
              <div style={{background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:8,padding:10,fontSize:13,color:"#e2e8f0",marginBottom:6}}>{result.title}</div>
              <CopyBtn text={result.title} label="Copy Title"/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Meta Description <span style={{color:result.meta.length>155?"#f87171":"#4ade80"}}>({result.meta.length}/155)</span></div>
              <div style={{background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:8,padding:10,fontSize:13,color:"#e2e8f0",marginBottom:6}}>{result.meta}</div>
              <CopyBtn text={result.meta} label="Copy Meta"/>
            </div>
          </div>
          {result.slug&&<div style={{marginTop:8,fontSize:12,color:"#64748b"}}>URL Slug: <span style={{color:"#a78bfa",fontFamily:"monospace"}}>/blog/{result.slug}</span></div>}
        </Section>

        {/* Full Article */}
        <Section title="Article Content">
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <CopyBtn text={result.body} label="Copy Article"/>
            <button onClick={()=>setShowWpSettings(!showWpSettings)}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #1e1e30",cursor:"pointer",fontSize:12,fontWeight:600,background:"#13131f",color:"#64748b"}}>
              ⚙ WP Settings
            </button>
            <GenBtn onClick={publishToWP} loading={publishing} label="🚀 Publish to WordPress (Draft)"/>
          </div>

          {showWpSettings&&<div style={{background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:10}}>WordPress Credentials</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <Input label="Site URL" value={wpUrl} onChange={e=>setWpUrl(e.target.value)} placeholder="https://thugfit.ae"/>
              <Input label="WP Username" value={wpUser} onChange={e=>setWpUser(e.target.value)} placeholder="admin"/>
              <Input label="Application Password" type="password" value={wpPass} onChange={e=>setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" hint="WP Admin → Users → Profile → Application Passwords"/>
            </div>
            <button onClick={saveWpSettings} style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:"linear-gradient(135deg,#7c3aed,#2563eb)",color:"#fff"}}>Save</button>
          </div>}

          {pubResult&&<div style={{marginBottom:12,padding:"10px 14px",borderRadius:8,border:"1px solid",background:pubResult.startsWith("✅")?"#16a34a15":"#ef444415",borderColor:pubResult.startsWith("✅")?"#16a34a40":"#ef444440",color:pubResult.startsWith("✅")?"#4ade80":"#fca5a5",fontSize:13}}>{pubResult}</div>}

          <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap",background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:8,padding:16,maxHeight:500,overflowY:"auto"}}>{result.body}</div>
        </Section>
      </>}
    </div>
  );
}

// ─── Tab 3: Meta Tags ─────────────────────────────────────────────────────────
function MetaTab() {
  const [pageUrl,setPageUrl]=useState("");
  const [pageDesc,setPageDesc]=useState("");
  const [pageType,setPageType]=useState("product");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState("");

  const generate = async () => {
    if (!pageUrl.trim()&&!pageDesc.trim()) { setError("Enter a page URL or description"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const typeMap = {product:"Product Page",category:"Category Page",homepage:"Homepage",blog:"Blog Post",about:"About Page"};
      const prompt = `Generate a complete SEO meta tag suite for this page of ${BRAND.name} (${BRAND.site}):

Page URL: ${pageUrl||"(not specified)"}
Page Type: ${typeMap[pageType]||pageType}
Page Description / Content: ${pageDesc||"(infer from the URL)"}
Brand: ${BRAND.name} — ${BRAND.desc}
Market: ${BRAND.market}

Generate ALL of the following in this EXACT format:

TITLE_TAG: [max 60 chars, include primary keyword, brand name at end]
META_DESC: [max 155 chars, include keyword, clear value proposition, CTA]
OG_TITLE: [for Facebook/Instagram sharing — can be slightly longer than title tag]
OG_DESC: [for social sharing — engaging, max 200 chars]
OG_IMAGE_REC: [describe what image to use for og:image]
TWITTER_TITLE: [Twitter card title]
TWITTER_DESC: [Twitter card description]
CANONICAL: [canonical URL]
ROBOTS: [robots meta — usually "index, follow" unless specified]
FOCUS_KEYWORD: [the primary keyword this page targets]

SCHEMA_JSON:
[Complete JSON-LD schema markup for this page type — product schema if product, LocalBusiness for homepage, etc.]

HTML_SNIPPET:
[Complete ready-to-paste HTML <head> meta tag block]

Also add 2-3 specific recommendations to improve this page's SEO beyond meta tags.`;

      const out = await claude(prompt,"You are an expert technical SEO specialist and schema markup expert. You generate complete, technically correct meta tag suites.");

      // Parse fields
      const field = (key) => { const m=out.match(new RegExp(`${key}:\\s*(.+)`)); return m?m[1].trim():""; };
      const schemaMatch = out.match(/SCHEMA_JSON:\n([\s\S]+?)(?=HTML_SNIPPET:|$)/);
      const htmlMatch   = out.match(/HTML_SNIPPET:\n([\s\S]+?)(?=Also add|$)/);

      setResult({
        raw: out,
        title:   field("TITLE_TAG"),
        meta:    field("META_DESC"),
        ogTitle: field("OG_TITLE"),
        ogDesc:  field("OG_DESC"),
        ogImg:   field("OG_IMAGE_REC"),
        twTitle: field("TWITTER_TITLE"),
        twDesc:  field("TWITTER_DESC"),
        keyword: field("FOCUS_KEYWORD"),
        schema:  schemaMatch?schemaMatch[1].trim():"",
        html:    htmlMatch?htmlMatch[1].trim():"",
      });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const MetaField = ({label,value,max}) => (
    value?<div style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label} {max&&<span style={{color:value.length>max?"#f87171":"#4ade80"}}>({value.length}/{max})</span>}</span>
        <CopyBtn text={value}/>
      </div>
      <div style={{background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:7,padding:"10px 12px",fontSize:13,color:"#e2e8f0"}}>{value}</div>
    </div>:null
  );

  return (
    <div>
      <Section title="🏷️ Meta Tag Generator">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Input label="Page URL" value={pageUrl} onChange={e=>setPageUrl(e.target.value)} placeholder="https://thugfit.ae/product/gym-leggings"/>
          <Select label="Page Type" value={pageType} onChange={e=>setPageType(e.target.value)}
            options={[{value:"product",label:"Product Page"},{value:"category",label:"Category Page"},{value:"homepage",label:"Homepage"},{value:"blog",label:"Blog Post"},{value:"about",label:"About Page"}]}/>
        </div>
        <Input label="Page Description / Content Summary (optional)" value={pageDesc} onChange={e=>setPageDesc(e.target.value)} type="textarea" placeholder="Describe what this page is about, what products it shows, etc."/>
        <GenBtn onClick={generate} loading={loading} label="🏷️ Generate All Meta Tags"/>
        {error&&<div style={{marginTop:10,color:"#f87171",fontSize:13}}>⚠ {error}</div>}
      </Section>

      {result&&<>
        <Section title="Core Meta Tags">
          <MetaField label="Title Tag" value={result.title} max={60}/>
          <MetaField label="Meta Description" value={result.meta} max={155}/>
          <MetaField label="Focus Keyword" value={result.keyword}/>
        </Section>
        <Section title="Open Graph (Facebook / Instagram)">
          <MetaField label="OG Title" value={result.ogTitle}/>
          <MetaField label="OG Description" value={result.ogDesc}/>
          {result.ogImg&&<div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>OG Image Recommendation</div>
            <div style={{background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:7,padding:"10px 12px",fontSize:13,color:"#a78bfa"}}>{result.ogImg}</div>
          </div>}
        </Section>
        {(result.twTitle||result.twDesc)&&<Section title="Twitter Card">
          <MetaField label="Twitter Title" value={result.twTitle}/>
          <MetaField label="Twitter Description" value={result.twDesc}/>
        </Section>}
        {result.schema&&<OutBox label="JSON-LD Schema Markup" content={result.schema}/>}
        {result.html&&<OutBox label="Complete HTML Snippet (paste in <head>)" content={result.html}/>}
        <Section title="Full Output">
          <CopyBtn text={result.raw} label="Copy Everything"/>
          <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap",marginTop:10,maxHeight:300,overflowY:"auto"}}>{result.raw}</div>
        </Section>
      </>}
    </div>
  );
}

// ─── Tab 4: On-Page Analyzer ──────────────────────────────────────────────────
function AnalyzerTab() {
  const [input,setInput]=useState("");
  const [inputType,setInputType]=useState("content");
  const [targetKw,setTargetKw]=useState("");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState("");
  const [error,setError]=useState("");

  const analyze = async () => {
    if (!input.trim()) { setError("Paste your page content or URL"); return; }
    setLoading(true); setError(""); setResult("");
    try {
      const prompt = `Perform a detailed on-page SEO audit for this ${inputType==="url"?"URL":"page content"} for ${BRAND.name} (${BRAND.site}).

${inputType==="url"?`URL to analyse: ${input}`:`Page content:\n${input}`}
${targetKw?`Target keyword: "${targetKw}"`:""}
Brand: ${BRAND.name} — ${BRAND.desc}, ${BRAND.market}

Provide a thorough SEO audit with these exact sections:

## SEO Score: X/100
[Brief explanation of the score]

## ✅ What's Working Well
[List 3-5 things done right]

## 🚨 Critical Issues (Fix Immediately)
[List any critical issues — missing title, duplicate content, etc. Each with exact fix]

## ⚠️ Warnings (Fix Soon)
[List medium-priority issues with specific fixes]

## 💡 Opportunities (Nice to Have)
[List improvements that would boost rankings further]

## Keyword Optimisation
[How well the target keyword is used — density, placement, LSI keywords needed]

## Content Quality Assessment
[Word count estimate, readability, topical coverage, what to add]

## Technical Quick Wins
[Any technical SEO issues visible from the content — heading structure, internal links, etc.]

## Action Plan (Priority Order)
[Numbered list of specific actions to take, most important first]

Be specific — give exact examples of rewrites, not vague advice.`;

      const out = await claude(prompt,"You are a senior on-page SEO specialist. You give specific, actionable audits with concrete examples and rewrite suggestions. No vague generic advice.");
      setResult(out);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Section title="📊 On-Page SEO Analyzer">
        <Select label="Input Type" value={inputType} onChange={e=>setInputType(e.target.value)}
          options={[{value:"content",label:"Paste Page Content"},{value:"url",label:"Page URL"}]}/>
        <Input label="Target Keyword (optional)" value={targetKw} onChange={e=>setTargetKw(e.target.value)} placeholder='e.g. "gym leggings Dubai"'/>
        <Input label={inputType==="url"?"Page URL":"Page Content"} value={input} onChange={e=>setInput(e.target.value)} type="textarea"
          placeholder={inputType==="url"?"https://thugfit.ae/product/leggings":"Paste your page content, product description, or article here..."}/>
        <GenBtn onClick={analyze} loading={loading} label="📊 Analyse Page SEO"/>
        {error&&<div style={{marginTop:10,color:"#f87171",fontSize:13}}>⚠ {error}</div>}
      </Section>
      {result&&<Section title="SEO Audit Report">
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><CopyBtn text={result} label="Copy Report"/></div>
        <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</div>
      </Section>}
    </div>
  );
}

// ─── Tab 5: Sitemap & Technical ───────────────────────────────────────────────
function SitemapTab() {
  const [pages,setPages]=useState(`https://thugfit.ae/
https://thugfit.ae/shop/
https://thugfit.ae/product-category/womens/
https://thugfit.ae/product-category/mens/
https://thugfit.ae/product-category/leggings/
https://thugfit.ae/product-category/sports-bras/
https://thugfit.ae/product-category/shorts/
https://thugfit.ae/about/
https://thugfit.ae/contact/
https://thugfit.ae/blog/`);
  const [loading,setLoading]=useState(false);
  const [sitemap,setSitemap]=useState("");
  const [techResult,setTechResult]=useState("");
  const [techLoading,setTechLoading]=useState(false);
  const [error,setError]=useState("");

  const generateSitemap = () => {
    const urlList = pages.split("\n").map(u=>u.trim()).filter(Boolean);
    const today = new Date().toISOString().split("T")[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlList.map((url,i)=>`  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${i===0?"daily":i<4?"weekly":"monthly"}</changefreq>
    <priority>${i===0?"1.0":i<4?"0.8":"0.6"}</priority>
  </url>`).join("\n")}
</urlset>`;
    setSitemap(xml);
  };

  const downloadSitemap = () => {
    const blob = new Blob([sitemap],{type:"text/xml"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sitemap.xml";
    a.click();
  };

  const getTechAdvice = async () => {
    setTechLoading(true); setTechResult(""); setError("");
    try {
      const prompt = `Provide a comprehensive technical SEO checklist and action plan for ${BRAND.name} — ${BRAND.site} (${BRAND.desc}, ${BRAND.market}).

The site runs on WooCommerce/WordPress.

Cover these technical SEO areas with specific recommendations for their platform:

## 1. Core Web Vitals
- LCP, FID/INP, CLS targets and how to achieve them on WooCommerce

## 2. Mobile Optimisation
- Mobile-first indexing requirements for WooCommerce

## 3. Site Speed
- Specific WooCommerce plugins and settings to improve load time
- Image optimisation for product photos

## 4. URL Structure
- Recommended URL structure for products, categories, and blog
- How to set permalinks in WordPress

## 5. Internal Linking Strategy
- How to structure internal links for an activewear e-commerce site
- Silo structure recommendation

## 6. Schema Markup
- Which schema types to implement (Product, LocalBusiness, BreadcrumbList, etc.)
- Recommended plugins for WooCommerce

## 7. Google Search Console Setup
- Step-by-step: how to submit sitemap.xml
- What to monitor weekly

## 8. Robots.txt
- Recommended robots.txt content for WooCommerce

## 9. Canonical Tags
- How to handle duplicate content from WooCommerce filters/sorting

## 10. Local SEO for UAE
- Google Business Profile optimisation for Dubai
- NAP consistency
- Local citation building for UAE

Give specific, actionable steps with plugin names, exact settings, and expected impact.`;

      const out = await claude(prompt,"You are a technical SEO expert specialising in WooCommerce and Middle East e-commerce markets.");
      setTechResult(out);
    } catch(e) { setError(e.message); }
    finally { setTechLoading(false); }
  };

  return (
    <div>
      <Section title="🗺️ Sitemap Generator">
        <Input label="Page URLs (one per line)" value={pages} onChange={e=>setPages(e.target.value)} type="textarea"
          hint="Add all your important pages — products, categories, blog posts"/>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:4}}>
          <GenBtn onClick={generateSitemap} loading={false} label="🗺️ Generate Sitemap XML"/>
          {sitemap&&<>
            <button onClick={()=>copy(sitemap,()=>{})} style={{padding:"11px 18px",borderRadius:9,border:"1px solid #7c3aed",cursor:"pointer",fontSize:13,fontWeight:700,background:"#7c3aed20",color:"#a78bfa"}}>Copy XML</button>
            <button onClick={downloadSitemap} style={{padding:"11px 18px",borderRadius:9,border:"1px solid #1e1e30",cursor:"pointer",fontSize:13,fontWeight:700,background:"#13131f",color:"#94a3b8"}}>⬇ Download sitemap.xml</button>
          </>}
        </div>
        {sitemap&&<pre style={{marginTop:12,background:"#0d0d16",border:"1px solid #1e1e30",borderRadius:8,padding:14,fontSize:11,color:"#94a3b8",overflowX:"auto",maxHeight:280}}>{sitemap}</pre>}
        {sitemap&&<div style={{marginTop:12,background:"#7c3aed10",border:"1px solid #7c3aed30",borderRadius:8,padding:12,fontSize:12,color:"#94a3b8",lineHeight:1.7}}>
          <strong style={{color:"#a78bfa"}}>📌 How to submit to Google Search Console:</strong><br/>
          1. Upload sitemap.xml to your WordPress root (via FTP or File Manager)<br/>
          2. URL will be: <span style={{color:"#a78bfa",fontFamily:"monospace"}}>https://thugfit.ae/sitemap.xml</span><br/>
          3. Go to <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" style={{color:"#7c3aed"}}>Google Search Console</a> → Sitemaps → Add sitemap URL → Submit
        </div>}
      </Section>

      <Section title="⚙️ Technical SEO Checklist">
        <GenBtn onClick={getTechAdvice} loading={techLoading} label="⚙️ Get Technical SEO Checklist"/>
        {error&&<div style={{marginTop:10,color:"#f87171",fontSize:13}}>⚠ {error}</div>}
        {techResult&&<>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12,marginBottom:8}}><CopyBtn text={techResult} label="Copy Checklist"/></div>
          <div style={{fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{techResult}</div>
        </>}
      </Section>
    </div>
  );
}

// ─── Main SEO Component ───────────────────────────────────────────────────────
const TABS = [
  {id:"keywords", icon:"🔍", label:"Keyword Research"},
  {id:"blog",     icon:"✍️",  label:"Blog Generator"},
  {id:"meta",     icon:"🏷️",  label:"Meta Tags"},
  {id:"analyzer", icon:"📊", label:"On-Page Analyzer"},
  {id:"sitemap",  icon:"🗺️",  label:"Sitemap & Technical"},
];

export default function SEO() {
  const [tab,setTab]=useState("keywords");

  return (
    <div style={{minHeight:"100vh",background:"#0d0d16",color:"#e2e8f0",fontFamily:"'Inter','Segoe UI',system-ui,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#0d0d16;}
        ::-webkit-scrollbar-thumb{background:#2a2a40;border-radius:3px;}
        select option{background:#0d0d16;color:#e2e8f0;}
        input::placeholder,textarea::placeholder{color:#3a3a5c;}
        textarea{font-family:inherit;}
        a{color:#7c3aed;}
      `}</style>

      {/* Header */}
      <div style={{background:"#09090f",borderBottom:"1px solid #1e1e30",padding:"16px 28px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:36,height:36,background:"linear-gradient(135deg,#7c3aed,#2563eb)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔍</div>
        <div>
          <div style={{fontWeight:800,fontSize:17,letterSpacing:"-0.3px"}}>SEO Module</div>
          <div style={{fontSize:11,color:"#3a3a5c",marginTop:1}}>THUGFIT · thugfit.ae — AI-Powered SEO Suite</div>
        </div>
        <div style={{marginLeft:"auto",background:"#13131f",border:"1px solid #1e1e30",borderRadius:8,padding:"6px 14px",fontSize:11,color:"#4a4a6a"}}>
          🌐 thugfit.ae · UAE Market
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{background:"#09090f",borderBottom:"1px solid #1e1e30",padding:"0 28px",display:"flex",gap:4,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"13px 18px",border:"none",borderBottom:"2px solid",cursor:"pointer",fontSize:13,fontWeight:tab===t.id?700:500,whiteSpace:"nowrap",background:"none",
              borderBottomColor:tab===t.id?"#7c3aed":"transparent",
              color:tab===t.id?"#a78bfa":"#4a4a6a",transition:"all .15s"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{padding:"24px 28px",maxWidth:1100,margin:"0 auto"}}>
        {tab==="keywords" && <KeywordsTab/>}
        {tab==="blog"     && <BlogTab/>}
        {tab==="meta"     && <MetaTab/>}
        {tab==="analyzer" && <AnalyzerTab/>}
        {tab==="sitemap"  && <SitemapTab/>}
      </div>
    </div>
  );
}
