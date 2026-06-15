import { describe, it, expect } from "vitest";
import { extractSubdomain, subdomainRewritePath } from "@/lib/subdomain";

describe("extractSubdomain", () => {
  it("returns the handle for a creator subdomain", () => {
    expect(extractSubdomain("jane.nestud.io")).toBe("jane");
    expect(extractSubdomain("jane.nestud.io:443")).toBe("jane");
    expect(extractSubdomain("jane.localhost:3000")).toBe("jane");
  });

  it("returns null for the app root / www", () => {
    expect(extractSubdomain("nestud.io")).toBeNull();
    expect(extractSubdomain("www.nestud.io")).toBeNull();
    expect(extractSubdomain("localhost:3000")).toBeNull();
  });

  it("ignores reserved subdomains", () => {
    expect(extractSubdomain("app.nestud.io")).toBeNull();
    expect(extractSubdomain("api.nestud.io")).toBeNull();
    expect(extractSubdomain("studio.nestud.io")).toBeNull();
  });

  it("uses only the left-most label and handles junk", () => {
    expect(extractSubdomain("jane.staging.nestud.io")).toBe("jane");
    expect(extractSubdomain("")).toBeNull();
    expect(extractSubdomain(null)).toBeNull();
    expect(extractSubdomain("example.com")).toBeNull();
  });

  it("maps a handle to the creator route", () => {
    expect(subdomainRewritePath("jane")).toBe("/u/jane");
  });
});
