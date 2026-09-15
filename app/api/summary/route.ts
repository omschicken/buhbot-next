import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcSummary, calcTax } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year");
    if (!year) return NextResponse.json({ error: "year required" }, { status: 400 });

    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      select: { category: true, amount: true },
    });

    const summary = calcSummary(transactions);
    const tax = calcTax(summary.net_profit);

    return NextResponse.json({ summary, tax });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
