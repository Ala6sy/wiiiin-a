/**
 * Builds a ready-to-upload folder for Hostinger public_html.
 * Run: npm run build:hostinger
 *
 * On Windows, uses robocopy — Node fs.cpSync can crash (0xC0000409)
 * with large trees / antivirus on some paths.
 */
import { cpSync, existsSync, mkdirSync, rmSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const deploySrc = path.join(root, "hostinger_deploy");
const out = path.join(root, "hostinger_upload");

if (!existsSync(dist)) {
  console.error("dist/ missing — run vite build first.");
  process.exit(1);
}

function robocopy(src, dest, extraArgs = []) {
  const r = spawnSync(
    "robocopy",
    [src, dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", ...extraArgs],
    { encoding: "utf8", windowsHide: true },
  );
  // robocopy: 0–7 = success / partial success; >= 8 = failure
  if (typeof r.status === "number" && r.status >= 8) {
    throw new Error(
      `robocopy failed (${r.status}): ${src} → ${dest}\n${r.stdout || ""}\n${r.stderr || ""}`,
    );
  }
}

function removeSecretConfigs() {
  for (const f of [
    path.join(out, "config.php"),
    path.join(out, "api", "config.php"),
  ]) {
    if (existsSync(f)) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

if (platform() === "win32") {
  robocopy(deploySrc, out, ["/XF", "config.php"]);
  removeSecretConfigs();
  robocopy(dist, out);
} else {
  cpSync(deploySrc, out, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(deploySrc, src).replace(/\\/g, "/");
      if (rel === "config.php" || rel === "api/config.php") return false;
      return true;
    },
  });
  cpSync(dist, out, { recursive: true });
}

mkdirSync(path.join(out, "reports"), { recursive: true });

if (!existsSync(path.join(out, "index.html"))) {
  console.error("ERROR: index.html missing in hostinger_upload — upload package incomplete.");
  process.exit(1);
}

console.log("Hostinger upload package ready:");
console.log(" ", out);
console.log("");
console.log("Upload ALL contents of hostinger_upload/ to public_html/ on Hostinger.");
console.log(
  "Content updates: edit public/data.json (or content-manager.html) and upload data.json only — no rebuild needed.",
);
console.log("Required for PDF share: generate_report.php, vendor/, reports/, ai_proxy.php");
console.log("Do NOT overwrite server config.php or api/config.php if they already work.");
