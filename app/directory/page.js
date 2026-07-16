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
          <p className="text-xs text-slate-400">Shown on the home screen</p>
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

export default function DirectoryPage() {
  const { profile } = useProfile();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, child_name, email, phone, avatar_url")
      .order("full_name", { ascending: true });
    setParents(data || []);
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

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Classroom families
      </h2>
      {loading ? (
        <SkeletonCards count={3} height="h-14" />
      ) : (
        <ul className="space-y-2">
          {parents.map((p, i) => (
            <li
              key={p.id}
              className="animate-fade-in-item flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card"
              style={staggerStyle(i)}
            >
              <Avatar src={p.avatar_url} name={p.full_name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{p.full_name}</p>
                {p.child_name && (
                  <p className="truncate text-xs text-slate-400">{p.child_name}&apos;s parent</p>
                )}
                <p className="truncate text-xs text-slate-500">{p.email}</p>
                {p.phone && <p className="truncate text-xs text-slate-500">{p.phone}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
