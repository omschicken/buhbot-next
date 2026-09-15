import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export async function GET(req: NextRequest) {
  try {
    const rounds = await prisma.round.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        files: true,
        transactions: { orderBy: { date: "asc" } },
      },
    });
    return NextResponse.json(rounds);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const transactionsJson = formData.get("transactions") as string;
    const filesMetaJson = formData.get("filesMeta") as string;
    const transactions = JSON.parse(transactionsJson) as {
      date: string;
      source: string;
      statementType: string;
      category: string;
      amount: number;
      note?: string;
    }[];
    const filesMeta = JSON.parse(filesMetaJson) as {
      name: string;
      source: string;
      statementType: string;
    }[];

    // Create round first to get ID
    const round = await prisma.round.create({ data: {} });

    // Upload files to Vercel Blob
    const uploadedFiles = [];
    for (let i = 0; i < filesMeta.length; i++) {
      const meta = filesMeta[i];
      const fileField = formData.get(`file_${i}`) as File | null;
      if (fileField) {
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (blobToken) {
          const blob = await put(
            `rounds/${round.id}/${meta.name}`,
            await fileField.arrayBuffer(),
            { access: "public", token: blobToken }
          );
          uploadedFiles.push({
            roundId: round.id,
            name: meta.name,
            url: blob.url,
            source: meta.source,
            statementType: meta.statementType,
          });
        } else {
          uploadedFiles.push({
            roundId: round.id,
            name: meta.name,
            url: "",
            source: meta.source,
            statementType: meta.statementType,
          });
        }
      } else {
        uploadedFiles.push({
          roundId: round.id,
          name: meta.name,
          url: "",
          source: meta.source,
          statementType: meta.statementType,
        });
      }
    }

    await prisma.file.createMany({ data: uploadedFiles });
    await prisma.transaction.createMany({
      data: transactions.map((t) => ({
        roundId: round.id,
        date: new Date(t.date),
        source: t.source,
        statementType: t.statementType,
        category: t.category,
        amount: t.amount,
        note: t.note || null,
      })),
    });

    const saved = await prisma.round.findUnique({
      where: { id: round.id },
      include: { files: true, transactions: true },
    });
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
