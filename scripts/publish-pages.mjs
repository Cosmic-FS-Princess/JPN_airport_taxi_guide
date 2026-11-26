// Publishes the built site to GitHub Pages from the gh-pages branch.
//
//   pnpm build && pnpm publish:pages
//
// GitHub Pages must be set to "Deploy from a branch" → gh-pages → /(root) once
// in the repository settings. The repository credential helper must be able to
// push to origin. Force-pushing keeps gh-pages a single, clean snapshot.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!existsSync("dist/index.html")) {
  console.error("dist/ not found — run `pnpm build` first.");
  process.exit(1);
}

const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const config = (key) => {
  try {
    return execFileSync("git", ["config", key], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};
const dir = mkdtempSync(join(tmpdir(), "jpn-pages-"));
cpSync("dist", dir, { recursive: true });
writeFileSync(join(dir, ".nojekyll"), "");

// execFile (no shell) keeps the commit message and paths quoted correctly
const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "inherit" });
git("init", "-b", "gh-pages");
git("config", "user.name", config("user.name") || "github-pages");
git("config", "user.email", config("user.email") || "github-pages@users.noreply.github.com");
git("config", "core.autocrlf", "false");
git("add", "-A");
git("commit", "-m", `Deploy ${new Date().toISOString()}`);
git("push", "--force", remote, "gh-pages");
console.log("published dist/ -> gh-pages");
