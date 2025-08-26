export const config = { runtime: "nodejs" };

// Lê o corpo cru da request (Node runtime)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// Resposta JSON + CORS
function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(obj));
}

// CORS preflight
function handleOptions(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.statusCode = 204;
  res.end();
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return handleOptions(res);
    if (req.method !== "POST") {
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const owner  = process.env.GITHUB_OWNER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token  = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !branch || !token) {
      return sendJson(res, 500, { ok: false, error: "missing_env", details: { owner: !!owner, repo: !!repo, branch: !!branch, token: !!token } });
    }

    // Lê corpo cru e valida JSON
    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: "invalid_json", details: String(e) });
    }

    // Gera caminho do arquivo
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10);
    const hms = now.toISOString().slice(11, 19).replace(/:/g, "");
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `data/${ymd}/${hms}-${rand}.json`;

    const content = Buffer.from(JSON.stringify(payload, null, 2) + "\n").toString("base64");

    // Cria arquivo no GitHub (API Contents)
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `chore(data): save preenvio -> ${path}`,
        content,
        branch
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return sendJson(res, resp.status, {
        ok: false,
        error: "github_save_failed",
        status: resp.status,
        details: data
      });
    }

    return sendJson(res, 200, {
      ok: true,
      path,
      content_sha: data.content?.sha,
      commit_sha: data.commit?.sha
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: "server_error", details: String(err) });
  }
}
