import { supabase } from "./supabase";

// Uploads a chat image (native or web) to the 'chat-photos' bucket.
// Returns the public URL we send in the message payload.
export async function uploadChatPhoto(
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
  const path = `${userId}/photo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("chat-photos")
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("chat-photos").getPublicUrl(path);
  return data.publicUrl;
}
