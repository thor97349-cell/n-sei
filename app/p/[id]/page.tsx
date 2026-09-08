import { notFound } from "next/navigation";
import InviteBox from "@/components/InviteBox";
import NewTaskForm from "@/components/NewTaskForm";
import SignInGate from "@/components/SignInGate";
import ProgressDashboard from "@/components/ProgressDashboard";
import ProjectNav from "@/components/ProjectNav";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TaskList from "@/components/TaskList";
import Toast from "@/components/Toast";
import { getSessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  findOrCreateMember,
  getProjectById,
  listMembers,
  listTaskReactions,
  listTasks,
} from "@/lib/repo";
import { getOrigin } from "@/lib/url";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; erro?: string; msg?: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) notFound();

  const project = await getProjectById(projectId);
  if (!project) notFound();

  const { aba, erro, msg } = await searchParams;
  const members = await listMembers(projectId);
  const origin = await getOrigin();
  const projectUrl = `${origin}/p/${projectId}`;

  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 px-6 py-12">
          <SignInGate
            callbackUrl={projectUrl}
            projectName={project.name}
            members={members}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const currentMember = await findOrCreateMember(projectId, user.name, user.email);

  const tasks = await listTasks(projectId);
  const reactions = await listTaskReactions(projectId);
  const activeTab = aba === "progresso" ? "progresso" : "tarefas";
  const inviteUrl = `${origin}/entrar/${project.invite_token}`;

  return (
    <>
      <SiteHeader />
      <Toast message={msg} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-slate-600">
              {project.description}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            Prazo final: {formatDate(project.deadline)} · Você é{" "}
            <span className="font-medium text-ink">{currentMember.name}</span>
          </p>
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-4">
          <InviteBox inviteUrl={inviteUrl} projectName={project.name} />
        </div>

        <div className="mt-6">
          <ProjectNav projectId={projectId} active={activeTab} />
        </div>

        <div className="mt-6 space-y-6">
          {activeTab === "tarefas" ? (
            <>
              <NewTaskForm projectId={projectId} members={members} />
              <TaskList
                tasks={tasks}
                reactions={reactions}
                currentMemberId={currentMember.id}
              />
            </>
          ) : (
            <ProgressDashboard
              members={members}
              tasks={tasks}
              reactions={reactions}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
