const colors = ["#34c0a2", "#5f9df6", "#a98bf2", "#d8a544", "#e2635f", "#4dbb70"];

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1)
    result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const value = hash(name || "unknown");
  const fg = colors[value % colors.length];
  const cells = Array.from({ length: 15 }, (_, index) => ((value >>> (index % 24)) & 1) === 1);
  return (
    <svg
      role="img"
      aria-label={`${name} avatar`}
      width={size}
      height={size}
      viewBox="0 0 5 5"
      className="flex-none rounded-[30%] border border-bd2"
      style={{ background: `${fg}20` }}
    >
      {Array.from({ length: 5 }, (_, y) =>
        Array.from({ length: 3 }, (_, x) =>
          cells[y * 3 + x] ? (
            <g key={`${x}:${y}`} fill={fg}>
              <rect x={x} y={y} width="1" height="1" />
              <rect x={4 - x} y={y} width="1" height="1" />
            </g>
          ) : null,
        ),
      )}
    </svg>
  );
}
