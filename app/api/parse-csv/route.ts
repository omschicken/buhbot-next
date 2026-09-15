import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const text = await file.text();

    // Try different delimiters
    let result = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (!result.data?.length) {
      result = Papa.parse(text, { header: true, delimiter: ";", skipEmptyLines: true });
    }
    if (!result.data?.length) {
      result = Papa.parse(text, { header: true, delimiter: "\t", skipEmptyLines: true });
    }

    const headers = result.meta.fields || [];

    // Heuristic column detection
    const findCol = (keywords: string[]) =>
      headers.find((h) =>
        keywords.some((k) => h.toLowerCase().includes(k.toLowerCase()))
      ) || null;

    const detected = {
      date: findCol(["дата", "date", "время", "time"]),
      amount: findCol(["сумма", "amount", "итого", "total", "рублей", "rub"]),
      fee: findCol(["комисс", "fee"]),
      type: findCol(["тип", "тип операции", "операция", "описание", "type", "operation", "description"]),
    };

    return NextResponse.json({
      headers,
      rows: result.data,
      detected,
      total: (result.data as Record<string, string>[]).length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
