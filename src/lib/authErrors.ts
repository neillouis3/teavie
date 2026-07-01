/** Map Supabase auth errors to clearer copy for login/signup forms. */
export function authErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Something went wrong. Try again.";
  }

  const message = String(
    "message" in err ? (err as { message: string }).message : ""
  ).trim();
  const code =
    "code" in err && typeof (err as { code?: string }).code === "string"
      ? (err as { code: string }).code
      : "";

  const lower = message.toLowerCase();

  if (
    code === "invalid_credentials" ||
    lower.includes("invalid login credentials")
  ) {
    return "No account found or wrong password. If you cleared Supabase, create a new account on the sign-up page.";
  }

  if (
    code === "email_not_confirmed" ||
    lower.includes("email not confirmed")
  ) {
    return "Confirm your email first, then sign in. Check your inbox for the Supabase confirmation link.";
  }

  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (lower.includes("password")) {
    return message;
  }

  return message || "Something went wrong. Try again.";
}
