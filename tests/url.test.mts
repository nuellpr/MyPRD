import assert from "node:assert/strict";
import test from "node:test";

const { publicOrigin, publicUrl } = await import("../lib/url.ts");

test("publicOrigin memakai x-forwarded-host & x-forwarded-proto di balik reverse proxy", () => {
  const prev = process.env.APP_URL;
  delete process.env.APP_URL;
  try {
    const req = new Request("http://localhost:3000/api/auth/google/callback", {
      headers: {
        "x-forwarded-host": "myprd.site",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(publicOrigin(req), "https://myprd.site");
    assert.equal(publicUrl(req, "/verifikasi-otp?a=1"), "https://myprd.site/verifikasi-otp?a=1");
  } finally {
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  }
});

test("publicOrigin memakai APP_URL bila dikonfigurasi", () => {
  const prev = process.env.APP_URL;
  process.env.APP_URL = "https://myprd.site/apa-saja";
  try {
    const req = new Request("http://127.0.0.1:3000/api/billing/checkout", {
      headers: { host: "127.0.0.1:3000" },
    });
    assert.equal(publicOrigin(req), "https://myprd.site");
    assert.equal(publicUrl(req, "/billing"), "https://myprd.site/billing");
  } finally {
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  }
});

test("publicOrigin fallback ke request.url untuk akses lokal", () => {
  const prev = process.env.APP_URL;
  delete process.env.APP_URL;
  try {
    const req = new Request("http://localhost:3000/login");
    assert.equal(publicOrigin(req), "http://localhost:3000");
  } finally {
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  }
});
