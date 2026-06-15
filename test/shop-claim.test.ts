import { describe, it, expect } from "vitest";
import { firstOpenSlotId, prefixFromSlug, villageAddress } from "@/lib/shop-claim";

describe("prefixFromSlug", () => {
  it("takes the first slug segment as the village prefix", () => {
    expect(prefixFromSlug("moon-court")).toBe("moon");
    expect(prefixFromSlug("saffron-yard")).toBe("saffron");
    expect(prefixFromSlug("rose")).toBe("rose");
  });
});

describe("villageAddress", () => {
  it("produces a regex-safe three-word address with the village prefix", () => {
    const addr = villageAddress("moon-court", 1);
    expect(addr).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/); // matches the shops.address CHECK
    expect(addr.split(".")[0]).toBe("moon");
  });
  it("varies with the seed (for collision retries)", () => {
    expect(villageAddress("moon-court", 1)).not.toBe(villageAddress("moon-court", 2));
  });
});

describe("firstOpenSlotId", () => {
  const slots = [
    { id: "s3", slot_number: 3 },
    { id: "s1", slot_number: 1 },
    { id: "s2", slot_number: 2 },
  ];
  it("returns the lowest-numbered free slot", () => {
    expect(firstOpenSlotId(slots, new Set(["s1"]))?.id).toBe("s2");
  });
  it("returns the first slot when none are taken", () => {
    expect(firstOpenSlotId(slots, new Set())?.id).toBe("s1");
  });
  it("returns null when every slot is taken", () => {
    expect(firstOpenSlotId(slots, new Set(["s1", "s2", "s3"]))).toBeNull();
  });
});
