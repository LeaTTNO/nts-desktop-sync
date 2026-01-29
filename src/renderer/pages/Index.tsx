import React, { useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import UserMenu from "@/components/UserMenu";
import TravelProgramBuilder from "@/components/builder/TravelProgramBuilder";
import FlightRobot from "@/components/builder/FlightRobot";
import TemplateLibrary from "@/components/builder/TemplateLibrary";
import { useTemplateStore } from "@/store/useTemplateStore";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { FlightInfoProvider } from "@/contexts/FlightInfoContext";
import "../styles/tt-layout.css";

import logoWhite from "@/assets/logo-white.png";
import giraffeBg from "@/assets/savana.jpg";
import giraffeHead from "@/assets/Giraffe-head.png";
import titleDivider from "@/assets/title-divider.png";

type TabType = "builder" | "flight" | "library";

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabType>("builder");
  const { isAdmin } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const getPageTitle = () => {
    switch (activeTab) {
      case "builder": return t.tabs.builder;
      case "flight": return t.tabs.flight;
      case "library": return t.tabs.library;
    }
  };

  return (
    <FlightInfoProvider>
      <div
        className="layout-root"
        style={{ backgroundImage: `url(${giraffeBg})` }}
      >

        {/* TOP BAR */}
        <header className="tt-topbar">
          <div className="tt-topbar-inner">
            <div className="tt-logo-wrap">
              <img src={logoWhite} className="tt-logo" alt="Logo" />
            </div>

            <nav className="tt-nav-links">
              <a>SAFARI</a>
              <a>ZANZIBAR</a>
              <a>KILIMANJARO</a>
            </nav>

            <div className="tt-header-right">
              <div className="tt-logginn-wrap">
                <UserMenu />
                <div className="tt-lang-below">
                  <LanguageToggle
                    language={language}
                    onLanguageChange={setLanguage}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* TABS */}
        <div className="tabs-floating">
          <button
            className={`tab-btn ${activeTab === "builder" ? "active" : ""}`}
            onClick={() => setActiveTab("builder")}
          >
            {t.tabs.builder}
          </button>
          <button
            className={`tab-btn ${activeTab === "flight" ? "active" : ""}`}
            onClick={() => setActiveTab("flight")}
          >
            {t.tabs.flight}
          </button>
          <button
            className={`tab-btn ${activeTab === "library" ? "active" : ""}`}
            onClick={() => setActiveTab("library")}
          >
            {t.tabs.library}
          </button>
        </div>

        {/* CONTENT */}
        <div className="page-wrapper">
          <div className="content-wrapper">

            {/* 📦 BOKS (ANKER) */}
            <div className="layout-content">

              {/* 🦒 GIRAFF – NÅ KORREKT FORANKRET */}
              <img
                src={giraffeHead}
                className="giraffe-overlay"
                alt=""
              />

              <div className="tt-title-wrap">
                <div className="flex items-center justify-center gap-2">
                  <h1 className="tt-page-title">{getPageTitle()}</h1>
                  {isAdmin && activeTab === "library" && (
                    <span title="Admin" style={{ marginTop: "-4px" }}>★</span>
                  )}
                </div>

                <div className="tt-divider">
                  <img src={titleDivider} alt="" />
                </div>
              </div>

              <div className="tt-content-card">
                {activeTab === "builder" && (
                  <TravelProgramBuilder language={language} />
                )}
                {activeTab === "flight" && <FlightRobot />}
                {activeTab === "library" && <TemplateLibrary />}
              </div>

            </div>
          </div>
        </div>

      </div>
    </FlightInfoProvider>
  );
}
