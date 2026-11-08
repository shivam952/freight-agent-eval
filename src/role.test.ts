import assert from "node:assert/strict";
import { test } from "node:test";
import { isGrounded } from "./role.js";

const email = "Hello, please quote for 1x20GP.\nDelivery to our warehouse in  Hamburg-Billbrook.\nKind regards, Anna";

test("an exact quote is grounded, ignoring case, line breaks and double spaces", () => {
  assert.ok(isGrounded("delivery to our warehouse in Hamburg-Billbrook", email));
});

test("a paraphrase is not grounded", () => {
  assert.ok(!isGrounded("goods are delivered to the buyer's warehouse", email));
});

test("a too-short quote is not accepted as evidence", () => {
  assert.ok(!isGrounded("our", email));
});
