"use client";
import { useRef, useState } from "react";
import { SOURCES, CATEGORIES, detectCategory, type SourceKey, type CategoryKey, type PendingTransaction, type PendingFile } from "@/types";

interface CsvMapping {
  date: string | null;
  amount: string | null;
  fee: string | null;
  type: string | null;
  defaultCategory: CategoryKey;
}

interface CsvPreview {
  headers: string[];
  rows: Record<string, string>[];
  detected: { date: string | null; amount: string | null; fee: string | null; type: string | null };
  total: number;
  file: PendingFile;
}

interface AutoParsedTx {
  date: string;
  category: string;
  amount: number;
  note: string;
}

interface PdfPreview {
  text: string;
  pages: number;
  file: PendingFile;
  parsed: AutoParsedTx[] | null; // null = unknown format, manual entry needed
}

interface Props {
  pendingFiles: PendingFile[];
  setPendingFiles: (f: PendingFile[]) => void;
  onAddTransactions: (txs: PendingTransaction[]) => void;
}

let idSeq = 0;
const uid = () => `t_${++idSeq}_${Date.now()}`;

export default function UploadTab({ pendingFiles, setPendingFiles, onAddTransactions }: Props) {
  const [source, setSource] = useState<SourceKey>("abcex");
  const [statementType, setStatementType] = useState(SOURCES[0].statementTypes[0]);
  const [dragging, setDragging] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvMapping, setCsvMapping] = useState<CsvMapping>({ date: null, amount: null, fee: null, type: null, defaultCategory: "purchase" });
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [pdfRows, setPdfRows] = useState<Partial<PendingTransaction>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSource = SOURCES.find((s) => s.key === source)!;

  function handleSourceChange(key: SourceKey) {
    setSource(key);
    const src = SOURCES.find((s) => s.key === key)!;
    setStatementType(src.statementTypes[0]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    for (const file of Array.from(files)) {
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const pendingFile: PendingFile = {
        id: uid(),
        name: file.name,
        source,
        statementType,
        file,
      };
      if (!isPdf) {
        await parseCsv(file, pendingFile);
      } else {
        await parsePdf(file, pendingFile);
      }
    }
  }

  async function parseCsv(file: File, pf: PendingFile) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCsvPreview({ ...data, file: pf });
      setCsvMapping({
        date: data.detected.date,
        amount: data.detected.amount,
        fee: data.detected.fee,
        type: data.detected.type,
        defaultCategory: source === "sber" ? "transfer_fee" : "purchase",
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function parsePdf(file: File, pf: PendingFile) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", source);
      fd.append("statementType", statementType);
      const res = await fetch("/api/parse-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const preview: PdfPreview = { text: data.text, pages: data.pages, file: pf, parsed: data.parsed ?? null };
      setPdfPreview(preview);
      if (data.parsed && data.parsed.length > 0) {
        // Use auto-detected source/type if available, otherwise fall back to user selection
        const rowSource = data.detectedSource || source;
        const rowStatementType = data.detectedStatementType || statementType;
        setPdfRows(data.parsed.map((p: AutoParsedTx) => ({
          date: p.date.slice(0, 10),
          source: rowSource,
          statementType: rowStatementType,
          category: p.category,
          amount: p.amount,
          note: p.note,
        })));
      } else {
        setPdfRows([{ date: new Date().toISOString().slice(0, 10), source, statementType, category: "other", amount: 0, note: "" }]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function confirmCsv() {
    if (!csvPreview) return;
    const { rows, file } = csvPreview;
    const { date: dateCol, amount: amtCol, fee: feeCol, type: typeCol, defaultCategory } = csvMapping;
    const txs: PendingTransaction[] = [];
    for (const row of rows) {
      const dateStr = dateCol ? row[dateCol] : "";
      const amtStr = amtCol ? row[amtCol] : "0";
      const feeStr = feeCol ? row[feeCol] : "0";
      const typeStr = typeCol ? row[typeCol] : "";

      const parsedDate = dateStr ? new Date(dateStr) : new Date();
      const isoDate = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

      const amt = parseFloat(amtStr.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      const fee = parseFloat(feeStr.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;

      const cat = detectCategory(typeStr, file.source, defaultCategory);

      if (amt !== 0) {
        txs.push({
          id: uid(),
          date: isoDate,
          source: file.source,
          statementType: file.statementType,
          category: cat,
          amount: Math.abs(amt),
          note: typeStr,
        });
      }
      if (fee !== 0) {
        txs.push({
          id: uid(),
          date: isoDate,
          source: file.source,
          statementType: file.statementType,
          category: source === "sber" ? "transfer_fee" : "purchase_fee",
          amount: Math.abs(fee),
          note: `Комиссия: ${typeStr}`,
        });
      }
    }

    setPendingFiles([...pendingFiles, file]);
    onAddTransactions(txs);
    setCsvPreview(null);
  }

  function confirmPdf() {
    if (!pdfPreview) return;
    const valid = pdfRows.filter((r) => r.amount && r.amount !== 0 && r.date && r.category) as PendingTransaction[];
    const txs = valid.map((r) => ({ ...r, id: uid(), source: pdfPreview.file.source, statementType: pdfPreview.file.statementType }));
    setPendingFiles([...pendingFiles, pdfPreview.file]);
    onAddTransactions(txs);
    setPdfPreview(null);
    setPdfRows([]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Source selector */}
      <div className="surface" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Manrope, sans-serif", color: "var(--text2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Источник
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {SOURCES.map((s) => (
            <button key={s.key} className={`chip ${source === s.key ? "active" : ""}`} onClick={() => handleSourceChange(s.key as SourceKey)}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Manrope, sans-serif", color: "var(--text2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Тип выписки
        </div>
        <select value={statementType} onChange={(e) => setStatementType(e.target.value)}>
          {currentSource.statementTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
        <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          Перетащите файлы или нажмите для выбора
        </div>
        <div style={{ fontSize: 13 }}>CSV или PDF — {currentSource.label}</div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.pdf"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {loading && <p style={{ color: "var(--text2)", fontSize: 14 }}>Обработка файла...</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>}

      {/* Added files list */}
      {pendingFiles.length > 0 && (
        <div className="surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Manrope, sans-serif", color: "var(--text2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Файлы текущего раунда ({pendingFiles.length})
          </div>
          {pendingFiles.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 18 }}>{f.name.endsWith(".pdf") ? "📄" : "📊"}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{SOURCES.find(s=>s.key===f.source)?.label} · {f.statementType}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <CsvPreviewModal
          preview={csvPreview}
          mapping={csvMapping}
          setMapping={setCsvMapping}
          onConfirm={confirmCsv}
          onCancel={() => setCsvPreview(null)}
        />
      )}

      {/* PDF Preview */}
      {pdfPreview && (
        <PdfPreviewPanel
          preview={pdfPreview}
          rows={pdfRows}
          setRows={setPdfRows}
          source={source}
          statementType={statementType}
          onConfirm={confirmPdf}
          onCancel={() => { setPdfPreview(null); setPdfRows([]); }}
        />
      )}
    </div>
  );
}

function CsvPreviewModal({ preview, mapping, setMapping, onConfirm, onCancel }: {
  preview: CsvPreview;
  mapping: CsvMapping;
  setMapping: (m: CsvMapping) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const noneOpt = <option value="">— не использовать —</option>;
  const colOpts = [noneOpt, ...preview.headers.map((h) => <option key={h} value={h}>{h}</option>)];

  return (
    <div className="surface" style={{ padding: 20 }}>
      <h3 style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>
        Сопоставление колонок CSV: {preview.file.name}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>
        Найдено {preview.total} строк. Проверьте и скорректируйте сопоставление колонок:
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {(["date", "amount", "fee", "type"] as const).map((field) => (
          <label key={field} style={{ fontSize: 13 }}>
            <div style={{ color: "var(--text2)", marginBottom: 4, fontWeight: 600 }}>
              {field === "date" ? "Дата" : field === "amount" ? "Сумма" : field === "fee" ? "Комиссия" : "Тип операции"}
            </div>
            <select
              value={mapping[field] || ""}
              onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || null })}
            >
              {colOpts}
            </select>
          </label>
        ))}
        <label style={{ fontSize: 13 }}>
          <div style={{ color: "var(--text2)", marginBottom: 4, fontWeight: 600 }}>Категория по умолчанию</div>
          <select
            value={mapping.defaultCategory}
            onChange={(e) => setMapping({ ...mapping, defaultCategory: e.target.value as CategoryKey })}
          >
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {/* Preview table */}
      <div className="scrollable-table" style={{ maxHeight: 240, overflow: "auto", marginBottom: 16 }}>
        <table>
          <thead>
            <tr>{preview.headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {preview.rows.slice(0, 10).map((row, i) => (
              <tr key={i}>{preview.headers.map((h) => <td key={h}>{row[h]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-primary" onClick={onConfirm}>Импортировать</button>
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

function PdfPreviewPanel({ preview, rows, setRows, source, statementType, onConfirm, onCancel }: {
  preview: PdfPreview;
  rows: Partial<PendingTransaction>[];
  setRows: (r: Partial<PendingTransaction>[]) => void;
  source: SourceKey;
  statementType: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  function updateRow(i: number, key: string, value: string | number) {
    const updated = rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r));
    setRows(updated);
  }
  function addRow() {
    setRows([...rows, { date: new Date().toISOString().slice(0, 10), source, statementType, category: "other", amount: 0, note: "" }]);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  const isAutoParsed = preview.parsed !== null;

  return (
    <div className="surface" style={{ padding: 20 }}>
      <h3 style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
        PDF: {preview.file.name} ({preview.pages} стр.)
      </h3>

      {isAutoParsed ? (
        <div style={{
          background: "var(--accent-light)",
          border: "1px solid var(--accent)",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 14,
          fontSize: 13,
          color: "var(--accent)",
          fontFamily: "Manrope, sans-serif",
          fontWeight: 600,
        }}>
          ✓ Формат распознан автоматически — извлечено {preview.parsed!.length} операций.
          Проверьте и при необходимости отредактируйте перед добавлением.
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
          Текст из PDF показан ниже. Добавьте операции вручную, ориентируясь на него.
        </p>
      )}
      <textarea
        readOnly
        value={preview.text}
        style={{ width: "100%", height: 180, resize: "vertical", fontSize: 12, fontFamily: "IBM Plex Mono, monospace", boxSizing: "border-box", marginBottom: 16 }}
      />

      <div style={{ marginBottom: 12 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 120px 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="date" value={row.date?.slice(0,10) || ""} onChange={(e) => updateRow(i, "date", e.target.value)} />
            <select value={row.category || "other"} onChange={(e) => updateRow(i, "category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input type="number" placeholder="Сумма ₽" value={row.amount || ""} onChange={(e) => updateRow(i, "amount", parseFloat(e.target.value) || 0)} />
            <input type="text" placeholder="Заметка" value={row.note || ""} onChange={(e) => updateRow(i, "note", e.target.value)} />
            <button className="btn-ghost" style={{ padding: "6px 10px" }} onClick={() => removeRow(i)}>✕</button>
          </div>
        ))}
        <button className="btn-ghost" onClick={addRow} style={{ marginTop: 4 }}>+ Добавить строку</button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-primary" onClick={onConfirm}>Добавить в операции</button>
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}
