import { supabase } from "./supabase";

// Uploads a chat image (native or web) to the private `chat-photos` bucket.
// Returns the storage path persisted on the message row. Use
// getChatPhotoSignedUrl() to display it after message RLS allows the row.
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

  return path;
}

export async function getChatPhotoSignedUrl(
  pathOrUrl: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const marker = "/chat-photos/";
  const markerIndex = pathOrUrl.indexOf(marker);
  const path =
    markerIndex >= 0
      ? decodeURIComponent(pathOrUrl.slice(markerIndex + marker.length))
      : pathOrUrl;

  const { data, error } = await supabase.storage
    .from("chat-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
