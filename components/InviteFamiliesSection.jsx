"use client";

import { useState } from "react";

let nextKey = 0;
function makeFamily() {
  return { key: nextKey++, emails: [""] };
}

export default function InviteFamiliesSection() {
  const [families, setFamilies] = useState([makeFamily()]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function updateEmail(familyKey, emailIndex, value) {
    setFamilies((fs) =>
      fs.map((f) =>
        f.key !== familyKey
          ? f
          : { ...f, emails: f.emails.map((e, i) => (i === emailIndex ? value : e)) }
      )
    );
  }

  function addEmail(familyKey) {
    setFamilies((fs) =>
      fs.map((f) => (f.key !== familyKey ? f : { ...f, emails: [...f.emails, ""] }))
    );
  }

  function removeEmail(familyKey, emailIndex) {
    setFamilies((fs) =>
      fs.map((f) =>
        f.key !== familyKey ? f : { ...f, emails: f.emails.filter((_, i) => i !== emailIndex) }
      )
    );
  }

  function addFamily() {
    setFamilies((fs) => [...fs, makeFamily()]);
  }

  function removeFamily(familyKey) {
    setFamilies((fs) => fs.filter((f) => f.key !== familyKey));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    setResult(null);

    const payload = {
      families: families.map((f) => ({ emails: f.emails.map((email) => email.trim()) })),
    };

    const res = await fetch("/api/admin/invite-families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    setSending(false);
    if (!res.ok) {
      setError(data.error || "Couldn't send those invites.");
      return;
    }
    setResult(data);
    setFamilies([makeFamily()]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-slate-500">
        Each family gets its own signup link by email — if a family has two parents, add both
        emails to the same family so they end up sharing one child profile instead of two.
      </p>

      {families.map((family, familyIndex) => (
        <div key={family.key} className="animate-fade-in-item rounded-2xl bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Family {familyIndex + 1}
            </p>
            {families.length > 1 && (
              <button
                type="button"
                onClick={() => removeFamily(family.key)}
                className="text-xs font-medium text-red-500"
              >
                Remove
              </button>
            )}
          </div>

          <div className="space-y-2">
            {family.emails.map((email, emailIndex) => (
              <div key={emailIndex} className="animate-fade-in-item flex gap-2">
                <input
                  required
                  type="email"
                  placeholder="parent@email.com"
                  value={email}
                  onChange={(e) => updateEmail(family.key, emailIndex, e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                {family.emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmail(family.key, emailIndex)}
                    className="flex-none text-lg text-slate-400"
                    aria-label="Remove email"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addEmail(family.key)}
            className="mt-2 text-xs font-medium text-brand-600"
          >
            + Add another email
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addFamily}
        className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500"
      >
        + Add Another Family
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <p className="text-xs font-medium text-brand-600">
          ✅ Sent {result.emailsSent} invite{result.emailsSent === 1 ? "" : "s"} across{" "}
          {result.families} famil{result.families === 1 ? "y" : "ies"}.
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-card disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send invites"}
      </button>
    </form>
  );
}
