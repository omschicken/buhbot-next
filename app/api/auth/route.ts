import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || password === sitePassword) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth_token", sitePassword || "", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  }
  return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
}
