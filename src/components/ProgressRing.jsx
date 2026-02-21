export default function ProgressRing({
  size = 96,
  stroke = 10,
  value = 0,
  color = "var(--mm-teal)", // ✅ use brand teal
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="block">
      {/* Background Circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#ebe8e5"
        strokeWidth={stroke}
        fill="none"
      />

      {/* Progress Circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dasharray] duration-700 ease-out"
      />

      {/* Percentage Text */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="fill-gray-900 dark:fill-gray-100 text-sm font-semibold"
      >
        {clamped}%
      </text>
    </svg>
  );
}
