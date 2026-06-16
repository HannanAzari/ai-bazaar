import { describe, it, expect } from "vitest";
import { createLocalRepository } from "@/lib/repo/local";
import { candidateFromImport } from "@/lib/validation";
import { makeReviewAction } from "@/lib/activity";

const repo = createLocalRepository();

function newCandidate(name: string) {
  return candidateFromImport({
    name,
    category: "lamp",
    imageUrl: `https://cdn.example.com/${name}.png`,
    width: 1024,
    height: 1024,
    transparent: true,
    tags: ["lamp"],
  });
}

describe("local repository", () => {
  it("seeds the 90 samples on first list", async () => {
    expect(await repo.list()).toHaveLength(90);
  });

  it("saveCandidate upserts a candidate", async () => {
    const all = await repo.list();
    const edited = { ...all[0], name: "Renamed" };
    await repo.saveCandidate(edited);
    const after = await repo.list();
    expect(after.find((c) => c.id === edited.id)?.name).toBe("Renamed");
    expect(after).toHaveLength(90);
  });

  it("addCandidates adds new and skips duplicates", async () => {
    const c = newCandidate("Brand New Lamp");
    const list1 = await repo.addCandidates([c]);
    expect(list1).toHaveLength(91);
    const list2 = await repo.addCandidates([c]); // same id again
    expect(list2).toHaveLength(91);
  });

  it("applyAction persists the candidate and logs the action", async () => {
    const all = await repo.list();
    const target = all.find((c) => c.status === "needs_review")!;
    const next = { ...target, status: "approved" as const, reviewer: "h" };
    const action = makeReviewAction(next, "approved", "Hannah");
    await repo.applyAction(next, action);

    const after = await repo.list();
    expect(after.find((c) => c.id === target.id)?.status).toBe("approved");

    const actions = await repo.listActions();
    expect(actions[0].action).toBe("approved");
    expect(actions[0].reviewer).toBe("Hannah");
    expect(actions[0].candidateId).toBe(target.id);
  });

  it("reset re-seeds candidates and clears the activity log", async () => {
    const target = (await repo.list())[0];
    await repo.applyAction({ ...target, status: "rejected" as const }, makeReviewAction(target, "rejected", "h"));
    expect((await repo.listActions()).length).toBeGreaterThan(0);

    const seeded = await repo.reset();
    expect(seeded).toHaveLength(90);
    expect(await repo.listActions()).toHaveLength(0);
  });

  it("local repo allows reset", () => {
    expect(repo.canReset).toBe(true);
    expect(repo.mode).toBe("demo");
  });
});
