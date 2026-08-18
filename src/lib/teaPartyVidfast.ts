import type { GuestSyncPayload } from "@/lib/teaPartySync";
import { postVidfastCommand } from "@/lib/vidfastProgress";

/** Apply a soft Tea Party sync via VidFast postMessage (no iframe remount). */
export function applyVidfastGuestSync(
  iframe: HTMLIFrameElement | null | undefined,
  plan: GuestSyncPayload
): boolean {
  if (!iframe || plan.remount) return false;
  postVidfastCommand(iframe, "seek", plan.targetSeconds);
  postVidfastCommand(iframe, plan.playing === false ? "pause" : "play");
  return true;
}
