/** Commit-graph lane layout, computed outside the React render path.
 *
 * Standard active-lanes algorithm: each lane holds the SHA it expects next.
 * For every commit row we produce the data the SVG cell renderer needs:
 *   lane     — column of the commit dot
 *   merge    — ≥2 parents (hollow dot)
 *   v        — vertical segments [lane, 0=full | 1=lower-half | 2=upper-half]
 *   curves   — other lanes joining (dir "top") or leaving (dir "bottom") the dot
 */
import type { CommitInfo } from "./gitparse";

export interface GraphRowLayout {
  lane: number;
  merge: boolean;
  v: [number, number][];
  curves: { lane: number; dir: "top" | "bottom" }[];
}

export const MAX_LANES = 12;

export function layoutGraph(commits: CommitInfo[]): GraphRowLayout[] {
  const lanes: (string | null)[] = [];
  const rows: GraphRowLayout[] = [];

  for (const c of commits) {
    const before = lanes.slice();

    // all lanes waiting for this commit (children edges converge here)
    const incoming: number[] = [];
    lanes.forEach((sha, i) => {
      if (sha === c.sha) incoming.push(i);
    });

    // dot lane: first waiting lane, else first free slot
    let dot: number;
    if (incoming.length > 0) {
      dot = incoming[0];
    } else {
      const free = lanes.indexOf(null);
      dot = free >= 0 ? free : lanes.length;
      if (dot === lanes.length) lanes.push(null);
    }

    const curves: GraphRowLayout["curves"] = [];

    // extra children lanes merge into the dot from above
    for (const i of incoming.slice(1)) {
      curves.push({ lane: i, dir: "top" });
      lanes[i] = null;
    }

    // continue first parent in the dot lane
    const parents = c.parents;
    lanes[dot] = parents.length > 0 ? parents[0] : null;

    // additional parents (merge): reuse a lane already expecting that parent,
    // otherwise allocate one; edge leaves the dot downward
    for (const p of parents.slice(1)) {
      const existing = lanes.indexOf(p);
      if (existing >= 0 && existing !== dot) {
        curves.push({ lane: existing, dir: "bottom" });
      } else {
        const free = lanes.indexOf(null);
        const l = free >= 0 ? free : lanes.length;
        if (l === lanes.length) lanes.push(p);
        else lanes[l] = p;
        curves.push({ lane: l, dir: "bottom" });
      }
    }

    // vertical segments: active above (in `before`), active below (in `lanes`)
    const v: [number, number][] = [];
    const curvedFromTop = new Set(
      curves.filter((curve) => curve.dir === "top").map((curve) => curve.lane),
    );
    const curvedFromBottom = new Set(
      curves.filter((curve) => curve.dir === "bottom").map((curve) => curve.lane),
    );
    const width = Math.min(Math.max(before.length, lanes.length), MAX_LANES);
    for (let i = 0; i < width; i++) {
      const above = i < before.length && before[i] !== null;
      const below = i < lanes.length && lanes[i] !== null;
      if (i === dot) {
        // the dot lane: draw up if something pointed here, down if a parent continues
        const up = above || incoming.length > 0;
        const down = below;
        if (up && down) v.push([i, 0]);
        else if (down) v.push([i, 1]);
        else if (up) v.push([i, 2]);
        continue;
      }
      // A lane-change edge already covers this half of the row. Drawing the
      // vertical half as well makes a straight line show through the curve.
      if (
        (above && !below && curvedFromTop.has(i)) ||
        (!above && below && curvedFromBottom.has(i))
      ) {
        continue;
      }
      if (above && below) v.push([i, 0]);
      else if (above && !below)
        v.push([i, 2]); // ends here (merged in)
      else if (!above && below) v.push([i, 1]); // starts here (branched out)
    }

    rows.push({
      lane: Math.min(dot, MAX_LANES - 1),
      merge: parents.length > 1,
      v,
      curves: curves.map((cv) => ({ ...cv, lane: Math.min(cv.lane, MAX_LANES - 1) })),
    });
  }

  return rows;
}
