"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const shortcutGroups = [
  {
    title: "General",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open search" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialog / Go back" },
    ],
  },
  {
    title: "Quiz",
    shortcuts: [
      { keys: ["A", "–", "D"], description: "Select answer option" },
      { keys: ["1", "–", "4"], description: "Select answer (numeric)" },
      { keys: ["Enter"], description: "Next question / Finish quiz" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Jump to any page" },
    ],
  },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in-scale">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/50 transition-colors"
            aria-label="Close shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-foreground/80">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) =>
                        key === "–" ? (
                          <span key={j} className="text-xs text-muted-foreground">
                            –
                          </span>
                        ) : (
                          <kbd
                            key={j}
                            className="min-w-[24px] rounded border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-xs text-muted-foreground"
                          >
                            {key}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground/50">
          Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-xs">?</kbd> to
          toggle this overlay
        </p>
      </div>
    </div>
  );
}
