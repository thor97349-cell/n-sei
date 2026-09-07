import { notFound } from "next/navigation";
import InviteBox from "@/components/InviteBox";
import NewTaskForm from "@/components/NewTaskForm";
import JoinForm from "@/components/JoinForm";
import ProgressDashboard from "@/components/ProgressDashboard";
import ProjectNav from "@/components/ProjectNav";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TaskList from "@/components/TaskList";
import { formatDate } from "@/lib/format";
import { getCurrentMemberId } from "@/lib/member-session";
import { getMember, getProjectById, listMembers, listTasks } from "@/lib/repo";
import { getOrigin } from "@/lib/url";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; erro?: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) notFound();

  const project = await getProjectById(projectId);
  if (!project) notFound();

  const { aba, erro } = await searchParams;
  const members = await listMembers(projectId);

  const currentMemberId = await getCurrentMemberId(projectId);
  const currentMember = currentMemberId
    ? await getMember(projectId, currentMemberId)
    : null;

  if (!currentMember) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 px-6 py-12">
          <JoinForm
            projectId={projectId}
            projectName={project.name}
            members={members}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const tasks = await listTasks(projectId);
  const activeTab = aba === "progresso" ? "progresso" : "tarefas";
  const origin = await getOrigin();
  const inviteUrl = `${origin}/entrar/${project.invite_token}`;

  return (
    <>
      <SiteHeader />
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
              <TaskList tasks={tasks} currentMemberId={currentMember.id} />
            </>
          ) : (
            <ProgressDashboard members={members} tasks={tasks} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
