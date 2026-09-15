import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const round = await prisma.round.findUnique({
      where: { id },
      include: { files: true },
    });
    if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      for (const file of round.files) {
        if (file.url) {
          try {
            await del(file.url, { token: blobToken });
          } catch {
            // ignore if already deleted
          }
        }
      }
    }

    await prisma.round.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
