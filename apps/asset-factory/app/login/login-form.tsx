"use client";

export function LoginForm({ from, hadError }: { from: string; hadError: boolean }) {
  return (
    <form method="post" action="/api/login">
      <input type="hidden" name="from" value={from} />
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoFocus />
      </div>
      <button className="btn btn-primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
        Enter
      </button>
      {hadError && <p className="error">Incorrect password.</p>}
    </form>
  );
}
