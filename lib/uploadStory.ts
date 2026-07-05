import { supabase } from "./supabase";

// Pushes a dinner story photo to the `stories` storage bucket under
// `{userId}/{eventId}.{ext}`. Returns the public URL we persist on the
// dinner_stories row.
export async function uploadStoryPhoto(
  userId: string,
  eventId: string,
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
  const path = `${userId}/${eventId}.${ext}`;

  const { error } = await supabase.storage
    .from("stories")
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("stories").getPublicUrl(path);
  return data.publicUrl;
}
