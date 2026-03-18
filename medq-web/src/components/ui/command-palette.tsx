"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Library,
  CircleHelp,
  Sparkles,
  Compass,
  CalendarDays,
  BarChart3,
  Upload,
  BookOpenCheck,
  User,
  Search,
  ArrowRight,
  Command,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: typeof Home;
  href: string;
  shortcut?: string;
}

const commands: CommandItem[] = [
  { id: "home", label: "Home", group: "Pages", icon: Home, href: "/today" },
  { id: "library", label: "Library", group: "Pages", icon: Library, href: "/library" },
  { id: "quiz", label: "Quiz", group: "Pages", icon: CircleHelp, href: "/practice" },
  { id: "exam-bank", label: "Exam Bank", group: "Pages", icon: BookOpenCheck, href: "/practice/exam-bank" },
  { id: "planner", label: "Planner", group: "Pages", icon: CalendarDays, href: "/today/plan" },
  { id: "analytics", label: "Analytics", group: "Pages", icon: BarChart3, href: "/today/analytics" },
  { id: "ai-chat", label: "AI Chat", group: "Pages", icon: Sparkles, href: "/ai" },
  { id: "explore", label: "Explore", group: "Pages", icon: Compass, href: "/ai/explore" },
  { id: "profile", label: "Settings", group: "Pages", icon: User, href: "/profile" },
  { id: "upload", label: "Upload File", group: "Actions", icon: Upload, href: "/library" },
  { id: "start-quiz", label: "Start Quiz", group: "Actions", icon: CircleHelp, href: "/practice" },
  { id: "ask-ai", label: "Ask AI", group: "Actions", icon: Sparkles, href: "/ai" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      const g = groups.get(item.group) || [];
      g.push(item);
      groups.set(item.group, g);
    });
    return groups;
  }, [filtered]);

  const flatItems = useMemo(() => filtered, [filtered]);

  useEffect(() => setSelectedIndex(0), [query]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery("");
      router.push(item.href);
    },
    [router]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatItems[selectedIndex]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatItems, selectedIndex, handleSelect]);

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          setOpen(false);
          setQuery("");
        }}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in-scale">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-2">
          {flatItems.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No results found</p>
          )}
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group}>
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
                {group}
              </p>
              {items.map((item) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedIndex === idx
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-xs">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-xs">↵</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />K to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
