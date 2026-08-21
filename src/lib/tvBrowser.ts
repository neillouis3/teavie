/** Smart TV / living-room browser user agents (Tizen, webOS, Fire TV, etc.). */
export const TV_USER_AGENT_RE =
  /SmartTV|Smart-TV|SMART-TV|Tizen|Web0S|WebOS|BRAVIA|HbbTV|GoogleTV|Google TV|Android TV|AppleTV|Apple TV|CrKey|CrTV|AFT[A-Z0-9]|Silk\/|NetCast|Viera|AquosBrowser|TiVo|Opera TV|VIDAA|Hisense|LG Browser|Xbox|PlayStation|Nintendo Switch|Freebox|Odin|MITV|Roku|DVB|InspireTV|TV Safari|Large Screen|AOSP on TV|GoogleTV/i;

const MOBILE_UA_RE = /Mobile|iPhone|iPod|Android.*Mobile|webOS/i;

export function isTvUserAgent(userAgent: string): boolean {
  return TV_USER_AGENT_RE.test(userAgent);
}

/** UA match or large living-room screen (generic TV browsers often use plain Chrome UA). */
export function isTvLikeEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (isTvUserAgent(ua)) return true;
  if (MOBILE_UA_RE.test(ua)) return false;
  if (typeof window === "undefined") return false;

  const screenW = Math.max(window.screen.width, window.screen.height);
  const screenH = Math.min(window.screen.width, window.screen.height);
  const layoutW = window.innerWidth;
  const hoverNone = window.matchMedia("(hover: none)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Common TV pattern: ~960px layout width on a 1080p+ physical screen.
  if (screenW >= 960 && layoutW < 1024 && (hoverNone || coarsePointer)) {
    return true;
  }

  if (screenW >= 1280 && screenH >= 540 && (hoverNone || coarsePointer)) {
    return true;
  }

  return false;
}

export function applyTvViewportFix(): void {
  if (typeof document === "undefined") return;
  if (!isTvLikeEnvironment()) return;
  document.documentElement.classList.add("tv-desktop");
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      "content",
      "width=1920, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );
  }
}

/** Runs before paint — sets tv-desktop + layout viewport width on TV browsers. */
export const TV_VIEWPORT_FIX_SCRIPT = `(function(){try{var ua=navigator.userAgent||"";var mobile=${MOBILE_UA_RE.toString()}.test(ua);var tvUa=${TV_USER_AGENT_RE.toString()}.test(ua);var sw=Math.max(screen.width,screen.height);var sh=Math.min(screen.width,screen.height);var lw=innerWidth;var hn=matchMedia("(hover: none)").matches;var cp=matchMedia("(pointer: coarse)").matches;var livingRoom=!mobile&&((sw>=960&&lw<1024&&(hn||cp))||(sw>=1280&&sh>=540&&(hn||cp)));if(!tvUa&&!livingRoom)return;document.documentElement.classList.add("tv-desktop");var m=document.querySelector('meta[name="viewport"]');if(m)m.setAttribute("content","width=1920, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");}catch(e){}})();`;
