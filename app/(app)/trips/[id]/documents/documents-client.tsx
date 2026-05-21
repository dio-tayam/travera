"use client";

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { CloudUpload, FileText, Plane, Hotel, Globe, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TraveraSpinner } from "@/components/shared/travera-spinner";
import { cn } from "@/lib/utils";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Doc = Database["public"]["Tables"]["documents"]["Row"];

const DOC_TYPE_ICON: Record<string, React.ElementType> = {
  flight: Plane,
  hotel: Hotel,
  visa: Globe,
  other: FileText,
};

const DOC_TYPE_COLOR: Record<string, string> = {
  flight: "#7dd3fc",
  hotel: "var(--color-primary)",
  visa: "#fcd116",
  other: "#9ca3af",
};

const MAX_SIZE_MB = 10;

interface DocumentsClientProps {
  trip: Trip;
  initialDocs: Doc[];
  userId: string;
  canEdit: boolean;
}

export function DocumentsClient({ trip, initialDocs, userId, canEdit }: DocumentsClientProps) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [docType, setDocType] = useState<Doc["type"]>("other");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const path = `${trip.id}/${userId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("trip-documents")
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: doc, error: dbError } = await supabase
        .from("documents")
        .insert({
          trip_id: trip.id,
          uploaded_by: userId,
          file_name: file.name,
          storage_path: path,
          type: docType,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setDocs((prev) => [doc, ...prev]);
      toast.success("Document uploaded!");
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleView(doc: Doc) {
    try {
      const { data, error } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(doc.storage_path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open file");
    }
  }

  async function handleDelete(doc: Doc) {
    await supabase.storage.from("trip-documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Document deleted");
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Header */}
      <div className="px-4 lg:px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          {t("documents.title")}
        </h1>
        <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>{trip.title}</p>
      </div>

      {/* Upload area */}
      {canEdit && (
        <div className="px-4 lg:px-6 mb-6">
          <div className="flex gap-2 mb-3">
            {(["flight", "hotel", "visa", "other"] as Doc["type"][]).map((type) => {
              const Icon = DOC_TYPE_ICON[type];
              return (
                <button
                  key={type}
                  onClick={() => setDocType(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={
                    docType === type
                      ? { backgroundColor: "var(--color-primary)", color: "white", borderColor: "var(--color-primary)" }
                      : { borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }
                  }
                >
                  <Icon size={12} />
                  {t(`documents.types.${type}`)}
                </button>
              );
            })}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
              dragOver ? "bg-blue-50" : "bg-white hover:bg-gray-50"
            )}
            style={{ borderColor: dragOver ? "var(--color-primary)" : "var(--color-primary)", opacity: dragOver ? 1 : 0.6 }}
            role="button"
            aria-label={t("documents.upload")}
          >
            {uploading ? (
              <TraveraSpinner size={40} />
            ) : (
              <>
                <CloudUpload size={40} style={{ color: "var(--color-primary)" }} className="mb-3" />
                <p className="text-sm font-medium" style={{ fontFamily: "var(--font-body)", color: "var(--color-foreground)" }}>
                  {t("documents.dropzone")}
                </p>
                <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: "var(--font-body)" }}>
                  {t("documents.maxSize")}
                </p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            onChange={(e) => handleFiles(e.target.files)}
            aria-label="Upload file"
          />
        </div>
      )}

      {/* Documents list */}
      <div className="px-4 lg:px-6 space-y-3">
        {docs.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
              No documents yet.
            </p>
          </div>
        ) : (
          docs.map((doc) => {
            const Icon = DOC_TYPE_ICON[doc.type] ?? FileText;
            const color = DOC_TYPE_COLOR[doc.type] ?? "#9ca3af";
            return (
              <div key={doc.id} className="bg-white rounded-xl shadow-sm flex items-center gap-4 px-4 py-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon size={18} style={{ color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ fontFamily: "var(--font-body)" }}>
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                    {t(`documents.types.${doc.type}`)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(doc)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                    style={{ fontFamily: "var(--font-body)" }}
                    aria-label={`View ${doc.file_name}`}
                  >
                    <ExternalLink size={13} />
                    {t("documents.view")}
                  </button>
                  {canEdit && doc.uploaded_by === userId && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      aria-label={`Delete ${doc.file_name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
