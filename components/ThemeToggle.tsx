"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      root.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const icons = { light: "☀️", dark: "🌙", system: "💻" };
  const next: Record<string, "light" | "dark" | "system"> = {
    system: "light",
    light: "dark",
    dark: "system",
  };

  return (
    <button
      className="btn-ghost"
      style={{ padding: "6px 10px", fontSize: 16 }}
      onClick={() => setTheme(next[theme])}
      title={`Тема: ${theme}`}
    >
      {icons[theme]}
    </button>
  );
}
