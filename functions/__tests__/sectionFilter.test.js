const {
  evaluateSectionForAnalysis,
  filterAnalyzableSections,
} = require("../processing/filters/sectionFilter");

describe("processing/filters/sectionFilter", () => {
  it("drops editorial-style front matter", () => {
    const decision = evaluateSectionForAnalysis({
      title: "Pages 1-10",
      text: "Editorial\nIn this issue we discuss journal updates and correspondence. Table of contents follows.",
    });
    expect(decision.include).toBe(false);
  });

  it("keeps clinical instructional content even with metadata terms", () => {
    const decision = evaluateSectionForAnalysis({
      title: "Pages 11-20",
      text: [
        "Clinical management of heart failure includes diagnosis, guideline-directed treatment, and medication titration.",
        "Symptoms, differential diagnosis, and prognosis should be reviewed in sequence.",
        "Copyright notice may appear in the footer.",
      ].join(" "),
    });
    expect(decision.include).toBe(true);
  });

  it("returns kept/dropped section lists", () => {
    const { keptSections, droppedSections } = filterAnalyzableSections([
      { title: "Pages 1-10", text: "Table of contents editorial correspondence" },
      {
        title: "Pages 11-20",
        text: [
          "Clinical diagnosis and treatment management with differential discussion.",
          "The section reviews symptoms, pathophysiology, and guideline-based medication choices.",
          "It also includes prognosis and follow-up planning for common scenarios.",
        ].join(" "),
      },
    ]);

    expect(keptSections).toHaveLength(1);
    expect(droppedSections).toHaveLength(1);
    expect(droppedSections[0].title).toContain("Pages 1-10");
  });
});
