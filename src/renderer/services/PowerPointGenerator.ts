// src/main/PowerPointGenerator.js
import fs from "fs";
import path from "path";
import { replaceXmlInPpt } from "./PowerPointXmlReplacer.mjs"; // ensure this export exists
import { processDGDTO } from "./ppt-dg-dto.js"; // your node helper (CommonJS or ESM). adjust if needed

export async function generatePowerPoint({ base = null, modules = [], language = "no", departureDate = null }) {
  // base: ArrayBuffer | null, modules: [{id,name,blob}]
  // returns: path to generated pptx or buffer

  // Basic flow:
  // 1) Build a new pptx by merging base + modules (your existing logic)
  // 2) Run XML replacer to substitute text placeholders
  // 3) Run DG/DTO processor (dates)
  // 4) Save to a temp file and return path

  const tmpOut = path.join(process.cwd(), "tmp", `generated_${Date.now()}.pptx`);
  await fs.promises.mkdir(path.dirname(tmpOut), { recursive: true });

  // Naive merge: if base provided, use it; else use first module.blob
  let initial = base;
  if (!initial && modules.length > 0 && modules[0].blob) {
    initial = modules[0].blob;
  }
  if (!initial) {
    throw new Error("No base PPT provided");
  }

  // Convert ArrayBuffer to Buffer if needed
  const baseBuffer = Buffer.from(initial);

  // Write base to temp
  const tmpBase = tmpOut + ".base.pptx";
  await fs.promises.writeFile(tmpBase, baseBuffer);

  // Here you should merge modules into the base using your existing merging logic.
  // For now: pass tmpBase to xml replacer and DG/DTO processor as example.

  // Example: replace placeholders
  await replaceXmlInPpt(tmpBase, tmpOut, {
    // pass replacements object if needed
  });

  // Apply DG/DTO processing (assuming processDGDTO accepts a path and date)
  if (typeof processDGDTO === "function") {
    await processDGDTO(tmpOut, departureDate);
  }

  // Return path for now
  return { path: tmpOut };
}
