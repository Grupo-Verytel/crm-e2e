export type DeliverableDisplayInput = {
  url: string;
  label?: string | null;
  type?: string | null;
};

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  FINANCIAL_DELIVERABLE: 'Entregable financiero',
  TECHNICAL_DELIVERABLE: 'Entregable técnico',
};

const GENERIC_PATH_SEGMENTS = new Set([
  'shared documents',
  'documents',
  'documentos compartidos',
  'sites',
  'preventa',
]);

/** Texto visible del enlace: label MEP → nombre de archivo → tipo → genérico. */
export function deliverableDisplayName(
  input: DeliverableDisplayInput,
): string {
  const trimmedLabel = input.label?.trim();
  if (trimmedLabel) {
    return trimmedLabel;
  }

  const fromUrl = fileNameFromSharePointUrl(input.url);
  if (fromUrl) {
    return fromUrl;
  }

  const typeLabel = input.type
    ? DELIVERABLE_TYPE_LABELS[input.type] ?? null
    : null;
  if (typeLabel) {
    return typeLabel;
  }

  return 'Documento SharePoint';
}

/** @deprecated Prefer `deliverableDisplayName({ url })`. */
export function sharePointDocumentName(url: string): string {
  return deliverableDisplayName({ url });
}

function fileNameFromSharePointUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname);

    const sharing = path.match(/\/:[a-z]:\/[rs]\/([^/]+)\/([^/?]+)/i);
    if (sharing) {
      const site = sharing[1].replace(/_/g, ' ');
      const segment = sharing[2];
      if (/\.[a-z0-9]{2,8}$/i.test(segment)) {
        return humanizeSegment(segment);
      }
      if (segment.length <= 32) {
        return humanizeSegment(segment);
      }
      return `Documento (${site})`;
    }

    const segments = path.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i];
      if (GENERIC_PATH_SEGMENTS.has(segment.toLowerCase())) {
        continue;
      }
      if (segment.length > 48 && !segment.includes('.')) {
        continue;
      }
      return humanizeSegment(segment);
    }

    return null;
  } catch {
    return null;
  }
}

function humanizeSegment(segment: string): string {
  return segment.replace(/_/g, ' ');
}
