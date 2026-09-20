import { useMemo, useState } from "react";
import { PRS } from "../lib/mock";
import type { PullRequest } from "../lib/types";
import { ciChip, revChip } from "../lib/ui";
import { useDispatch } from "../state/store";

type FilterId =
  "all" | "review" | "authored" | "draft" | "approved" | "changes" | "failing" | "merged";

const FILTERS: { id: FilterId; label: string; test: (p: PullRequest) => boolean }[] = [
  { id: "review", label: "Review requested", test: (p) => p.review === "requested" && !p.merged },
  { id: "authored", label: "Authored", test: (p) => p.au === "alex" },
  { id: "draft", label: "Draft", test: (p) => p.draft },
  { id: "approved", label: "Approved", test: (p) => p.review === "approved" && !p.merged },
  { id: "changes", label: "Changes requested", test: (p) => p.review === "changes" },
  { id: "failing", label: "Failing CI", test: (p) => p.ci === "fail" },
  { id: "merged", label: "Merged", test: (p) => !!p.merged },
];

export function PRListView() {
  const dispatch = useDispatch();
  const [active, setActive] = useState<FilterId>("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    let items = PRS;
    const f = FILTERS.find((x) => x.id === active);
    if (f) items = items.filter(f.test);
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (p) =>
          p.t.toLowerCase().includes(q) ||
          p.au.toLowerCase().includes(q) ||
          String(p.num).includes(q),
      );
    }
    return items;
  }, [active, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-2 border-b border-bd bg-infbg px-[14px] py-[7px] text-[12px]">
        <span className="font-bold text-inf">ℹ Demo preview</span>
        <span className="text-tx2">
          Pull requests load from GitHub once an account is connected — that's the next milestone.
          Filters and navigation below work on sample data.
        </span>
        <span className="flex-1" />
        <button
          onClick={() => dispatch({ type: "nav", view: "accounts" })}
          className="btn-accent px-[10px] py-[2px] text-[11.5px] font-semibold"
        >
          Set up accounts →
        </button>
      </div>

      <div className="flex h-10 flex-none items-center gap-[6px] overflow-x-auto border-b border-bd bg-panel px-[14px]">
        <input
          placeholder="Search pull requests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-[220px] flex-none"
        />
        <span
          onClick={() => setActive("all")}
          className="flex-none cursor-pointer whitespace-nowrap rounded-xl px-[10px] py-[3px] text-[11.5px]"
          style={{
            background: active === "all" ? "var(--acbg)" : "transparent",
            border: active === "all" ? "1px solid transparent" : "1px solid var(--bd2)",
            color: active === "all" ? "var(--actx)" : "var(--tx2)",
            fontWeight: active === "all" ? 600 : 400,
          }}
        >
          All · {PRS.length}
        </span>
        {FILTERS.map((f) => {
          const count = PRS.filter(f.test).length;
          const on = active === f.id;
          return (
            <span
              key={f.id}
              onClick={() => setActive(on ? "all" : f.id)}
              className="flex-none cursor-pointer whitespace-nowrap rounded-xl px-[10px] py-[3px] text-[11.5px]"
              style={{
                background: on ? "var(--acbg)" : "transparent",
                border: on ? "1px solid transparent" : "1px solid var(--bd2)",
                color: on ? "var(--actx)" : count === 0 ? "var(--tx3)" : "var(--tx2)",
                fontWeight: on ? 600 : 400,
              }}
            >
              {f.label} · {count}
            </span>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((p) => {
          const ci = ciChip(p.ci);
          const rv = revChip(p.review);
          const stColor = p.merged ? "var(--pur)" : p.draft ? "var(--tx3)" : "var(--ok)";
          const stLabel = p.merged ? "Merged" : p.draft ? "Draft" : "Open";
          return (
            <div
              key={p.num}
              onClick={() => dispatch({ type: "nav", view: "prreview" })}
              className="flex h-[52px] cursor-pointer items-center gap-3 border-b border-bd px-4 hover:bg-hov"
            >
              <span
                title={stLabel}
                className="w-[18px] flex-none text-center text-[14px]"
                style={{ color: stColor }}
              >
                {p.draft ? "◌" : "⇄"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-[2px] flex items-center gap-2">
                  <span
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold"
                    style={{ color: p.merged ? "var(--tx2)" : "var(--tx)" }}
                  >
                    {p.t}
                  </span>
                  <span className="flex-none font-mono text-[11.5px] text-tx3">#{p.num}</span>
                  {p.draft && (
                    <span className="flex-none rounded-[4px] border border-bd2 px-[6px] text-[10.5px] text-tx3">
                      Draft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11.5px] text-tx3">
                  <span>{p.repo}</span>
                  <span>·</span>
                  <span className="font-mono">
                    {p.from} → {p.to}
                  </span>
                  <span>·</span>
                  <span>{p.au}</span>
                  <span>·</span>
                  <span>updated {p.upd}</span>
                </div>
              </div>
              <span
                className="flex-none whitespace-nowrap rounded-[4px] px-2 py-[2px] text-[11px]"
                style={{ color: rv.c, background: rv.bg }}
              >
                {rv.txt}
              </span>
              <span
                className="flex-none whitespace-nowrap rounded-[4px] px-2 py-[2px] text-[11px]"
                style={{ color: ci.c, background: ci.bg }}
              >
                {ci.txt}
              </span>
              <span className="w-[88px] flex-none text-right text-[11.5px] text-tx3">
                {p.com > 0 ? `${p.com} comments` : ""}
              </span>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-[12.5px] text-tx3">
            No pull requests match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
