import Link from 'next/link';
import { signInWithPassword, signUpWithPassword, sendMagicLink } from './actions';
import { GoogleSignInButton } from './google-button';

type SearchParams = Promise<{ error?: string; notice?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, notice } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← ClipCal
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        UMN students only. Use your <code>@umn.edu</code> email.
      </p>

      {error ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {notice === 'check-email' ? (
        <p className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Check your inbox to confirm your address.
        </p>
      ) : null}
      {notice === 'magic-link-sent' ? (
        <p className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Magic link sent — check your inbox.
        </p>
      ) : null}

      <GoogleSignInButton />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-3">
        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="you@umn.edu"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            placeholder="(only for password sign-in / sign-up)"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="submit"
            formAction={signInWithPassword}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in with password
          </button>
          <button
            type="submit"
            formAction={signUpWithPassword}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Create account
          </button>
          <button
            type="submit"
            formAction={sendMagicLink}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Email me a magic link
          </button>
        </div>
      </form>
    </main>
  );
}
