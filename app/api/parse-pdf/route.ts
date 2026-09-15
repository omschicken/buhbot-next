import { NextRequest, NextResponse } from "next/server";
import { autoParseStatement } from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const source = (formData.get("source") as string) || "";
    const statementType = (formData.get("statementType") as string) || "";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    let text = "";
    let numpages = 0;

    try {
      // Try pdf-parse v2 class API first
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      await parser.load();
      const result = await parser.getText();
      text = result.pages.map((p: { text: string }) => p.text).join("\n");
      numpages = result.pages.length;
    } catch {
      // Fallback to v1 API
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buf);
      text = data.text;
      numpages = data.numpages;
    }

    const parsed = autoParseStatement(text, source, statementType);

    return NextResponse.json({ text, pages: numpages, parsed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
