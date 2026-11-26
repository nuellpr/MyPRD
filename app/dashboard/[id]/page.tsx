import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteChrome";
import { Workspace, type WorkspaceMessage, type WorkspaceQuota } from "@/components/Workspace";
import { currentUser } from "@/lib/auth";
import { getAvailableProviders, resolveActiveModelId } from "@/lib/env";
import { getProject, getPrd, getQuotaState, listMessages } from "@/lib/repo";

export default async function ProjectPage({ params }: PageProps<"/dashboard/[id]">) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) notFound();

  const messages: WorkspaceMessage[] = listMessages(project.id).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
  const prd = getPrd(project.id);
  const quota: WorkspaceQuota = getQuotaState(user.id, user.plan);
  const models = getAvailableProviders().map((p) => ({
    id: p.id,
    label: p.label,
    models: p.models.map((model) => ({ id: `${p.id}/${model}`, model })),
  }));

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader authed floatingDock={false} />
      <Workspace
        project={{
          id: project.id,
          title: project.title,
          idea: project.idea,
          modelId: resolveActiveModelId(undefined, project.modelId),
          language: project.language === "en" ? "en" : "id",
          updatedAt: project.updatedAt,
        }}
        initialMessages={messages}
        initialPrd={prd?.content ?? null}
        initialPrdVersion={prd?.version ?? 1}
        quota={quota}
        models={models}
      />
    </div>
  );
}
