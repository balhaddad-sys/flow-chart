"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Loader2,
  Network,
  ArrowRightLeft,
  TableProperties,
  GitBranch,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/useAuth";
import { getAuth } from "firebase/auth";

/* ─── Types ────────────────────────────────────────────────────────── */

interface ConceptMapNode {
  id: string;
  label: string;
  category: "primary" | "secondary" | "tertiary";
  color: string;
}
interface ConceptMapEdge {
  from: string;
  to: string;
  label: string;
}
interface ConceptMapData {
  nodes: ConceptMapNode[];
  edges: ConceptMapEdge[];
}

interface ProcessStep {
  id: string;
  label: string;
  detail: string;
  type: "start" | "step" | "decision" | "end";
  color: string;
}
interface ProcessConnection {
  from: string;
  to: string;
  label?: string;
}
interface ProcessFlowData {
  steps: ProcessStep[];
  connections: ProcessConnection[];
}

interface ComparisonTableData {
  columns: string[];
  rows: string[][];
  highlights?: { row: number; col: number; color: string }[];
}

interface HierarchyNode {
  label: string;
  color: string;
  children?: HierarchyNode[];
}
interface HierarchyData {
  root: HierarchyNode;
}

interface TimelineEvent {
  label: string;
  detail: string;
  time: string;
  color: string;
}
interface TimelineData {
  events: TimelineEvent[];
}

interface Visual {
  type: "concept_map" | "process_flow" | "comparison_table" | "hierarchy" | "timeline";
  title: string;
  description: string;
  data: ConceptMapData | ProcessFlowData | ComparisonTableData | HierarchyData | TimelineData;
}

interface VisualLearnerProps {
  sectionTitle?: string;
  sectionText: string | null;
  blueprint?: {
    keyConcepts?: string[];
    learningObjectives?: string[];
    highYieldPoints?: string[];
  } | null;
  topicTags?: string[];
}

/* ─── Color Utilities ──────────────────────────────────────────────── */

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-800",     text: "text-blue-700 dark:text-blue-300",     dot: "bg-blue-500" },
  red:    { bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-800",       text: "text-red-700 dark:text-red-300",       dot: "bg-red-500" },
  green:  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/30",   border: "border-orange-200 dark:border-orange-800",   text: "text-orange-700 dark:text-orange-300",   dot: "bg-orange-500" },
  purple: { bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-violet-200 dark:border-violet-800",   text: "text-violet-700 dark:text-violet-300",   dot: "bg-violet-500" },
  gray:   { bg: "bg-gray-50 dark:bg-gray-900/40",     border: "border-gray-200 dark:border-gray-700",     text: "text-gray-700 dark:text-gray-300",     dot: "bg-gray-500" },
};

function c(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.gray;
}

const TYPE_ICON: Record<string, typeof Network> = {
  concept_map: Network,
  process_flow: ArrowRightLeft,
  comparison_table: TableProperties,
  hierarchy: GitBranch,
  timeline: Clock,
};

const TYPE_LABEL: Record<string, string> = {
  concept_map: "Concept Map",
  process_flow: "Process Flow",
  comparison_table: "Comparison",
  hierarchy: "Classification",
  timeline: "Timeline",
};

/* ─── Loading Phases ───────────────────────────────────────────────── */

const LOADING_PHASES = [
  "Analyzing section content",
  "Identifying visual relationships",
  "Designing diagrams",
  "Rendering visual aids",
];

function LoadingState() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((p) => Math.min(p + 1, LOADING_PHASES.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in">
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-100 to-blue-100 dark:from-teal-900/40 dark:to-blue-900/40 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-teal-600 dark:text-teal-400 animate-pulse" />
        </div>
        <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 text-teal-500 animate-spin" />
      </div>
      <p className="text-sm font-medium mb-1.5">Creating visual aids</p>
      <div className="flex flex-col gap-1.5 mt-2">
        {LOADING_PHASES.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 text-xs transition-all duration-500 ${
              i < phase ? "text-teal-600 dark:text-teal-400" :
              i === phase ? "text-foreground font-medium" :
              "text-muted-foreground/50"
            }`}
          >
            <div className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
              i < phase ? "bg-teal-500 scale-100" :
              i === phase ? "bg-foreground scale-125" :
              "bg-muted-foreground/30 scale-75"
            }`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Concept Map Renderer ─────────────────────────────────────────── */

function ConceptMapVisual({ data }: { data: ConceptMapData }) {
  const { nodes, edges } = data;
  if (!nodes?.length) return null;

  // Build adjacency for layout
  const primary = nodes.filter((n) => n.category === "primary");
  const secondary = nodes.filter((n) => n.category === "secondary");
  const tertiary = nodes.filter((n) => n.category === "tertiary");
  const layers = [primary, secondary, tertiary].filter((l) => l.length > 0);

  return (
    <div className="space-y-4">
      {/* Nodes by layer */}
      {layers.map((layer, li) => (
        <div key={li} className="flex flex-wrap justify-center gap-2.5">
          {layer.map((node) => {
            const col = c(node.color);
            const isCenter = node.category === "primary";
            return (
              <div
                key={node.id}
                className={`
                  relative rounded-xl border px-3.5 py-2 text-center transition-all
                  ${col.bg} ${col.border}
                  ${isCenter ? "ring-2 ring-offset-1 ring-teal-500/30 dark:ring-offset-gray-950 shadow-sm" : ""}
                `}
              >
                <span className={`text-xs font-semibold ${col.text}`}>
                  {node.label}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Edges as labeled connections */}
      {edges?.length > 0 && (
        <div className="mt-3 space-y-1.5 px-2">
          {edges.map((edge, i) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`font-medium ${c(fromNode.color).text}`}>{fromNode.label}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="h-px w-4 bg-muted-foreground/40" />
                  <span className="italic text-[11px] text-muted-foreground/80 max-w-[120px] truncate">{edge.label}</span>
                  <span className="h-px w-3 bg-muted-foreground/40" />
                  <span className="text-muted-foreground/60">&rarr;</span>
                </span>
                <span className={`font-medium ${c(toNode.color).text}`}>{toNode.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Process Flow Renderer ────────────────────────────────────────── */

function ProcessFlowVisual({ data }: { data: ProcessFlowData }) {
  const { steps, connections } = data;
  if (!steps?.length) return null;

  // Order steps by connections for linear display
  const ordered = orderSteps(steps, connections);

  return (
    <div className="flex flex-col items-center gap-0">
      {ordered.map((step, i) => {
        const col = c(step.color);
        const isDecision = step.type === "decision";
        const isEnd = step.type === "end";
        const conn = connections?.find((cn) => cn.from === step.id);
        const connLabel = conn?.label;

        return (
          <div key={step.id} className="flex flex-col items-center w-full">
            <div
              className={`
                relative w-full max-w-sm border px-4 py-3 text-center transition-all
                ${col.bg} ${col.border}
                ${isDecision ? "rotate-0 rounded-xl border-dashed border-2" : "rounded-xl"}
                ${isEnd ? "ring-2 ring-offset-1 ring-emerald-500/30 dark:ring-offset-gray-950" : ""}
              `}
            >
              {isDecision && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-400 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                  Decision
                </span>
              )}
              <p className={`text-xs font-semibold ${col.text}`}>{step.label}</p>
              {step.detail && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{step.detail}</p>
              )}
            </div>
            {i < ordered.length - 1 && (
              <div className="flex flex-col items-center py-1">
                <div className="w-px h-4 bg-muted-foreground/25" />
                {connLabel && (
                  <span className="text-[10px] text-muted-foreground/70 italic px-2 py-0.5">{connLabel}</span>
                )}
                <div className="text-muted-foreground/40 text-[10px]">&#9660;</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function orderSteps(steps: ProcessStep[], connections: ProcessConnection[]): ProcessStep[] {
  if (!connections?.length) return steps;
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const hasIncoming = new Set(connections.map((c) => c.to));
  let current = steps.find((s) => !hasIncoming.has(s.id)) ?? steps[0];
  const ordered: ProcessStep[] = [];
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ordered.push(current);
    const next = connections.find((c) => c.from === current!.id);
    current = next ? stepMap.get(next.to) ?? undefined! : undefined!;
  }
  // Add any unvisited steps
  for (const s of steps) {
    if (!visited.has(s.id)) ordered.push(s);
  }
  return ordered;
}

/* ─── Comparison Table Renderer ────────────────────────────────────── */

function ComparisonTableVisual({ data }: { data: ComparisonTableData }) {
  const { columns, rows, highlights } = data;
  if (!columns?.length || !rows?.length) return null;

  const highlightMap = new Map<string, string>();
  highlights?.forEach((h) => highlightMap.set(`${h.row}-${h.col}`, h.color));

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map((col, ci) => (
              <th
                key={ci}
                className={`
                  px-3 py-2.5 text-left font-semibold border-b-2 border-border/80
                  ${ci === 0 ? "bg-muted/60 rounded-tl-lg sticky left-0 z-10" : "bg-muted/30"}
                `}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/30 last:border-0">
              {row.map((cell, ci) => {
                const hlColor = highlightMap.get(`${ri}-${ci}`);
                const col = hlColor ? c(hlColor) : null;
                return (
                  <td
                    key={ci}
                    className={`
                      px-3 py-2.5 leading-snug
                      ${ci === 0 ? "font-medium bg-muted/30 sticky left-0 z-10" : ""}
                      ${col ? `${col.bg} ${col.text} font-medium` : ""}
                    `}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Hierarchy Renderer ───────────────────────────────────────────── */

function HierarchyVisual({ data }: { data: HierarchyData }) {
  if (!data?.root) return null;

  function renderNode(node: HierarchyNode, depth: number): React.ReactNode {
    const col = c(node.color);
    const hasChildren = node.children && node.children.length > 0;
    return (
      <div key={node.label} className={depth > 0 ? "ml-4 sm:ml-6" : ""}>
        <div className="flex items-start gap-2 py-1">
          {depth > 0 && (
            <div className="flex flex-col items-center mt-1.5 shrink-0">
              <div className="w-3 h-px bg-muted-foreground/25" />
            </div>
          )}
          <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${col.bg} ${col.border}`}>
            <div className={`h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
            <span className={`text-xs font-medium ${col.text}`}>{node.label}</span>
          </div>
        </div>
        {hasChildren && (
          <div className="border-l border-muted-foreground/15 ml-2 sm:ml-3">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return <div className="py-1">{renderNode(data.root, 0)}</div>;
}

/* ─── Timeline Renderer ────────────────────────────────────────────── */

function TimelineVisual({ data }: { data: TimelineData }) {
  const { events } = data;
  if (!events?.length) return null;

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-teal-300 via-muted-foreground/20 to-muted-foreground/10 dark:from-teal-700" />

      <div className="space-y-4">
        {events.map((event, i) => {
          const col = c(event.color);
          return (
            <div key={i} className="relative">
              {/* Dot */}
              <div className={`absolute -left-6 top-2.5 h-3 w-3 rounded-full border-2 border-background ${col.dot}`} />
              <div className={`rounded-xl border px-3.5 py-2.5 ${col.bg} ${col.border}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{event.time}</span>
                </div>
                <p className={`text-xs font-semibold ${col.text}`}>{event.label}</p>
                {event.detail && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{event.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Visual Card Wrapper ──────────────────────────────────────────── */

function VisualCard({ visual, index }: { visual: Visual; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = TYPE_ICON[visual.type] ?? Eye;
  const typeLabel = TYPE_LABEL[visual.type] ?? visual.type;

  const renderContent = () => {
    switch (visual.type) {
      case "concept_map":
        return <ConceptMapVisual data={visual.data as ConceptMapData} />;
      case "process_flow":
        return <ProcessFlowVisual data={visual.data as ProcessFlowData} />;
      case "comparison_table":
        return <ComparisonTableVisual data={visual.data as ComparisonTableData} />;
      case "hierarchy":
        return <HierarchyVisual data={visual.data as HierarchyData} />;
      case "timeline":
        return <TimelineVisual data={visual.data as TimelineData} />;
      default:
        return <p className="text-xs text-muted-foreground">Unsupported visual type.</p>;
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-card overflow-hidden transition-all animate-in stagger-${Math.min(index + 1, 4)}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-teal-100 dark:bg-teal-900/40 shrink-0">
          <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate">{visual.title}</h4>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 bg-muted/60 px-2 py-0.5 rounded-full">
              {typeLabel}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{visual.description}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/30">
          {renderContent()}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */

export function VisualLearner({ sectionTitle, sectionText, blueprint, topicTags }: VisualLearnerProps) {
  const { user } = useAuth();
  const [visuals, setVisuals] = useState<Visual[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    if (!sectionText || !sectionTitle || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const concepts = [
        ...(blueprint?.keyConcepts ?? []),
        ...(blueprint?.learningObjectives ?? []).slice(0, 3),
      ];

      let idToken = await user?.getIdToken();
      const body = JSON.stringify({
        title: sectionTitle,
        sectionText: sectionText.slice(0, 12000),
        concepts,
        topicTags: topicTags ?? [],
      });

      let res = await fetch("/api/visual-learn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body,
        signal: controller.signal,
      });

      if (res.status === 401 && user) {
        idToken = await user.getIdToken(true);
        res = await fetch("/api/visual-learn", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body,
          signal: controller.signal,
        });
      }

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate visuals.");
      }

      const data = json.data as { visuals?: Visual[] };
      if (!data.visuals?.length) {
        throw new Error("No visual aids could be generated for this content.");
      }

      if (!controller.signal.aborted) {
        setVisuals(data.visuals);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to generate visuals.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [sectionText, sectionTitle, loading, user, blueprint, topicTags]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Auto-generate when text is available
  useEffect(() => {
    if (sectionText && sectionTitle && !visuals && !loading && !error) {
      generate();
    }
  }, [sectionText, sectionTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingState />;

  if (visuals?.length) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-medium text-muted-foreground">
              {visuals.length} visual aid{visuals.length > 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs rounded-full"
            onClick={() => {
              setVisuals(null);
              setError(null);
              setTimeout(generate, 50);
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
        </div>
        {visuals.map((visual, i) => (
          <VisualCard key={`${visual.type}-${i}`} visual={visual} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-100 to-blue-100 dark:from-teal-900/40 dark:to-blue-900/40 mb-4">
        <Eye className="h-6 w-6 text-teal-600 dark:text-teal-400" />
      </div>
      <p className="text-sm font-medium">Visual Learning Aids</p>
      <p className="mt-1.5 mb-5 text-xs text-muted-foreground max-w-[280px] leading-relaxed">
        AI-generated diagrams, concept maps, flowcharts, and comparison tables for this section.
      </p>
      {error && (
        <p className="mb-3 max-w-xs text-xs text-destructive">{error}</p>
      )}
      <Button
        onClick={generate}
        disabled={loading || !sectionText}
        className="rounded-full px-5"
        size="sm"
      >
        <Eye className="mr-1.5 h-3.5 w-3.5" />
        Generate Visuals
      </Button>
      {!sectionText && (
        <p className="mt-3 text-xs text-muted-foreground">Section text must be loaded first.</p>
      )}
    </div>
  );
}
