import Link from "next/link";

interface ProjectNavProps {
  projectId: number;
  active: "tarefas" | "progresso";
}

export default function ProjectNav({ projectId, active }: ProjectNavProps) {
  const tabs = [
    { key: "tarefas", label: "Tarefas" },
    { key: "progresso", label: "Progresso" },
  ] as const;

  return (
    <nav className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/p/${projectId}?aba=${tab.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              active === tab.key
                ? "bg-brand text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <a
        href={`/p/${projectId}/relatorio`}
        className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-ink hover:bg-slate-50"
      >
        Relatório PDF
      </a>
    </nav>
  );
}
