type Props = {
  size?: number;
  className?: string;
};

/** Open-detail hint: frame + arrow toward the upper-right. */
export function OpenDetailPopoutIcon({ size = 17.46, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`.trim()}
      aria-hidden
    >
      <path
        d="M14 4h6v6M10 14 20 4M18 10v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
