/** Smart TV / living-room browser user agents (Tizen, webOS, Fire TV, etc.). */
export const TV_USER_AGENT_RE =
  /SmartTV|Smart-TV|SMART-TV|Tizen|Web0S|WebOS|BRAVIA|HbbTV|GoogleTV|Google TV|Android TV|AppleTV|Apple TV|CrKey|AFT[A-Z0-9]|Silk\/|NetCast|Viera|AquosBrowser|TiVo|Opera TV|VIDAA|Hisense|LG Browser|Xbox|PlayStation|Nintendo Switch|Freebox|Odin/i;

export function isTvUserAgent(userAgent: string): boolean {
  return TV_USER_AGENT_RE.test(userAgent);
}

/** Inline script string — runs before paint to widen layout viewport on TV browsers. */
export const TV_VIEWPORT_FIX_SCRIPT = `(function(){try{var ua=navigator.userAgent||"";var tv=${TV_USER_AGENT_RE.toString()}.test(ua);if(!tv)return;document.documentElement.classList.add("tv-desktop");var m=document.querySelector('meta[name="viewport"]');if(m)m.setAttribute("content","width=1920, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");}catch(e){}})();`;

export function applyTvViewportFix(): void {
  if (typeof document === "undefined") return;
  if (!isTvUserAgent(navigator.userAgent)) return;
  document.documentElement.classList.add("tv-desktop");
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      "content",
      "width=1920, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );
  }
}
