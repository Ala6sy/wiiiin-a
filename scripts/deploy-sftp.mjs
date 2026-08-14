/**
 * Deploy hostinger_upload/ → Hostinger public_html
 *
 * Methods (no password change needed if using SSH key or working FTP):
 *   DEPLOY_METHOD=sftp  → port 65002 (password OR private key)
 *   DEPLOY_METHOD=ftp   → port 21 (FTP Accounts password)
 *
 * Secrets only from .env.local
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localRoot = path.join(root, "hostinger_upload");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) {
    console.error("Missing .env.local — copy from .env.example and set SFTP_* values.");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function walkFiles(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

function shouldSkip(rel) {
  const n = rel.replace(/\\/g, "/");
  return n === "config.php" || n === "api/config.php";
}

const env = loadEnvLocal();
const method = (env.DEPLOY_METHOD || "ftp").toLowerCase();
const host = env.SFTP_HOST;
const username = env.SFTP_USER;
const password = env.SFTP_PASSWORD || "";
const remotePath = (env.SFTP_REMOTE_PATH || "/public_html").replace(/\/$/, "");
const keyPath = env.SFTP_PRIVATE_KEY
  ? path.resolve(root, env.SFTP_PRIVATE_KEY)
  : path.join(root, ".deploy-keys", "id_ed25519");

if (!host || !username) {
  console.error("Set SFTP_HOST and SFTP_USER in .env.local");
  process.exit(1);
}

if (!existsSync(localRoot) || !existsSync(path.join(localRoot, "index.html"))) {
  console.error("hostinger_upload/ incomplete — run: npm run build:hostinger");
  process.exit(1);
}

const files = walkFiles(localRoot).filter((f) => !shouldSkip(f));

async function deploySftp() {
  const port = Number(env.SFTP_PORT || 65002);
  const { default: SftpClient } = await import("ssh2-sftp-client");
  const sftp = new SftpClient();
  const cfg = { host, port, username };

  if (existsSync(keyPath)) {
    cfg.privateKey = readFileSync(keyPath);
    console.log(`SFTP key auth → ${username}@${host}:${port}`);
  } else if (password) {
    cfg.password = password;
    console.log(`SFTP password auth → ${username}@${host}:${port}`);
  } else {
    console.error("Need SFTP_PASSWORD or private key at .deploy-keys/id_ed25519");
    process.exit(1);
  }

  await sftp.connect(cfg);
  let uploaded = 0;
  try {
    for (const rel of files) {
      const local = path.join(localRoot, rel);
      const remote = `${remotePath}/${rel.replace(/\\/g, "/")}`;
      await sftp.mkdir(path.posix.dirname(remote), true);
      await sftp.fastPut(local, remote);
      uploaded++;
      if (uploaded % 25 === 0) console.log(`  … ${uploaded}/${files.length}`);
    }
  } finally {
    await sftp.end();
  }
  return uploaded;
}

async function deployFtp() {
  const port = Number(env.FTP_PORT || 21);
  if (!password) {
    console.error("FTP needs SFTP_PASSWORD in .env.local (same as Hostinger FTP Accounts).");
    process.exit(1);
  }
  const { Client } = await import("basic-ftp");
  const client = new Client(60_000);
  console.log(`FTP → ${username}@${host}:${port} → ${remotePath}`);
  await client.access({
    host,
    port,
    user: username,
    password,
    secure: false,
  });

  // Ensure we land in public_html (Hostinger often starts in home)
  try {
    await client.cd(remotePath);
  } catch {
    await client.ensureDir(remotePath);
    await client.cd(remotePath);
  }

  let uploaded = 0;
  try {
    for (const rel of files) {
      const local = path.join(localRoot, rel);
      const remoteRel = rel.replace(/\\/g, "/");
      const dir = path.posix.dirname(remoteRel);
      if (dir && dir !== ".") await client.ensureDir(dir);
      await client.uploadFrom(local, remoteRel);
      // ensureDir may leave cwd deeper — always return to remote root
      await client.cd(remotePath);
      uploaded++;
      if (uploaded % 25 === 0) console.log(`  … ${uploaded}/${files.length}`);
    }
  } finally {
    client.close();
  }
  return uploaded;
}

let uploaded = 0;
try {
  uploaded = method === "sftp" ? await deploySftp() : await deployFtp();
} catch (err) {
  console.error("\nUpload failed:", err?.message || err);
  if (method === "ftp") {
    console.error("\nTips:");
    console.error("  • Use main FTP user from Hostinger → FTP Accounts (often u357509589)");
    console.error("  • Or try extra FTP account user exactly as shown there");
    console.error("  • Password must match FTP Accounts (quote it if it has # $ @)");
  } else {
    console.error("\nTips without changing password:");
    console.error("  1) Hostinger → SSH Access → Add SSH Key — paste .deploy-keys/id_ed25519.pub");
    console.error("  2) Or set DEPLOY_METHOD=ftp and use FTP port 21");
  }
  process.exit(1);
}

const skipped = walkFiles(localRoot).length - files.length;
console.log(`Done. Uploaded ${uploaded} files via ${method.toUpperCase()} to ${remotePath}`);
if (skipped) console.log(`Skipped ${skipped} secret config file(s).`);
console.log("Refresh the site with Ctrl+F5.");
