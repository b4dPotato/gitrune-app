import { LANE_COLORS } from "../../lib/ui";
import type { GraphRowLayout } from "../../lib/graphlayout";

export const COMMIT_ROW_HEIGHT = 46;

export function CommitGraphCell({ row, width }: { row: GraphRowLayout; width: number }) {
  const mid = COMMIT_ROW_HEIGHT / 2;
  const x = (lane: number) => 8 + lane * 12;
  const color = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];
  const edgeStyle = (lane: number) => ({
    stroke: color(lane),
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    opacity: 0.55,
  });
  return (
    <svg width={width} height={COMMIT_ROW_HEIGHT} className="block" aria-hidden="true">
      {row.v.map(([lane, mode], index) => (
        <line
          key={`v${index}`}
          x1={x(lane)}
          x2={x(lane)}
          y1={mode === 1 ? mid : 0}
          y2={mode === 2 ? mid : COMMIT_ROW_HEIGHT}
          style={edgeStyle(lane)}
        />
      ))}
      {row.curves.map((edge, index) => {
        const from = x(edge.lane);
        const to = x(row.lane);
        const path =
          edge.dir === "top"
            ? `M ${from} 0 C ${from} 14, ${to} 10, ${to} ${mid}`
            : `M ${from} ${COMMIT_ROW_HEIGHT} C ${from} 32, ${to} 36, ${to} ${mid}`;
        return <path key={`edge${index}`} d={path} fill="none" style={edgeStyle(edge.lane)} />;
      })}
      <circle
        cx={x(row.lane)}
        cy={mid}
        r={row.merge ? 4 : 3.5}
        style={
          row.merge
            ? { fill: "var(--panel)", stroke: color(row.lane), strokeWidth: 2 }
            : { fill: color(row.lane) }
        }
      />
    </svg>
  );
}
