export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // tenta ler JSON
    let body;
    try {
      body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body);
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }

    const OWNER  = process.env.GITHUB_OWNER;
    const REPO   = process.env.GITHUB_REPO;
    const BRANCH = process.env.GITHUB_BRANCH || "main";
    const TOKEN  = process.env.GITHUB_TOKEN;

    const missing = {
      owner: !OWNER,
      repo: !REPO,
      branch: !BRANCH,
      token: !TOKEN,
    };
    if (missing.owner || missing.repo || missing.branch || missing.token) {
      return res.status(500).json({ ok: false, error: "missing_env", details: missing });
    }

    // caminho data/YYYY-MM-DD/hhmmss-aleatorio.json
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 8);

    const path = `data/${yyyy}-${mm}-${dd}/${hh}${mi}${ss}-${rand}.json`;
    const contentStr = JSON.stringify(body, null, 2);
    const b64 = Buffer.from(contentStr, "utf-8").toString("base64");

    const ghRes = await fetch(`https://api.github.com/repos/${OWNER}/${encodeURIComponent(REPO)}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
      },
      body: JSON.stringify({
        message: `save: ${path}`,
        content: b64,
        branch: BRANCH,
      }),
    });

    const ghJson = await ghRes.json();

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({
        ok: false,
        error: "github_save_failed",
        status: ghRes.status,
        details: ghJson,
      });
    }

    return res.status(200).json({
      ok: true,
      path,
      content_sha: ghJson.content?.sha,
      commit_sha: ghJson.commit?.sha,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
