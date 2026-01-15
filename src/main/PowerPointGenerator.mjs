// src/main/PowerPointGenerator.mjs
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { replaceInPptx } from "./PowerPointXmlReplacer.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// args: {language, departureDate (string|null), modules: [{id,name,blob}]}
export async function generatePowerPoint(args) {
  // Strategy:
  // - choose base template (for demonstrasjon: use a local base.pptx in src/main/templates/base.pptx)
  // - merge module pptx parts (for simplicity, we will open base and run the replacer that inserts module text placeholders)
  // - call replaceInPptx to run DG/DTO replacements
  // - return Buffer or path

  const basePath = path.join(__dirname, "templates", "base.pptx");
  const outPath = path.join(__dirname, "out", `program-${Date.now()}.pptx`);
  await fs.mkdir(path.join(__dirname,"out"), { recursive: true });

  // copy base to out
  await fs.copyFile(basePath, outPath);

  // run replacement engine (inject DG/DTO)
  const res = await replaceInPptx({
    pptxPath: outPath,
    departureDate: args.departureDate || null,
    // modules could affect replacements — here we only run DG/DTO replacement
  });

  return { path: outPath, replaced: res };
}
