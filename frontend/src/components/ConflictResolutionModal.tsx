import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { AlertCircle, X, RotateCcw, Send } from "lucide-react";
import { syncManager } from "../services/syncManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConflictData {
  id: string;
  batchId: string;
  /** The local (offline) state the user was trying to push */
  data?: Record<string, unknown>;
  /** Details returned by the conflict-detection middleware */
  conflictDetails?: {
    reason?: string;
    serverState?: Record<string, unknown>;
    onChainState?: Record<string, unknown>;
  };
}

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: ConflictData;
  /** Called after the conflict has been resolved (discard or resubmit) */
  onResolve: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pretty-print a JS object for the diff panel */
const JsonBlock: React.FC<{ data: unknown }> = ({ data }) => (
  <pre className="text-xs font-mono bg-gray-900/60 text-green-300 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap break-words">
    {JSON.stringify(data ?? {}, null, 2)}
  </pre>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConflictResolutionModal: React.FC<
  ConflictResolutionModalProps
> = ({ open, onOpenChange, conflict, onResolve }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<string>(
    JSON.stringify(conflict.data ?? {}, null, 2),
  );
  const [mode, setMode] = useState<"review" | "edit">("review");

  const serverState =
    conflict.conflictDetails?.serverState ??
    conflict.conflictDetails?.onChainState ??
    {};

  // ── Discard local changes ──────────────────────────────────────────────
  const handleDiscard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await syncManager.discardPendingUpdate(conflict.id);
      onResolve();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to discard update.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Edit & Resubmit ───────────────────────────────────────────────────
  const handleResubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const parsed = JSON.parse(editedData);
      await syncManager.resubmitWithResolution(conflict.id, parsed);
      onResolve();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to resubmit. Check JSON syntax.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel */}
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-50
            -translate-x-1/2 -translate-y-1/2
            w-full max-w-2xl max-h-[90vh] overflow-y-auto
            bg-gray-800 border border-orange-500/40 rounded-2xl shadow-2xl
            focus:outline-none
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
          "
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-orange-900/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 shrink-0" />
              <div>
                <Dialog.Title className="text-base font-semibold text-white">
                  {t("sync.conflictTitle", "Sync Conflict Detected")}
                </Dialog.Title>
                <p className="text-xs text-gray-400 mt-0.5">
                  Batch&nbsp;
                  <span className="font-mono text-orange-300">
                    {conflict.batchId}
                  </span>
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                aria-label={t("common.close", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* ── Reason Banner ── */}
          {conflict.conflictDetails?.reason && (
            <div className="mx-6 mt-4 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm text-orange-300">
              ⚠️&nbsp;{conflict.conflictDetails.reason}
            </div>
          )}

          {/* ── Mode tabs ── */}
          <div className="flex gap-2 px-6 mt-4">
            {(["review", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  mode === m
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                {m === "review"
                  ? t("sync.reviewChanges", "Review Changes")
                  : t("sync.editResubmit", "Edit & Resubmit")}
              </button>
            ))}
          </div>

          {/* ── Body ── */}
          <div className="px-6 py-4 space-y-4">
            {mode === "review" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Local state */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t("sync.yourLocalState", "Your Local Changes")}
                  </p>
                  <JsonBlock data={conflict.data} />
                </div>
                {/* Server / on-chain state */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t("sync.serverState", "Current Server State")}
                  </p>
                  <JsonBlock data={serverState} />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {t("sync.editPayload", "Edit payload before resubmitting")}
                </p>
                <textarea
                  value={editedData}
                  onChange={(e) => setEditedData(e.target.value)}
                  spellCheck={false}
                  rows={12}
                  className="w-full font-mono text-xs bg-gray-900/60 text-green-300 border border-gray-600 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="flex flex-col sm:flex-row gap-2 px-6 pb-5">
            <button
              onClick={handleDiscard}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {t("sync.discardLocal", "Discard My Changes")}
            </button>

            <button
              onClick={handleResubmit}
              disabled={isLoading || mode === "review"}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              title={mode === "review" ? "Switch to Edit tab first" : undefined}
            >
              <Send className="h-4 w-4" />
              {isLoading
                ? t("common.loading", "Loading...")
                : t("sync.resubmit", "Resubmit Changes")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ConflictResolutionModal;
