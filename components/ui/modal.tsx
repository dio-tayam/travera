"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Accessible dialog: bottom sheet on phones, centred panel from `sm` up. */
export function Modal({ open, onOpenChange, title, description, children, className }: ModalProps) {
  const { t } = useTranslation("common");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] animate-overlay" />
        <Dialog.Content
          className={cn(
            "fixed z-50 inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto bg-surface",
            "rounded-t-[20px] border-t border-line safe-bottom animate-sheet",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:w-[calc(100%-2rem)] sm:max-w-[460px] sm:rounded-[18px] sm:border",
            "shadow-[0_24px_60px_-20px_rgb(22_24_29/0.35)] focus:outline-none",
            className
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:pt-5 pb-1">
            <div className="min-w-0">
              <Dialog.Title className="display text-[26px] text-ink">{title}</Dialog.Title>
              {description
                ? <Dialog.Description className="mt-1 text-[13px] text-ink-2">{description}</Dialog.Description>
                : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close
              className="-mr-1.5 rounded-[var(--radius-control)] p-2 text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
              aria-label={t("common.close")}
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="px-5 pb-5 pt-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
