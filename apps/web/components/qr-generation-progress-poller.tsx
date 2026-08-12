"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const QR_GENERATION_PROGRESS_POLL_INTERVAL_MS = 3_000;

interface QrGenerationProgressPollerProps {
  active: boolean;
  label: string;
}

export function QrGenerationProgressPoller({ active, label }: QrGenerationProgressPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, QR_GENERATION_PROGRESS_POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [active, router]);

  return active ? (
    <p aria-live="polite" className="qr-console-v2-help">
      {label}
    </p>
  ) : null;
}
