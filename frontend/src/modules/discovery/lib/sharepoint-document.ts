/** Nombre visible a partir de la última parte de la URL. */
export function sharePointDocumentName(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const last = path.split('/').filter(Boolean).pop();
    if (!last) return url;
    return last.replace(/_/g, ' ');
  } catch {
    return url;
  }
}
