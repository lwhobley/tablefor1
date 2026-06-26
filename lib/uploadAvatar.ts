import { supabase } from "./supabase";

// Accepts a Blob (web) or a local URI (native) and pushes it to the
// `avatars` storage bucket under `{userId}/avatar.{ext}`. Returns the public
// URL we persist on the user row.
export async function uploadAvatar(
  userId: string,
  source: Blob | { uri: string; mimeType?: string },
): Promise<string> {
  let blob: Blob;
  let contentType: string;

  if (source instanceof Blob) {
    blob = source;
    contentType = source.type || "image/jpeg";
  } else {
    const res = await fetch(source.uri);
    blob = await res.blob();
    contentType = source.mimeType || blob.type || "image/jpeg";
  }

  const ext = contentType.split("/")[1] ?? "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
