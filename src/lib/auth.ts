const SESSION_KEY = "pdf_toolbox.session";

export interface Session {
  email: string;
  name: string;
  signedInAt: number;
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed && typeof parsed.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function signIn(email: string): Session {
  const session: Session = {
    email,
    name: email.split("@")[0] || "Demo User",
    signedInAt: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
}
