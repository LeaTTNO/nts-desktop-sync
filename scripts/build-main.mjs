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

console.log("✅ Electron main & preload kopiert til dist/");
