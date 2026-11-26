import { requireUser } from "@/lib/auth";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { deriveTitleFromPrd } from "@/lib/prd";
import { getPrd, getProject, savePrd, updateProject } from "@/lib/repo";
import { MAX_PRD_CHARS, sanitizeUserText } from "@/lib/safety";

type Context = { params: Promise<{ id: string }> };

/** GET PRD project (dipakai editor & preview). */
export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });
    return jsonOk({ prd: getPrd(project.id) });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PUT PRD — menyimpan hasil edit manual user dari editor markdown. */
export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const body = await readJson<{ content?: string }>(request);
    const content = sanitizeUserText(body.content, MAX_PRD_CHARS);
    if (!content) return Response.json({ error: "Isi PRD tidak boleh kosong." }, { status: 400 });

    const prd = savePrd(project.id, content);
    const title = deriveTitleFromPrd(prd.content, project.title);
    updateProject(user.id, project.id, { title, status: "prd_ready" });
    return jsonOk({ prd, title });
  } catch (error) {
    return errorToResponse(error);
  }
}
