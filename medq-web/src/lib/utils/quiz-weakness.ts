import type { QuestionModel } from "@/lib/types/question";

export interface TopicWeakness {
  tag: string;
  rawTag: string;
  attempted: number;
  correct: number;
  accuracy: number;
  weaknessScore: number;
  severity: "CRITICAL" | "REINFORCE" | "STRONG";
}

export interface QuizWeaknessProfile {
  topics: TopicWeakness[];
  totalAnswered: number;
  totalCorrect: number;
  overallAccuracy: number;
  hasEnoughData: boolean;
  unansweredCount: number;
}

function formatTag(raw: string): string {
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

interface TopicAccum {
  rawTag: string;
  attempted: number;
  correct: number;
  missedDifficultySum: number;
  missedCount: number;
}

export function computeQuizWeakness(
  questions: QuestionModel[],
  results: Map<string, boolean>,
  answers: Map<string, number>,
): QuizWeaknessProfile {
  const totalAnswered = answers.size;
  const totalCorrect = Array.from(results.values()).filter(Boolean).length;
  const unansweredCount = questions.length - totalAnswered;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  if (totalAnswered < 2) {
    return { topics: [], totalAnswered, totalCorrect, overallAccuracy, hasEnoughData: false, unansweredCount };
  }

  const topicMap = new Map<string, TopicAccum>();

  for (const q of questions) {
    if (!answers.has(q.id)) continue;
    const isCorrect = results.get(q.id) === true;
    const tags = q.topicTags.length > 0 ? q.topicTags : ["General"];

    for (const raw of tags) {
      const key = raw.toLowerCase();
      let entry = topicMap.get(key);
      if (!entry) {
        entry = { rawTag: raw, attempted: 0, correct: 0, missedDifficultySum: 0, missedCount: 0 };
        topicMap.set(key, entry);
      }
      entry.attempted++;
      if (isCorrect) {
        entry.correct++;
      } else {
        entry.missedDifficultySum += Math.max(1, Math.min(5, q.difficulty || 3));
        entry.missedCount++;
      }
    }
  }

  const topics: TopicWeakness[] = [];

  for (const entry of topicMap.values()) {
    const accuracy = entry.attempted > 0 ? entry.correct / entry.attempted : 0;
    const avgMissedDifficulty = entry.missedCount > 0 ? entry.missedDifficultySum / entry.missedCount : 0;
    const difficultyWeight = avgMissedDifficulty / 5;
    const weaknessScore = 0.7 * (1 - accuracy) + 0.3 * difficultyWeight;
    const severity: TopicWeakness["severity"] =
      weaknessScore >= 0.6 ? "CRITICAL" : weaknessScore >= 0.35 ? "REINFORCE" : "STRONG";

    topics.push({
      tag: formatTag(entry.rawTag),
      rawTag: entry.rawTag,
      attempted: entry.attempted,
      correct: entry.correct,
      accuracy: Math.round(accuracy * 100),
      weaknessScore,
      severity,
    });
  }

  topics.sort((a, b) => b.weaknessScore - a.weaknessScore);

  return { topics, totalAnswered, totalCorrect, overallAccuracy, hasEnoughData: true, unansweredCount };
}
