"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    childName: "",
    email: "",
    phone: "",
    password: "",
    inviteCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Something went wrong. Try again.");
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setLoading(false);

    if (signInError) {
      setError("Account created — please sign in.");
      router.push("/login");
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12 safe-top safe-bottom">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center text-xl font-bold shadow-card">
          SC
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Join the classroom</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask your room parent for the invite code.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
          <input
            required
            value={form.fullName}
            onChange={update("fullName")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Child&apos;s name <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={form.childName}
            onChange={update("childName")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Email <span className="text-slate-400">(shown to other parents)</span>
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Phone <span className="text-slate-400">(optional — shown to other parents)</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={update("phone")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            autoComplete="tel"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={update("password")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Invite code</label>
          <input
            required
            value={form.inviteCode}
            onChange={update("inviteCode")}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-500 px-4 py-3 text-base font-semibold text-white shadow-card transition active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "Joining…" : "Join classroom"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-brand-600">
          Sign in
        </Link>
      </p>
    </main>
  );
}
