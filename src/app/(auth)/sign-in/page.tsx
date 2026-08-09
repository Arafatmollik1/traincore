import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/challenges");

  const googleConfigured = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">traincore</h1>
        <p className="mt-3 max-w-xs text-sm text-foreground/60">
          Challenges, competitions and community — with live AI rep counting.
          Completely free.
        </p>
      </div>

      {googleConfigured ? (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/challenges" });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-full border border-foreground/15 bg-background px-6 py-3 text-sm font-medium shadow-sm transition hover:bg-foreground/5 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.3a12 12 0 0 0 0 10.8l4-3z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.3.6 4.6 1.8L20 3.1A12 12 0 0 0 1.3 6.6l4 3.1c1-2.8 3.6-4.9 6.7-4.9z"
              />
            </svg>
            Continue with Google
          </button>
        </form>
      ) : (
        <div className="max-w-sm rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground/80">
          <p className="font-semibold">Google sign-in isn&apos;t set up yet</p>
          <p className="mt-1 text-foreground/60">
            Add <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>{" "}
            to <code>.env</code>, then restart the dev server. See the README
            for the two-minute setup.
          </p>
        </div>
      )}
    </main>
  );
}
