"use server";

import { redirect } from "next/navigation";
import { getCurrentMemberId, setCurrentMember } from "@/lib/member-session";
import {
  createProject as createProjectRepo,
  createTask as createTaskRepo,
  findOrCreateMember,
  getProjectById,
  getProjectByToken,
  getTask,
  setTaskReaction,
  updateTaskStatus,
} from "@/lib/repo";
import {
  PROOF_TYPES,
  REACTIONS,
  TASK_STATUSES,
  TASK_WEIGHTS,
  type ProofType,
  type ReactionType,
  type TaskStatus,
  type TaskWeight,
} from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;
const MAX_PROOF_FILE_BYTES = 2 * 1024 * 1024;

function str(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function createProjectAction(formData: FormData) {
  const name = str(formData, "name");
  const description = str(formData, "description");
  const deadline = str(formData, "deadline");
  const creatorName = str(formData, "creator_name");
  const creatorEmail = str(formData, "creator_email");

  if (!name || !creatorName || !creatorEmail || !EMAIL_RE.test(creatorEmail)) {
    throw new Error("Preencha o nome do projeto e os seus dados corretamente.");
  }

  const { projectId, memberId } = await createProjectRepo({
    name,
    description: description || undefined,
    deadline: deadline || undefined,
    creatorName,
    creatorEmail,
  });

  await setCurrentMember(projectId, memberId);

  redirect(`/p/${projectId}?msg=${encodeURIComponent("Projeto criado!")}`);
}

export async function joinProjectAction(formData: FormData) {
  const token = str(formData, "token");
  const projectIdInput = str(formData, "project_id");
  const name = str(formData, "name");
  const email = str(formData, "email");

  if (!name || !email || !EMAIL_RE.test(email)) {
    throw new Error("Preencha seu nome e um e-mail válido.");
  }

  const project = token
    ? await getProjectByToken(token)
    : await getProjectById(Number(projectIdInput));

  if (!project) {
    throw new Error("Projeto não encontrado. Confira o link de convite.");
  }

  const member = await findOrCreateMember(project.id, name, email);
  await setCurrentMember(project.id, member.id);

  redirect(
    `/p/${project.id}?msg=${encodeURIComponent(`Bem-vindo(a), ${member.name}!`)}`,
  );
}

export async function createTaskAction(formData: FormData) {
  const projectId = Number(str(formData, "project_id"));
  const title = str(formData, "title");
  const description = str(formData, "description");
  const assigneeId = Number(str(formData, "assignee_id"));
  const deadline = str(formData, "deadline");
  const weightInput = Number(str(formData, "weight")) as TaskWeight;
  const weight: TaskWeight = TASK_WEIGHTS.includes(weightInput) ? weightInput : 3;

  if (!Number.isFinite(projectId) || !title || !Number.isFinite(assigneeId)) {
    throw new Error("Preencha ao menos o título e o responsável da tarefa.");
  }

  await createTaskRepo({
    projectId,
    title,
    description: description || undefined,
    assigneeId,
    deadline: deadline || undefined,
    weight,
  });

  redirect(
    `/p/${projectId}?aba=tarefas&msg=${encodeURIComponent("Tarefa criada!")}`,
  );
}

export async function updateTaskStatusAction(formData: FormData) {
  const projectId = Number(str(formData, "project_id"));
  const taskId = Number(str(formData, "task_id"));
  const status = str(formData, "status") as TaskStatus;

  if (
    !Number.isFinite(projectId) ||
    !Number.isFinite(taskId) ||
    !TASK_STATUSES.includes(status)
  ) {
    throw new Error("Dados inválidos.");
  }

  const currentMemberId = await getCurrentMemberId(projectId);
  const task = await getTask(projectId, taskId);
  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }
  if (task.assignee_id !== currentMemberId) {
    redirect(
      `/p/${projectId}?aba=tarefas&erro=${encodeURIComponent(
        "Só quem é responsável pela tarefa pode atualizar o status dela.",
      )}`,
    );
  }

  if (status === "concluida") {
    const proofTypeInput = str(formData, "proof_type");
    const proofText = str(formData, "proof_text");
    const proofFile = formData.get("proof_file");

    if (proofTypeInput === "nenhuma" || !proofTypeInput) {
      await updateTaskStatus(taskId, status);
    } else if (!PROOF_TYPES.includes(proofTypeInput as ProofType)) {
      throw new Error("Tipo de prova inválido.");
    } else {
      const proofType = proofTypeInput as ProofType;

      if (proofType === "nota") {
        if (!proofText) {
          throw new Error("Escreva a nota antes de concluir a tarefa.");
        }
        await updateTaskStatus(taskId, status, { proofType, proofText });
      } else if (proofType === "link") {
        if (!proofText || !URL_RE.test(proofText)) {
          throw new Error(
            "Informe um link válido (começando com http:// ou https://).",
          );
        }
        await updateTaskStatus(taskId, status, { proofType, proofText });
      } else {
        if (!(proofFile instanceof File) || proofFile.size === 0) {
          throw new Error("Anexe um arquivo antes de concluir a tarefa.");
        }
        if (proofFile.size > MAX_PROOF_FILE_BYTES) {
          throw new Error("O arquivo de prova precisa ter no máximo 2MB.");
        }
        const bytes = Buffer.from(await proofFile.arrayBuffer());
        const mime = proofFile.type || "application/octet-stream";
        await updateTaskStatus(taskId, status, {
          proofType,
          proofFile: `data:${mime};base64,${bytes.toString("base64")}`,
          proofFileName: proofFile.name,
        });
      }
    }
  } else {
    await updateTaskStatus(taskId, status);
  }

  const msg = status === "concluida" ? "Tarefa concluída!" : "Tarefa iniciada!";
  redirect(`/p/${projectId}?aba=tarefas&msg=${encodeURIComponent(msg)}`);
}

export async function reactToTaskAction(formData: FormData) {
  const projectId = Number(str(formData, "project_id"));
  const taskId = Number(str(formData, "task_id"));
  const reaction = str(formData, "reaction") as ReactionType;

  if (
    !Number.isFinite(projectId) ||
    !Number.isFinite(taskId) ||
    !REACTIONS.includes(reaction)
  ) {
    throw new Error("Dados inválidos.");
  }

  const currentMemberId = await getCurrentMemberId(projectId);
  const task = await getTask(projectId, taskId);
  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }
  if (task.status !== "concluida") {
    throw new Error("Só é possível confirmar ou contestar uma tarefa concluída.");
  }
  if (!currentMemberId) {
    redirect(
      `/p/${projectId}?aba=tarefas&erro=${encodeURIComponent(
        "Identifique-se no projeto antes de confirmar ou contestar uma tarefa.",
      )}`,
    );
  }
  if (currentMemberId === task.assignee_id) {
    redirect(
      `/p/${projectId}?aba=tarefas&erro=${encodeURIComponent(
        "Quem concluiu a tarefa não pode confirmar ou contestar a própria tarefa.",
      )}`,
    );
  }

  await setTaskReaction(taskId, currentMemberId, reaction);

  const msg = reaction === "confirma" ? "Você confirmou a tarefa." : "Você contestou a tarefa.";
  redirect(`/p/${projectId}?aba=tarefas&msg=${encodeURIComponent(msg)}`);
}
