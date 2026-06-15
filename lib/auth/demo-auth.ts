import type { AuthClient, AuthCredentials, SessionUser, SignUpInput } from "@/lib/auth/types";
import { nameFromEmail } from "@/lib/auth/types";

// Demo auth — the existing localStorage session, behind the unified AuthClient.
// There is no password check (the demo never had one); sign-in/up simply
// establish a session. The key is unchanged (`ai-bazaar-user`) so existing demo
// state and the DemoProvider stay in sync.

const KEY = "ai-bazaar-user";
const DEMO_ID = "demo-user";

type StoredUser = { id?: string; name: string; email: string };

function read(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    return { id: parsed.id ?? DEMO_ID, name: parsed.name, email: parsed.email };
  } catch {
    return null;
  }
}

function write(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(KEY, JSON.stringify(user));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("ai-bazaar-auth-changed"));
}

export class DemoAuthClient implements AuthClient {
  async getInitialUser() {
    return read();
  }

  async signUp(input: SignUpInput): Promise<SessionUser> {
    const email = input.email || "maker@example.com";
    const user: SessionUser = { id: DEMO_ID, email, name: input.name?.trim() || nameFromEmail(email) };
    write(user);
    return user;
  }

  async signIn(input: AuthCredentials): Promise<SessionUser> {
    const email = input.email || "maker@example.com";
    // Demo keeps any previously stored name; otherwise derive one.
    const existing = read();
    const user: SessionUser = {
      id: DEMO_ID,
      email,
      name: existing && existing.email === email ? existing.name : nameFromEmail(email),
    };
    write(user);
    return user;
  }

  async signOut() {
    write(null);
  }

  subscribe(callback: (user: SessionUser | null) => void) {
    if (typeof window === "undefined") return () => undefined;
    const handler = () => callback(read());
    window.addEventListener("ai-bazaar-auth-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ai-bazaar-auth-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }
}
