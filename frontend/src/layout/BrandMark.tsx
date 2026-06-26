/**
 * Placeholder brand mark. Replace with the official Verytel logo SVG (which is the only
 * place the `Aller` font is allowed). Respect the logo's clear-space and proportions per
 * the brand manual. UI text never uses Aller.
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" className={className} role="img" aria-label="Verytel · Frisson">
      <rect x="0" y="4" width="16" height="16" rx="3" fill="var(--brand-primary)" />
      <rect x="4" y="8" width="8" height="8" rx="2" fill="var(--brand-turquoise)" />
      <text x="24" y="17" fontFamily="var(--font-ui)" fontWeight="700" fontSize="13" fill="var(--ink)">
        Frisson CRM
      </text>
    </svg>
  );
}
