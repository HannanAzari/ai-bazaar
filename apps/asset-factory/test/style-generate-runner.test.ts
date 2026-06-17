import { describe, it, expect, vi } from "vitest";
import { runStyleBatch, summarizeBatchErrors, type OneResult } from "@/lib/style-generate-runner";

describe("sequential style batch runner", () => {
  it("calls the provider ONE AT A TIME, in order (never parallel)", async () => {
    const events: string[] = [];
    let active = 0;
    const generateOne = vi.fn(async (i: number): Promise<OneResult> => {
      active += 1;
      expect(active).toBe(1); // never more than one in flight
      events.push(`start ${i}`);
      await Promise.resolve();
      events.push(`end ${i}`);
      active -= 1;
      return { ok: true, url: `https://img/${i}.png` };
    });
    const res = await runStyleBatch(3, { generateOne, delayMs: 0, sleep: async () => {} });
    expect(res.urls).toEqual(["https://img/0.png", "https://img/1.png", "https://img/2.png"]);
    expect(events).toEqual(["start 0", "end 0", "start 1", "end 1", "start 2", "end 2"]);
  });

  it("waits delayMs between calls (count-1 times), not after the last", async () => {
    const sleep = vi.fn(async () => {});
    await runStyleBatch(3, { generateOne: async (i) => ({ ok: true, url: `u${i}` }), delayMs: 12000, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(12000);
  });

  it("does not sleep when delayMs is 0", async () => {
    const sleep = vi.fn(async () => {});
    await runStyleBatch(3, { generateOne: async (i) => ({ ok: true, url: `u${i}` }), delayMs: 0, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("preserves partial successes (earlier images survive a later failure)", async () => {
    const res = await runStyleBatch(3, {
      delayMs: 0,
      sleep: async () => {},
      generateOne: async (i) => (i === 1 ? { ok: false, error: "boom" } : { ok: true, url: `u${i}` }),
    });
    expect(res.urls).toEqual(["u0", "u2"]); // image 1 failed, 0 and 2 kept
    expect(res.errors).toEqual([{ index: 1, error: "boom" }]);
    expect(summarizeBatchErrors(3, res)).toBe("1/3 failed — boom");
  });

  it("reports progress for each step", async () => {
    const progress: string[] = [];
    await runStyleBatch(2, {
      generateOne: async (i) => ({ ok: true, url: `u${i}` }),
      delayMs: 0,
      sleep: async () => {},
      onProgress: (done, total) => progress.push(`${done}/${total}`),
    });
    expect(progress).toEqual(["1/2", "2/2"]);
  });

  it("Generate 1 path: single call, no delay, no errors when it succeeds", async () => {
    const generateOne = vi.fn(async () => ({ ok: true as const, url: "https://img/only.png" }));
    const sleep = vi.fn(async () => {});
    const res = await runStyleBatch(1, { generateOne, delayMs: 12000, sleep });
    expect(generateOne).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(res.urls).toEqual(["https://img/only.png"]);
    expect(summarizeBatchErrors(1, res)).toBe("");
  });
});
