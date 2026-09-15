import { NextRequest, NextResponse } from "next/server";
import { autoParseStatement } from "@/lib/parsers";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const source = (formData.get("source") as string) || "";
    const statementType = (formData.get("statementType") as string) || "";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    const text: string = data.text;

    // Try smart auto-parsing
    const parsed = autoParseStatement(text, source, statementType);

    return NextResponse.json({
      text,
      pages: data.numpages,
      parsed, // null if format unknown, array of ParsedTransaction if known
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
