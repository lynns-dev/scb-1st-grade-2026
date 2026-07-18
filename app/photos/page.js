"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";
import { uploadPhoto } from "@/lib/uploadFile";
import AppShell from "@/components/AppShell";
import { SkeletonCards } from "@/components/Skeleton";
import { staggerStyle } from "@/lib/stagger";

function PhotoUploadForm({ profile, families, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFamilies, setSelectedFamilies] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function handlePick(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  function toggleFamily(id) {
    setSelectedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setSaving(true);
    setError("");

    const supabase = createClient();
    try {
      const imageUrl = await uploadPhoto(supabase, profile.id, file);

      const { data: photo, error: insertError } = await supabase
        .from("photos")
        .insert({ image_url: imageUrl, caption: caption || null, uploaded_by: profile.id })
        .select("id")
        .single();
      if (insertError) throw insertError;

      if (selectedFamilies.size > 0) {
        const rows = Array.from(selectedFamilies).map((familyId) => ({
          photo_id: photo.id,
          family_id: familyId,
        }));
        const { error: tagError } = await supabase.from("photo_tags").insert(rows);
        if (tagError) throw tagError;
      }

      setFile(null);
      setPreview("");
      setCaption("");
      setSelectedFamilies(new Set());
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded();
    } catch (err) {
      setError(err.message || "Couldn't upload that photo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-2xl bg-white p-4 shadow-card">
      <p className="text-sm font-semibold text-slate-900">📷 Add a photo</p>

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-brand-600"
        >
          {preview ? "Change photo" : "+ Choose a photo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePick}
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected preview"
            className="mt-2 max-h-48 w-full rounded-xl object-cover"
          />
        )}
      </div>

      <input
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />

      {families.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">
            Tag families in this photo (optional)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {families.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => toggleFamily(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  selectedFamilies.has(f.id)
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {f.child_name || "Family"}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Uploading…" : "Post photo"}
      </button>
    </form>
  );
}

export default function PhotosPage() {
  const { profile } = useProfile();
  const [photos, setPhotos] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function refresh() {
    const supabase = createClient();
    const [{ data: photosData }, { data: familiesData }] = await Promise.all([
      supabase
        .from("photos")
        .select(
          "id, image_url, caption, uploaded_by, created_at, photo_tags ( family_id, families ( child_name ) )"
        )
        .order("created_at", { ascending: false }),
      supabase.from("families").select("id, child_name").order("child_name", { ascending: true }),
    ]);
    setPhotos(photosData || []);
    setFamilies(familiesData || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id) {
    const supabase = createClient();
    await supabase.from("photos").delete().eq("id", id);
    refresh();
  }

  const visiblePhotos =
    filter === "mine" && profile?.family_id
      ? photos.filter((p) => (p.photo_tags || []).some((t) => t.family_id === profile.family_id))
      : photos;

  return (
    <AppShell title="Photos">
      <p className="mb-4 text-sm text-slate-500">
        Share photos from throughout the year — tag families so everyone can find (and download)
        the ones with their kid.
      </p>

      {profile && (
        <PhotoUploadForm profile={profile} families={families} onUploaded={refresh} />
      )}

      {profile?.family_id && (
        <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
          {[
            { id: "all", label: "All photos" },
            { id: "mine", label: "My family" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setFilter(v.id)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${
                filter === v.id ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : visiblePhotos.length === 0 ? (
        <div className="animate-fade-in-item rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
          {filter === "mine"
            ? "No photos tagged with your family yet."
            : "No photos yet — be the first to add one!"}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visiblePhotos.map((p, i) => {
            const familyNames = (p.photo_tags || [])
              .map((t) => t.families?.child_name)
              .filter(Boolean);
            const mine = p.uploaded_by === profile?.id;

            return (
              <div key={p.id} className="animate-fade-in-item" style={staggerStyle(i)}>
                <div className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 shadow-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url}
                    alt={p.caption || "Classroom photo"}
                    className="h-full w-full object-cover"
                  />
                  <a
                    href={p.image_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm text-brand-600 shadow-card"
                    aria-label="Save photo"
                  >
                    ⬇
                  </a>
                  {mine && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-red-500 shadow-card"
                      aria-label="Delete photo"
                    >
                      ×
                    </button>
                  )}
                </div>
                {familyNames.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-slate-400">
                    {familyNames.join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
