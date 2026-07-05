import { supabase } from "./supabase";

// Pushes a check-in selfie to the `checkins` storage bucket under
// `{userId}/{bookingId}.{ext}`. Returns the public URL we persist on the
// checkins row.
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

  const { data } = supabase.storage.from("checkins").getPublicUrl(path);
  return data.publicUrl;
}
