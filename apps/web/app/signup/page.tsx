"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password || pending) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: name.trim() || email.trim().split("@")[0]!,
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not sign up.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="bg-background text-foreground flex h-dvh flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="text-center">
          <h1 className="font-medium text-3xl tracking-tight">Sign up</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create your darwin account.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Input
            aria-label="Name"
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Ada Lovelace"
            type="text"
            value={name}
          />
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
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="Password (min 8 characters)"
            type="password"
            value={password}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button disabled={pending} onClick={() => void submit()} type="button">
            {pending ? "Creating account…" : "Sign up"}
          </Button>
        </div>
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link className="text-foreground underline underline-offset-4" href="/signin">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
