// src/renderer/components/TravelProgramBuilder.tsx
import React, { useState } from "react";
import TemplateDropdown from "./TemplateDropdown";
import { useTemplateStore } from "../store/useTemplateStore";

export default function TravelProgramBuilder() {
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [departureDate, setDepartureDate] = useState<string>(""); // ISO string: yyyy-mm-dd

  // get templates from store
  const templates = useTemplateStore((s) => s.templates);
  const baseTemplate = useTemplateStore((s) => s.baseTemplate); // you MUST have this in store

  async function handleGenerate() {
    if (!baseTemplate?.blob) {
      alert("Ingen base-mal funnet. Last opp en base-PPT først.");
      return;
    }

    // Convert base blob to ArrayBuffer
    const baseBuffer = await baseTemplate.blob.arrayBuffer();

    // Convert selected modules
    const moduleObjects = selectedModules
      .map((id) => templates.find((t) => t.id === id))
      .filter(Boolean)
      .map((mod) => ({
        id: mod!.id,
        name: mod!.name,
        blob: mod!.blob, // original blob (PowerPointXmlReplacer håndterer DG/DTO)
      }));

    window.electronAPI
      .generatePpt({
        base: baseBuffer,
        modules: moduleObjects,
        language: "no",
        departureDate: departureDate || null,
      })
      .then((res) => {
        if (!res.success) {
          alert("Feil under generering: " + res.error);
          return;
        }
        alert("PowerPoint generert!\n" + res.path);
        window.electronAPI.openFolder(res.path);
      });
  }

  return (
    <div className="card animate-fade-in">

      <h2 className="section-title mb-4">Bygg reiseprogram</h2>

      {/* UTREISEDATO */}
      <label className="block mb-4">
        <span className="font-medium text-primary">Utreisedato (valgfritt)</span>
        <input
          type="date"
          className="input mt-1"
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
        />
      </label>

      {/* MODULER */}
      <TemplateDropdown
        selected={selectedModules}
        setSelected={setSelectedModules}
      />

      {/* GENERER */}
      <button className="btn primary mt-6 w-full" onClick={handleGenerate}>
        Generer PowerPoint
      </button>
    </div>
  );
}
