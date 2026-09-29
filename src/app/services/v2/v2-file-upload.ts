/** PUTs the bytes to a presigned storage URL with exactly the headers the signature pins. */
export function putV2File(
  method: string,
  url: string,
  headers: Readonly<Record<string, string>>,
  file: File,
  progress: (value: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error('v2.documents.uploadFailed'));
    });
    request.addEventListener('error', () => reject(new Error('v2.documents.uploadFailed')));
    request.addEventListener('abort', () => reject(new Error('v2.documents.uploadFailed')));
    request.send(file);
  });
}
