import { requireUser } from "@/lib/auth";
import { errorToResponse } from "@/lib/http";
import { getPrd, getProject } from "@/lib/repo";
import { parseTasks, tasksToJson, tasksToMarkdown } from "@/lib/tasks";

type Context = { params: Promise<{ id: string }> };

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "prd"
  );
}

/**
 * GET /api/projects/:id/export?format=markdown|json|tasks-md|tasks-json
 *
 * PRD & task breakdown diunduh sebagai file, siap ditempel ke AI coding agent.
 */
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const prd = getPrd(project.id);
    if (!prd) return Response.json({ error: "Project ini belum punya PRD." }, { status: 404 });

    const format = new URL(request.url).searchParams.get("format") ?? "markdown";
    const slug = slugify(project.title);

    const files: Record<string, { body: string; type: string; name: string }> = {
      markdown: { body: prd.content, type: "text/markdown; charset=utf-8", name: `${slug}-prd.md` },
      json: {
        body: JSON.stringify(
          {
            project: {
              id: project.id,
              title: project.title,
              modelId: project.modelId,
              language: project.language,
              status: project.status,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
            },
            prd: { content: prd.content, version: prd.version, updatedAt: prd.updatedAt },
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        type: "application/json; charset=utf-8",
        name: `${slug}-prd.json`,
      },
      "tasks-md": {
        body: tasksToMarkdown(project.title, parseTasks(prd.content)),
        type: "text/markdown; charset=utf-8",
        name: `${slug}-tasks.md`,
      },
      "tasks-json": {
        body: tasksToJson(project.title, parseTasks(prd.content)),
        type: "application/json; charset=utf-8",
        name: `${slug}-tasks.json`,
      },
    };

    const file = files[format];
    if (!file) {
      return Response.json({ error: "Format export tidak dikenal." }, { status: 400 });
    }

    return new Response(file.body, {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
