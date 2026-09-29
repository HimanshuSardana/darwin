"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Reject open redirects: only same-origin paths are allowed. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password || pending) return;
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign in.");
      return;
    }
    router.push(safeNext(searchParams.get("next")));
    router.refresh();
  };

  return (
    <main className="bg-background text-foreground flex h-dvh flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="text-center">
          <h1 className="font-medium text-3xl tracking-tight">Sign in</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back to darwin.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Input
            aria-label="Email"
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
          <Input
            aria-label="Password"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="Password"
            type="password"
            value={password}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button disabled={pending} onClick={() => void submit()} type="button">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </div>
        <p className="text-muted-foreground text-center text-sm">
          No account?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
