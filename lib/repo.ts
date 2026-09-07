import { randomUUID } from "crypto";
import { getSqlReady } from "./db";
import type { Member, Project, Task, TaskStatus } from "./types";

function generateInviteToken(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function toProject(row: Record<string, unknown>): Project {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    deadline: row.deadline == null ? null : String(row.deadline),
    invite_token: String(row.invite_token),
    created_at: String(row.created_at),
  };
}

function toMember(row: Record<string, unknown>): Member {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    name: String(row.name),
    email: String(row.email),
    created_at: String(row.created_at),
  };
}

function toTask(row: Record<string, unknown>): Task {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    assignee_id: Number(row.assignee_id),
    assignee_name: String(row.assignee_name ?? ""),
    deadline: row.deadline == null ? null : String(row.deadline),
    status: row.status as TaskStatus,
    proof_text: row.proof_text == null ? null : String(row.proof_text),
    proof_image: row.proof_image == null ? null : String(row.proof_image),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    created_at: String(row.created_at),
  };
}

export interface NewProject {
  name: string;
  description?: string;
  deadline?: string;
  creatorName: string;
  creatorEmail: string;
}

export async function createProject(
  data: NewProject,
): Promise<{ projectId: number; memberId: number }> {
  const sql = await getSqlReady();
  const inviteToken = generateInviteToken();

  const projectRows = await sql`
    INSERT INTO projects (name, description, deadline, invite_token)
    VALUES (${data.name}, ${data.description ?? null}, ${data.deadline ?? null}, ${inviteToken})
    RETURNING id
  `;
  const projectId = Number(projectRows[0].id);

  const memberRows = await sql`
    INSERT INTO members (project_id, name, email)
    VALUES (${projectId}, ${data.creatorName}, ${data.creatorEmail.toLowerCase()})
    RETURNING id
  `;
  const memberId = Number(memberRows[0].id);

  return { projectId, memberId };
}

export async function getProjectById(id: number): Promise<Project | null> {
  const sql = await getSqlReady();
  const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return rows.length ? toProject(rows[0]) : null;
}

export async function getProjectByToken(
  token: string,
): Promise<Project | null> {
  const sql = await getSqlReady();
  const rows = await sql`SELECT * FROM projects WHERE invite_token = ${token}`;
  return rows.length ? toProject(rows[0]) : null;
}

export async function listMembers(projectId: number): Promise<Member[]> {
  const sql = await getSqlReady();
  const rows = await sql`
    SELECT * FROM members WHERE project_id = ${projectId} ORDER BY created_at ASC
  `;
  return rows.map(toMember);
}

export async function getMember(
  projectId: number,
  memberId: number,
): Promise<Member | null> {
  const sql = await getSqlReady();
  const rows = await sql`
    SELECT * FROM members WHERE project_id = ${projectId} AND id = ${memberId}
  `;
  return rows.length ? toMember(rows[0]) : null;
}

// Members join with just name + e-mail (no password): matching the e-mail
// used before re-identifies the same person instead of creating a duplicate.
export async function findOrCreateMember(
  projectId: number,
  name: string,
  email: string,
): Promise<Member> {
  const sql = await getSqlReady();
  const normalizedEmail = email.toLowerCase();

  const existing = await sql`
    SELECT * FROM members WHERE project_id = ${projectId} AND email = ${normalizedEmail}
  `;
  if (existing.length) {
    if (String(existing[0].name) !== name) {
      const updated = await sql`
        UPDATE members SET name = ${name}
        WHERE id = ${Number(existing[0].id)}
        RETURNING *
      `;
      return toMember(updated[0]);
    }
    return toMember(existing[0]);
  }

  const rows = await sql`
    INSERT INTO members (project_id, name, email)
    VALUES (${projectId}, ${name}, ${normalizedEmail})
    RETURNING *
  `;
  return toMember(rows[0]);
}

export interface NewTask {
  projectId: number;
  title: string;
  description?: string;
  assigneeId: number;
  deadline?: string;
}

export async function createTask(data: NewTask): Promise<number> {
  const sql = await getSqlReady();
  const rows = await sql`
    INSERT INTO tasks (project_id, title, description, assignee_id, deadline)
    VALUES (${data.projectId}, ${data.title}, ${data.description ?? null}, ${data.assigneeId}, ${data.deadline ?? null})
    RETURNING id
  `;
  return Number(rows[0].id);
}

export async function listTasks(projectId: number): Promise<Task[]> {
  const sql = await getSqlReady();
  const rows = await sql`
    SELECT tasks.*, members.name AS assignee_name
    FROM tasks
    JOIN members ON members.id = tasks.assignee_id
    WHERE tasks.project_id = ${projectId}
    ORDER BY tasks.created_at ASC
  `;
  return rows.map(toTask);
}

export async function getTask(
  projectId: number,
  taskId: number,
): Promise<Task | null> {
  const sql = await getSqlReady();
  const rows = await sql`
    SELECT tasks.*, members.name AS assignee_name
    FROM tasks
    JOIN members ON members.id = tasks.assignee_id
    WHERE tasks.project_id = ${projectId} AND tasks.id = ${taskId}
  `;
  return rows.length ? toTask(rows[0]) : null;
}

export interface TaskCompletion {
  proofText?: string;
  proofImage?: string;
}

export async function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
  completion?: TaskCompletion,
): Promise<void> {
  const sql = await getSqlReady();
  if (status === "concluida") {
    await sql`
      UPDATE tasks
      SET status = ${status},
          proof_text = ${completion?.proofText ?? null},
          proof_image = ${completion?.proofImage ?? null},
          completed_at = now()
      WHERE id = ${taskId}
    `;
  } else {
    await sql`
      UPDATE tasks
      SET status = ${status}, completed_at = NULL
      WHERE id = ${taskId}
    `;
  }
}
