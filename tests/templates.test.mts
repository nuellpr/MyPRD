import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { TEMPLATES, getTemplate, stackLine } = await import("../lib/templates.ts");

describe("templates", () => {
  it("slug unik dan field wajib terisi", () => {
    const slugs = TEMPLATES.map((t) => t.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const t of TEMPLATES) {
      assert.ok(t.slug.length > 0);
      assert.ok(t.name.length > 0);
      assert.ok(t.tagline.length > 0);
      assert.ok(t.description.length > 30);
      assert.ok(t.stack.length >= 3);
      assert.ok(t.includes.length > 0);
      assert.equal(t.steps.length, 4);
    }
  });

  it("prompt install menyebut stack template dan melarang hardcode secret", () => {
    for (const t of TEMPLATES) {
      assert.ok(t.installPrompt.length > 200, t.slug);
      for (const s of t.stack) {
        assert.ok(
          t.installPrompt.includes(s.label),
          `${t.slug} prompt harus menyebut ${s.label}`,
        );
      }
      assert.match(t.installPrompt, /environment variable|env/i);
    }
  });

  it("ideaContext menyebut nama template", () => {
    for (const t of TEMPLATES) {
      assert.ok(t.ideaContext.includes(t.name), t.slug);
    }
  });

  it("getTemplate mengembalikan null untuk slug asing dan mencakup template baru", () => {
    assert.equal(getTemplate("tidak-ada"), null);
    assert.equal(getTemplate("next-starter")?.name, "Starter Next.js");
    assert.equal(getTemplate("laravel-starter")?.name, "Starter Laravel");
    assert.equal(getTemplate("expo-starter")?.name, "Starter Mobile Expo");
    assert.ok(TEMPLATES.length >= 5);
  });

  it("stackLine menggabung label dengan +", () => {
    const t = getTemplate("next-starter");
    assert.ok(t);
    assert.equal(stackLine(t), "Next.js + Node.js + PostgreSQL + Docker");
  });
});
