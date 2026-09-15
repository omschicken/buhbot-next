"use client";
import { useEffect, useState } from "react";
import { calcSummary, calcTax, formatRub, CATEGORIES, type PendingTransaction } from "@/types";

interface Props {
  pendingTransactions: PendingTransaction[];
}

interface SummaryData {
  sale: number;
  purchase: number;
  purchase_fee: number;
  sale_fee: number;
  transfer_fee: number;
  subscription: number;
  total_income: number;
  total_expense: number;
  net_profit: number;
}

interface TaxData {
  base: number;
  tax13: number;
  tax15: number;
  total_tax: number;
  after_tax: number;
}

function Row({ label, value, accent, amber, negative }: {
  label: string;
  value: number;
  accent?: boolean;
  amber?: boolean;
  negative?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 13, color: "var(--text2)" }}>{label}</span>
      <span
        className="mono"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: accent ? "var(--accent)" : amber ? "var(--amber)" : negative ? "var(--red)" : "var(--text)",
        }}
      >
        {formatRub(value)}
      </span>
    </div>
  );
}

export default function SummaryPanel({ pendingTransactions }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [savedSummary, setSavedSummary] = useState<SummaryData | null>(null);
  const [savedTax, setSavedTax] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/summary?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setSavedSummary(d.summary);
        setSavedTax(d.tax);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  // Combine saved + pending
  const pendingFiltered = pendingTransactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year;
  });

  const pendingSummary = calcSummary(pendingFiltered);
  const hasPending = pendingFiltered.length > 0;

  const combined: SummaryData = savedSummary
    ? {
        sale: savedSummary.sale + pendingSummary.sale,
        purchase: savedSummary.purchase + pendingSummary.purchase,
        purchase_fee: savedSummary.purchase_fee + pendingSummary.purchase_fee,
        sale_fee: savedSummary.sale_fee + pendingSummary.sale_fee,
        transfer_fee: savedSummary.transfer_fee + pendingSummary.transfer_fee,
        subscription: savedSummary.subscription + pendingSummary.subscription,
        total_income: savedSummary.total_income + pendingSummary.total_income,
        total_expense: savedSummary.total_expense + pendingSummary.total_expense,
        net_profit: savedSummary.net_profit + pendingSummary.net_profit,
      }
    : pendingSummary;

  const tax = calcTax(combined.net_profit);

  const years = [];
  for (let y = currentYear; y >= 2020; y--) years.push(y);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        minWidth: 280,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 15, margin: 0 }}>
          Сводка за год
        </h2>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: "4px 8px", fontSize: 13 }}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: "var(--text2)", fontSize: 13 }}>Загрузка...</p>}

      {hasPending && (
        <div
          style={{
            background: "var(--amber-light)",
            border: "1px solid var(--amber)",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 12,
            fontSize: 12,
            color: "var(--amber)",
            fontFamily: "Manrope, sans-serif",
            fontWeight: 600,
          }}
        >
          + {pendingFiltered.length} операций не сохранено
        </div>
      )}

      {/* Доходы */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          Доходы
        </div>
        <div
          className="stat-card"
          style={{ padding: "10px 14px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text2)" }}>Продажа крипты</span>
            <span className="mono accent-text" style={{ fontSize: 18, fontWeight: 700 }}>
              {formatRub(combined.sale, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Расходы */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          Расходы
        </div>
        <div className="stat-card" style={{ padding: "10px 14px" }}>
          <Row label="Покупка крипты" value={combined.purchase} />
          <Row label="Комиссия за покупку" value={combined.purchase_fee} />
          <Row label="Комиссия за продажу" value={combined.sale_fee} />
          <Row label="Комиссия перевода" value={combined.transfer_fee} />
          <Row label="Подписка СберПервый" value={combined.subscription} />
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
            <Row label="Итого расходы" value={combined.total_expense} negative />
          </div>
        </div>
      </div>

      {/* Чистая прибыль */}
      <div
        className="stat-card"
        style={{
          padding: "12px 14px",
          marginBottom: 12,
          background: combined.net_profit >= 0 ? "var(--accent-light)" : "var(--red-light)",
          borderColor: combined.net_profit >= 0 ? "var(--accent)" : "var(--red)",
        }}
      >
        <div style={{ fontSize: 12, color: combined.net_profit >= 0 ? "var(--accent)" : "var(--red)", marginBottom: 4, fontWeight: 600, fontFamily: "Manrope, sans-serif" }}>
          Чистая прибыль
        </div>
        <div
          className="mono"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: combined.net_profit >= 0 ? "var(--accent)" : "var(--red)",
          }}
        >
          {formatRub(combined.net_profit, 0)}
        </div>
      </div>

      {/* НДФЛ */}
      {combined.net_profit > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            НДФЛ
          </div>
          <div
            className="stat-card"
            style={{ padding: "10px 14px", background: "var(--amber-light)", borderColor: "var(--amber)" }}
          >
            <Row label="База" value={tax.base} amber />
            {tax.tax13 > 0 && <Row label="13% (до 2,4 млн)" value={tax.tax13} amber />}
            {tax.tax15 > 0 && <Row label="15% (свыше 2,4 млн)" value={tax.tax15} amber />}
            <div style={{ borderTop: "1px solid var(--amber)", marginTop: 6, paddingTop: 6 }}>
              <Row label="Итого НДФЛ" value={tax.total_tax} amber />
            </div>
          </div>
        </div>
      )}

      {/* Прибыль после налога */}
      <div className="stat-card" style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>Прибыль после налога</div>
        <div
          className="mono"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: tax.after_tax >= 0 ? "var(--accent)" : "var(--red)",
          }}
        >
          {formatRub(tax.after_tax, 0)}
        </div>
      </div>
    </div>
  );
}
