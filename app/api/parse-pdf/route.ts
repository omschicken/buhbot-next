import { NextRequest, NextResponse } from "next/server";
import { autoParseStatement } from "@/lib/parsers";
import { extractText } from "unpdf";

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
    const buffer = new Uint8Array(arrayBuffer);

    const { text, totalPages } = await extractText(buffer, { mergePages: true });

    const parsed = autoParseStatement(text, source, statementType);

    return NextResponse.json({ text, pages: totalPages, parsed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
