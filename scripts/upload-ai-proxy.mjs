import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const keyPath = path.resolve(root, env.SFTP_PRIVATE_KEY || ".deploy-keys/id_ed25519");
const sftp = new SftpClient();
await sftp.connect({
  host: env.SFTP_HOST,
  port: Number(env.SFTP_PORT || 65002),
  username: env.SFTP_USER,
  privateKey: readFileSync(keyPath),
});
const remote = `${(env.SFTP_REMOTE_PATH || "/public_html").replace(/\/$/, "")}/ai_proxy.php`;
await sftp.put(path.join(root, "hostinger_deploy", "ai_proxy.php"), remote);
console.log("Uploaded", remote);
await sftp.end();
