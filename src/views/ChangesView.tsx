import { VerticalResizeHandle } from "../components/layout/VerticalResizeHandle";
import { ChangesDiffPanel } from "../features/changes/ChangesDiffPanel";
import { ChangesFilePanel } from "../features/changes/ChangesFilePanel";
import { CommitComposer } from "../features/changes/CommitComposer";
import { CommitSafetyDialogs } from "../features/changes/CommitSafetyDialogs";
import { useChangesViewModel } from "../features/changes/useChangesViewModel";

export function ChangesView() {
  const vm = useChangesViewModel();
  return (
    <div className="flex min-h-0 flex-1">
      <ChangesFilePanel
        width={vm.app.changesPanelW}
        filter={vm.fileFilter}
        unstaged={vm.unstaged}
        staged={vm.staged}
        unstagedTotal={vm.unstagedTotal}
        stagedTotal={vm.stagedTotal}
        stagingPendingCount={vm.stagingPendingCount}
        selectedUnstaged={vm.app.selUnstaged}
        selectedStaged={vm.app.selStaged}
        stashOpen={vm.stashOpen}
        stashMessage={vm.stashMessage}
        stashUntracked={vm.stashUntracked}
        stashBusy={vm.stashPush.isPending}
        onFilterChange={vm.setFileFilter}
        onToggleStash={() => vm.setStashOpen((value) => !value)}
        onStashMessageChange={vm.setStashMessage}
        onStashUntrackedChange={vm.setStashUntracked}
        onStash={() => void vm.doStash()}
        onSelectUnstaged={(index) => vm.set({ selUnstaged: index, selStaged: -1 })}
        onSelectStaged={(index) => vm.set({ selStaged: index, selUnstaged: -1 })}
        onStage={vm.stageFiles}
        onUnstage={vm.unstageFiles}
      >
        <CommitComposer
          identity={vm.identity}
          branch={vm.status?.branch}
          message={vm.message}
          template={vm.commitTemplate ?? undefined}
          stagedCount={vm.stagedTotal}
          amend={vm.amend}
          sign={vm.sign}
          pushAfter={vm.pushAfter}
          pushAfterDisabled={vm.pushAfterDisabled}
          pushAfterDescription={vm.pushAfterDescription}
          busy={vm.commit.isPending}
          undoBusy={vm.undoCommit.isPending}
          error={vm.commitError}
          onMessageChange={vm.setMessage}
          onCommit={() => void vm.doCommit()}
          onAmendChange={vm.setAmend}
          onSignChange={vm.setSign}
          onPushAfterChange={vm.setPushAfter}
          onUndo={() => void vm.requestUndo()}
        />
      </ChangesFilePanel>
      <VerticalResizeHandle
        label="Resize changes panel"
        onMouseDown={vm.beginPanelResize}
        onDoubleClick={() => vm.set({ changesPanelW: 290 })}
      />
      <ChangesDiffPanel
        repoPath={vm.repo?.path}
        file={vm.selectedFile}
        diff={vm.diff}
        mode={vm.app.diffMode}
        selectedLines={vm.selectedLines}
        patchBusy={vm.applyPatch.isPending}
        onModeChange={(diffMode) => vm.set({ diffMode })}
        onApplySelectedLines={() => void vm.applySelectedLines()}
        onApplyHunk={vm.applyHunk}
        onToggleLine={vm.toggleLine}
        onDiscard={() =>
          vm.selectedFile && vm.set({ discardOpen: true, discardPath: vm.selectedFile.path })
        }
      />
      <CommitSafetyDialogs
        undoPreview={vm.undoPreview}
        amendPreview={vm.amendPreview}
        undoBusy={vm.undoCommit.isPending}
        amendBusy={vm.commit.isPending}
        onCancelUndo={() => vm.setUndoPreview(null)}
        onConfirmUndo={() => void vm.confirmUndo()}
        onCancelAmend={() => vm.setAmendPreview(null)}
        onConfirmAmend={() => {
          vm.setAmendPreview(null);
          void vm.performCommit(true);
        }}
      />
    </div>
  );
}
