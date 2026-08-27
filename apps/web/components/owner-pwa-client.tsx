"use client";

import { useEffect } from "react";
import { registerOwnerServiceWorker } from "../owner/owner-device-client";

export function OwnerPwaClient() {
  useEffect(() => {
    void registerOwnerServiceWorker();
  }, []);
  return null;
}
