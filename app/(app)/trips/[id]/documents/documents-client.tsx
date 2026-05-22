"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { CloudUpload, FileText, Plane, Hotel, Globe, Trash2,
         ExternalLink, Loader2, AlertTriangle } from "lucide-react";
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

interface Props { trip: Trip; initialDocs: Doc[]; userId: string; canEdit: boolean }

export function DocumentsClient({ trip, initialDocs, userId, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [docs, setDocs]         = useState(initialDocs);
  const [uploading, setUpl]     = useState(false);
  const [dragOver, setDrag]     = useState(false);
  const [docType, setDocType]   = useState<Doc["type"]>("other");
  const [bucketOk, setBucketOk] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    supabase.storage.from("trip-documents").list("", { limit: 1 })
      .then(({ error }) => setBucketOk(!error));
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) { toast.error("Max file size is 10MB"); return; }
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
    <div className="min-h-screen pb-8 animate-fade-in" style={{ background: "var(--color-background)" }}>

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

      {canEdit && (
        <div className="px-4 lg:px-8 mb-5 space-y-3">
          {/* Type tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["flight","hotel","visa","other"] as Doc["type"][]).map(type => {
              const Icon  = TYPE_ICON[type];
              const style = TYPE_COLOR[type];
              return (
                <button key={type} onClick={() => setDocType(type)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                                   font-semibold border transition-all active:scale-95"
                        style={docType === type
                          ? { background: style.bg, color: style.text,
                              borderColor: style.text }
                          : { borderColor: "#e2e8f0", color: "#64748b", background: "white" }}>
                  <Icon size={12}/> {t(`documents.types.${type}`)}
                </button>
              );
            })}
          </div>

          {/* Dropzone */}
          <div onDragOver={e=>{ e.preventDefault(); setDrag(true); }}
               onDragLeave={()=>setDrag(false)}
               onDrop={e=>{ e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
               onClick={()=>fileRef.current?.click()}
               className={cn(
                 "card border-2 border-dashed p-10 flex flex-col items-center justify-center rounded-2xl",
                 "text-center cursor-pointer transition-all",
                 dragOver
                   ? "border-purple-400 bg-purple-50"
                   : "border-slate-200 hover:border-purple-300 hover:bg-slate-50/70"
               )}
               role="button" tabIndex={0} aria-label={t("documents.upload")}
               onKeyDown={e=>{ if(e.key==="Enter") fileRef.current?.click(); }}>
            {uploading ? (
              <Loader2 size={32} className="animate-spin text-purple-400 mb-3"/>
            ) : (
              <CloudUpload size={32}
                className={cn("mb-3 transition-colors", dragOver ? "text-purple-500" : "text-slate-300")}/>
            )}
            <p className="text-sm font-medium text-slate-600">
              {uploading ? "Uploading…" : t("documents.dropzone")}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t("documents.maxSize")} · PDF, JPG, PNG
            </p>
          </div>
          <input ref={fileRef} type="file" className="hidden"
                 accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                 onChange={e=>handleFiles(e.target.files)} aria-label="Upload file"/>
        </div>
      )}

      {/* Documents list */}
      <div className="px-4 lg:px-8 space-y-2.5">
        {docs.length === 0 ? (
          <div className="card p-12 text-center rounded-2xl">
            <FileText size={38} className="mx-auto text-slate-200 mb-3" aria-hidden="true"/>
            <p className="text-sm text-slate-400">
              No documents yet.{canEdit ? " Upload your first file above." : ""}
            </p>
          </div>
        ) : docs.map(doc => {
          const Icon  = TYPE_ICON[doc.type] ?? FileText;
          const style = TYPE_COLOR[doc.type] ?? TYPE_COLOR.other;
          return (
            <div key={doc.id}
                 className="card flex items-center gap-3.5 px-4 py-3.5 group rounded-2xl
                            hover:shadow-md transition-shadow duration-200">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                   style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
                <Icon size={17} style={{ color: style.text }} aria-hidden="true"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
                <p className="text-xs text-slate-400 capitalize mt-0.5">
                  {t(`documents.types.${doc.type}`)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => viewDoc(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs
                                   font-semibold border border-slate-200 text-slate-600
                                   hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600
                                   transition-all active:scale-95"
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
          );
        })}
      </div>
    </div>
  );
}
