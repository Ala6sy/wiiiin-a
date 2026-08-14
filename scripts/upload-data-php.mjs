/**
 * Upload api/data.php only (ML snippets support).
 * Usage: node scripts/upload-data-php.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
const local = path.join(root, "hostinger_upload", "api", "data.php");

if (!existsSync(local)) {
  console.error("Missing hostinger_upload/api/data.php — run npm run build:hostinger first");
  process.exit(1);
}

const sftp = new SftpClient();
await sftp.connect({
  host: env.SFTP_HOST,
  port: Number(env.SFTP_PORT || 65002),
  username: env.SFTP_USER,
  privateKey: readFileSync(keyPath),
  readyTimeout: 60000,
});

await sftp.put(local, `${remoteBase}/api/data.php`);
console.log("✓ Uploaded api/data.php");
await sftp.end();
