"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalActions } from "./modal";
import { Button } from "./button";
import { Input } from "./field";

/** Confirmation dialog for destructive actions. Pass `confirmText` to require typing it first. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, confirmText, danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => Promise<void> | void;
  title: string; description?: string; confirmLabel: string; confirmText?: string; danger?: boolean;
}) {
  const { t } = useTranslation("common");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !confirmText || typed.trim() === confirmText.trim();

  return (
    <Modal open={open} onOpenChange={o => { if (!o) { setTyped(""); onClose(); } }} title={title} description={description}>
      <form onSubmit={async e => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setTyped(""); }
      }}>
        {confirmText && (
          <label className="block text-[13px] text-ink-2">
            {t("common.typeToConfirm", { text: confirmText })}
            <Input className="mt-2" value={typed} onChange={e => setTyped(e.target.value)} autoFocus aria-label={confirmText} />
          </label>
        )}
        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant={danger ? "accent" : "primary"} disabled={!ready} loading={busy}
                  className={danger ? "bg-negative hover:bg-negative/90" : undefined}>
            {confirmLabel}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
