import api from "./axios";

/**
 * Upload a file directly to Cloudinary using short-lived signed parameters.
 *
 * The API signs the request but keeps its Cloudinary secret private. The
 * browser sends the file directly to Cloudinary, so bytes don't pass through
 * the API server.
 *
 * Returns { key, publicUrl } — `key` is what the API stores, `publicUrl` is
 * where the file can be read from.
 */
export async function uploadFile(file, kind = "media") {
  const { data } = await api.post("/media/presign", {
    kind,
    contentType: file.type,
    size: file.size,
  });

  const form = new FormData();
  form.append("file", file);
  Object.entries(data.fields).forEach(([name, value]) =>
    form.append(name, value),
  );

  const response = await fetch(data.uploadUrl, { method: "POST", body: form });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message || `Upload failed with status ${response.status}`,
    );
  }

  return { key: data.key, publicUrl: result.secure_url || data.publicUrl };
}

/**
 * The address of an uploaded file.
 *
 * Media lives in Cloudinary, so the URL is absolute. Anything that still
 * points at the API is a file from before the move.
 */
export function mediaSrc(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${api.defaults.baseURL}${url}`;
}
