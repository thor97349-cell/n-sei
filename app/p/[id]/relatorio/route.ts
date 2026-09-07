import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { CONTRIBUTION_LEVEL_LABELS, computeMemberContribution } from "@/lib/contribution";
import { getProjectById, listMembers, listTaskReactions, listTasks } from "@/lib/repo";
import { PROOF_TYPE_LABELS, TASK_WEIGHT_LABELS } from "@/lib/types";

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
  const reactions = await listTaskReactions(projectId);

  const stats = members.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee_id === member.id);
    const completed = memberTasks.filter((t) => t.status === "concluida");
    const contribution = computeMemberContribution(memberTasks);
    return { member, completed, contribution };
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
  const brand = rgb(0.31, 0.27, 0.9);
  const success = rgb(0.02, 0.588, 0.412);
  const amber = rgb(0.961, 0.62, 0.043);
  const alert = rgb(0.918, 0.345, 0.047);
  const levelColor = { alta: success, moderada: amber, baixa: alert };

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

  for (const { member, completed, contribution } of stats) {
    if (!hasRoom()) break;

    const percent = contribution.assignedWeight
      ? Math.round((contribution.completedWeight / contribution.assignedWeight) * 100)
      : 0;
    const color = levelColor[contribution.level];

    drawText(`${member.name}`, { size: 12, f: bold });
    drawText(CONTRIBUTION_LEVEL_LABELS[contribution.level], {
      size: 9,
      f: bold,
      color,
      x: pageWidth - marginX - 150,
    });
    y -= 13;
    drawText(
      `${contribution.completedWeight}/${contribution.assignedWeight} pontos (${percent}%) · ${completed.length}/${contribution.assignedCount} tarefas`,
      { size: 8, color: gray, x: pageWidth - marginX - 210 },
    );
    y -= 13;

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
      color,
    });
    y -= 18;

    if (completed.length === 0) {
      drawText("Nenhuma tarefa concluída.", { size: 9, color: gray, x: marginX + 10 });
      y -= 14;
    } else {
      for (const task of completed) {
        if (!hasRoom()) break;
        const titleLines = wrap(`• ${task.title}`, 9.5, font, barWidth - 20);
        for (const line of titleLines) {
          if (!hasRoom()) break;
          drawText(line, { size: 9.5, f: bold, x: marginX + 10 });
          y -= 13;
        }

        if (!hasRoom()) continue;
        drawText(
          `Peso: ${TASK_WEIGHT_LABELS[task.weight]} (${task.weight})  ·  Prazo: ${formatDate(task.deadline)}  ·  Concluída em: ${formatDateTime(task.completed_at)}`,
          { size: 8.5, color: gray, x: marginX + 16 },
        );
        y -= 12;

        if (task.proof_type === "nota" || task.proof_type === "link") {
          const label = PROOF_TYPE_LABELS[task.proof_type];
          const proofLines = wrap(
            `Prova (${label}): ${task.proof_text ?? ""}`,
            8.5,
            font,
            barWidth - 32,
          );
          for (const line of proofLines) {
            if (!hasRoom()) break;
            drawText(line, { size: 8.5, color: gray, x: marginX + 16 });
            y -= 12;
          }
        } else if (task.proof_type === "arquivo") {
          if (hasRoom()) {
            drawText(
              `Prova (arquivo): ${task.proof_file_name ?? "anexado no sistema"}`,
              { size: 8.5, color: gray, x: marginX + 16 },
            );
            y -= 12;
          }
        } else if (hasRoom()) {
          drawText("Sem prova anexada.", {
            size: 8.5,
            color: gray,
            x: marginX + 16,
          });
          y -= 12;
        }

        const taskReactions = reactions.filter((r) => r.task_id === task.id);
        const confirmCount = taskReactions.filter((r) => r.reaction === "confirma").length;
        const contestCount = taskReactions.filter((r) => r.reaction === "contesta").length;
        if ((confirmCount > 0 || contestCount > 0) && hasRoom()) {
          drawText(`${confirmCount} confirmaram · ${contestCount} contestaram`, {
            size: 8.5,
            color: gray,
            x: marginX + 16,
          });
          y -= 12;
        }
        y -= 6;
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
