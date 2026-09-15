/**
 * Smart PDF parsers for each statement source.
 * Returns structured transactions ready for the operations table.
 */

export interface ParsedTransaction {
  date: string; // ISO
  category: string;
  amount: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Cifra Markets PDFs have spaces between every character: "П о к у п к а".
 *  Removes single inter-character spaces while preserving column separators (2+ spaces). */
export function cleanCifraText(raw: string): string {
  // Replace runs of 3+ spaces with a sentinel
  let s = raw.replace(/\s{3,}/g, "|||");
  // Remove single spaces between non-space chars
  s = s.replace(/([^\s|]) ([^\s|])/g, "$1$2");
  // Second pass (overlapping pairs)
  s = s.replace(/([^\s|]) ([^\s|])/g, "$1$2");
  // Restore separators as single space
  s = s.replace(/\|\|\|/g, " | ");
  return s;
}

function parseRuAmount(s: string): number {
  // "2 970 000,00" or "2970000.00" or "+3 033 000,00"
  return parseFloat(
    s.replace(/\+/, "").replace(/\s/g, "").replace(",", ".")
  ) || 0;
}

function parseDate(s: string): string {
  // "14.09.2026" → full 4-digit year
  if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) {
    const [d, m, y] = s.slice(0, 10).split(".");
    return new Date(`${y}-${m}-${d}`).toISOString();
  }
  // "14.09.26" → 2-digit year (ABCEX format), assume 2000+
  if (/^\d{2}\.\d{2}\.\d{2}$/.test(s.slice(0, 8))) {
    const [d, m, y] = s.slice(0, 8).split(".");
    return new Date(`20${y}-${m}-${d}`).toISOString();
  }
  // "2026-09-07"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return new Date(s.slice(0, 10)).toISOString();
  }
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Sberbank выписка по счёту
// ---------------------------------------------------------------------------
// Operation record spans up to 3 lines:
//   Line A: {date}   {time}   {category}   {±amount}   {balance}
//   Line B: {proc_date}   {auth_code}   {description}
//   Line C (optional): "В сумму операции включена комиссия X руб."
//
// We only extract:
//   transfer_fee   – commission embedded in sberbank-p2p-swift transfers
//   transfer_info  – the p2p-swift transfer itself (reference only)
//   sale           – "Перевод на карту" + "Bank office" (crypto sale proceeds)
//   subscription   – "Премиальное обслуживание"

export function parseSber(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];

  // unpdf returns text as a single string without newlines between records.
  // Strategy: split on each operation date+time boundary, then process each chunk.
  const flat = text
    .replace(/Выписка по платёжному счёту[^]*?Страница \d+ из \d+/g, " ")
    .replace(/Продолжение на следующей странице/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ");

  // Each record starts with "DD.MM.YYYY HH:MM"
  // Split text into chunks by that pattern, keeping the delimiter in each chunk
  const chunkRe = /\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/g;
  const positions: number[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = chunkRe.exec(flat)) !== null) {
    positions.push(cm.index);
  }

  for (let pi = 0; pi < positions.length; pi++) {
    const start = positions[pi];
    const end = positions[pi + 1] ?? flat.length;
    const chunk = flat.slice(start, end).trim();

    const dateMatch = chunk.match(/^(\d{2}\.\d{2}\.\d{4})/);
    if (!dateMatch) continue;
    const dateStr = parseDate(dateMatch[1]);

    // Amount: first pair of "±N NNN,NN  N NNN,NN" after the time (amount then balance)
    const amountMatch = chunk.match(/([+\-]?[\d ]+,\d{2})\s+[\d ]+,\d{2}/);
    const amountRaw = amountMatch ? amountMatch[1] : "0";
    const amount = parseRuAmount(amountRaw);
    const isCredit = amountRaw.trimStart().startsWith("+");

    const lower = chunk.toLowerCase();

    // ── P2P swift transfer ───────────────────────────────────────────────
    if (lower.includes("sberbank-p2p-swift")) {
      results.push({
        date: dateStr,
        category: "transfer_info",
        amount: Math.abs(amount),
        note: chunk.replace(/\s+/g, " ").slice(0, 120),
      });
      const commMatch = chunk.match(/комиссия\s+([\d\s]+[,\.]\d{2})\s*руб/i);
      if (commMatch) {
        results.push({
          date: dateStr,
          category: "transfer_fee",
          amount: parseRuAmount(commMatch[1]),
          note: `Комиссия перевода p2p-swift`,
        });
      }
      continue;
    }

    // ── Crypto sale proceeds ─────────────────────────────────────────────
    if (
      isCredit &&
      (lower.includes("перевод на карту") || lower.includes("перевод на счёт")) &&
      lower.includes("bank office")
    ) {
      results.push({
        date: dateStr,
        category: "sale",
        amount: Math.abs(amount),
        note: `Продажа крипты: ${chunk.replace(/\s+/g, " ").slice(0, 100)}`,
      });
      continue;
    }

    // ── Subscription ─────────────────────────────────────────────────────
    if (
      lower.includes("премиальное обслуживание") ||
      lower.includes("сберпервый") ||
      lower.includes("prime")
    ) {
      results.push({
        date: dateStr,
        category: "subscription",
        amount: Math.abs(amount),
        note: "Подписка СберПервый",
      });
      continue;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Cifra Markets – helper to decode spaced-out text
// ---------------------------------------------------------------------------

function decodeCifra(raw: string): string {
  // Attempt to remove inter-character spaces.
  // Strategy: replace 1-space gaps between [a-яёА-ЯЁa-zA-Z0-9.,/\-:] pairs.
  let s = raw;
  for (let pass = 0; pass < 5; pass++) {
    s = s.replace(/([\wа-яёА-ЯЁ.,/\-:])[ ]([\wа-яёА-ЯЁ.,/\-:])/g, "$1$2");
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Cifra Markets – Broker report (Отчёт брокера) and Depot report (Отчёт депозитария)
// Both contain a trade section with columns:
//   Тикер | ISIN | Рынок | Операция | Кол-во | Цена | Сумма | Комиссия | Дата | Расчёты | Номер сделки
// ---------------------------------------------------------------------------

export function parseCifra(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];

  // Decode spaced characters
  const decoded = decodeCifra(text);

  // Find section boundaries
  const tradesStart = Math.max(
    decoded.indexOf("Исполненныесделки"),
    decoded.indexOf("Сделки,заключённые"),
    decoded.indexOf("Сделки,заключенные"),
  );
  if (tradesStart === -1) return results;

  // Work with just the trades section
  const tradesSection = decoded.slice(tradesStart);

  // Each trade row looks like:
  //   USDT-RUB.IMEX - IMEX Покупка 100 86.570000 8657.00RUR 129.86RUR 2026-09-07 16:56:23 2026-09-07 ...
  // or in depot report:
  //   USDT-RUB.IMEX IMEX Покупка 100.00000000 86.57000000 8657.00RUR 0.00 129.86RUR 2026-09-07 16:56:23 ...

  // Regex: capture ticker, operation, amount (RUR), commission (RUR), date
  const tradeRe =
    /(USDT-RUB|RUB-USDT|USDT\/RUB)[\w.\-]*\s+[\w\-]*\s+(Покупка|Продажа)\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)\s*RUR\s+[\d.,]*\s*([\d.,]+)\s*RUR\s+(\d{4}-\d{2}-\d{2})/g;

  let m: RegExpExecArray | null;
  while ((m = tradeRe.exec(tradesSection)) !== null) {
    const op = m[2]; // Покупка | Продажа
    const amountRur = parseFloat(m[3].replace(/\s/g, "").replace(",", "."));
    const commissionRur = parseFloat(m[4].replace(/\s/g, "").replace(",", "."));
    const dateStr = parseDate(m[5]);

    if (op === "Покупка" && amountRur > 0) {
      results.push({
        date: dateStr,
        category: "purchase",
        amount: amountRur,
        note: `Покупка USDT-RUB Цифра Маркетс`,
      });
      if (commissionRur > 0) {
        results.push({
          date: dateStr,
          category: "purchase_fee",
          amount: commissionRur,
          note: `Комиссия за покупку USDT-RUB`,
        });
      }
    } else if (op === "Продажа" && amountRur > 0) {
      results.push({
        date: dateStr,
        category: "sale",
        amount: amountRur,
        note: `Продажа USDT-RUB Цифра Маркетс`,
      });
      if (commissionRur > 0) {
        results.push({
          date: dateStr,
          category: "sale_fee",
          amount: commissionRur,
          note: `Комиссия за продажу USDT-RUB`,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// ABCEX – Выписка по ордерам (order execution report)
// Columns (tab-separated, dates may have embedded newlines):
//   Создан | Завершен | Номер заявки | Пара | Тип | Направление |
//   Размер заявки | Ср. цена | Отдано | Получено* | Комиссия | Статус
// "Получено" is already net of commission; commission is a separate column.
// ---------------------------------------------------------------------------

export function parseAbcexOrders(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];

  // Flatten newlines within cells to spaces for easier regex matching
  const flat = text.replace(/\n/g, " ").replace(/ {2,}/g, " ");

  // Each completed row: two dates (DD.MM.YY HH:MM), order id, pair, type,
  // direction, size USDT, avg_price, given USDT, received RUB, commission RUB, Заполнена
  const rowRe =
    /(\d{2}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})\s+\d{2}\.\d{2}\.\d{2}\s+\d{2}:\d{2}\s+\d+\s+(USDTRUB|RUBUSDT)\s+\S+\s+(Продать|Купить)\s+[\d.,]+\s*USDT\s+[\d.,]+\s+[\d.,]+\s*USDT\s+([\d.,]+)\s*RUB\s+([\d.,]+)\s*RUB\s+Заполнена/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(flat)) !== null) {
    const dateStr = parseDate(`${m[1]}`);
    const direction = m[4];
    const receivedRub = parseFloat(m[5].replace(",", "."));
    const commissionRub = parseFloat(m[6].replace(",", "."));

    if (direction === "Продать" && receivedRub > 0) {
      results.push({
        date: dateStr,
        category: "sale",
        amount: receivedRub,
        note: "Продажа USDT на ABCEX",
      });
      if (commissionRub > 0) {
        results.push({
          date: dateStr,
          category: "sale_fee",
          amount: commissionRub,
          note: "Комиссия ABCEX за продажу",
        });
      }
    } else if (direction === "Купить" && receivedRub > 0) {
      results.push({
        date: dateStr,
        category: "purchase",
        amount: receivedRub,
        note: "Покупка USDT на ABCEX",
      });
      if (commissionRub > 0) {
        results.push({
          date: dateStr,
          category: "purchase_fee",
          amount: commissionRub,
          note: "Комиссия ABCEX за покупку",
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// ABCEX – Выписка фиатных операций (RUB withdrawals/deposits, reference only)
// Columns: Дата и время | Направление | Валюта | Метод | Сумма | Номер заявки
// ---------------------------------------------------------------------------

export function parseAbcexFiat(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const flat = text.replace(/\n/g, " ").replace(/ {2,}/g, " ");

  // DD.MM.YY HH:MM \t Вывод/Пополнение \t RUB \t Наличные \t amount \t order_id
  const rowRe =
    /(\d{2}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})\s+(Вывод|Пополнение)\s+RUB\s+\S+\s+([\d]+)\s+\d+/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(flat)) !== null) {
    const dateStr = parseDate(m[1]);
    const direction = m[3];
    const amount = parseFloat(m[4]);

    results.push({
      date: dateStr,
      category: direction === "Вывод" ? "withdrawal_info" : "deposit_info",
      amount,
      note: `ABCEX фиат ${direction === "Вывод" ? "вывод" : "пополнение"} RUB`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// ABCEX – Выписка криптовалютных операций (USDT on-chain, reference only)
// Columns: Дата и время | Направление | Валюта | Метод | Сеть | Сумма | Адрес | TXID
// ---------------------------------------------------------------------------

export function parseAbcexCrypto(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const flat = text.replace(/\n/g, " ").replace(/ {2,}/g, " ");

  const rowRe =
    /(\d{2}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})\s+(Пополнение|Вывод)\s+USDT\s+\S+\s+\S+\s+([\d.,]+)\s+\S+\s+\S+/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(flat)) !== null) {
    const dateStr = parseDate(m[1]);
    const direction = m[3];
    const amount = parseFloat(m[4].replace(",", "."));

    results.push({
      date: dateStr,
      category: direction === "Пополнение" ? "deposit_info" : "withdrawal_info",
      amount,
      note: `ABCEX крипто ${direction === "Пополнение" ? "пополнение" : "вывод"} USDT`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Auto-detect source from text and dispatch to the right parser
// ---------------------------------------------------------------------------

export function autoParseStatement(
  text: string,
  source: string,
  statementType: string
): ParsedTransaction[] | null {
  const t = text.toLowerCase();

  // Sberbank statement
  if (
    source === "sber" ||
    t.includes("сбербанк") ||
    t.includes("sberbank") ||
    t.includes("выписка по платёжному счёту") ||
    t.includes("выписка по платежному счету")
  ) {
    return parseSber(text);
  }

  // Cifra Markets
  if (
    source === "cifra" ||
    t.includes("цифра маркетс") ||
    t.includes("cifra") ||
    t.includes("отчет депозитария") ||
    t.includes("отчёт депозитария") ||
    t.includes("отчет брокера") ||
    t.includes("отчёт брокера")
  ) {
    return parseCifra(text);
  }

  // ABCEX – orders report (main income source from ABCEX)
  if (
    source === "abcex" ||
    (t.includes("abcex") && t.includes("выписка по ордерам"))
  ) {
    return parseAbcexOrders(text);
  }

  // ABCEX – fiat operations (RUB cash withdrawals, reference)
  if (t.includes("abcex") && t.includes("выписка фиатных операций")) {
    return parseAbcexFiat(text);
  }

  // ABCEX – crypto operations (USDT deposits, reference)
  if (t.includes("abcex") && t.includes("выписка криптовалютных операций")) {
    return parseAbcexCrypto(text);
  }

  return null; // Unknown format – fall back to manual entry
}
