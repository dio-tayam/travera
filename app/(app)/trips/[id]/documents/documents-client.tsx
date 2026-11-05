"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { toast } from "sonner";
import {
  AlertTriangle, Check, CheckCircle2, Download, ExternalLink, Eye, FileText, Loader2, MoreHorizontal, Pencil,
  Plus, Search, Tag, Trash2, UploadCloud, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DOC_META, DOC_TYPES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Avatar, EmptyState, PageBody, PageHeader } from "@/components/ui/primitives";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Doc = Database["public"]["Tables"]["documents"]["Row"];
type DocType = Doc["type"];
type Member = { user_id: string; role: string; profiles: Database["public"]["Tables"]["profiles"]["Row"] | null };

const BUCKET = "trip-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const isImage = (name: string) => /\.(jpe?g|png|gif|webp)$/i.test(name);
const isPdf = (name: string) => /\.pdf$/i.test(name);
const extOf = (name: string) => name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE";
/** Upload time, recovered from the `<timestamp>_name` storage path (documents have no created_at column). */
const uploadedAt = (d: Doc) => Number(/\/(\d{10,})_/.exec(d.storage_path)?.[1] ?? 0);
const shortDate = (ms: number) => ms ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(ms)) : "";

/** Documents most trips need, mapped to the stored type. */
const ESSENTIALS: { type: DocType; label: string; hint: string }[] = [
  { type: "flight", label: "Flight tickets", hint: "Boarding passes or e-tickets" },
  { type: "hotel", label: "Accommodation", hint: "Hotel or rental confirmations" },
  { type: "visa", label: "Visa & entry", hint: "Visa, e-visa or entry forms" },
];

type UploadJob = { id: string; name: string; status: "uploading" | "done" | "error"; error?: string };

interface Props { trip: Trip; initialDocs: Doc[]; members: Member[]; userId: string; canEdit: boolean }

export function DocumentsClient({ trip, initialDocs, members, userId, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState(initialDocs);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [docType, setDocType] = useState<DocType>("other");
  const [filter, setFilter] = useState<DocType | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "name" | "type">("newest");
  const [bucketOk, setBucketOk] = useState<boolean | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [renaming, setRenaming] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canEdit) return;
    supabase.storage.from(BUCKET).list("", { limit: 1 }).then(({ error }) => setBucketOk(!error));
  }, [canEdit, supabase]);

  // Signed URLs for image thumbnails (only ones we don't have yet)
  useEffect(() => {
    const missing = docs.filter(d => isImage(d.file_name) && !previews[d.id]);
    if (!missing.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(missing.map(d => d.storage_path), 3600).then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((item, i) => { if (item.signedUrl) map[missing[i].id] = item.signedUrl; });
      setPreviews(prev => ({ ...prev, ...map }));
    });
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  const member = (uid: string) => members.find(m => m.user_id === uid);
  const nameOf = (uid: string) => uid === userId ? "You" : member(uid)?.profiles?.display_name?.split(" ")[0] ?? "Traveler";

  /* ── Upload (multiple files, sequential) ────────────────────────────── */
  async function handleFiles(list: FileList | File[] | null, type: DocType = docType) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const queued: UploadJob[] = files.map(f => ({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, status: "uploading" }));
    setJobs(j => [...queued, ...j]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i], job = queued[i];
      const fail = (msg: string) => setJobs(j => j.map(x => x.id === job.id ? { ...x, status: "error", error: msg } : x));
      if (file.size > MAX_BYTES) { fail("Larger than 10 MB"); continue; }
      try {
        const safe = file.name.replace(/[^\w.\-() ]+/g, "_");
        const path = `${trip.id}/${userId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: doc, error: dbErr } = await supabase.from("documents").insert({
          trip_id: trip.id, uploaded_by: userId, file_name: file.name, storage_path: path, type,
        }).select().single();
        if (dbErr) throw dbErr;
        if (isImage(file.name)) setPreviews(p => ({ ...p, [doc.id]: URL.createObjectURL(file) }));
        setDocs(p => [doc, ...p]);
        setJobs(j => j.map(x => x.id === job.id ? { ...x, status: "done" } : x));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        fail(/bucket|not found/i.test(msg) ? "Storage isn't set up yet" : msg);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    // Clear finished jobs after a moment; keep errors visible until dismissed.
    setTimeout(() => setJobs(j => j.filter(x => x.status !== "done")), 2500);
  }

  function pickFiles(type?: DocType) {
    if (type) setDocType(type);
    fileRef.current?.click();
  }

  async function signedUrl(doc: Doc, download = false) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .createSignedUrl(doc.storage_path, 3600, download ? { download: doc.file_name } : undefined);
    if (error || !data) { toast.error("Couldn't open the file"); return null; }
    return data.signedUrl;
  }

  async function download(doc: Doc) {
    const url = await signedUrl(doc, true);
    if (url) window.location.href = url;
  }

  async function deleteDoc(doc: Doc) {
    const prev = docs;
    setDocs(p => p.filter(d => d.id !== doc.id));
    if (viewing?.id === doc.id) setViewing(null);
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) { setDocs(prev); toast.error("Couldn't delete the file"); return; }
    toast.success("Deleted");
  }

  async function updateDoc(doc: Doc, change: Partial<Pick<Doc, "file_name" | "type">>) {
    const prev = docs;
    setDocs(p => p.map(d => d.id === doc.id ? { ...d, ...change } : d));
    const { error } = await supabase.from("documents").update(change).eq("id", doc.id);
    if (error) { setDocs(prev); toast.error("Couldn't update the file"); }
  }

  /* ── Derived ────────────────────────────────────────────────────────── */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    docs.forEach(d => { c[d.type] = (c[d.type] ?? 0) + 1; });
    return c;
  }, [docs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = docs.filter(d => (filter === "all" || d.type === filter) && (!q || d.file_name.toLowerCase().includes(q)));
    return [...list].sort((a, b) =>
      sort === "name" ? a.file_name.localeCompare(b.file_name)
      : sort === "type" ? a.type.localeCompare(b.type) || uploadedAt(b) - uploadedAt(a)
      : uploadedAt(b) - uploadedAt(a));
  }, [docs, filter, query, sort]);

  const busy = jobs.some(j => j.status === "uploading");

  return (
    <PageBody>
      <PageHeader eyebrow={t("nav.docs")} title={t("documents.title")}
                  description="Keep tickets, reservations and visas where the whole group can reach them."
                  actions={canEdit && <Button onClick={() => pickFiles()} loading={busy}><UploadCloud size={16} aria-hidden="true" /> Upload</Button>} />

      {canEdit && bucketOk === false && (
        <div className="mt-6 flex gap-3 rounded-[var(--radius-panel)] border border-warning/30 bg-warning-soft px-4 py-3.5" role="status">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-[13px] text-ink-2">
            <span className="font-medium text-ink">File storage isn&apos;t set up.</span>{" "}
            Run <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">supabase/setup-storage.sql</code> in the Supabase SQL editor to enable uploads.
          </p>
        </div>
      )}

      {/* Essentials checklist */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {ESSENTIALS.map(e => {
          const have = counts[e.type] ?? 0;
          const { icon: Icon, color } = DOC_META[e.type];
          return (
            <div key={e.type} className={cn("panel flex items-center gap-3 px-4 py-3.5", have > 0 && "border-positive/30")}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${color}14`, color }}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink">{e.label}</p>
                <p className="truncate text-[12px] text-ink-3">{have > 0 ? `${have} ${have === 1 ? "file" : "files"}` : e.hint}</p>
              </div>
              {have > 0
                ? <CheckCircle2 size={18} className="shrink-0 text-positive" aria-label="Added" />
                : canEdit && (
                  <button onClick={() => pickFiles(e.type)} aria-label={`Upload ${e.label}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-3 transition-colors hover:border-ink hover:text-ink">
                    <Plus size={15} />
                  </button>
                )}
            </div>
          );
        })}
      </div>

      {/* Upload */}
      {canEdit && (
        <div className="panel mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
            <p className="text-[13px] font-medium text-ink">Save new files as</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("documents.docType")}>
              {DOC_TYPES.map(type => {
                const { icon: Icon } = DOC_META[type];
                const active = docType === type;
                return (
                  <button key={type} role="radio" aria-checked={active} onClick={() => setDocType(type)}
                          className={cn("flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
                                        active ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:bg-sunken")}>
                    <Icon size={13} aria-hidden="true" /> {t(`documents.types.${type}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            role="button" tabIndex={0} aria-label={t("documents.upload")}
            onClick={() => pickFiles()}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFiles(); } }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            className={cn("m-3 flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed px-6 py-8 text-center transition-colors sm:flex-row sm:gap-4 sm:text-left",
                          dragOver ? "border-accent bg-accent-soft" : "border-line-strong hover:border-ink hover:bg-paper")}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-2">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            </span>
            <div>
              <p className="text-[14px] font-medium text-ink">Drop files here or click to choose — several at once is fine</p>
              <p className="mt-0.5 text-[12.5px] text-ink-3">PDF, JPG, PNG or WebP · {t("documents.maxSize")}</p>
            </div>
          </div>
          {jobs.length > 0 && (
            <ul className="space-y-1 border-t border-line px-4 py-3 sm:px-5" aria-live="polite">
              {jobs.map(j => (
                <li key={j.id} className="flex items-center gap-2.5 text-[12.5px]">
                  {j.status === "uploading" && <Loader2 size={14} className="animate-spin text-ink-3" />}
                  {j.status === "done" && <Check size={14} className="text-positive" />}
                  {j.status === "error" && <AlertTriangle size={14} className="text-negative" />}
                  <span className="min-w-0 flex-1 truncate text-ink">{j.name}</span>
                  {j.status === "error" && <span className="text-negative">{j.error}</span>}
                  {j.status === "error" && (
                    <button onClick={() => setJobs(x => x.filter(y => y.id !== j.id))} aria-label="Dismiss" className="rounded p-0.5 text-ink-3 hover:text-ink"><X size={13} /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                 onChange={e => handleFiles(e.target.files)} aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* Library */}
      <section className="mt-10" aria-label="Files">
        {docs.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="Filter by type">
              {(["all", ...DOC_TYPES] as const).map(type => (
                <button key={type} role="tab" aria-selected={filter === type} onClick={() => setFilter(type)}
                        className={cn("flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[12.5px] transition-colors",
                                      filter === type ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                  {type === "all" ? "All" : t(`documents.types.${type}`)}
                  <span className={cn("font-mono text-[11px]", filter === type ? "text-paper/60" : "text-ink-3")}>{counts[type] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:ml-auto">
              <div className="relative flex-1 lg:w-56">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search files" className="h-9 pl-8" aria-label="Search files" />
              </div>
              <div className="w-36">
                <Select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="h-9" aria-label="Sort files">
                  <option value="newest">Newest first</option>
                  <option value="name">Name A–Z</option>
                  <option value="type">By type</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {docs.length === 0 ? (
          <EmptyState icon={FileText} title={t("documents.noDocuments")}
                      description={canEdit ? "Upload boarding passes, hotel confirmations or visas to share them with everyone on the trip." : undefined} />
        ) : visible.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">No files match.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map(doc => {
              const meta = DOC_META[doc.type] ?? DOC_META.other;
              const Icon = meta.icon;
              const preview = previews[doc.id];
              const uploader = member(doc.uploaded_by);
              const mineOrEditor = canEdit;
              return (
                <li key={doc.id} className="panel group flex flex-col overflow-hidden">
                  <button onClick={() => setViewing(doc)} aria-label={`Preview ${doc.file_name}`}
                          className="relative block h-36 overflow-hidden border-b border-line bg-paper">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="" loading="lazy" decoding="async"
                           className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <span className="grid-texture flex h-full w-full items-center justify-center">
                        <span className="flex h-16 w-12 flex-col items-center justify-end rounded-[6px] border border-line-strong bg-surface pb-2 shadow-[3px_3px_0_var(--color-line)]">
                          <span className="font-mono text-[10px] font-medium" style={{ color: meta.color }}>{extOf(doc.file_name)}</span>
                        </span>
                      </span>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition-all group-hover:bg-ink/25 group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-ink shadow"><Eye size={13} /> Preview</span>
                    </span>
                  </button>
                  <div className="flex flex-1 items-center gap-3 px-4 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${meta.color}14`, color: meta.color }}>
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink" title={doc.file_name}>{doc.file_name}</p>
                      <p className="flex items-center gap-1.5 truncate text-[12px] text-ink-3">
                        {t(`documents.types.${doc.type}`)}
                        {uploadedAt(doc) > 0 && <> · {shortDate(uploadedAt(doc))}</>}
                        {members.length > 1 && <> · <Avatar name={uploader?.profiles?.display_name} src={uploader?.profiles?.avatar_url} size={16} /> {nameOf(doc.uploaded_by)}</>}
                      </p>
                    </div>
                    <Menu.Root>
                      <Menu.Trigger aria-label={`Options for ${doc.file_name}`}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken">
                        <MoreHorizontal size={16} />
                      </Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Content align="end" sideOffset={4}
                                      className="z-50 min-w-[190px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise">
                          <MenuItem onSelect={() => setViewing(doc)} icon={Eye}>Preview</MenuItem>
                          <MenuItem onSelect={() => download(doc)} icon={Download}>Download</MenuItem>
                          {mineOrEditor && <MenuItem onSelect={() => setRenaming(doc)} icon={Pencil}>Rename</MenuItem>}
                          {mineOrEditor && (
                            <Menu.Sub>
                              <Menu.SubTrigger className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken data-[state=open]:bg-sunken">
                                <Tag size={14} /> Change type
                              </Menu.SubTrigger>
                              <Menu.Portal>
                                <Menu.SubContent sideOffset={6}
                                                 className="z-50 min-w-[150px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)]">
                                  {DOC_TYPES.map(type => (
                                    <MenuItem key={type} onSelect={() => updateDoc(doc, { type })} icon={DOC_META[type].icon}>
                                      <span className="flex-1">{t(`documents.types.${type}`)}</span>
                                      {doc.type === type && <Check size={13} className="text-accent" />}
                                    </MenuItem>
                                  ))}
                                </Menu.SubContent>
                              </Menu.Portal>
                            </Menu.Sub>
                          )}
                          {canEdit && doc.uploaded_by === userId && (
                            <Menu.Item onSelect={() => deleteDoc(doc)}
                                       className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-[8px] border-t border-line px-2.5 py-2 text-[13px] text-negative outline-none data-[highlighted]:bg-negative-soft">
                              <Trash2 size={14} /> {t("documents.delete")}
                            </Menu.Item>
                          )}
                        </Menu.Content>
                      </Menu.Portal>
                    </Menu.Root>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {viewing && (
        <PreviewDialog doc={viewing} imageUrl={previews[viewing.id]} getUrl={signedUrl}
                       onDownload={() => download(viewing)} onClose={() => setViewing(null)} />
      )}
      {renaming && (
        <RenameDialog doc={renaming} onClose={() => setRenaming(null)}
                      onSave={name => { updateDoc(renaming, { file_name: name }); setRenaming(null); }} />
      )}
    </PageBody>
  );
}

function MenuItem({ onSelect, icon: Icon, children }: { onSelect: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Menu.Item onSelect={onSelect}
               className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken">
      <Icon size={14} /> {children}
    </Menu.Item>
  );
}

/* ── In-app preview ──────────────────────────────────────────────────────── */
function PreviewDialog({ doc, imageUrl, getUrl, onDownload, onClose }: {
  doc: Doc; imageUrl?: string; getUrl: (d: Doc) => Promise<string | null>; onDownload: () => void; onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(imageUrl ?? null);
  const [loading, setLoading] = useState(!imageUrl);

  useEffect(() => {
    if (imageUrl) return;
    let alive = true;
    getUrl(doc).then(u => { if (alive) { setUrl(u); setLoading(false); } });
    return () => { alive = false; };
  }, [doc, imageUrl, getUrl]);

  const previewable = isImage(doc.file_name) || isPdf(doc.file_name);

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }} title={doc.file_name} className="sm:max-w-[880px]">
      <div className="relative h-[62dvh] overflow-hidden rounded-[12px] border border-line bg-paper">
        {loading && <div className="grid h-full place-items-center"><Loader2 size={20} className="animate-spin text-ink-3" /></div>}
        {!loading && url && isImage(doc.file_name) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={doc.file_name} className="h-full w-full object-contain" />
        )}
        {!loading && url && isPdf(doc.file_name) && (
          <iframe src={url} title={doc.file_name} className="h-full w-full" />
        )}
        {!loading && (!url || !previewable) && (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <FileText size={22} className="mx-auto text-ink-3" />
              <p className="mt-2 text-[13px] text-ink-2">{url ? "This file type can't be previewed here." : "Couldn't load the file."}</p>
            </div>
          </div>
        )}
      </div>
      <ModalActions>
        {url && (
          <Button asChild variant="ghost">
            <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open in new tab</a>
          </Button>
        )}
        <Button onClick={onDownload}><Download size={15} /> Download</Button>
      </ModalActions>
    </Modal>
  );
}

function RenameDialog({ doc, onClose, onSave }: { doc: Doc; onClose: () => void; onSave: (name: string) => void }) {
  const ext = /\.[^.]+$/.exec(doc.file_name)?.[0] ?? "";
  const [name, setName] = useState(doc.file_name.slice(0, doc.file_name.length - ext.length));
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }} title="Rename file">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(`${name.trim()}${ext}`); }}>
        <div className="flex items-center gap-2">
          <Input autoFocus value={name} onChange={e => setName(e.target.value)} aria-label="File name" />
          {ext && <span className="font-mono text-[13px] text-ink-3">{ext}</span>}
        </div>
        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>Save</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
