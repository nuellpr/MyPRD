// Katalog template/starter kit: data statis (tanpa DB) ala halaman Template
// ngodingpakeai.com — user menyalin "prompt install" lalu menempelkannya ke
// AI coding agent (Claude Code/Cursor/OpenCode) untuk scaffold codebase.
export interface TemplateStack {
  category: string;
  label: string;
}

export interface Template {
  slug: string;
  name: string;
  version: string;
  price: string;
  tagline: string;
  description: string;
  stack: TemplateStack[];
  includes: string[];
  steps: { title: string; body: string }[];
  installPrompt: string;
  /** Konteks yang di-prefill ke form ide saat user klik "Bikin PRD dengan template". */
  ideaContext: string;
}

const NEXT_INSTALL_PROMPT = `Siapkan starter project fullstack di folder kosong ini dengan stack berikut:

- Frontend + Backend: Next.js (App Router, TypeScript, Tailwind CSS)
- Runtime: Node.js LTS
- Database: PostgreSQL (jalan di Docker) + Drizzle ORM + sistem migration
- Auth: Better Auth (email + password, session cookie httpOnly)
- Deployment: Dockerfile multi-stage + docker-compose untuk Postgres

Ikuti best practice ini:
- Semua secret dan API key hanya lewat environment variable (.env), jangan hardcode
- Validasi input di setiap trust boundary (form, API route, webhook)
- Rate limiting di route yang memanggil API berbayar/AI
- Skema database dirancang sejak awal (tabel user, session, dan contoh tabel domain)
- Jangan install dependency yang tidak dipakai

Setelah selesai, tampilkan: struktur folder, cara menjalankan (npm run dev + docker compose up), dan daftar route/API yang tersedia.`;

const TANSTACK_INSTALL_PROMPT = `Siapkan starter project fullstack di folder kosong ini dengan stack berikut:

- Frontend + Backend: TanStack Start (TypeScript, Tailwind CSS, file-based routing)
- Runtime: Node.js LTS
- Database: PostgreSQL (jalan di Docker) + Drizzle ORM + sistem migration
- Auth: Better Auth (email + password, session cookie httpOnly)
- Deployment: Dockerfile multi-stage + docker-compose untuk Postgres

Ikuti best practice ini:
- Semua secret dan API key hanya lewat environment variable (.env), jangan hardcode
- Validasi input di setiap trust boundary (form, API route, webhook)
- Rate limiting di route yang memanggil API berbayar/AI
- Skema database dirancang sejak awal (tabel user, session, dan contoh tabel domain)
- Jangan install dependency yang tidak dipakai

Setelah selesai, tampilkan: struktur folder, cara menjalankan (dev + docker compose up), dan daftar route/API yang tersedia.`;

const START_STEPS = [
  {
    title: "Siapkan komputermu (sekali saja)",
    body: "Install Node.js dan Docker Desktop, lalu nyalakan Docker. Pakai AI coding agent favoritmu: Claude Code, Cursor, OpenCode, atau Codex.",
  },
  {
    title: 'Klik "Salin prompt install"',
    body: "Tidak perlu mengisi nama aplikasi atau membuat project dulu — cukup salin promptnya.",
  },
  {
    title: "Tempel prompt di folder kosong",
    body: "Agent men-download pola starter, menyiapkan database, dan menjalankan aplikasi. Kamu tinggal buka localhost dan coba.",
  },
  {
    title: "Lanjutkan dengan PRD",
    body: 'Setelah aplikasi berjalan, klik "Bikin PRD dengan template" agar PRD-mu memakai tech stack template ini.',
  },
];

export const TEMPLATES: Template[] = [
  {
    slug: "next-starter",
    name: "Starter Next.js",
    version: "0.1.0",
    price: "Gratis",
    tagline: "Template fullstack application",
    description:
      "Kerangka aplikasi fullstack Next.js + PostgreSQL yang mengikuti best practice production: auth, database + migration, dan Docker. Mulai tidak dari nol supaya hemat token AI.",
    stack: [
      { category: "Frontend", label: "Next.js" },
      { category: "Backend", label: "Node.js" },
      { category: "Database", label: "PostgreSQL" },
      { category: "Deployment", label: "Docker" },
    ],
    includes: [
      "Pola source code siap jalan (App Router + API route)",
      "Skema database + sistem migration (Drizzle ORM)",
      "Auth email + session (Better Auth)",
      "Contoh rate limiting dan config env yang aman",
    ],
    steps: START_STEPS,
    installPrompt: NEXT_INSTALL_PROMPT,
    ideaContext:
      "Tech stack pilihan: Next.js (fullstack) + PostgreSQL + Docker (template Starter Next.js MyPRD).",
  },
  {
    slug: "tanstack-starter",
    name: "Starter TanStack",
    version: "0.1.0",
    price: "Gratis",
    tagline: "Template fullstack TanStack Start",
    description:
      "Kerangka aplikasi fullstack TanStack Start + PostgreSQL yang ringan saat development dan build. Alternatif Next.js kalau kamu suka file-based routing TanStack.",
    stack: [
      { category: "Frontend", label: "TanStack Start" },
      { category: "Backend", label: "Node.js" },
      { category: "Database", label: "PostgreSQL" },
      { category: "Deployment", label: "Docker" },
    ],
    includes: [
      "Pola source code siap jalan (file-based routing + server functions)",
      "Skema database + sistem migration (Drizzle ORM)",
      "Auth email + session (Better Auth)",
      "Contoh rate limiting dan config env yang aman",
    ],
    steps: START_STEPS,
    installPrompt: TANSTACK_INSTALL_PROMPT,
    ideaContext:
      "Tech stack pilihan: TanStack Start (fullstack) + PostgreSQL + Docker (template Starter TanStack MyPRD).",
  },
];

export function getTemplate(slug: string): Template | null {
  return TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function stackLine(template: Template): string {
  return template.stack.map((s) => s.label).join(" + ");
}
