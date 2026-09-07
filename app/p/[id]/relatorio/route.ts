import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { getProjectById, listMembers, listTasks } from "@/lib/repo";

export const dynamic = "force-dynamic";

function stripDiacritics(value: string): string {
  return Array.from(value.normalize("NFD"))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return new NextResponse("Projeto não encontrado.", { status: 404 });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return new NextResponse("Projeto não encontrado.", { status: 404 });
  }

  const members = await listMembers(projectId);
  const tasks = await listTasks(projectId);

  const stats = members.map((member) => {
    const assigned = tasks.filter((t) => t.assignee_id === member.id);
    const completed = assigned.filter((t) => t.status === "concluida");
    const percent = assigned.length
      ? Math.round((completed.length / assigned.length) * 100)
      : 0;
    return { member, assigned, completed, percent };
  });

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 50;
  const pageWidth = 595.28;
  const bottomMargin = 40;
  let y = 792;

  const ink = rgb(0.09, 0.14, 0.12);
  const gray = rgb(0.4, 0.42, 0.45);
  const brand = rgb(0.06, 0.48, 0.36);

  function drawText(
    text: string,
    options: { size: number; f?: typeof font; color?: ReturnType<typeof rgb>; x?: number },
  ) {
    page.drawText(text, {
      x: options.x ?? marginX,
      y,
      size: options.size,
      font: options.f ?? font,
      color: options.color ?? ink,
    });
  }

  function wrap(text: string, size: number, f: typeof font, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const attempt = current ? `${current} ${word}` : word;
      if (f.widthOfTextAtSize(attempt, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = attempt;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function hasRoom(): boolean {
    return y > bottomMargin;
  }

  drawText("Relatório de contribuição", { size: 18, f: bold });
  y -= 24;
  drawText(project.name, { size: 13, f: bold, color: brand });
  y -= 16;
  drawText(
    `Prazo final: ${formatDate(project.deadline)}  ·  Gerado em: ${formatDateTime(new Date().toISOString())}`,
    { size: 9, color: gray },
  );
  y -= 24;

  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 1,
    color: rgb(0.85, 0.86, 0.87),
  });
  y -= 20;

  for (const { member, assigned, completed, percent } of stats) {
    if (!hasRoom()) break;

    drawText(`${member.name}`, { size: 12, f: bold });
    drawText(`${completed.length}/${assigned.length} tarefas (${percent}%)`, {
      size: 10,
      color: gray,
      x: pageWidth - marginX - 130,
    });
    y -= 14;

    const barWidth = pageWidth - marginX * 2;
    const barHeight = 6;
    page.drawRectangle({
      x: marginX,
      y,
      width: barWidth,
      height: barHeight,
      color: rgb(0.9, 0.91, 0.92),
    });
    page.drawRectangle({
      x: marginX,
      y,
      width: (barWidth * percent) / 100,
      height: barHeight,
      color: brand,
    });
    y -= 18;

    if (completed.length === 0) {
      drawText("Nenhuma tarefa concluída.", { size: 9, color: gray, x: marginX + 10 });
      y -= 14;
    } else {
      for (const task of completed) {
        if (!hasRoom()) break;
        const lines = wrap(`• ${task.title}`, 9.5, font, barWidth - 20);
        for (const line of lines) {
          if (!hasRoom()) break;
          drawText(line, { size: 9.5, x: marginX + 10 });
          y -= 13;
        }
      }
    }
    y -= 10;
  }

  const bytes = await doc.save();
  const filename = `relatorio-${slugify(project.name) || "projeto"}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
