import {
  buildExploreTutorSystemPrompt,
  chooseExploreChatProvider,
  normalizeExploreLevel,
} from "./explore-chat-policy";

describe("normalizeExploreLevel", () => {
  it("normalizes known aliases", () => {
    const level = normalizeExploreLevel("md5l");
    expect(level.id).toBe("MD5");
    expect(level.label).toContain("MD5");
  });

  it("falls back to MD3 for unknown values", () => {
    const level = normalizeExploreLevel("unknown-level");
    expect(level.id).toBe("MD3");
  });
});

describe("chooseExploreChatProvider", () => {
  it("routes delicate + nuanced prompts to Claude Haiku", () => {
    const decision = chooseExploreChatProvider({
      topic: "Perinatal psychiatry",
      message:
        "How do I handle a pregnant patient with suicidal ideation and anticoagulation contraindications with risk-benefit trade-offs?",
    });

    expect(decision.provider).toBe("claude-haiku");
    expect(decision.delicateScore).toBeGreaterThan(0);
    expect(decision.nuancedScore).toBeGreaterThan(0);
  });

  it("keeps standard prompts on Gemini", () => {
    const decision = chooseExploreChatProvider({
      topic: "Cardiac physiology",
      message: "What is preload and why does it matter in heart failure?",
    });

    expect(decision.provider).toBe("gemini");
  });

  it("does not switch for delicate-only prompts without clinical nuance", () => {
    const decision = chooseExploreChatProvider({
      topic: "Patient communication",
      message: "How should I discuss end-of-life concerns compassionately?",
    });

    expect(decision.provider).toBe("gemini");
  });
});

describe("buildExploreTutorSystemPrompt", () => {
  it("includes level-specific calibration and sensitivity guidance", () => {
    const level = normalizeExploreLevel("RESIDENT");
    const prompt = buildExploreTutorSystemPrompt({
      topic: "Septic shock",
      levelProfile: level,
      contextText: "Summary: distributive shock with vasoplegia",
      highSensitivityMode: true,
    });

    expect(prompt).toContain("Selected level: Resident");
    expect(prompt).toContain("Summary: distributive shock with vasoplegia");
    expect(prompt).toMatch(/clinically delicate(?:\/| or )nuanced/i);
  });
});
