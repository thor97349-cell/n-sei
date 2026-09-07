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
  updateTaskStatus,
} from "@/lib/repo";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PROOF_IMAGE_BYTES = 2 * 1024 * 1024;

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

  redirect(`/p/${projectId}`);
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

  redirect(`/p/${project.id}`);
}

export async function createTaskAction(formData: FormData) {
  const projectId = Number(str(formData, "project_id"));
  const title = str(formData, "title");
  const description = str(formData, "description");
  const assigneeId = Number(str(formData, "assignee_id"));
  const deadline = str(formData, "deadline");

  if (!Number.isFinite(projectId) || !title || !Number.isFinite(assigneeId)) {
    throw new Error("Preencha ao menos o título e o responsável da tarefa.");
  }

  await createTaskRepo({
    projectId,
    title,
    description: description || undefined,
    assigneeId,
    deadline: deadline || undefined,
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
    const proofText = str(formData, "proof_text");
    const proofFile = formData.get("proof_image");
    let proofImage: string | undefined;

    if (proofFile instanceof File && proofFile.size > 0) {
      if (!proofFile.type.startsWith("image/")) {
        throw new Error("O arquivo de prova precisa ser uma imagem.");
      }
      if (proofFile.size > MAX_PROOF_IMAGE_BYTES) {
        throw new Error("A imagem de prova precisa ter no máximo 2MB.");
      }
      const bytes = Buffer.from(await proofFile.arrayBuffer());
      proofImage = `data:${proofFile.type};base64,${bytes.toString("base64")}`;
    }

    await updateTaskStatus(taskId, status, {
      proofText: proofText || undefined,
      proofImage,
    });
  } else {
    await updateTaskStatus(taskId, status);
  }

  const msg = status === "concluida" ? "Tarefa concluída!" : "Tarefa iniciada!";
  redirect(`/p/${projectId}?aba=tarefas&msg=${encodeURIComponent(msg)}`);
}
