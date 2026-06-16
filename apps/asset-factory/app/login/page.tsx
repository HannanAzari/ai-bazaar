import { redirect } from "next/navigation";
import { isGateEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  // If no password is configured, the tool is open — skip the gate entirely.
  if (!isGateEnabled()) {
    redirect("/");
  }
  const params = await searchParams;
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 style={{ marginTop: 0, fontSize: "1.1rem" }}>🏭 Asset Factory</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Internal tool — enter the access password.
        </p>
        <LoginForm from={params.from ?? "/"} hadError={params.error === "1"} />
      </div>
    </div>
  );
}
