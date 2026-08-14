/**
 * Fast upload of SPA entry + main JS (+ ai_proxy) only.
 * Usage: node scripts/upload-critical.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localRoot = path.join(root, "hostinger_upload");

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnvLocal();
const remoteBase = (env.SFTP_REMOTE_PATH || "/public_html").replace(/\/$/, "");
const keyPath = path.resolve(root, env.SFTP_PRIVATE_KEY || ".deploy-keys/id_ed25519");

if (!existsSync(path.join(localRoot, "index.html"))) {
  console.error("Missing hostinger_upload/index.html — run npm run build:hostinger first");
  process.exit(1);
}

const assetsDir = path.join(localRoot, "assets");
const assetFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((n) => /^index-.*\.(js|css)$/.test(n) || /^index\.es-.*\.js$/.test(n) || /^purify\.es-.*\.js$/.test(n))
  : [];

const files = [
  { local: path.join(localRoot, "index.html"), remote: `${remoteBase}/index.html` },
  ...assetFiles.map((n) => ({
    local: path.join(assetsDir, n),
    remote: `${remoteBase}/assets/${n}`,
  })),
];

const aiProxy = path.join(root, "hostinger_deploy", "ai_proxy.php");
if (existsSync(aiProxy)) {
  files.push({ local: aiProxy, remote: `${remoteBase}/ai_proxy.php` });
}

const sftp = new SftpClient();
await sftp.connect({
  host: env.SFTP_HOST,
  port: Number(env.SFTP_PORT || 65002),
  username: env.SFTP_USER,
  privateKey: readFileSync(keyPath),
  readyTimeout: 60000,
});

console.log(`Uploading ${files.length} critical files…`);
for (const f of files) {
  await sftp.put(f.local, f.remote);
  console.log("  ✓", path.basename(f.local));
}
await sftp.end();
console.log("Done. Refresh with Ctrl+F5.");
