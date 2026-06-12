import { describe, it, expect } from "vitest";
import { fileReport, getReports, hiddenRefs, setReportStatus } from "@/lib/reports";

describe("reports", () => {
  it("files reports as pending and transitions status", () => {
    const report = fileReport({ targetType: "house", targetRef: "saffron.tiny.lantern", targetLabel: "The Quiet Kettle", reason: "spam links" });
    expect(report.status).toBe("pending");
    expect(getReports()).toHaveLength(1);

    setReportStatus(report.id, "reviewed");
    expect(getReports()[0].status).toBe("reviewed");

    setReportStatus(report.id, "dismissed");
    expect(getReports()[0].status).toBe("dismissed");
  });

  it("hiddenRefs reflects only reports marked hidden (hidden-house filtering)", () => {
    const report = fileReport({ targetType: "house", targetRef: "moon.blue.hour", targetLabel: "Blue Hour Studio", reason: "abuse" });
    expect(hiddenRefs().has("moon.blue.hour")).toBe(false);

    setReportStatus(report.id, "hidden");
    expect(hiddenRefs().has("moon.blue.hour")).toBe(true);
  });
});
