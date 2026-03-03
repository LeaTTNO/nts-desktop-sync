import fs from "fs";
import path from "path";

const src = path.resolve("src/main");
const dest = path.resolve("dist/main");

fs.mkdirSync(dest, { recursive: true });

const filesToCopy = [
  "electron-main.js",
  "preload.js",
  "ppt-dg-dto.js",
  "ppt-build.ps1",
  "ppt-post-process.ps1"
];

console.log("\n🔨 Kopierer Electron main-filer til dist/main/...");
console.log("=".repeat(50));

for (const file of filesToCopy) {
  const srcPath = path.join(src, file);
  const destPath = path.join(dest, file);
  
  if (!fs.existsSync(srcPath)) {
    console.error(`❌ FEIL: ${file} finnes ikke i src/main/`);
    process.exit(1);
  }
  
  fs.copyFileSync(srcPath, destPath);
  const stats = fs.statSync(destPath);
  console.log(`✅ ${file.padEnd(25)} (${stats.size} bytes)`);
}

console.log("=".repeat(50));
console.log("✅ Alle Electron main-filer kopiert til dist/\n");
