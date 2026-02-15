export function Mascot({
  size = 120,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Antennae */}
      <line
        x1="45"
        y1="28"
        x2="38"
        y2="12"
        stroke="#4f8fff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="38" cy="10" r="4" fill="#6da3ff" />
      <line
        x1="75"
        y1="28"
        x2="82"
        y2="12"
        stroke="#4f8fff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="82" cy="10" r="4" fill="#6da3ff" />

      {/* Body glow */}
      <circle cx="60" cy="65" r="38" fill="#4f8fff" opacity="0.15" />

      {/* Body */}
      <circle cx="60" cy="65" r="34" fill="#4f8fff" />

      {/* Eyes */}
      <ellipse cx="47" cy="60" rx="9" ry="10" fill="white" />
      <ellipse cx="73" cy="60" rx="9" ry="10" fill="white" />

      {/* Pupils */}
      <circle cx="49" cy="62" r="4.5" fill="#0b1022">
        <animate
          attributeName="cx"
          values="49;51;49;47;49"
          dur="4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="75" cy="62" r="4.5" fill="#0b1022">
        <animate
          attributeName="cx"
          values="75;77;75;73;75"
          dur="4s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Eye shine */}
      <circle cx="51" cy="58" r="2" fill="white" opacity="0.8" />
      <circle cx="77" cy="58" r="2" fill="white" opacity="0.8" />

      {/* Mouth */}
      <path
        d="M52 76 Q60 82 68 76"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
