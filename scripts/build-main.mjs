import fs from "fs";
import path from "path";

const src = path.resolve("src/main");
const dest = path.resolve("dist/main");

fs.mkdirSync(dest, { recursive: true });

fs.copyFileSync(
  path.join(src, "electron-main.js"),
  path.join(dest, "electron-main.js")
);

fs.copyFileSync(
  path.join(src, "preload.js"),
  path.join(dest, "preload.js")
);

fs.copyFileSync(
  path.join(src, "ppt-dg-dto.js"),
  path.join(dest, "ppt-dg-dto.js")
);

// PowerShell scripts for PowerPoint generation
fs.copyFileSync(
  path.join(src, "ppt-build.ps1"),
  path.join(dest, "ppt-build.ps1")
);

fs.copyFileSync(
  path.join(src, "ppt-post-process.ps1"),
  path.join(dest, "ppt-post-process.ps1")
);

console.log("✅ Electron main & preload kopiert til dist/");
