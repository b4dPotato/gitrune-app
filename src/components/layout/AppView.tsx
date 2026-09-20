import type { RepoRecord, RepoStatus } from "../../lib/ipc";
import type { ViewId } from "../../lib/types";
import { AccountsView } from "../../views/AccountsView";
import { BranchesView } from "../../views/BranchesView";
import { ChangesView } from "../../views/ChangesView";
import { ConflictsView } from "../../views/ConflictsView";
import { GraphView } from "../../views/GraphView";
import { OpLogView } from "../../views/OpLogView";
import { OverviewView } from "../../views/OverviewView";
import { PRListView } from "../../views/PRListView";
import { PRReviewView } from "../../views/PRReviewView";
import { StashesView } from "../../views/StashesView";
import { WorkspaceView } from "../../views/WorkspaceView";
import { WorktreesView } from "../../views/WorktreesView";

export function AppView({
  view,
  repo,
  status,
}: {
  view: ViewId;
  repo?: RepoRecord;
  status?: RepoStatus;
}) {
  switch (view) {
    case "overview":
      return <OverviewView repo={repo} status={status} />;
    case "changes":
      return <ChangesView />;
    case "stashes":
      return <StashesView />;
    case "graph":
      return <GraphView />;
    case "branches":
      return <BranchesView />;
    case "prs":
      return <PRListView />;
    case "prreview":
      return <PRReviewView />;
    case "worktrees":
      return <WorktreesView />;
    case "conflicts":
      return <ConflictsView />;
    case "accounts":
      return <AccountsView />;
    case "oplog":
      return <OpLogView />;
    case "workspace":
      return <WorkspaceView />;
  }
}
