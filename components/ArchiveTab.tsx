"use client";
import { useEffect, useState } from "react";
import { CATEGORIES, SOURCES, calcSummary, formatRub } from "@/types";

interface TxRecord {
  id: string;
  date: string;
  source: string;
  statementType: string;
  category: string;
  amount: number;
  note?: string;
}

interface FileRecord {
  id: string;
  name: string;
  url: string;
  source: string;
  statementType: string;
}

interface RoundRecord {
  id: string;
  createdAt: string;
  files: FileRecord[];
  transactions: TxRecord[];
}

interface Props {
  refreshKey: number;
}

export default function ArchiveTab({ refreshKey }: Props) {
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/rounds")
      .then((r) => r.json())
      .then(setRounds)
      .catch(() => setError("Ошибка загрузки архива"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  }

  async function deleteRound(id: string) {
    if (!confirm("Удалить раунд и все его данные? Это действие нельзя отменить.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/rounds/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
      setRounds(rounds.filter((r) => r.id !== id));
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(null);
    }
  }

  const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
  const srcMap = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));

  if (loading) return <p style={{ color: "var(--text2)" }}>Загрузка архива...</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (rounds.length === 0) return (
    <div className="surface" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🗄️</div>
      <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 600 }}>Архив пуст</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Сохранённые раунды появятся здесь</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rounds.map((round) => {
        const sum = calcSummary(round.transactions);
        const isExpanded = expanded.has(round.id);
        const date = new Date(round.createdAt).toLocaleString("ru-RU");

        return (
          <div key={round.id} className="surface" style={{ overflow: "hidden" }}>
            {/* Header */}
            <div
              onClick={() => toggle(round.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                cursor: "pointer",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>{isExpanded ? "🔽" : "▶️"}</span>
                <div>
                  <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14 }}>
                    Раунд {date}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>
                    {round.transactions.length} операций · {round.files.length} файлов
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>Прибыль</div>
                  <div className="mono" style={{ fontWeight: 700, color: sum.net_profit >= 0 ? "var(--accent)" : "var(--red)" }}>
                    {formatRub(sum.net_profit, 0)}
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: "5px 12px", fontSize: 13, color: "var(--red)", borderColor: "var(--red)" }}
                  onClick={(e) => { e.stopPropagation(); deleteRound(round.id); }}
                  disabled={deleting === round.id}
                >
                  {deleting === round.id ? "..." : "Удалить"}
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                  {[
                    { label: "Продажа", value: sum.sale, accent: true },
                    { label: "Покупка", value: sum.purchase },
                    { label: "Ком. покупка", value: sum.purchase_fee },
                    { label: "Ком. продажа", value: sum.sale_fee },
                    { label: "Ком. перевод", value: sum.transfer_fee },
                    { label: "Подписка", value: sum.subscription },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="surface2" style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 2 }}>{label}</div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: accent ? "var(--accent)" : "var(--text)" }}>
                        {formatRub(value, 0)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Files */}
                {round.files.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Файлы
                    </div>
                    {round.files.map((f) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <span style={{ fontSize: 16 }}>{f.name.endsWith(".pdf") ? "📄" : "📊"}</span>
                        <span style={{ fontSize: 13, flex: 1 }}>{f.name}</span>
                        <span style={{ fontSize: 12, color: "var(--text2)" }}>{srcMap[f.source] || f.source}</span>
                        {f.url ? (
                          <a href={`/api/rounds/${round.id}/file/${f.id}`} download style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none" }}>
                            ⬇ Скачать
                          </a>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text2)" }}>нет ссылки</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Transactions */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Операции
                  </div>
                  <div className="scrollable-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Источник</th>
                          <th>Категория</th>
                          <th style={{ textAlign: "right" }}>Сумма ₽</th>
                          <th>Заметка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {round.transactions.map((t) => {
                          const cat = catMap[t.category];
                          return (
                            <tr key={t.id}>
                              <td className="mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{new Date(t.date).toLocaleDateString("ru-RU")}</td>
                              <td style={{ fontSize: 13, color: "var(--text2)" }}>{srcMap[t.source] || t.source}</td>
                              <td>
                                <span className={`badge badge-${cat?.type === "income" ? "income" : cat?.type === "expense" ? "expense" : "info"}`}>
                                  {cat?.label || t.category}
                                </span>
                              </td>
                              <td className="mono" style={{ textAlign: "right", fontWeight: 600, color: cat?.type === "income" ? "var(--accent)" : cat?.type === "expense" ? "var(--red)" : "var(--text)" }}>
                                {formatRub(t.amount)}
                              </td>
                              <td style={{ fontSize: 12, color: "var(--text2)" }}>{t.note}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
