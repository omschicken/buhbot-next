import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { head } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await params;
    const file = await prisma.file.findFirst({
      where: { id: fileId, roundId: id },
    });
    if (!file?.url) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const meta = await head(file.url, { token: token ?? undefined });

    const blobRes = await fetch(meta.url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!blobRes.ok) return NextResponse.json({ error: "Blob fetch failed" }, { status: 502 });

    const filename = encodeURIComponent(file.name);
    return new NextResponse(blobRes.body, {
      headers: {
        "Content-Type": meta.contentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
