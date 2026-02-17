"use client";

import {
  BookOpen,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Diamond,
  Circle,
  Square,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExploreStore } from "@/lib/stores/explore-store";
import type {
  ChartDataPoint,
  TreatmentComparisonChart,
  DiagnosticAlgorithmChart,
} from "@/lib/firebase/functions";

/* ---------- Chart sub-components ---------- */

function BarChart({
  dataPoints,
  xLabel,
  yLabel,
  sourceCitation,
  sourceUrl,
}: {
  dataPoints: ChartDataPoint[];
  xLabel?: string;
  yLabel?: string;
  sourceCitation?: string;
  sourceUrl?: string;
}) {
  if (dataPoints.length === 0) return null;
  const maxVal = Math.max(...dataPoints.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {yLabel && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {yLabel}
        </p>
      )}
      <div className="flex items-end gap-2">
        {dataPoints.map((point) => (
          <div key={point.label} className="min-w-[52px] flex-1 text-center">
            <div className="flex h-28 items-end justify-center">
              <div
                className="w-5 rounded-t bg-primary/80 transition-all"
                style={{
                  height: `${Math.max(8, (point.value / maxVal) * 112)}px`,
                }}
                title={`${point.value}${point.unit ? ` ${point.unit}` : ""}`}
              />
            </div>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
              {point.label}
            </p>
            <p className="text-xs font-semibold">
              {point.value}
              {point.unit ? (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {" "}{point.unit}
                </span>
              ) : null}
            </p>
          </div>
        ))}
      </div>
      {xLabel && (
        <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {xLabel}
        </p>
      )}
      <ChartSource citation={sourceCitation} url={sourceUrl} />
    </div>
  );
}

function GroupedBarChart({ chart }: { chart: TreatmentComparisonChart }) {
  const colors = [
    "bg-primary/80",
    "bg-blue-500/70",
    "bg-emerald-500/70",
    "bg-amber-500/70",
  ];
  const allValues = chart.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {chart.series.map((s, i) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs">
            <span className={`inline-block h-2.5 w-2.5 rounded ${colors[i % colors.length]}`} />
            {s.name}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-3">
        {chart.categories.map((cat, ci) => (
          <div key={cat} className="min-w-[60px] flex-1 text-center">
            <div className="flex h-28 items-end justify-center gap-0.5">
              {chart.series.map((s, si) => (
                <div
                  key={s.name}
                  className={`w-3 rounded-t ${colors[si % colors.length]}`}
                  style={{
                    height: `${Math.max(6, ((s.values[ci] ?? 0) / maxVal) * 112)}px`,
                  }}
                  title={`${s.name}: ${s.values[ci] ?? 0}${chart.unit ? ` ${chart.unit}` : ""}`}
                />
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
              {cat}
            </p>
          </div>
        ))}
      </div>
      {chart.unit && (
        <p className="text-center text-[10px] text-muted-foreground">
          Values in {chart.unit}
        </p>
      )}
      <ChartSource citation={chart.sourceCitation} url={chart.sourceUrl} />
    </div>
  );
}

function AlgorithmFlowchart({ chart }: { chart: DiagnosticAlgorithmChart }) {
  if (chart.steps.length === 0) return null;

  const StepIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "decision":
        return <Diamond className="h-4 w-4 shrink-0 text-amber-500" />;
      case "endpoint":
        return <Square className="h-4 w-4 shrink-0 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 shrink-0 text-primary" />;
    }
  };

  return (
    <div className="space-y-1">
      {chart.steps.map((step, i) => (
        <div key={step.id} className="relative flex items-start gap-2 pl-2">
          {i < chart.steps.length - 1 && (
            <div className="absolute left-[17px] top-5 h-[calc(100%)] w-px bg-border" />
          )}
          <StepIcon type={step.type} />
          <div className="flex-1 pb-3">
            <p className="text-sm leading-snug">{step.label}</p>
            {step.type === "decision" && (
              <div className="mt-1 flex gap-3 text-[10px]">
                {step.yesNext && (
                  <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                    Yes <ChevronRight className="h-3 w-3" />
                  </span>
                )}
                {step.noNext && (
                  <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                    No <ChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      <ChartSource citation={chart.sourceCitation} />
    </div>
  );
}

function ChartSource({ citation, url }: { citation?: string; url?: string }) {
  if (!citation) return null;
  return (
    <div className="border-t border-border/40 pt-1.5">
      <p className="text-[10px] text-muted-foreground">
        Source: {citation}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Verify <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </p>
      <p className="text-[10px] italic text-muted-foreground/70">
        AI-generated data — verify before clinical use.
      </p>
    </div>
  );
}

/* ---------- Main Teaching Component ---------- */

interface ExploreTeachingProps {
  onStartQuiz?: () => void;
  onNewTopic?: () => void;
}

export function ExploreTeaching({ onStartQuiz, onNewTopic }: ExploreTeachingProps) {
  const store = useExploreStore();
  const { topicInsight, topic, levelLabel, reset } = store;

  if (!topicInsight) return null;

  const {
    summary,
    teachingSections,
    corePoints,
    clinicalFramework,
    chartData,
    clinicalPitfalls,
    redFlags,
    studyApproach,
    guidelineUpdates,
    citations,
  } = topicInsight;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{topic}</CardTitle>
            {levelLabel && <Badge variant="secondary">{levelLabel}</Badge>}
            <Badge variant="outline">{topicInsight.modelUsed}</Badge>
          </div>
        </CardHeader>
        {summary && (
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
          </CardContent>
        )}
      </Card>

      {/* Teaching Sections */}
      {teachingSections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {section.content && (
              <div className="space-y-2">
                {section.content.split(/\n\n+/).map((paragraph, pi) => (
                  <p key={pi} className="text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            {section.keyPoints.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  Key Points
                </p>
                <ul className="space-y-1">
                  {section.keyPoints.map((kp, ki) => (
                    <li key={ki} className="flex gap-2 text-sm">
                      <span className="mt-0.5 shrink-0 text-primary">•</span>
                      {kp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Inline chart if section matches a chart_data key */}
            {section.id === "epidemiology" && chartData.epidemiology && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {chartData.epidemiology.title}
                </p>
                <BarChart
                  dataPoints={chartData.epidemiology.dataPoints}
                  xLabel={chartData.epidemiology.xLabel}
                  yLabel={chartData.epidemiology.yLabel}
                  sourceCitation={chartData.epidemiology.sourceCitation}
                  sourceUrl={chartData.epidemiology.sourceUrl}
                />
              </div>
            )}
            {section.id === "diagnosis" && chartData.diagnosticAlgorithm && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {chartData.diagnosticAlgorithm.title}
                </p>
                <AlgorithmFlowchart chart={chartData.diagnosticAlgorithm} />
              </div>
            )}
            {section.id === "management" && chartData.treatmentComparison && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {chartData.treatmentComparison.title}
                </p>
                <GroupedBarChart chart={chartData.treatmentComparison} />
              </div>
            )}
            {section.id === "prognosis" && chartData.prognosticData && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {chartData.prognosticData.title}
                </p>
                <BarChart
                  dataPoints={chartData.prognosticData.dataPoints}
                  sourceCitation={chartData.prognosticData.sourceCitation}
                  sourceUrl={chartData.prognosticData.sourceUrl}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Charts that weren't inlined in a matching section */}
      {chartData.epidemiology && !teachingSections.some((s) => s.id === "epidemiology") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{chartData.epidemiology.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              dataPoints={chartData.epidemiology.dataPoints}
              xLabel={chartData.epidemiology.xLabel}
              yLabel={chartData.epidemiology.yLabel}
              sourceCitation={chartData.epidemiology.sourceCitation}
              sourceUrl={chartData.epidemiology.sourceUrl}
            />
          </CardContent>
        </Card>
      )}
      {chartData.treatmentComparison && !teachingSections.some((s) => s.id === "management") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{chartData.treatmentComparison.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart chart={chartData.treatmentComparison} />
          </CardContent>
        </Card>
      )}
      {chartData.diagnosticAlgorithm && !teachingSections.some((s) => s.id === "diagnosis") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{chartData.diagnosticAlgorithm.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <AlgorithmFlowchart chart={chartData.diagnosticAlgorithm} />
          </CardContent>
        </Card>
      )}
      {chartData.prognosticData && !teachingSections.some((s) => s.id === "prognosis") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{chartData.prognosticData.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              dataPoints={chartData.prognosticData.dataPoints}
              sourceCitation={chartData.prognosticData.sourceCitation}
              sourceUrl={chartData.prognosticData.sourceUrl}
            />
          </CardContent>
        </Card>
      )}

      {/* Core Points */}
      {corePoints.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Core Points</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {corePoints.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 font-semibold text-primary">
                    {i + 1}.
                  </span>
                  {point}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Clinical Framework */}
      {(clinicalFramework.pathophysiology ||
        clinicalFramework.diagnosticApproach.length > 0 ||
        clinicalFramework.managementApproach.length > 0 ||
        clinicalFramework.escalationTriggers.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clinical Framework</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {clinicalFramework.pathophysiology && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Pathophysiology
                </p>
                <div className="space-y-2">
                  {clinicalFramework.pathophysiology.split(/\n\n+/).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            )}
            {clinicalFramework.diagnosticApproach.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Diagnostic Approach
                </p>
                <ol className="space-y-1">
                  {clinicalFramework.diagnosticApproach.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {clinicalFramework.managementApproach.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Management Approach
                </p>
                <ol className="space-y-1">
                  {clinicalFramework.managementApproach.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {clinicalFramework.escalationTriggers.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                  Escalation Triggers
                </p>
                <ul className="space-y-1">
                  {clinicalFramework.escalationTriggers.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-red-700 dark:text-red-300">
                      <span className="mt-0.5 shrink-0">!</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pitfalls & Red Flags */}
      {(clinicalPitfalls.length > 0 || redFlags.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {clinicalPitfalls.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mr-1.5 inline h-4 w-4" />
                  Clinical Pitfalls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1.5">
                  {clinicalPitfalls.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">
                        {i + 1}.
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
          {redFlags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-600 dark:text-red-400">
                  Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1.5">
                  {redFlags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="shrink-0 font-semibold text-red-600 dark:text-red-400">
                        {i + 1}.
                      </span>
                      {f}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Study Approach */}
      {studyApproach.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-600 dark:text-green-400">
              Study Approach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {studyApproach.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 font-semibold text-green-600 dark:text-green-400">
                    {i + 1}.
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Guideline Updates */}
      {guidelineUpdates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {guidelineUpdates.map((g, i) => (
              <a
                key={`${g.source}-${i}`}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {g.year && <Badge variant="outline" className="text-[10px]">{g.year}</Badge>}
                  <Badge variant="secondary" className="text-[10px]">{g.source}</Badge>
                  <Badge
                    variant={g.strength === "HIGH" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {g.strength}
                  </Badge>
                  <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm font-medium">{g.title}</p>
                {g.keyChange && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.keyChange}</p>
                )}
                {g.practiceImpact && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    Impact: {g.practiceImpact}
                  </p>
                )}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Citations */}
      {(citations?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {citations?.map((c, i) => (
              <a
                key={`${c.url}-${i}`}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded p-1.5 text-sm transition-colors hover:bg-muted/40"
              >
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {c.source}
                </Badge>
                <span className="flex-1 truncate">{c.title}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </a>
            ))}
            <p className="mt-3 border-t border-border/40 pt-2.5 text-[11px] italic text-muted-foreground/70">
              Links open search results — verify specific articles before clinical use.
            </p>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button onClick={onStartQuiz ?? (() => store.goToQuizFromTeaching())} className="gap-2">
          Start Quiz <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onNewTopic ?? reset}>
          New Topic
        </Button>
      </div>
    </div>
  );
}
