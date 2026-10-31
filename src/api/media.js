import api from './axios';

/**
 * Upload a file straight to the storage bucket.
 *
 * The API hands out a presigned URL and the browser PUTs the bytes to the
 * bucket itself. The file never travels through the API, so a video does not
 * have to fit in a request body, and nothing is written to the API's disk —
 * which on Render is wiped on every deploy.
 *
 * Returns { key, publicUrl } — `key` is what the API stores, `publicUrl` is
 * where the file can be read from.
 */
export async function uploadFile(file, kind = 'media') {
  const { data } = await api.post('/media/presign', {
    kind,
    contentType: file.type,
    size: file.size,
  });

  const response = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: data.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return { key: data.key, publicUrl: data.publicUrl };
}

/**
 * The address of an uploaded file.
 *
 * Media lives in the bucket, so the URL is absolute. Anything that still
 * points at the API is a file from before the move.
 */
export function mediaSrc(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${api.defaults.baseURL}${url}`;
}
