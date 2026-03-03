export function MailmindIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={className}
    >
      <defs>
        <linearGradient id="mindFlow" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#4facfe" />
          <stop offset="100%" stopColor="#00f2fe" />
        </linearGradient>
      </defs>
      <path
        d="M 20 150 C 50 130, 40 30, 85 45 C 130 60, 100 140, 140 120 C 180 100, 170 50, 185 75"
        fill="none"
        stroke="url(#mindFlow)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
