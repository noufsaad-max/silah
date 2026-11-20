// Lightweight syntax checker: uses the TypeScript compiler's transpileModule
// (single-file, no import resolution needed) to catch real syntax errors
// without requiring node_modules to be installed.
import ts from "typescript";
import fs from "fs";
import path from "path";

const root = process.argv[2] || ".";
let fileCount = 0;
let errorCount = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) checkFile(full);
  }
}

function checkFile(file) {
  fileCount++;
  const code = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const syntaxErrors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (syntaxErrors.length > 0) {
    errorCount++;
    console.log(`\n--- ${file} ---`);
    for (const d of syntaxErrors) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (d.file && d.start !== undefined) {
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        console.log(`  line ${line + 1}:${character + 1} - ${msg}`);
      } else {
        console.log(`  ${msg}`);
      }
    }
  }
}

walk(root);
console.log(`\nChecked ${fileCount} files, ${errorCount} with syntax errors.`);
process.exit(errorCount > 0 ? 1 : 0);
