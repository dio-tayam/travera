"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { CloudUpload, FileText, Plane, Hotel, Globe, Trash2,
         ExternalLink, Loader2, AlertTriangle, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Doc  = Database["public"]["Tables"]["documents"]["Row"];

const TYPE_ICON: Record<string, React.ElementType> = {
  flight: Plane, hotel: Hotel, visa: Globe, other: FileText,
};
const TYPE_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  flight:  { text: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  hotel:   { text: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  visa:    { text: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  other:   { text: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
};

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

interface Props { trip: Trip; initialDocs: Doc[]; userId: string; canEdit: boolean }

export function DocumentsClient({ trip, initialDocs, userId, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [docs, setDocs]           = useState(initialDocs);
  const [uploading, setUpl]       = useState(false);
  const [dragOver, setDrag]       = useState(false);
  const [docType, setDocType]     = useState<Doc["type"]>("other");
  const [bucketOk, setBucketOk]   = useState<boolean | null>(null);
  const [previews, setPreviews]   = useState<Record<string, string>>({});
  const [localPreview, setLocal]  = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    supabase.storage.from("trip-documents").list("", { limit: 1 })
      .then(({ error }) => setBucketOk(!error));
  });

  // Fetch signed URLs for image docs
  useEffect(() => {
    const imgDocs = docs.filter(d => isImage(d.file_name));
    if (imgDocs.length === 0) return;
    supabase.storage
      .from("trip-documents")
      .createSignedUrls(imgDocs.map(d => d.storage_path), 3600)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((item, i) => {
          if (item.signedUrl) map[imgDocs[i].id] = item.signedUrl;
        });
        setPreviews(prev => ({ ...prev, ...map }));
      });
  }, [docs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) { toast.error("Max file size is 10MB"); return; }

    // Show local preview while uploading
    if (isImage(file.name)) {
      const url = URL.createObjectURL(file);
      setLocal({ url, name: file.name });
    }

    setUpl(true);
    try {
      const path = `${trip.id}/${userId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("trip-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: doc, error: dbErr } = await supabase.from("documents").insert({
        trip_id: trip.id, uploaded_by: userId,
        file_name: file.name, storage_path: path, type: docType,
      }).select().single();
      if (dbErr) throw dbErr;

      setDocs(p => [doc, ...p]);
      setLocal(null);
      toast.success("Document uploaded!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      const isBucketMissing = msg.toLowerCase().includes("bucket") ||
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("object");
      toast.error(
        isBucketMissing
          ? "Storage not set up. Run supabase/setup-storage.sql in your Supabase SQL Editor."
          : msg,
        { duration: 6000 }
      );
      setLocal(null);
    } finally {
      setUpl(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function viewDoc(doc: Doc) {
    const { data, error } = await supabase.storage
      .from("trip-documents").createSignedUrl(doc.storage_path, 3600);
    if (error) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDoc(doc: Doc) {
    await supabase.storage.from("trip-documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(p => p.filter(d => d.id !== doc.id));
    toast.success("Document deleted");
  }

  return (
    <div className="h-full overflow-y-auto animate-fade-in" style={{ background: "var(--color-background)" }}>

      {/* Storage warning */}
      {bucketOk === false && (
        <div className="mx-4 lg:mx-8 mt-4 flex gap-3 items-start bg-amber-50 border border-amber-200
                        rounded-2xl p-4 text-sm">
          <AlertTriangle size={17} className="text-amber-500 shrink-0 mt-0.5"/>
          <div>
            <p className="font-semibold text-amber-800 mb-0.5">Storage bucket not set up</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Run <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-800">
                supabase/setup-storage.sql
              </code> in your <strong>Supabase SQL Editor</strong> to enable uploads.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 lg:px-8 pt-6 pb-4">
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily:"var(--font-heading)" }}>
          {t("documents.title")}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">{trip.title}</p>
      </div>

      {/* Two-column layout */}
      <div className={cn(
        "px-4 lg:px-8 grid gap-6 items-start pb-8",
        canEdit ? "lg:grid-cols-[360px_1fr]" : ""
      )}>

        {/* ── Column 1: Upload ──────────────────────────────────── */}
        {canEdit && (
          <div className="space-y-3 lg:sticky lg:top-6">
            {/* Type selector card */}
            <div className="card p-4 rounded-2xl space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("documents.docType")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["flight","hotel","visa","other"] as Doc["type"][]).map(type => {
                  const Icon  = TYPE_ICON[type];
                  const style = TYPE_COLOR[type];
                  return (
                    <button key={type} onClick={() => setDocType(type)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm
                                       font-semibold border transition-all active:scale-95"
                            style={docType === type
                              ? { background: style.bg, color: style.text, borderColor: style.text }
                              : { borderColor: "#e2e8f0", color: "#64748b", background: "white" }}>
                      <Icon size={14}/> {t(`documents.types.${type}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropzone */}
            <div onDragOver={e => { e.preventDefault(); setDrag(true); }}
                 onDragLeave={() => setDrag(false)}
                 onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
                 onClick={() => fileRef.current?.click()}
                 className={cn(
                   "card border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                   "flex flex-col items-center justify-center text-center",
                   localPreview ? "p-4" : "p-10",
                   dragOver
                     ? "border-purple-400 bg-purple-50"
                     : "border-slate-200 hover:border-purple-300 hover:bg-slate-50/70"
                 )}
                 role="button" tabIndex={0} aria-label={t("documents.upload")}
                 onKeyDown={e => { if (e.key === "Enter") fileRef.current?.click(); }}>

              {localPreview ? (
                /* Preview of locally selected image */
                <div className="w-full space-y-3" onClick={e => e.stopPropagation()}>
                  <img src={localPreview.url} alt={localPreview.name}
                       className="w-full h-40 object-cover rounded-xl border border-slate-100"/>
                  <p className="text-xs text-slate-500 truncate text-center">{localPreview.name}</p>
                  {uploading && (
                    <div className="flex items-center justify-center gap-2 text-sm text-purple-600 font-medium">
                      <Loader2 size={14} className="animate-spin"/> Uploading…
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {uploading
                    ? <Loader2 size={32} className="animate-spin text-purple-400 mb-3"/>
                    : <CloudUpload size={32}
                        className={cn("mb-3 transition-colors", dragOver ? "text-purple-500" : "text-slate-300")}/>}
                  <p className="text-sm font-medium text-slate-600">
                    {uploading ? "Uploading…" : t("documents.dropzone")}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t("documents.maxSize")} · PDF, JPG, PNG
                  </p>
                </>
              )}
            </div>

            <input ref={fileRef} type="file" className="hidden"
                   accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                   onChange={e => handleFiles(e.target.files)} aria-label="Upload file"/>
          </div>
        )}

        {/* ── Column 2: Documents list / preview ───────────────── */}
        <div>
          {docs.length === 0 ? (
            <div className="card p-12 text-center rounded-2xl">
              <FileText size={38} className="mx-auto text-slate-200 mb-3" aria-hidden="true"/>
              <p className="text-sm text-slate-400">
                {t("documents.noDocuments")}{canEdit ? t("documents.uploadPrompt") : ""}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {docs.map(doc => {
                const Icon      = TYPE_ICON[doc.type] ?? FileText;
                const style     = TYPE_COLOR[doc.type] ?? TYPE_COLOR.other;
                const imgPreview = previews[doc.id];
                return (
                  <div key={doc.id}
                       className="card overflow-hidden rounded-2xl hover:shadow-md transition-shadow duration-200 group">
                    {/* Image thumbnail or icon banner */}
                    {imgPreview ? (
                      <div className="relative h-36 bg-slate-100 overflow-hidden">
                        <img src={imgPreview} alt={doc.file_name}
                             className="w-full h-full object-cover transition-transform duration-500
                                        group-hover:scale-105"/>
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent"/>
                        <span className="absolute top-2 left-2 flex items-center gap-1.5 text-[11px]
                                         px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: style.bg, color: style.text }}>
                          <Icon size={10}/> {t(`documents.types.${doc.type}`)}
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 flex items-center justify-center"
                           style={{ backgroundColor: style.bg }}>
                        {isImage(doc.file_name)
                          ? <ImageIcon size={32} style={{ color: style.text }} className="opacity-40"/>
                          : <Icon size={32} style={{ color: style.text }} className="opacity-40"/>}
                      </div>
                    )}

                    {/* Info */}
                    <div className="p-3.5">
                      <p className="text-sm font-semibold text-slate-800 truncate mb-0.5">{doc.file_name}</p>
                      <p className="text-xs text-slate-400 capitalize mb-3">
                        {t(`documents.types.${doc.type}`)}
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => viewDoc(doc)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5
                                           rounded-xl text-xs font-semibold border border-slate-200
                                           text-slate-600 hover:bg-slate-50 hover:border-blue-200
                                           hover:text-blue-600 transition-all active:scale-95"
                                aria-label={`View ${doc.file_name}`}>
                          <ExternalLink size={11}/> {t("documents.view")}
                        </button>
                        {canEdit && doc.uploaded_by === userId && (
                          <button onClick={() => deleteDoc(doc)}
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-400
                                             hover:bg-red-50 transition-all"
                                  aria-label={`Delete ${doc.file_name}`}>
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
