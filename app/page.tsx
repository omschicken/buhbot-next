"use client";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import UploadTab from "@/components/UploadTab";
import OperationsTab from "@/components/OperationsTab";
import ArchiveTab from "@/components/ArchiveTab";
import SummaryPanel from "@/components/SummaryPanel";
import type { PendingTransaction, PendingFile } from "@/types";

type Tab = "upload" | "operations" | "archive";

export default function Home() {
  const [tab, setTab] = useState<Tab>("upload");
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [archiveRefresh, setArchiveRefresh] = useState(0);

  function addTransactions(txs: PendingTransaction[]) {
    setPendingTransactions((prev) => [...prev, ...txs]);
    setTab("operations");
  }

  function onSaved() {
    setArchiveRefresh((k) => k + 1);
    setTab("archive");
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "upload", label: "Загрузка выписок" },
    { key: "operations", label: "Операции", badge: pendingTransactions.length || undefined },
    { key: "archive", label: "Архив раундов" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 52,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>₿</span>
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontWeight: 800,
              fontSize: 16,
              color: "var(--text)",
            }}
          >
            Бухгалтер
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text2)",
              borderLeft: "1px solid var(--border)",
              paddingLeft: 12,
              display: "none",
            }}
            className="hidden sm:block"
          >
            Калькулятор крипто-арбитража
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Layout */}
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "20px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 20,
          alignItems: "start",
        }}
        className="main-grid"
      >
        {/* Left: tabs + content */}
        <div style={{ minWidth: 0 }}>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid var(--border)",
              marginBottom: 20,
              overflowX: "auto",
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
                style={{ whiteSpace: "nowrap" }}
              >
                {t.label}
                {t.badge ? (
                  <span
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "1px 6px",
                      fontSize: 11,
                      marginLeft: 6,
                      fontFamily: "Manrope, sans-serif",
                    }}
                  >
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "upload" && (
            <UploadTab
              pendingFiles={pendingFiles}
              setPendingFiles={setPendingFiles}
              onAddTransactions={addTransactions}
            />
          )}
          {tab === "operations" && (
            <OperationsTab
              transactions={pendingTransactions}
              setTransactions={setPendingTransactions}
              pendingFiles={pendingFiles}
              setPendingFiles={setPendingFiles}
              onSaved={onSaved}
            />
          )}
          {tab === "archive" && <ArchiveTab refreshKey={archiveRefresh} />}
        </div>

        {/* Right: summary panel */}
        <div>
          <SummaryPanel pendingTransactions={pendingTransactions} />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .main-grid {
            grid-template-columns: 1fr !important;
          }
          .main-grid > div:last-child {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
}
