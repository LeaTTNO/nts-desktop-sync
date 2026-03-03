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

// Also copy icon from build/ to dist/main/
const iconSrc = path.resolve("build/logo-white.ico");
const iconDest = path.join(dest, "logo-white.ico");

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

// Copy icon
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDest);
  const iconStats = fs.statSync(iconDest);
  console.log(`✅ ${"logo-white.ico".padEnd(25)} (${iconStats.size} bytes)`);
} else {
  console.warn(`⚠️ Warning: logo-white.ico not found in build/`);
}

console.log("=".repeat(50));
console.log("✅ Alle Electron main-filer kopiert til dist/\n");
