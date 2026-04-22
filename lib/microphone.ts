/**
 * Pre-grant microphone permission so the browser has already asked the user
 * by the time the intro video ends and we switch to voice mode.
 * Tracks are stopped immediately — we just want the permission, not the stream.
 *
 * Safe to fire-and-forget: rejection (user denied, not in secure context,
 * iframe missing `allow="microphone"`) is logged and swallowed.
 */
export async function prewarmMicrophonePermission(): Promise<
  "granted" | "denied" | "unavailable"
> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unavailable";
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (err) {
    console.warn("Microphone permission not granted:", err);
    return "denied";
  }
}
