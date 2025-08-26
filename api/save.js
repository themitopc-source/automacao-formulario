export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).end(); return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" }); return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { pacote } = body || {};
    if (!pacote) { res.status(400).json({ ok: false, error: "Missing 'pacote'" }); return; }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_BRANCH || "main";
    if (!owner || !repo || !token) {
      res.status(500).json({ ok: false, error: "Missing GitHub env vars" }); return;
    }

    const now = new Date();
    const ymd = now.toISOString().slice(0,10);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.json`;
    const path = `submissions/${ymd}/${filename}`;
    const message = `chore: add submission ${filename}`;
    const content = Buffer.from(JSON.stringify(pacote, null, 2)).toString("base64");

    const gh = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "preenvio-app",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ message, content, branch }),
    });

    if (!gh.ok) { const t = await gh.text(); res.status(gh.status).json({ ok:false, error:t }); return; }
    const data = await gh.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(201).json({ ok: true, path, html_url: data?.content?.html_url || null });
  } catch (e) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ ok:false, error: String(e) });
  }
}
