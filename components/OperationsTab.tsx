"use client";
import { useState } from "react";
import { CATEGORIES, SOURCES, formatRub, type PendingTransaction, type PendingFile, type CategoryKey } from "@/types";

interface Props {
  transactions: PendingTransaction[];
  setTransactions: (t: PendingTransaction[]) => void;
  pendingFiles: PendingFile[];
  setPendingFiles: (f: PendingFile[]) => void;
  onSaved: () => void;
}

export default function OperationsTab({ transactions, setTransactions, pendingFiles, setPendingFiles, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateTx(id: string, key: keyof PendingTransaction, value: string | number) {
    setTransactions(transactions.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
  }

  function removeTx(id: string) {
    setTransactions(transactions.filter((t) => t.id !== id));
  }

  async function saveRound() {
    if (transactions.length === 0) {
      setError("Нет операций для сохранения");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("transactions", JSON.stringify(transactions));
      const filesMeta = pendingFiles.map((f) => ({
        name: f.name,
        source: f.source,
        statementType: f.statementType,
      }));
      fd.append("filesMeta", JSON.stringify(filesMeta));
      pendingFiles.forEach((pf, i) => fd.append(`file_${i}`, pf.file));

      const res = await fetch("/api/rounds", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Ошибка сохранения");
      }
      setTransactions([]);
      setPendingFiles([]);
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
  const srcMap = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));

  const total = transactions.reduce((acc, t) => {
    const cat = catMap[t.category];
    if (cat?.type === "income") return acc + t.amount;
    if (cat?.type === "expense") return acc - t.amount;
    return acc;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 18, margin: 0 }}>
            Операции текущего раунда
          </h2>
          <p style={{ color: "var(--text2)", fontSize: 13, margin: "4px 0 0" }}>
            {transactions.length} операций · Итог: {" "}
            <span className="mono" style={{ color: total >= 0 ? "var(--accent)" : "var(--red)", fontWeight: 600 }}>
              {formatRub(total)}
            </span>
          </p>
        </div>
        <button className="btn-primary" onClick={saveRound} disabled={saving || transactions.length === 0}>
          {saving ? "Сохраняем..." : "💾 Сохранить раунд в архив"}
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}

      {transactions.length === 0 ? (
        <div className="surface" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 600 }}>Нет операций</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Загрузите выписки на вкладке «Загрузка»</div>
        </div>
      ) : (
        <div className="surface scrollable-table">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Источник</th>
                <th>Категория</th>
                <th style={{ textAlign: "right" }}>Сумма ₽</th>
                <th>Заметка</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const cat = catMap[t.category];
                return (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="date"
                        value={t.date.slice(0, 10)}
                        onChange={(e) => updateTx(t.id, "date", new Date(e.target.value).toISOString())}
                        style={{ padding: "3px 6px", fontSize: 13 }}
                      />
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text2)", whiteSpace: "nowrap" }}>
                      {srcMap[t.source] || t.source}
                    </td>
                    <td>
                      <select
                        value={t.category}
                        onChange={(e) => updateTx(t.id, "category", e.target.value)}
                        style={{ fontSize: 13, padding: "3px 6px" }}
                      >
                        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <input
                        type="number"
                        value={t.amount}
                        onChange={(e) => updateTx(t.id, "amount", parseFloat(e.target.value) || 0)}
                        style={{ textAlign: "right", width: 110, fontSize: 13 }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={t.note}
                        onChange={(e) => updateTx(t.id, "note", e.target.value)}
                        style={{ width: "100%", minWidth: 120, fontSize: 13 }}
                        placeholder="Заметка"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeTx(t.id)}
                        style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 16 }}
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
