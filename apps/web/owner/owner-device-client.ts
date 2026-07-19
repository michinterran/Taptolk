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
