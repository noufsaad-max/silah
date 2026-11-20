import fs from "fs";
import path from "path";

const root = process.cwd();
let missing = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) checkFile(full);
  }
}

function resolveAlias(importPath) {
  const rel = importPath.replace(/^@\//, "");
  const base = path.join(root, rel);
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".json",
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.some((c) => fs.existsSync(c));
}

function checkFile(file) {
  const code = fs.readFileSync(file, "utf8");
  const importRegex = /from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importRegex.exec(code))) {
    const imp = match[1];
    if (imp.startsWith("@/")) {
      if (!resolveAlias(imp)) missing.push(`${file} -> ${imp}`);
    }
  }
}

walk(root);
if (missing.length) {
  console.log("MISSING IMPORTS:");
  missing.forEach((m) => console.log("  " + m));
  process.exit(1);
} else {
  console.log("All @/ imports resolve to real files.");
}
