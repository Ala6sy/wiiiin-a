/**
 * Builds a ready-to-upload folder for Hostinger public_html.
 * Run: npm run build:hostinger
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const deploySrc = path.join(root, "hostinger_deploy");
const out = path.join(root, "hostinger_upload");

if (!existsSync(dist)) {
  console.error("dist/ missing — run vite build first.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

cpSync(deploySrc, out, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(deploySrc, src);
    if (rel === "api/config.php") return false;
    return true;
  },
});

cpSync(dist, out, { recursive: true });

mkdirSync(path.join(out, "reports"), { recursive: true });

console.log("Hostinger upload package ready:");
console.log(" ", out);
console.log("");
console.log("Upload ALL contents of hostinger_upload/ to public_html/ on Hostinger.");
console.log("Content updates: edit public/data.json (or content-manager.html) and upload data.json only — no rebuild needed.");
console.log("Required for PDF share: generate_report.php, vendor/, reports/, ai_proxy.php");
