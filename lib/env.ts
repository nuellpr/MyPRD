/**
 * Pusat konfigurasi environment.
 *
 * Semua akses `process.env` untuk konfigurasi aplikasi lewat sini supaya
 * mudah dilacak dan ada default yang aman untuk development.
 */

export type ProviderId = "mock" | "gemini" | "openai" | "openrouter" | "deepseek" | "kimi" | "qwen" | "groq" | "custom";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Base URL OpenAI-compatible, mis. https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  /** Daftar model yang ditawarkan ke user. */
  models: string[];
  /** Perkiraan harga per 1 juta token (USD) untuk monitoring biaya. */
  costPerMTokIn: number;
  costPerMTokOut: number;
}

function readKey(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== "") return value.trim();
  }
  return "";
}

/**
 * Katalog provider. Provider tanpa API key otomatis tidak muncul di UI,
 * kecuali provider `mock` yang selalu tersedia agar aplikasi bisa dicoba
 * tanpa kredensial apa pun.
 */
export function getProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [
    {
      id: "mock",
      label: "Demo (tanpa API key)",
      baseUrl: "",
      apiKey: "",
      models: ["myprd-demo"],
      costPerMTokIn: 0,
      costPerMTokOut: 0,
    },
    {
      id: "gemini",
      label: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: readKey("GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI"),
      models: (process.env.GEMINI_MODELS ?? "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.5-flash,gemini-2.5-flash")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      costPerMTokIn: 0.3,
      costPerMTokOut: 2.5,
    },
    {
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: readKey("OPENAI_API_KEY"),
      models: (process.env.OPENAI_MODELS ?? "gpt-4o-mini,gpt-4o").split(",").map((m) => m.trim()).filter(Boolean),
      costPerMTokIn: 0.15,
      costPerMTokOut: 0.6,
    },
    {
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: readKey("OPENROUTER_API_KEY"),
      models: (process.env.OPENROUTER_MODELS ?? "deepseek/deepseek-chat-v3.1,anthropic/claude-sonnet-4.5")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      costPerMTokIn: 0.3,
      costPerMTokOut: 1.2,
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: readKey("DEEPSEEK_API_KEY"),
      models: (process.env.DEEPSEEK_MODELS ?? "deepseek-chat,deepseek-reasoner").split(",").map((m) => m.trim()).filter(Boolean),
      costPerMTokIn: 0.27,
      costPerMTokOut: 1.1,
    },
    {
      id: "kimi",
      label: "Kimi (Moonshot)",
      baseUrl: process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1",
      apiKey: readKey("KIMI_API_KEY", "MOONSHOT_API_KEY"),
      models: (process.env.KIMI_MODELS ?? "kimi-k2-0905-preview,moonshot-v1-32k").split(",").map((m) => m.trim()).filter(Boolean),
      costPerMTokIn: 0.6,
      costPerMTokOut: 2.5,
    },
    {
      id: "qwen",
      label: "Qwen (DashScope)",
      baseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      apiKey: readKey("QWEN_API_KEY", "DASHSCOPE_API_KEY"),
      models: (process.env.QWEN_MODELS ?? "qwen3-coder-plus,qwen-plus").split(",").map((m) => m.trim()).filter(Boolean),
      costPerMTokIn: 0.4,
      costPerMTokOut: 1.2,
    },
    {
      id: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: readKey("GROQ_API_KEY"),
      models: (process.env.GROQ_MODELS ?? "llama-3.3-70b-versatile").split(",").map((m) => m.trim()).filter(Boolean),
      costPerMTokIn: 0.2,
      costPerMTokOut: 0.6,
    },
  ];

  const customBaseUrl = process.env.CUSTOM_BASE_URL ?? "";
  if (customBaseUrl) {
    providers.push({
      id: "custom",
      label: process.env.CUSTOM_LABEL ?? "Custom (OpenAI-compatible)",
      baseUrl: customBaseUrl,
      apiKey: readKey("CUSTOM_API_KEY"),
      models: (process.env.CUSTOM_MODELS ?? "default").split(",").map((m) => m.trim()).filter(Boolean),
      costPerMTokIn: Number(process.env.CUSTOM_COST_IN ?? 0),
      costPerMTokOut: Number(process.env.CUSTOM_COST_OUT ?? 0),
    });
  }

  return providers;
}

/** Provider yang bisa dipakai user (mock selalu ada, lainnya butuh key). */
export function getAvailableProviders(): ProviderConfig[] {
  return getProviders().filter((p) => p.id === "mock" || p.apiKey !== "");
}

/** Format model id: `provider/model`. */
export function parseModelId(modelId: string): { providerId: ProviderId; model: string } | null {
  const idx = modelId.indexOf("/");
  if (idx <= 0) return null;
  const providerId = modelId.slice(0, idx) as ProviderId;
  const model = modelId.slice(idx + 1);
  if (!model) return null;
  return { providerId, model };
}

export function findProvider(providerId: string): ProviderConfig | undefined {
  return getAvailableProviders().find((p) => p.id === providerId);
}

export function defaultModelId(): string {
  const configured = process.env.AI_DEFAULT_MODEL;
  if (configured) {
    const parsed = parseModelId(configured);
    if (parsed && findProvider(parsed.providerId)) return configured;
  }
  const firstNonMock = getAvailableProviders().find((p) => p.id !== "mock");
  if (firstNonMock) return `${firstNonMock.id}/${firstNonMock.models[0]}`;
  return "mock/myprd-demo";
}

export function appSecret(): string {
  const secret = process.env.APP_SECRET ?? "";
  if (secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET wajib diisi minimal 16 karakter di production.");
  }
  return "dev-only-insecure-secret-please-change";
}

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? "data/myprd.db";
}

/**
 * Batas diam provider: kalau tidak ada chunk baru selama ini, stream dianggap
 * macet (provider free tier kadang berhenti tanpa menutup koneksi).
 * Default 120 detik; bisa diturunkan untuk pengujian.
 */
export function aiIdleTimeoutMs(): number {
  const raw = Number(process.env.AI_IDLE_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(raw) && raw >= 100 ? raw : 120_000;
}

/**
 * Email admin (dipisah koma, case-insensitive). Admin mendapat badge admin
 * di halaman pengaturan.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

export const freeMonthlyQuota = Number(process.env.FREE_MONTHLY_QUOTA ?? 5);
