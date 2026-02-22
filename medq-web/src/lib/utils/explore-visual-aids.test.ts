import {
  buildExploreVisualAidQueries,
  extractExploreVisualTargets,
  shouldShowExploreVisualAids,
} from "./explore-visual-aids";

describe("explore visual aids", () => {
  it("enables visual aids for anatomy-heavy topics", () => {
    const shouldShow = shouldShowExploreVisualAids({
      topic: "Brachial plexus anatomy",
      summary: "Motor and sensory innervation of the upper limb.",
    });
    expect(shouldShow).toBe(true);
  });

  it("stays off for non-visual topics by default", () => {
    const shouldShow = shouldShowExploreVisualAids({
      topic: "Hypertension treatment algorithms",
      summary: "First-line antihypertensive choices and escalation strategy.",
    });
    expect(shouldShow).toBe(false);
  });

  it("builds stable wiki search queries", () => {
    const queries = buildExploreVisualAidQueries("Femoral triangle");
    expect(queries).toContain('intitle:"Femoral triangle" anatomy diagram');
  });

  it("extracts specific anatomy targets from context", () => {
    const targets = extractExploreVisualTargets({
      topic: "Upper limb injuries",
      summary: "Assess brachial plexus and radial nerve deficits.",
      corePoints: ["Radial nerve palsy patterns"],
    });
    expect(targets).toContain("brachial plexus");
    expect(targets).toContain("radial nerve");
  });
});
