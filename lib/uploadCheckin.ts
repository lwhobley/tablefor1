import { supabase } from "./supabase";

// Pushes a check-in selfie to the `checkins` storage bucket under
// `{userId}/{bookingId}.{ext}`. The bucket is private (trust & safety
// selfies of real people at a known place/time shouldn't be world-readable
// at a guessable URL), so this returns the storage path — not a public
// URL — for the caller to persist. Use getCheckinSelfieSignedUrl() to
// display it later.
export async function uploadCheckinSelfie(
  userId: string,
  bookingId: string,
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
  const path = `${userId}/${bookingId}.${ext}`;

  const { error } = await supabase.storage
    .from("checkins")
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  return path;
}

// Mints a short-lived signed URL for a stored check-in selfie path. The
// `checkins: read own or match members` storage policy still governs who
// createSignedUrl succeeds for.
export async function getCheckinSelfieSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("checkins")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
