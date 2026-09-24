import assert from "node:assert/strict";
import { test } from "node:test";

import { withHeartbeat, type HeartbeatItem } from "../lib/sse-heartbeat.ts";

async function collect<T>(iterable: AsyncIterable<HeartbeatItem<T>>): Promise<HeartbeatItem<T>[]> {
  const items: HeartbeatItem<T>[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("withHeartbeat meneruskan semua nilai sumber tanpa kehilangan satu pun", async () => {
  async function* source() {
    yield "a";
    yield "b";
    yield "c";
  }
  const items = await collect(withHeartbeat(source(), 1000));
  const values = items.filter((i) => i.kind === "value").map((i) => (i as { value: string }).value);
  assert.deepEqual(values, ["a", "b", "c"]);
  assert.equal(items.filter((i) => i.kind === "ping").length, 0);
});

test("withHeartbeat mengirim ping saat sumber menggantung lebih lama dari interval", async () => {
  async function* source() {
    await delay(90);
    yield "lambat";
  }
  const items = await collect(withHeartbeat(source(), 25));
  const pings = items.filter((i) => i.kind === "ping").length;
  const values = items.filter((i) => i.kind === "value").map((i) => (i as { value: string }).value);
  assert.ok(pings >= 2, `harus ada minimal 2 ping, dapat ${pings}`);
  // Nilai asli tetap terkirim tepat satu kali walau sudah beberapa kali ping.
  assert.deepEqual(values, ["lambat"]);
});

test("withHeartbeat menjaga urutan nilai setelah ping diselipkan", async () => {
  async function* source() {
    yield 1;
    await delay(60);
    yield 2;
    await delay(60);
    yield 3;
  }
  const items = await collect(withHeartbeat(source(), 20));
  const values = items.filter((i) => i.kind === "value").map((i) => (i as { value: number }).value);
  assert.deepEqual(values, [1, 2, 3]);
});

test("withHeartbeat tidak mengirim ping untuk sumber yang selesai cepat", async () => {
  async function* source() {
    yield "x";
  }
  const items = await collect(withHeartbeat(source(), 5000));
  assert.deepEqual(items, [{ kind: "value", value: "x" }]);
});

test("withHeartbeat meneruskan error dari sumber", async () => {
  async function* source() {
    yield "ok";
    throw new Error("provider mati");
  }
  await assert.rejects(() => collect(withHeartbeat(source(), 1000)), /provider mati/);
});

test("withHeartbeat memanggil return() sumber saat consumer berhenti lebih awal", async () => {
  let closed = false;
  async function* source() {
    try {
      yield "a";
      yield "b";
    } finally {
      closed = true;
    }
  }
  for await (const item of withHeartbeat(source(), 1000)) {
    assert.deepEqual(item, { kind: "value", value: "a" });
    break;
  }
  assert.equal(closed, true);
});
