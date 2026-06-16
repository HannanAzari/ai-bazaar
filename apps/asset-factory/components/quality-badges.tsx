import { type QualityIssue } from "@/lib/quality";

export function IssueDots({ issues }: { issues: QualityIssue[] }) {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  if (critical === 0 && warning === 0) return null;
  return (
    <span className="chips" aria-label={`${critical} critical, ${warning} warnings`}>
      {critical > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span className="dot critical" /> {critical}
        </span>
      )}
      {warning > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span className="dot warning" /> {warning}
        </span>
      )}
    </span>
  );
}

export function IssueList({ issues }: { issues: QualityIssue[] }) {
  if (issues.length === 0) {
    return <p className="muted">No quality issues. ✓</p>;
  }
  return (
    <div className="issues">
      {issues.map((issue) => (
        <div key={issue.code} className={`issue ${issue.severity}`}>
          <span className={`dot ${issue.severity}`} style={{ marginTop: 5 }} />
          <span>
            <strong>{issue.severity === "critical" ? "Critical" : "Warning"}:</strong> {issue.message}
          </span>
        </div>
      ))}
    </div>
  );
}
