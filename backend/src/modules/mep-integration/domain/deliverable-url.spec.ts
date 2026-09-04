import { isHttpsUrl, isSharePointDocumentUrl } from './deliverable-url';

const DOCUMENT =
  'https://verytel.sharepoint.com/sites/preventa/Shared%20Documents/int_20004/diseno-tecnico.pdf';
const LIST_RECORD =
  'https://verytel.sharepoint.com/sites/preventa/Lists/Commitments/DispForm.aspx?ID=20004';

describe('entregables — §6.5 / INV-23 / AC-29', () => {
  it('INV-23: una URL de SharePoint Documents es un entregable válido', () => {
    expect(isSharePointDocumentUrl(DOCUMENT)).toBe(true);
  });

  it('TS-SVC-09 / INV-23: el registro de SharePoint List nunca es entregable', () => {
    expect(isSharePointDocumentUrl(LIST_RECORD)).toBe(false);
  });

  it('AC-29: el registro de ruta/capacidad no se confunde con la entrega final', () => {
    // Misma biblioteca, misma organización: lo que decide es el tipo de
    // recurso, no el host.
    expect(new URL(DOCUMENT).hostname).toBe(new URL(LIST_RECORD).hostname);
    expect(isSharePointDocumentUrl(DOCUMENT)).not.toBe(
      isSharePointDocumentUrl(LIST_RECORD),
    );
  });

  it('INV-23: una tarea de Planner no es un entregable', () => {
    expect(
      isSharePointDocumentUrl(
        'https://tasks.office.com/verytel/Home/Task/task-20004',
      ),
    ).toBe(false);
  });

  it('§10.3: un entregable en HTTP plano se rechaza', () => {
    expect(
      isSharePointDocumentUrl(DOCUMENT.replace('https://', 'http://')),
    ).toBe(false);
  });

  it('INV-23: un host que solo contiene "sharepoint.com" como sufijo falso se rechaza', () => {
    expect(
      isSharePointDocumentUrl(
        'https://sharepoint.com.atacante.net/sites/x/Shared%20Documents/a.pdf',
      ),
    ).toBe(false);
  });

  it('§6.5: los enlaces operativos exigen HTTPS', () => {
    expect(isHttpsUrl('https://tasks.office.com/verytel/Home/Task/1')).toBe(
      true,
    );
    expect(isHttpsUrl('http://tasks.office.com/verytel/Home/Task/1')).toBe(
      false,
    );
    expect(isHttpsUrl('no-es-una-url')).toBe(false);
  });
});
