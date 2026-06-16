// Reviewer identity (V2, Task 8). After the password login, each reviewer enters a
// display name so approve/reject and the activity log are attributed. Stored
// per-device in localStorage (the password is the access control; the name is just
// attribution).

const REVIEWER_KEY = "nestudio-asset-factory-reviewer";

export function getReviewer(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REVIEWER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setReviewer(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REVIEWER_KEY, name.trim());
  } catch {
    // ignore
  }
}

export function clearReviewer(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REVIEWER_KEY);
  } catch {
    // ignore
  }
}
