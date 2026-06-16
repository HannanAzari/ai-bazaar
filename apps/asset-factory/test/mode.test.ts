import { describe, it, expect, afterEach } from "vitest";
import { getFactoryMode, isSupabaseMode } from "@/lib/runtime-mode";

const ORIGINAL = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  if (ORIGINAL.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL.url;
  if (ORIGINAL.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL.anon;
});

describe("factory runtime mode", () => {
  it("is demo when the Supabase env is absent", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(getFactoryMode()).toBe("demo");
    expect(isSupabaseMode()).toBe(false);
  });

  it("is supabase only when BOTH url and anon key are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(getFactoryMode()).toBe("demo");

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getFactoryMode()).toBe("supabase");
    expect(isSupabaseMode()).toBe(true);
  });
});
