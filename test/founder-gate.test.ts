import { afterEach, describe, expect, it } from "vitest";
import { assertFounder } from "@/lib/founder-gate";

function req(token?: string): Request {
  return new Request("http://localhost/api/ai/generate", {
    method: "POST",
    headers: token === undefined ? {} : { "x-founder-token": token },
  });
}

const ORIGINAL = process.env.FOUNDER_ACCESS_TOKEN;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.FOUNDER_ACCESS_TOKEN;
  else process.env.FOUNDER_ACCESS_TOKEN = ORIGINAL;
});

describe("assertFounder", () => {
  it("fails CLOSED (503) when the server has no token configured", () => {
    delete process.env.FOUNDER_ACCESS_TOKEN;
    const res = assertFounder(req("anything"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });

  it("rejects a missing token (401)", () => {
    process.env.FOUNDER_ACCESS_TOKEN = "secret-code";
    const res = assertFounder(req(undefined));
    expect(res!.status).toBe(401);
  });

  it("rejects a wrong token (401)", () => {
    process.env.FOUNDER_ACCESS_TOKEN = "secret-code";
    const res = assertFounder(req("wrong"));
    expect(res!.status).toBe(401);
  });

  it("rejects a token of different length (401, no timing throw)", () => {
    process.env.FOUNDER_ACCESS_TOKEN = "secret-code";
    const res = assertFounder(req("x"));
    expect(res!.status).toBe(401);
  });

  it("accepts the correct token (null → proceed)", () => {
    process.env.FOUNDER_ACCESS_TOKEN = "secret-code";
    const res = assertFounder(req("secret-code"));
    expect(res).toBeNull();
  });
});
