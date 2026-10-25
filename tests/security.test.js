import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImageType } from "../functions/_lib/util.js";
import { canEdit, sha256Hex, isTeam, editCookie } from "../functions/_lib/auth.js";

const req = (headers = {}, url = "https://x.test/api/portraits/abc") => new Request(url, { headers });

test("image sniffing trusts bytes, not names", () => {
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(sniffImageType(new Uint8Array([])), null);
});

test("edit token: only the matching cookie or header may change a locked draft", async () => {
  const token = "a".repeat(48);
  const p = { edit_token_hash: await sha256Hex(token) };
  const env = {};
  assert.equal(await canEdit(env, req(), p), false);
  assert.equal(await canEdit(env, req({ cookie: "x=1; lp_edit=" + "b".repeat(48) }), p), false);
  assert.equal(await canEdit(env, req({ cookie: "x=1; lp_edit=" + token }), p), true);
  assert.equal(await canEdit(env, req({ "x-edit-token": token }), p), true);
  assert.equal(await canEdit(env, req(), { edit_token_hash: null }), true, "older drafts stay open");
});

test("team token: exact match only, never when unset", async () => {
  assert.equal(isTeam({}, req({ "x-admin-token": "" })), false);
  assert.equal(isTeam({ ADMIN_TOKEN: "secret" }, req({ "x-admin-token": "secre" })), false);
  assert.equal(isTeam({ ADMIN_TOKEN: "secret" }, req({ "x-admin-token": "secret" })), true);
  assert.equal(isTeam({ ADMIN_TOKEN: "secret" }, req({}, "https://x.test/a?token=secret")), true);
  assert.equal(await canEdit({ ADMIN_TOKEN: "secret" }, req({ "x-admin-token": "secret" }), { edit_token_hash: "zz" }), true, "the team can edit any draft");
});

test("edit cookie is HttpOnly, scoped to the draft, Secure on https", () => {
  const c = editCookie("abc", "t", req());
  assert.match(c, /HttpOnly/); assert.match(c, /Path=\/api\/portraits\/abc;/); assert.match(c, /Secure/); assert.match(c, /SameSite=Lax/);
  assert.doesNotMatch(editCookie("abc", "t", req({}, "http://localhost/")), /Secure/);
});
