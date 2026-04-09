import React, { useState, useCallback } from "react";
import FlightRobot from "./FlightRobot";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, X } from "lucide-react";
import "../Flyrobott.css";

interface Tab {
  id: string;
  label: string;
}

let tabCounter = 1;

const translations = {
  no: { newTab: "Ny fane", tab: "Søk" },
  da: { newTab: "Ny fane", tab: "Søgning" },
};

export default function FlightRobotTabs() {
  const { language } = useLanguage();
  const t = translations[language] || translations.no;

  const [tabs, setTabs] = useState<Tab[]>([
    { id: `tab-${tabCounter}`, label: `${t.tab} 1` },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);

  const addTab = useCallback(() => {
    tabCounter++;
    const newTab: Tab = {
      id: `tab-${tabCounter}`,
      label: `${t.tab} ${tabCounter}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [t.tab]);

  const removeTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setTabs((prev) => {
        if (prev.length <= 1) return prev; // keep at least one tab
        const next = prev.filter((tab) => tab.id !== tabId);
        if (activeTabId === tabId) {
          setActiveTabId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [activeTabId]
  );

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="fr-tabs-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`fr-tab ${activeTabId === tab.id ? "fr-tab-active" : ""}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <span
                className="fr-tab-close"
                onClick={(e) => removeTab(tab.id, e)}
                title={language === "da" ? "Luk fane" : "Lukk fane"}
              >
                <X size={14} />
              </span>
            )}
          </button>
        ))}
        <button
          className="fr-tab fr-tab-add"
          onClick={addTab}
          title={t.newTab}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tab content - all tabs stay mounted, hidden via display */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{ display: activeTabId === tab.id ? "block" : "none" }}
        >
          <FlightRobot />
        </div>
      ))}
    </div>
  );
}
