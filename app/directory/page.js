"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { uploadAvatar, uploadChildPhoto } from "@/lib/uploadFile";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import NotificationsToggle from "@/components/NotificationsToggle";
import { SkeletonCards } from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

function EditMyInfo({ profile, onSaved }) {
  const [childName, setChildName] = useState(profile.child_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingChild, setUploadingChild] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const childFileInputRef = useRef(null);

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    try {
      const supabase = createClient();
      const publicUrl = await uploadAvatar(supabase, profile.id, file);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onSaved(data.profile);
    } catch (err) {
      setError(err.message || "Couldn't upload that photo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleChildPhotoPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploadingChild(true);

    try {
      const supabase = createClient();
      const publicUrl = await uploadChildPhoto(supabase, profile.id, file);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childAvatarUrl: publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onSaved(data.profile);
    } catch (err) {
      setError(err.message || "Couldn't upload that photo.");
    } finally {
      setUploadingChild(false);
      if (childFileInputRef.current) childFileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childName, phone }),
    });
    const data = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save changes.");
      return;
    }
    onSaved(data.profile);
  }

  return (
    <div className="mb-6 rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.full_name} size={56} />
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm font-medium text-brand-600 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPick}
          />
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 border-t border-slate-100 pt-3">
        <Avatar src={profile.child_avatar_url} name={profile.child_name} size={56} />
        <div>
          <p className="text-xs text-slate-400">
            Shown on the home screen — shared with any co-parent linked to your family
          </p>
          <button
            type="button"
            onClick={() => childFileInputRef.current?.click()}
            disabled={uploadingChild}
            className="text-sm font-medium text-brand-600 disabled:opacity-50"
          >
            {uploadingChild ? "Uploading…" : "Change child's photo"}
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

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          placeholder="Child's name"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save my info"}
        </button>
      </form>
    </div>
  );
}

function InviteCoParent() {
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/family/invite-code")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setInviteCode(data?.inviteCode || ""))
      .catch(() => {});
  }, []);

  const link =
    inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/signup?familyCode=${inviteCode}`
      : "";

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail without HTTPS/permission — the code is still
      // shown on screen so they can copy it manually.
    }
  }

  if (!inviteCode) return null;

  return (
    <div className="mb-6 rounded-2xl bg-white p-4 shadow-card">
      <p className="text-sm font-semibold text-slate-900">Invite your child&apos;s other parent</p>
      <p className="mt-1 text-xs text-slate-500">
        So they get their own login and show up in chat as themselves, instead of a duplicate
        entry for the same kid.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
        <code className="flex-1 truncate text-sm font-semibold tracking-wide text-slate-700">
          {inviteCode}
        </code>
        <button
          onClick={handleCopy}
          className="flex-none rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function LinksSection({ links }) {
  if (!links.length) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Links
      </h2>
      <ul className="space-y-2">
        {links.map((l, i) => (
          <li key={l.id} className="animate-fade-in-item" style={staggerStyle(i)}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-card"
            >
              <span className="truncate text-sm font-medium text-slate-800">{l.title}</span>
              <span className="flex-none text-brand-600">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DirectoryPage() {
  const { profile } = useProfile();
  const [families, setFamilies] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = createClient();
    const [{ data: familyData }, { data: linkData }] = await Promise.all([
      supabase
        .from("families")
        .select("id, child_name, child_avatar_url, profiles ( id, full_name, email, phone, avatar_url )")
        .order("child_name", { ascending: true }),
      supabase.from("links").select("id, title, url").order("created_at", { ascending: true }),
    ]);
    setFamilies(familyData || []);
    setLinks(linkData || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AppShell title="Directory">
      <p className="mb-4 text-sm text-slate-500">
        Contact info for reaching out about birthday parties, playdates, and everything else.
      </p>

      <NotificationsToggle />

      {profile && (
        <EditMyInfo
          profile={profile}
          onSaved={() => {
            refresh();
          }}
        />
      )}

      <InviteCoParent />

      <LinksSection links={links} />

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Classroom families
      </h2>
      {loading ? (
        <SkeletonCards count={3} height="h-20" />
      ) : (
        <ul className="space-y-3">
          {families.map((f, i) => (
            <li
              key={f.id}
              className="animate-fade-in-item rounded-2xl bg-white p-3 shadow-card"
              style={staggerStyle(i)}
            >
              <div className="mb-2 flex items-center gap-3">
                <Avatar src={f.child_avatar_url} name={f.child_name} size={40} />
                <p className="truncate font-semibold text-slate-900">
                  {f.child_name || "Family"}
                </p>
              </div>
              <ul className="space-y-2 border-t border-slate-100 pt-2">
                {(f.profiles || []).map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Avatar src={p.avatar_url} name={p.full_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{p.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{p.email}</p>
                      {p.phone && <p className="truncate text-xs text-slate-500">{p.phone}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
