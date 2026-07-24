export async function getOwnerDeviceHash(): Promise<string> {
  const key = "tt_owner_device";
  let deviceValue = window.localStorage.getItem(key);
  if (!deviceValue) {
    deviceValue = crypto.randomUUID();
    window.localStorage.setItem(key, deviceValue);
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deviceValue));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function registerOwnerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  return navigator.serviceWorker.register("/owner-sw.js", { scope: "/" });
}

export async function getOwnerPushConfig(): Promise<
  { enabled: false } | { enabled: true; publicKey: string }
> {
  const response = await fetch("/api/owner/push/config", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    return { enabled: false };
  }
  const payload = (await response.json()) as {
    data: { enabled: false } | { enabled: true; publicKey: string };
  };
  return payload.data;
}

export function pushSupported(): boolean {
  return "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
}

export function decodeVapidPublicKey(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/gu, "+").replace(/_/gu, "/");
  const raw = window.atob(base64);
  const output = Uint8Array.from([...raw], (char) => char.charCodeAt(0));
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}
