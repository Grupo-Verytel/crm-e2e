/**
 * Validación de entregables — §6.5, INV-23 / AC-29.
 *
 * Un entregable es una URL de **SharePoint Documents**. El registro de
 * SharePoint List (`/Lists/…`, `DispForm.aspx`, `AllItems.aspx`) nunca es
 * entregable: se rechaza con 422 DELIVERABLE_NOT_A_DOCUMENT.
 */

const SHAREPOINT_HOST = /(^|\.)sharepoint\.com$/i;

/** Segmentos que delatan un registro de SharePoint List, no un documento. */
const LIST_MARKERS = [
  '/lists/',
  'dispform.aspx',
  'allitems.aspx',
  'editform.aspx',
  'newform.aspx',
];

/** Segmentos propios de una biblioteca de documentos. */
const DOCUMENT_MARKERS = [
  '/shared documents/',
  '/shared%20documents/',
  '/documents/',
  '/documentos%20compartidos/',
  '/documentos compartidos/',
];

export function isSharePointDocumentUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  // §10.3 / §6.5: HTTPS obligatorio en todo enlace del contrato.
  if (url.protocol !== 'https:') {
    return false;
  }

  if (!SHAREPOINT_HOST.test(url.hostname)) {
    return false;
  }

  const path = `${url.pathname}${url.search}`.toLowerCase();

  if (LIST_MARKERS.some((marker) => path.includes(marker))) {
    return false;
  }

  return DOCUMENT_MARKERS.some((marker) => path.includes(marker));
}

/** HTTPS obligatorio para cualquier enlace operativo del contrato. */
export function isHttpsUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).protocol === 'https:';
  } catch {
    return false;
  }
}
