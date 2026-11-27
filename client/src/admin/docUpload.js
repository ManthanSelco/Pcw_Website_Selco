// Upload a PDF / Word / PowerPoint file (max 50 MB) to the server, with progress.
// Used by Recordings (report file) and Events (attached documents).
export const DOC_MAX_MB = 50;
export const DOC_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const fileSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n ? `${Math.max(1, Math.round(n / 1024))} KB` : '');

// Returns an error message, or '' when the file can be uploaded.
export function checkDoc(file) {
  if (!/\.(pdf|docx?|pptx?)$/i.test(file.name)) return 'Please choose a PDF, Word (.doc/.docx) or PowerPoint (.ppt/.pptx) file.';
  if (file.size > DOC_MAX_MB * 1024 * 1024)
    return `“${file.name}” is ${fileSize(file.size)}, more than ${DOC_MAX_MB} MB. Use a Google Drive (or other) share link instead.`;
  return '';
}

// resolves { url, name, size }, rejects with an Error that has a readable message
export function uploadDoc(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload-doc');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON (e.g. the server's upload limit) */
      }
      if (xhr.status === 200 && body.url) resolve({ url: body.url, name: body.name, size: body.size });
      else reject(new Error(body.error || (xhr.status === 413 ? 'The file is too large for the server. Use a share link instead.' : 'Upload failed. Please try again.')));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check the internet connection and try again.'));
    onProgress?.(0);
    xhr.send(fd);
  });
}
