/**
 * Load MONGODB_URI for Node scripts the same way people expect from Next:
 * `teavie/.env` first, then `teavie/.env.local` overrides.
 * Does not override keys already set in the process environment (e.g. CI / shell).
 */
const fs = require("fs");
const path = require("path");

const TEAVIE_ROOT = path.join(__dirname, "..", "..");

function parseEnvFile(content, setKey) {
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    setKey(k, v);
  }
}

function loadMongoEnv() {
  const envPath = path.join(TEAVIE_ROOT, ".env");
  const localPath = path.join(TEAVIE_ROOT, ".env.local");
  /** @type {Record<string, string>} */
  const merged = {};

  if (fs.existsSync(envPath)) {
    parseEnvFile(fs.readFileSync(envPath, "utf8"), (k, v) => {
      merged[k] = v;
    });
  }
  if (fs.existsSync(localPath)) {
    parseEnvFile(fs.readFileSync(localPath, "utf8"), (k, v) => {
      merged[k] = v;
    });
  }

  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

/** Hosts from URI for logs only (no password). */
function mongoHostHint(uri) {
  if (!uri || typeof uri !== "string") return "(no MONGODB_URI)";
  const at = uri.indexOf("@");
  if (at === -1) return "(non-standard uri)";
  const rest = uri.slice(at + 1);
  const slash = rest.indexOf("/");
  const q = rest.indexOf("?");
  const end = slash === -1 ? (q === -1 ? rest.length : q) : Math.min(slash, q === -1 ? Infinity : q);
  return rest.slice(0, end) || "(unknown host)";
}

module.exports = {
  TEAVIE_ROOT,
  loadMongoEnv,
  mongoHostHint,
};
