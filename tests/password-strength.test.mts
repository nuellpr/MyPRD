import assert from "node:assert/strict";
import test from "node:test";
import { scorePassword } from "../lib/password-strength.ts";

test("scorePassword mengembalikan 0 untuk kosong dan 1-4 sesuai kriteria", () => {
  assert.equal(scorePassword(""), 0);
  assert.equal(scorePassword("abc"), 0);
  assert.equal(scorePassword("abcdefgh"), 1);
  assert.equal(scorePassword("Abcdefgh"), 2);
  assert.equal(scorePassword("Abcdefg1"), 3);
  assert.equal(scorePassword("Abcdef1!"), 4);
});
