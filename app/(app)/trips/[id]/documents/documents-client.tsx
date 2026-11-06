"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle, Check, CheckCircle2, Download, ExternalLink, Eye, FileText, Loader2, Lock, MoreHorizontal, Pencil,
  Plus, Search, ShieldCheck, Tag, Trash2, UploadCloud, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { cn, formatShortDate } from "@/lib/utils";
import { DOC_META, DOC_TYPES } from "@/lib/categories";
import type { Member } from "@/lib/types";
import type { DocumentRow, TripRow, Visibility } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Modal, ModalActions } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Segmented } from "@/components/ui/segmented";
import { Avatar, EmptyState, PageBody, PageHeader } from "@/components/ui/primitives";

type Doc = DocumentRow;
type DocType = Doc["type"];

const BUCKET = "trip-documents";
const MAX_BYTES = 10 * 1024 * 1024;
/** Must match `allowed_mime_types` on the bucket (supabase/v2-roles-privacy-admin.sql). */
const ALLOWED: Record<string, string[]> = {
  "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/gif": ["gif"], "image/webp": ["webp"],
};
const PREVIEW_TTL = 300;   // seconds a preview/thumbnail link stays valid
const DOWNLOAD_TTL = 60;
const isImage = (name: string) => /\.(jpe?g|png|gif|webp)$/i.test(name);
const isPdf = (name: string) => /\.pdf$/i.test(name);
const extOf = (name: string) => name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE";
/** Upload time: `<timestamp>_name` in the storage path (older rows), else created_at. */
const uploadedAt = (d: Doc) => Number(/\/(\d{10,})_/.exec(d.storage_path)?.[1] ?? 0) || new Date(d.created_at ?? 0).getTime();

const ESSENTIALS: DocType[] = ["flight", "hotel", "visa"];

type UploadJob = { id: string; name: string; status: "uploading" | "done" | "error"; error?: string };

interface Props { trip: TripRow; initialDocs: Doc[]; members: Member[]; userId: string; canEdit: boolean; isOwner: boolean }

export function DocumentsClient({ trip, initialDocs, members, userId, canEdit, isOwner }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState(initialDocs);
  const [tab, setTab] = useState<Visibility>("group");
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [docType, setDocType] = useState<DocType>("other");
  const [filter, setFilter] = useState<DocType | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "name" | "type">("newest");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [renaming, setRenaming] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadVisibility = useRef<Visibility>("group");

  const canUploadHere = tab === "private" || canEdit;
  const mayManage = (d: Doc) => d.uploaded_by === userId || (d.visibility === "group" && isOwner);
  const mayDelete = mayManage;

  // Live updates for shared files.
  useRealtime(`docs:${trip.id}`, [{ table: "documents", filter: `trip_id=eq.${trip.id}` }], () => {
    supabase.from("documents").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDocs(data as Doc[]); });
  });

  // Short-lived signed URLs for image thumbnails (only ones we don't have yet).
  useEffect(() => {
    const missing = docs.filter(d => isImage(d.file_name) && !previews[d.id]);
    if (!missing.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(missing.map(d => d.storage_path), PREVIEW_TTL).then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((item, i) => { if (item.signedUrl) map[missing[i].id] = item.signedUrl; });
      setPreviews(prev => ({ ...prev, ...map }));
    });
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release local blob previews on unmount.
  useEffect(() => () => { Object.values(previews).forEach(u => u.startsWith("blob:") && URL.revokeObjectURL(u)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const member = (uid: string) => members.find(m => m.user_id === uid);
  const nameOf = (uid: string) => uid === userId ? t("common.you") : member(uid)?.profiles?.display_name?.split(" ")[0] ?? t("common.traveler");

  /** Checks type by MIME *and* extension; the bucket enforces the same list server-side. */
  function validate(file: File): string | null {
    if (file.size > MAX_BYTES) return t("documents.errors.tooBig");
    if (file.size === 0) return t("documents.errors.empty");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const okExt = Object.values(ALLOWED).some(exts => exts.includes(ext));
    const okMime = !file.type || (ALLOWED[file.type]?.includes(ext) ?? false);
    return okExt && okMime ? null : t("documents.errors.type");
  }

  /* ── Upload (multiple files, sequential) ────────────────────────────── */
  async function handleFiles(list: FileList | File[] | null, type: DocType = docType) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const visibility = uploadVisibility.current;
    if (visibility === "group" && !canEdit) { toast.error(t("documents.errors.groupOnly")); return; }
    const queued: UploadJob[] = files.map(f => ({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, status: "uploading" }));
    setJobs(j => [...queued, ...j]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i], job = queued[i];
      const fail = (msg: string) => setJobs(j => j.map(x => x.id === job.id ? { ...x, status: "error", error: msg } : x));
      const invalid = validate(file);
      if (invalid) { fail(invalid); continue; }
      try {
        const safe = file.name.normalize("NFKC").replace(/[^\w.\-() ]+/g, "_").replace(/^\.+/, "").slice(-120) || "file";
        const path = `${trip.id}/${userId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: false, contentType: file.type || undefined, cacheControl: "3600",
        });
        if (upErr) throw upErr;
        const { data: doc, error: dbErr } = await supabase.from("documents").insert({
          trip_id: trip.id, uploaded_by: userId, file_name: file.name.slice(0, 200), storage_path: path, type, visibility,
          stop_id: null,
        }).select().single();
        if (dbErr) { await supabase.storage.from(BUCKET).remove([path]); throw dbErr; }
        if (isImage(file.name)) setPreviews(p => ({ ...p, [doc.id]: URL.createObjectURL(file) }));
        setDocs(p => [doc as Doc, ...p.filter(d => d.id !== doc.id)]);
        setJobs(j => j.map(x => x.id === job.id ? { ...x, status: "done" } : x));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        fail(/bucket|not found/i.test(msg) ? t("documents.errors.storage") : /mime|type/i.test(msg) ? t("documents.errors.type")
             : /row-level|policy|permission/i.test(msg) ? t("documents.errors.denied") : t("documents.errors.upload"));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setJobs(j => j.filter(x => x.status !== "done")), 2500);
  }

  function pickFiles(type?: DocType) {
    if (type) setDocType(type);
    uploadVisibility.current = tab;
    fileRef.current?.click();
  }

  async function signedUrl(doc: Doc, download = false) {
    const { data, error } = await supabase.storage.from(BUCKET)
      .createSignedUrl(doc.storage_path, download ? DOWNLOAD_TTL : PREVIEW_TTL, download ? { download: doc.file_name } : undefined);
    if (error || !data) { toast.error(t("documents.errors.open")); return null; }
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
    // File first: the storage policy checks the document row (uploader, or the owner for group files).
    const { error: fileErr } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = fileErr ? { error: fileErr } : await supabase.from("documents").delete().eq("id", doc.id);
    if (error) { setDocs(prev); toast.error(t("documents.errors.delete")); return; }
    setDeleting(null);
    toast.success(t("documents.deleted"));
  }

  async function updateDoc(doc: Doc, change: Partial<Pick<Doc, "file_name" | "type" | "visibility">>, okKey?: string) {
    if (change.visibility === "group" && !canEdit) { toast.error(t("documents.errors.groupOnly")); return; }
    const prev = docs;
    setDocs(p => p.map(d => d.id === doc.id ? { ...d, ...change } : d));
    const { error } = await supabase.from("documents").update(change).eq("id", doc.id);
    if (error) { setDocs(prev); toast.error(t("documents.errors.update")); return; }
    if (okKey) toast.success(t(okKey));
  }

  /* ── Derived ────────────────────────────────────────────────────────── */
  const inTab = useMemo(() => docs.filter(d => tab === "private" ? d.visibility === "private" && d.uploaded_by === userId : d.visibility !== "private"), [docs, tab, userId]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: inTab.length };
    inTab.forEach(d => { c[d.type] = (c[d.type] ?? 0) + 1; });
    return c;
  }, [inTab]);
  const groupCount = docs.filter(d => d.visibility !== "private").length;
  const privateCount = docs.filter(d => d.visibility === "private" && d.uploaded_by === userId).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inTab.filter(d => (filter === "all" || d.type === filter) && (!q || d.file_name.toLowerCase().includes(q)));
    return [...list].sort((a, b) =>
      sort === "name" ? a.file_name.localeCompare(b.file_name)
      : sort === "type" ? a.type.localeCompare(b.type) || uploadedAt(b) - uploadedAt(a)
      : uploadedAt(b) - uploadedAt(a));
  }, [inTab, filter, query, sort]);

  const busy = jobs.some(j => j.status === "uploading");

  return (
    <PageBody>
      <PageHeader eyebrow={t("nav.docs")} title={t("documents.title")} description={t("documents.description")}
                  actions={canUploadHere && <Button onClick={() => pickFiles()} loading={busy}><UploadCloud size={16} aria-hidden="true" /> {t("documents.uploadBtn")}</Button>} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t("documents.view")} value={tab} onChange={v => { setTab(v); setFilter("all"); }} options={[
          { id: "group", label: t("documents.tabs.group"), icon: Users, count: groupCount },
          { id: "private", label: t("documents.tabs.private"), icon: Lock, count: privateCount },
        ]} />
        <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
          {tab === "group"
            ? <><Users size={13} aria-hidden="true" /> {canEdit ? t("documents.groupHint") : t("documents.groupHintViewer")}</>
            : <><ShieldCheck size={13} aria-hidden="true" /> {t("documents.privateHint")}</>}
        </p>
      </div>

      {/* Essentials checklist — counts files you can see in either space */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ESSENTIALS.map(type => {
          const shared = docs.filter(d => d.type === type && d.visibility !== "private").length;
          const mine = docs.filter(d => d.type === type && d.visibility === "private" && d.uploaded_by === userId).length;
          const have = shared + mine;
          const { icon: Icon, color } = DOC_META[type];
          return (
            <div key={type} className={cn("panel flex items-center gap-3 px-4 py-3.5", have > 0 && "border-positive/30")}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${color}14`, color }}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink">{t(`documents.essentials.${type}`)}</p>
                <p className="truncate text-[12px] text-ink-3">
                  {have > 0 ? t("documents.essentialCount", { shared, mine }) : t(`documents.essentials.${type}Hint`)}
                </p>
              </div>
              {have > 0
                ? <CheckCircle2 size={18} className="shrink-0 text-positive" aria-label={t("documents.added")} />
                : canUploadHere && (
                  <button onClick={() => pickFiles(type)} aria-label={t("documents.uploadType", { type: t(`documents.essentials.${type}`) })}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-3 transition-colors hover:border-ink hover:text-ink">
                    <Plus size={15} />
                  </button>
                )}
            </div>
          );
        })}
      </div>

      {/* Upload */}
      {canUploadHere ? (
        <div className="panel mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
            <p className="text-[13px] font-medium text-ink">{t("documents.saveAs")}</p>
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
            <span className="ms-auto flex items-center gap-1.5 text-[12px] text-ink-3">
              {tab === "private" ? <Lock size={12} /> : <Users size={12} />}
              {tab === "private" ? t("documents.onlyYou") : t("documents.everyone")}
            </span>
          </div>
          <div
            role="button" tabIndex={0} aria-label={t("documents.upload")}
            onClick={() => pickFiles()}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFiles(); } }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadVisibility.current = tab; handleFiles(e.dataTransfer.files); }}
            className={cn("m-3 flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed px-6 py-8 text-center transition-colors sm:flex-row sm:gap-4 sm:text-start",
                          dragOver ? "border-accent bg-accent-soft" : "border-line-strong hover:border-ink hover:bg-paper")}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-2">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            </span>
            <div>
              <p className="text-[14px] font-medium text-ink">{t("documents.dropzone")}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-3">{t("documents.formats")} · {t("documents.maxSize")}</p>
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
                    <button onClick={() => setJobs(x => x.filter(y => y.id !== j.id))} aria-label={t("common.dismiss")} className="rounded p-0.5 text-ink-3 hover:text-ink"><X size={13} /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-panel)] border border-line bg-sunken px-4 py-3 text-[13px] text-ink-2">
          <Lock size={15} className="shrink-0" aria-hidden="true" />
          <span className="flex-1">{t("documents.viewerUpload")}</span>
          <Button size="sm" variant="secondary" onClick={() => setTab("private")}>{t("documents.goPrivate")}</Button>
        </div>
      )}
      <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/*"
             onChange={e => handleFiles(e.target.files)} aria-hidden="true" tabIndex={-1} />

      {/* Library */}
      <section className="mt-10" aria-label={t("documents.files")}>
        {inTab.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label={t("documents.filterType")}>
              {(["all", ...DOC_TYPES] as const).map(type => (
                <button key={type} aria-pressed={filter === type} onClick={() => setFilter(type)}
                        className={cn("flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[12.5px] transition-colors",
                                      filter === type ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                  {type === "all" ? t("packing.filters.all") : t(`documents.types.${type}`)}
                  <span className={cn("font-mono text-[11px]", filter === type ? "text-paper/60" : "text-ink-3")}>{counts[type] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:ms-auto">
              <div className="relative flex-1 lg:w-56">
                <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("documents.search")} className="h-9 ps-8" aria-label={t("documents.search")} />
              </div>
              <div className="w-36">
                <Select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="h-9" aria-label={t("documents.sort")}>
                  <option value="newest">{t("documents.sortNewest")}</option>
                  <option value="name">{t("documents.sortName")}</option>
                  <option value="type">{t("documents.sortType")}</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {inTab.length === 0 ? (
          <EmptyState icon={tab === "private" ? Lock : FileText}
                      title={tab === "private" ? t("documents.emptyPrivate") : t("documents.noDocuments")}
                      description={tab === "private" ? t("documents.emptyPrivateDesc") : canEdit ? t("documents.emptyGroupDesc") : undefined} />
        ) : visible.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">{t("documents.noMatch")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map(doc => {
              const meta = DOC_META[doc.type] ?? DOC_META.other;
              const Icon = meta.icon;
              const preview = previews[doc.id];
              const uploader = member(doc.uploaded_by);
              const manage = mayManage(doc);
              const at = uploadedAt(doc);
              return (
                <li key={doc.id} className="panel group flex flex-col overflow-hidden">
                  <button onClick={() => setViewing(doc)} aria-label={t("documents.previewAria", { name: doc.file_name })}
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
                    {doc.visibility === "private" && (
                      <span className="absolute start-2 top-2 flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-medium text-ink shadow-sm">
                        <Lock size={10} /> {t("documents.privateBadge")}
                      </span>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition-all group-hover:bg-ink/25 group-hover:opacity-100">
                      <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-ink shadow"><Eye size={13} /> {t("documents.preview")}</span>
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
                        {at > 0 && <span suppressHydrationWarning> · {formatShortDate(new Date(at))}</span>}
                        {members.length > 1 && doc.visibility === "group" && <> · <Avatar name={uploader?.profiles?.display_name} src={uploader?.profiles?.avatar_url} size={16} /> {nameOf(doc.uploaded_by)}</>}
                      </p>
                    </div>
                    <Menu.Root>
                      <Menu.Trigger aria-label={t("documents.optionsAria", { name: doc.file_name })}
                                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken">
                        <MoreHorizontal size={16} />
                      </Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Content align="end" sideOffset={4}
                                      className="z-50 min-w-[210px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise">
                          <MenuItem onSelect={() => setViewing(doc)} icon={Eye}>{t("documents.preview")}</MenuItem>
                          <MenuItem onSelect={() => download(doc)} icon={Download}>{t("documents.download")}</MenuItem>
                          {manage && <MenuItem onSelect={() => setRenaming(doc)} icon={Pencil}>{t("documents.rename")}</MenuItem>}
                          {manage && (
                            <Menu.Sub>
                              <Menu.SubTrigger className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken data-[state=open]:bg-sunken">
                                <Tag size={14} /> {t("documents.changeType")}
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
                          {doc.uploaded_by === userId && doc.visibility === "private" && canEdit && (
                            <MenuItem onSelect={() => updateDoc(doc, { visibility: "group" }, "documents.sharedToast")} icon={Users}>{t("documents.shareWithGroup")}</MenuItem>
                          )}
                          {doc.uploaded_by === userId && doc.visibility === "group" && (
                            <MenuItem onSelect={() => updateDoc(doc, { visibility: "private" }, "documents.madePrivateToast")} icon={Lock}>{t("documents.makePrivate")}</MenuItem>
                          )}
                          {mayDelete(doc) && (
                            <Menu.Item onSelect={() => setDeleting(doc)}
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
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await deleteDoc(deleting); }}
                     title={t("documents.deleteTitle")} description={deleting ? t("documents.deleteDesc", { name: deleting.file_name }) : undefined}
                     confirmLabel={t("documents.delete")} />
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
  const { t } = useTranslation("common");
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
          <iframe src={url} title={doc.file_name} className="h-full w-full" referrerPolicy="no-referrer" />
        )}
        {!loading && (!url || !previewable) && (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <FileText size={22} className="mx-auto text-ink-3" />
              <p className="mt-2 text-[13px] text-ink-2">{url ? t("documents.cantPreview") : t("documents.errors.open")}</p>
            </div>
          </div>
        )}
      </div>
      <ModalActions>
        {url && !url.startsWith("blob:") && (
          <Button asChild variant="ghost">
            <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> {t("documents.openTab")}</a>
          </Button>
        )}
        <Button onClick={onDownload}><Download size={15} /> {t("documents.download")}</Button>
      </ModalActions>
    </Modal>
  );
}

function RenameDialog({ doc, onClose, onSave }: { doc: Doc; onClose: () => void; onSave: (name: string) => void }) {
  const { t } = useTranslation("common");
  const ext = /\.[^.]+$/.exec(doc.file_name)?.[0] ?? "";
  const [name, setName] = useState(doc.file_name.slice(0, doc.file_name.length - ext.length));
  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }} title={t("documents.renameTitle")}>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(`${name.trim().slice(0, 190)}${ext}`); }}>
        <div className="flex items-center gap-2">
          <Input autoFocus value={name} onChange={e => setName(e.target.value)} aria-label={t("documents.fileName")} maxLength={190} />
          {ext && <span className="font-mono text-[13px] text-ink-3">{ext}</span>}
        </div>
        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={!name.trim()}>{t("common.save")}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
