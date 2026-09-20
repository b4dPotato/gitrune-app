import { useCallback } from "react";
import { useToast } from "../components/Toast";

export interface OperationFeedback {
  success: boolean;
  stderr?: string;
}

/** Consistent success/error feedback for every typed Git mutation. */
export function useOperationRunner() {
  const toast = useToast();

  return useCallback(
    async <T extends OperationFeedback>(request: Promise<T>, successMessage: string) => {
      try {
        const result = await request;
        toast(
          result.success ? successMessage : result.stderr || "Git operation failed",
          result.success ? "ok" : "error",
        );
        return result.success;
      } catch (error) {
        toast(error, "error");
        return false;
      }
    },
    [toast],
  );
}
