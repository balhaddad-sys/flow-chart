# Adaptive Planner Research Notes

## Why the old planner felt generic

The previous scheduler mainly optimized for:

- section order
- daily capacity
- fixed review offsets

That made it operationally correct, but not meaningfully adaptive. It did not use weak-topic data, exam emphasis, retrieval timing, or interleaving logic when deciding what should come first.

## Research-backed changes implemented

### 1. Retrieval should be scheduled, not left to chance

- Repeated retrieval outperforms repeated study for durable retention.
- In medical education, repeated testing with feedback also beats repeated study over longer horizons.

Implementation:

- Question tasks are now treated as retrieval events, not just extra workload.
- Hard or weak topics get a short retrieval gap before their question block instead of always being placed immediately.

Sources:

- Karpicke JD, Roediger HL. *The critical importance of retrieval for learning.* Science. 2008. https://pubmed.ncbi.nlm.nih.gov/18276894/
- Larsen DP, Butler AC, Roediger HL. *Repeated testing improves long-term retention relative to repeated study: a randomised controlled trial.* Med Educ. 2009. https://pubmed.ncbi.nlm.nih.gov/19930508/

### 2. Spacing should adapt to retention horizon

- Optimal spacing depends on how long the learner needs to remember material.
- Practice scheduling can be improved with quantitative models instead of fixed intervals alone.

Implementation:

- The scheduler now uses exam proximity as an urgency signal when ranking work.
- Existing FSRS review generation stays in place, but initial plan creation now also uses adaptive spacing logic for question timing.

Sources:

- Cepeda NJ et al. *Spacing effects in learning: a temporal ridgeline of optimal retention.* Psychol Sci. 2008. https://pubmed.ncbi.nlm.nih.gov/19076480/
- Pavlik PI, Anderson JR. *Using a model to compute the optimal schedule of practice.* J Exp Psychol Appl. 2008. https://pubmed.ncbi.nlm.nih.gov/18590367/

### 3. Interleaving improves discrimination and transfer

- Interleaving helps learners choose the right strategy from the problem itself instead of pattern-matching from blocked repetition.

Implementation:

- Adaptive mode no longer blindly follows strict section order.
- It uses a local lookahead window so nearby weak/high-yield topics can move earlier while still preserving course continuity.
- It also penalizes repeating the same topic back-to-back when selecting the next study task.

Source:

- Rohrer D, Dedrick RF, Stershic S. *Interleaved Practice Improves Mathematics Learning.* J Educ Psychol. 2015. PDF mirror: https://files.eric.ed.gov/fulltext/ED557355.pdf

### 4. Spaced education has direct medical-education evidence

- Spaced delivery improves topic-specific learning and can improve long-term retention in medical training environments.

Implementation:

- Auto-generated plans now use the same adaptive logic as manual regeneration, so the first plan benefits too.

Source:

- Kerfoot BP, Brotschi E. *Online spaced education to teach urology to medical students: a multi-institutional randomized trial.* Am J Surg. 2009. https://pubmed.ncbi.nlm.nih.gov/18614145/

## What changed in code

- `functions/scheduling/scheduler.js`
  - Added adaptive planning context construction.
  - Added weakness-aware, exam-aware, and high-yield-aware scoring.
  - Added local interleaving for study task ordering.
  - Added delayed question placement for hard/weak topics.
  - Added task rationale/focus metadata and more specific task titles.
- `functions/scheduling/generateSchedule.js`
  - Now builds adaptive context from course exam type and weakness stats.
- `functions/scheduling/autoSchedule.js`
  - Uses the same adaptive context during automatic plan creation.
- `medq-web/src/components/planner/task-row.tsx`
  - Surfaces adaptive rationale in the planner UI.

## Next improvements worth doing

- Use recent attempt history per section, not just top weak topics, when computing priority.
- Track estimate accuracy (`actualMinutes` vs `estMinutes`) and adapt future task duration.
- Add explicit mastery thresholds so some sections schedule more retrieval before new coverage is unlocked.
- Add time-of-day preferences so hard tasks land in peak-focus windows.
- Show a plan summary card explaining why certain topics were front-loaded.
