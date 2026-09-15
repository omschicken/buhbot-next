import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Бухгалтер — Крипто-арбитраж",
  description: "Калькулятор чистой прибыли крипто-арбитража",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
