/**
 * Tabs Component
 * Tab navigation with count badges
 */

import React from "react";

export interface Tab {
  id: string;
  label: string;
  count: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
}: TabsProps): React.ReactElement {
  return (
    <div className="tabs-container" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
        >
          <span className="tab-label">{tab.label}</span>
          <span
            className={`tab-count ${
              tab.id === "exceptions" && tab.count > 0 ? "has-exceptions" : ""
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
