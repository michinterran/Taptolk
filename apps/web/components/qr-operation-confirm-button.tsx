"use client";

import { useId, useRef } from "react";

interface QrOperationConfirmButtonProps {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  label: string;
  title: string;
  tone?: "danger" | "primary" | "secondary";
}

export function QrOperationConfirmButton({
  cancelLabel,
  confirmLabel,
  description,
  label,
  title,
  tone = "primary",
}: QrOperationConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const triggerClassName =
    tone === "danger"
      ? "tt-button tt-button--danger tt-button--compact"
      : tone === "secondary"
        ? "tt-button tt-button--secondary tt-button--compact"
        : "tt-button tt-button--compact";
  const openDialog = () => dialogRef.current?.showModal();
  const closeDialog = () => dialogRef.current?.close();

  return (
    <>
      <button className={triggerClassName} onClick={openDialog} type="button">
        {label}
      </button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="qr-operation-confirm-dialog"
        ref={dialogRef}
      >
        <div className="qr-operation-confirm-dialog__content">
          <div className="qr-operation-confirm-dialog__copy">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <div className="qr-operation-confirm-dialog__actions">
            <button
              className="tt-button tt-button--secondary tt-button--compact"
              onClick={closeDialog}
              type="button"
            >
              {cancelLabel}
            </button>
            <button className={triggerClassName} type="submit">
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
