export default function RailflowLogo({ className, size = 36 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Railflow">
      <defs>
        <linearGradient id="rfArcGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2D6BFF" />
          <stop offset="1" stopColor="#16C8B0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill="#0B1437" />
      <path d="M16 44 A20 20 0 0 1 48 44" fill="none" stroke="url(#rfArcGradient)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="26" r="4.5" fill="url(#rfArcGradient)" />
    </svg>
  );
}
