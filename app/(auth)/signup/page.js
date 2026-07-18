"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadChildPhoto } from "@/lib/uploadFile";
import { subscribeToPush } from "@/lib/pushClient";
import Logo from "@/components/Logo";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    fullName: "",
    childName: "",
    email: "",
    phone: "",
    password: "",
    inviteCode: "",
    familyCode: "",
  });
  const [childPhoto, setChildPhoto] = useState(null);
  const [childPhotoPreview, setChildPhotoPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const childFileInputRef = useRef(null);

  useEffect(() => {
    const familyCode = searchParams.get("familyCode");
    const inviteCode = searchParams.get("inviteCode");
    const email = searchParams.get("email");
    if (familyCode || inviteCode || email) {
      setForm((f) => ({
        ...f,
        familyCode: familyCode || f.familyCode,
        inviteCode: inviteCode || f.inviteCode,
        email: email || f.email,
      }));
    }
  }, [searchParams]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleChildPhotoPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setChildPhoto(file);
    setChildPhotoPreview(URL.createObjectURL(file));
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
    const {
      data: { user },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (signInError) {
      setLoading(false);
      setError("Account created — please sign in.");
      router.push("/login");
      return;
    }

    if (childPhoto && user) {
      try {
        const publicUrl = await uploadChildPhoto(supabase, user.id, childPhoto);
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childAvatarUrl: publicUrl }),
        });
      } catch {
        // Not worth blocking signup over — they can add it later from Directory.
      }
    }

    // Ask for notifications right away instead of leaving it as a toggle
    // parents have to go find later. Still requires them to tap "Allow" in
    // the browser's own prompt — nothing can grant that silently — but this
    // gets it in front of them at the one moment they're already engaged.
    try {
      await subscribeToPush();
    } catch {
      // Denied, unsupported, or not set up — NotificationsPrompt on Home
      // will offer it again (unless they explicitly denied it).
    }

    setLoading(false);
    router.push("/home");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12 safe-top safe-bottom">
      <div className="mb-6 text-center">
        <Logo size={56} className="mx-auto mb-3 block rounded-2xl shadow-card" />
        <h1 className="text-3xl font-bold text-slate-900">Join the classroom</h1>
        <p className="mt-1 text-sm text-slate-500">
          {form.familyCode.trim()
            ? "You're joining as a co-parent — no invite code needed."
            : "Ask your room parent for the invite code."}
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
            Family code <span className="text-slate-400">(optional — joining a spouse/co-parent?)</span>
          </label>
          <input
            value={form.familyCode}
            onChange={update("familyCode")}
            placeholder="e.g. A1B2C3D4"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base uppercase shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {form.familyCode.trim() && (
            <p className="mt-1 text-xs text-slate-500">
              You&apos;ll share your child&apos;s existing profile with that account — no need to fill in
              their name/photo below.
            </p>
          )}
        </div>
        {!form.familyCode.trim() && (
          <>
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
                Child&apos;s photo <span className="text-slate-400">(optional — shown on the home screen)</span>
              </label>
              <div className="flex items-center gap-3">
                {childPhotoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={childPhotoPreview}
                    alt="Preview"
                    className="h-14 w-14 flex-none rounded-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => childFileInputRef.current?.click()}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-brand-600 shadow-sm"
                >
                  {childPhotoPreview ? "Change photo" : "Add a photo"}
                </button>
                <input
                  ref={childFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleChildPhotoPick}
                />
              </div>
            </div>
          </>
        )}
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
        {!form.familyCode.trim() && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Invite code</label>
            <input
              required
              value={form.inviteCode}
              onChange={update("inviteCode")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        )}

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
