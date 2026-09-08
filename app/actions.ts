"use server";

import { redirect } from "next/navigation";
import { getSessionUser, signIn, signOut } from "@/lib/auth";
import {
  createProject as createProjectRepo,
  createTask as createTaskRepo,
  findOrCreateMember,
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

const URL_RE = /^https?:\/\/.+/i;
const MAX_PROOF_FILE_BYTES = 2 * 1024 * 1024;

function str(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInWithGoogle(formData: FormData) {
  const callbackUrl = str(formData, "callback_url") || "/";
  await signIn("google", { redirectTo: callbackUrl });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function createProjectAction(formData: FormData) {
  const name = str(formData, "name");
  const description = str(formData, "description");
  const deadline = str(formData, "deadline");

  const user = await getSessionUser();
  if (!user) {
    throw new Error("Entre com sua conta Google antes de criar um projeto.");
  }
  if (!name) {
    throw new Error("Preencha o nome do projeto.");
  }

  const { projectId } = await createProjectRepo({
    name,
    description: description || undefined,
    deadline: deadline || undefined,
    creatorName: user.name,
    creatorEmail: user.email,
  });

  redirect(`/p/${projectId}?msg=${encodeURIComponent("Projeto criado!")}`);
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

  const user = await getSessionUser();
  const task = await getTask(projectId, taskId);
  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }
  const currentMember = user
    ? await findOrCreateMember(projectId, user.name, user.email)
    : null;
  if (!currentMember || task.assignee_id !== currentMember.id) {
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

  const user = await getSessionUser();
  const task = await getTask(projectId, taskId);
  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }
  if (task.status !== "concluida") {
    throw new Error("Só é possível confirmar ou contestar uma tarefa concluída.");
  }
  if (!user) {
    redirect(
      `/p/${projectId}?aba=tarefas&erro=${encodeURIComponent(
        "Entre com sua conta Google antes de confirmar ou contestar uma tarefa.",
      )}`,
    );
  }

  const currentMember = await findOrCreateMember(projectId, user.name, user.email);
  if (currentMember.id === task.assignee_id) {
    redirect(
      `/p/${projectId}?aba=tarefas&erro=${encodeURIComponent(
        "Quem concluiu a tarefa não pode confirmar ou contestar a própria tarefa.",
      )}`,
    );
  }

  await setTaskReaction(taskId, currentMember.id, reaction);

  const msg = reaction === "confirma" ? "Você confirmou a tarefa." : "Você contestou a tarefa.";
  redirect(`/p/${projectId}?aba=tarefas&msg=${encodeURIComponent(msg)}`);
}
