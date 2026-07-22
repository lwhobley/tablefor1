import { supabase } from "./supabase";

// Pushes a dinner story photo to the (private) `stories` storage bucket
// under `{userId}/{eventId}.{ext}`. Returns the storage path persisted on
// the dinner_stories row; display it via getStoryPhotoSignedUrl().
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

  return path;
}

// The stories bucket is private (round-3 hardening) — dinner photos of
// real people at a known place/time must not be world-readable on the
// CDN. Rows written before the flip stored full public URLs; strip
// through the bucket marker so both formats sign correctly. External
// (seeded/editorial) URLs pass through untouched.
export async function getStoryPhotoSignedUrl(
  pathOrUrl: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const marker = "/stories/";
  const markerIndex = pathOrUrl.indexOf(marker);
  const looksExternal = pathOrUrl.startsWith("http") && markerIndex < 0;
  if (looksExternal) return pathOrUrl;

  const path = markerIndex >= 0
    ? decodeURIComponent(pathOrUrl.slice(markerIndex + marker.length))
    : pathOrUrl;

  const { data, error } = await supabase.storage
    .from("stories")
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
