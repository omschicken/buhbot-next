export type CategoryKey =
  | "sale"
  | "purchase"
  | "purchase_fee"
  | "sale_fee"
  | "transfer_fee"
  | "subscription"
  | "transfer_info"
  | "withdrawal_info"
  | "other";

export type CategoryType = "income" | "expense" | "info";

export interface Category {
  key: CategoryKey;
  label: string;
  type: CategoryType;
}

export const CATEGORIES: Category[] = [
  { key: "sale", label: "Продажа крипты (доход)", type: "income" },
  { key: "purchase", label: "Покупка крипты (расход)", type: "expense" },
  { key: "purchase_fee", label: "Комиссия за покупку (расход)", type: "expense" },
  { key: "sale_fee", label: "Комиссия за продажу (расход)", type: "expense" },
  { key: "transfer_fee", label: "Комиссия перевода банк→биржа (расход)", type: "expense" },
  { key: "subscription", label: "Подписка СберПервый (расход)", type: "expense" },
  { key: "transfer_info", label: "Перевод / пополнение (справочно)", type: "info" },
  { key: "withdrawal_info", label: "Вывод средств (справочно)", type: "info" },
  { key: "other", label: "Другое / не учитывать", type: "info" },
];

export type SourceKey = "abcex" | "cifra" | "sber";

export interface Source {
  key: SourceKey;
  label: string;
  statementTypes: string[];
}

export const SOURCES: Source[] = [
  {
    key: "abcex",
    label: "ABCEX",
    statementTypes: ["Пополнение", "Обмен (сделки)", "Вывод наличных"],
  },
  {
    key: "cifra",
    label: "Цифра Маркетс",
    statementTypes: ["Операции / сделки"],
  },
  {
    key: "sber",
    label: "Сбербанк",
    statementTypes: ["Выписка по счёту / карте"],
  },
];

export interface PendingTransaction {
  id: string; // client-side temp id
  date: string; // ISO string
  source: SourceKey;
  statementType: string;
  category: CategoryKey;
  amount: number;
  note: string;
}

export interface PendingFile {
  id: string;
  name: string;
  source: SourceKey;
  statementType: string;
  file: File;
}

export interface RoundSummary {
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

export interface TaxCalc {
  base: number;
  tax13: number;
  tax15: number;
  total_tax: number;
  after_tax: number;
}

export function calcTax(profit: number): TaxCalc {
  if (profit <= 0) {
    return { base: 0, tax13: 0, tax15: 0, total_tax: 0, after_tax: profit };
  }
  const threshold = 2_400_000;
  let tax13 = 0;
  let tax15 = 0;
  if (profit <= threshold) {
    tax13 = profit * 0.13;
  } else {
    tax13 = threshold * 0.13;
    tax15 = (profit - threshold) * 0.15;
  }
  const total_tax = tax13 + tax15;
  return { base: profit, tax13, tax15, total_tax, after_tax: profit - total_tax };
}

export function calcSummary(transactions: { category: string; amount: number }[]): RoundSummary {
  const s: Record<string, number> = {};
  for (const t of transactions) {
    s[t.category] = (s[t.category] || 0) + Math.abs(t.amount);
  }
  const sale = s["sale"] || 0;
  const purchase = s["purchase"] || 0;
  const purchase_fee = s["purchase_fee"] || 0;
  const sale_fee = s["sale_fee"] || 0;
  const transfer_fee = s["transfer_fee"] || 0;
  const subscription = s["subscription"] || 0;
  const total_income = sale;
  const total_expense = purchase + purchase_fee + sale_fee + transfer_fee + subscription;
  const net_profit = total_income - total_expense;
  return { sale, purchase, purchase_fee, sale_fee, transfer_fee, subscription, total_income, total_expense, net_profit };
}

export function detectCategory(text: string, source: SourceKey, defaultCat: CategoryKey): CategoryKey {
  const t = text.toLowerCase();
  if (/продаж|sell|sale/.test(t)) return "sale";
  if (/покуп|buy|purchase/.test(t)) return "purchase";
  if (/подписк|сберперв|prime/.test(t)) return "subscription";
  if (/комисс|fee/.test(t)) return source === "sber" ? "transfer_fee" : "purchase_fee";
  if (/пополнен|deposit|transfer/.test(t)) return "transfer_info";
  if (/вывод|withdrawal/.test(t)) return "withdrawal_info";
  return defaultCat;
}

export function formatRub(n: number, decimals = 2): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
