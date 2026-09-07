import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import JoinForm from "@/components/JoinForm";
import { getProjectByToken, listMembers } from "@/lib/repo";

export default async function EntrarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await getProjectByToken(token);

  if (!project) {
    return (
      <>
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-6 py-16 text-center">
          <div>
            <h1 className="text-xl font-bold text-ink">Link inválido</h1>
            <p className="mt-2 text-sm text-slate-500">
              Esse link de convite não existe mais. Peça um novo link a quem
              criou o projeto.
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const members = await listMembers(project.id);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-6 py-12">
        <JoinForm
          token={token}
          projectName={project.name}
          members={members}
        />
      </main>
      <SiteFooter />
    </>
  );
}
