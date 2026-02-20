const { buildExamPlaybookPrompt } = require("../ai/examPlaybooks");
const { questionsUserPrompt } = require("../ai/prompts");

describe("examPlaybooks", () => {
  it("builds MRCP Part 1 playbook guidance", () => {
    const prompt = buildExamPlaybookPrompt("MRCP_PART1");
    expect(prompt).toContain("Exam intelligence profile: MRCP Part 1");
    expect(prompt).toContain("Coverage blueprint");
    expect(prompt).toContain("Cardiology and ECG/arrhythmia logic");
    expect(prompt).toContain("Clinical reasoning requirements");
  });

  it("falls back to generic guidance for unknown exam types", () => {
    const prompt = buildExamPlaybookPrompt("UNKNOWN_EXAM");
    expect(prompt).toContain("Exam intelligence profile: Generic medical SBA exam mode");
    expect(prompt).toContain("Core diagnosis and differential logic");
  });
});

describe("questionsUserPrompt with playbook", () => {
  it("injects curated exam playbook into generation prompt", () => {
    const prompt = questionsUserPrompt({
      blueprintJSON: {
        key_concepts: ["Atrial fibrillation rate/rhythm strategies"],
        high_yield_points: ["Stroke prophylaxis thresholds"],
        terms_to_define: ["CHA2DS2-VASc"],
      },
      count: 5,
      easyCount: 1,
      mediumCount: 3,
      hardCount: 1,
      sectionTitle: "Arrhythmia management",
      sourceFileName: "cardiology-notes.pdf",
      examType: "MRCP_PART1",
    });

    expect(prompt).toContain("Exam intelligence profile: MRCP Part 1");
    expect(prompt).toContain("Coverage blueprint");
    expect(prompt).toContain("minimum 3 distinct blueprint domains");
  });
});
