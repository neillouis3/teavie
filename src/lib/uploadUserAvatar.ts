import { createClient } from "@/utils/supabase/client";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 2 MB or smaller.";
  }
  return null;
}

export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export function readGuestAvatarDataUrl(file: File, maxBytes = 512_000): Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) return Promise.reject(new Error(validationError));
  if (file.size > maxBytes) {
    return Promise.reject(new Error("Image must be 500 KB or smaller."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}
