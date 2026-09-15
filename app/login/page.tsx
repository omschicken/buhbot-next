"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "16px",
      }}
    >
      <div className="surface" style={{ width: "100%", maxWidth: 380, padding: "40px 32px" }}>
        <h1
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 8,
            color: "var(--text)",
          }}
        >
          Бухгалтер
        </h1>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 28 }}>
          Введите пароль для доступа
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
            autoFocus
          />
          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{error}</p>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Проверяем..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
