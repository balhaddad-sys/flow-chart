/**
 * @file study-text.test.ts
 * @description Tests for OCR cleaning, text block parsing, note section
 * building, deduplication, source extraction, and fallback guide derivation.
 */

import {
  isOCRNoise,
  cleanOCR,
  parseTextBlocks,
  buildNoteSections,
  dedupe,
  deriveSourceSnippets,
  deriveSourceParagraphs,
  findBestParagraphIndex,
  deriveFallbackGuide,
} from "./study-text";
import type { TextBlock, NoteSection } from "./study-text";

// ── isOCRNoise ──

describe("isOCRNoise", () => {
  it("treats empty / whitespace-only as noise", () => {
    expect(isOCRNoise("")).toBe(true);
    expect(isOCRNoise("   ")).toBe(true);
    expect(isOCRNoise("\t")).toBe(true);
  });

  it("flags common book metadata", () => {
    expect(isOCRNoise("Copyright 2023 Elsevier")).toBe(true);
    expect(isOCRNoise("All rights reserved")).toBe(true);
    expect(isOCRNoise("ISBN 978-0-123456-78-9")).toBe(true);
    expect(isOCRNoise("Printed in the United States")).toBe(true);
    expect(isOCRNoise("Library of Congress Cataloging")).toBe(true);
  });

  it("flags publisher lines", () => {
    expect(isOCRNoise("Published by Elsevier")).toBe(true);
    expect(isOCRNoise("McGraw-Hill Education")).toBe(true);
    expect(isOCRNoise("Springer Nature 2022")).toBe(true);
    expect(isOCRNoise("Lippincott Williams & Wilkins")).toBe(true);
  });

  it("flags page numbers and pure digit lines", () => {
    expect(isOCRNoise("42")).toBe(true);
    expect(isOCRNoise("page 12")).toBe(true);
    expect(isOCRNoise("page iv")).toBe(true);
    expect(isOCRNoise("• 3 -")).toBe(true);
  });

  it("flags date / file metadata lines", () => {
    expect(isOCRNoise("01/15/2023")).toBe(true);
    expect(isOCRNoise("lecture.pdf")).toBe(true);
    expect(isOCRNoise("notes.docx")).toBe(true);
    expect(isOCRNoise("slides.pptx")).toBe(true);
  });

  it("passes real content through", () => {
    expect(isOCRNoise("The mitral valve separates the left atrium from the left ventricle.")).toBe(false);
    expect(isOCRNoise("Diagnosis requires serum ferritin levels above 300 ng/mL.")).toBe(false);
    expect(isOCRNoise("Acute pancreatitis")).toBe(false);
  });
});

// ── cleanOCR ──

describe("cleanOCR", () => {
  it("joins hyphenated words across line breaks", () => {
    expect(cleanOCR("hemo-\nglobin")).toBe("hemoglobin");
  });

  it("joins hyphenated words with space after hyphen", () => {
    expect(cleanOCR("hemo- globin")).toBe("hemoglobin");
  });

  it("collapses multiple spaces", () => {
    expect(cleanOCR("too   many    spaces")).toBe("too many spaces");
  });

  it("trims leading/trailing whitespace", () => {
    expect(cleanOCR("  hello world  ")).toBe("hello world");
  });

  it("handles combined artifacts", () => {
    expect(cleanOCR("  hemo- globin  has   broken  spacing  ")).toBe("hemoglobin has broken spacing");
  });
});

// ── parseTextBlocks ──

describe("parseTextBlocks", () => {
  it("returns empty for blank text", () => {
    expect(parseTextBlocks("")).toEqual([]);
    expect(parseTextBlocks("   \n\n   ")).toEqual([]);
  });

  it("detects all-caps lines as headings", () => {
    const blocks = parseTextBlocks("CARDIAC ANATOMY\n\nThe heart has four chambers.");
    expect(blocks).toEqual([
      { type: "heading", content: "CARDIAC ANATOMY" },
      { type: "paragraph", content: "The heart has four chambers." },
    ]);
  });

  it("detects title-case short lines as headings", () => {
    const blocks = parseTextBlocks("Mitral Valve\n\nThe mitral valve is bicuspid.");
    expect(blocks[0]).toEqual({ type: "heading", content: "Mitral Valve" });
  });

  it("handles multi-line chunks with heading + body", () => {
    const input = "INTRODUCTION\nThis section covers the basics of cardiology.";
    const blocks = parseTextBlocks(input);
    expect(blocks[0]).toEqual({ type: "heading", content: "INTRODUCTION" });
    expect(blocks[1]).toEqual({ type: "paragraph", content: "This section covers the basics of cardiology." });
  });

  it("filters out OCR noise blocks", () => {
    const input = "Copyright 2023\n\nActual content here.\n\n42";
    const blocks = parseTextBlocks(input);
    expect(blocks.length).toBe(1);
    expect(blocks[0].content).toBe("Actual content here.");
  });

  it("handles paragraphs without headings", () => {
    const input =
      "The patient presented with chest pain and shortness of breath.\n\n" +
      "Physical examination revealed a systolic murmur at the apex.";
    const blocks = parseTextBlocks(input);
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
    expect(blocks.length).toBe(2);
  });
});

// ── buildNoteSections ──

describe("buildNoteSections", () => {
  it("returns empty for empty blocks", () => {
    expect(buildNoteSections([])).toEqual([]);
  });

  it("groups paragraphs under preceding heading", () => {
    const blocks: TextBlock[] = [
      { type: "heading", content: "PATHOLOGY" },
      { type: "paragraph", content: "Cell injury is central to disease." },
      { type: "paragraph", content: "Necrosis and apoptosis differ." },
    ];
    const sections = buildNoteSections(blocks);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("PATHOLOGY");
    expect(sections[0].paragraphs).toEqual([
      "Cell injury is central to disease.",
      "Necrosis and apoptosis differ.",
    ]);
  });

  it("uses 'Core Notes' for leading paragraphs before any heading", () => {
    const blocks: TextBlock[] = [
      { type: "paragraph", content: "Some intro text." },
      { type: "heading", content: "TOPIC" },
      { type: "paragraph", content: "Topic content." },
    ];
    const sections = buildNoteSections(blocks);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe("Core Notes");
    expect(sections[1].title).toBe("TOPIC");
  });

  it("generates unique section IDs", () => {
    const blocks: TextBlock[] = [
      { type: "heading", content: "First Section" },
      { type: "paragraph", content: "Content A." },
      { type: "heading", content: "Second Section" },
      { type: "paragraph", content: "Content B." },
    ];
    const sections = buildNoteSections(blocks);
    expect(sections.length).toBe(2);
    expect(sections[0].id).toContain("sec-first-section");
    expect(sections[1].id).toContain("sec-second-section");
    expect(sections[0].id).not.toBe(sections[1].id);
  });

  it("handles consecutive headings (last heading wins)", () => {
    const blocks: TextBlock[] = [
      { type: "heading", content: "H1" },
      { type: "heading", content: "H2" },
      { type: "paragraph", content: "Under H2." },
    ];
    const sections = buildNoteSections(blocks);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("H2");
  });
});

// ── dedupe ──

describe("dedupe", () => {
  it("removes duplicate strings (case insensitive)", () => {
    expect(dedupe(["Hello", "hello", "HELLO"])).toEqual(["Hello"]);
  });

  it("respects max limit", () => {
    expect(dedupe(["a", "b", "c", "d", "e"], 3)).toEqual(["a", "b", "c"]);
  });

  it("skips empty strings", () => {
    expect(dedupe(["", " ", "real"])).toEqual(["real"]);
  });

  it("preserves original casing of first occurrence", () => {
    expect(dedupe(["Acute MI", "acute mi", "Acute MI"])).toEqual(["Acute MI"]);
  });

  it("defaults to max 6", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(dedupe(items).length).toBe(6);
  });
});

// ── deriveSourceSnippets ──

describe("deriveSourceSnippets", () => {
  it("returns empty for null/empty input", () => {
    expect(deriveSourceSnippets(null)).toEqual([]);
    expect(deriveSourceSnippets("")).toEqual([]);
  });

  it("extracts proper sentences from paragraph text", () => {
    const text =
      "The mitral valve is a bicuspid valve located between the left atrium and the left ventricle of the heart and is critical for unidirectional blood flow. " +
      "Mitral regurgitation occurs when the valve does not close properly, allowing blood to flow backward into the left atrium during ventricular systole.";
    const snippets = deriveSourceSnippets(text);
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets.every((s) => s.length >= 80)).toBe(true);
  });

  it("respects max limit", () => {
    const longText = Array(20)
      .fill(
        "This is a sufficiently long sentence about cardiac physiology that meets the minimum length requirement for extraction into a snippet. "
      )
      .join("\n\n");
    const snippets = deriveSourceSnippets(longText, 2);
    expect(snippets.length).toBeLessThanOrEqual(2);
  });

  it("deduplicates extracted snippets", () => {
    const text =
      "The autonomic nervous system controls heart rate and is essential for cardiovascular homeostasis in the human body. " +
      "\n\n" +
      "The autonomic nervous system controls heart rate and is essential for cardiovascular homeostasis in the human body.";
    const snippets = deriveSourceSnippets(text);
    expect(snippets.length).toBe(1);
  });
});

// ── deriveSourceParagraphs ──

describe("deriveSourceParagraphs", () => {
  it("returns empty for no sections", () => {
    expect(deriveSourceParagraphs([])).toEqual([]);
  });

  it("filters short paragraphs", () => {
    const sections: NoteSection[] = [
      { id: "s1", title: "Test", paragraphs: ["Too short.", "Also short."] },
    ];
    expect(deriveSourceParagraphs(sections)).toEqual([]);
  });

  it("extracts paragraphs above 80 chars", () => {
    const longParagraph =
      "The sinoatrial node generates electrical impulses that travel through the cardiac conduction system, including the AV node and bundle of His.";
    const sections: NoteSection[] = [
      { id: "s1", title: "Conduction", paragraphs: [longParagraph] },
    ];
    const result = deriveSourceParagraphs(sections);
    expect(result.length).toBe(1);
    expect(result[0]).toContain("sinoatrial");
  });

  it("respects max limit", () => {
    const long =
      "Sufficiently long paragraph about medical topics that exceeds eighty characters for testing extraction limits.";
    const sections: NoteSection[] = [
      {
        id: "s1",
        title: "T",
        paragraphs: Array(20).fill(long + " Unique variant "),
      },
    ];
    const result = deriveSourceParagraphs(sections, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

// ── findBestParagraphIndex ──

describe("findBestParagraphIndex", () => {
  const paragraphs = [
    "The heart pumps blood throughout the body via the systemic and pulmonary circulation.",
    "Diabetes mellitus is characterised by chronic hyperglycaemia resulting from defects in insulin secretion or action.",
    "Acute appendicitis is the most common surgical emergency presenting with right iliac fossa pain.",
  ];

  it("returns -1 for empty snippet", () => {
    expect(findBestParagraphIndex("", paragraphs)).toBe(-1);
  });

  it("returns -1 for empty paragraphs", () => {
    expect(findBestParagraphIndex("test", [])).toBe(-1);
  });

  it("finds exact substring match", () => {
    const idx = findBestParagraphIndex("systemic and pulmonary circulation", paragraphs);
    expect(idx).toBe(0);
  });

  it("finds partial match via head", () => {
    const idx = findBestParagraphIndex(
      "Diabetes mellitus is characterised by chronic hyperglycaemia resulting from defects in insulin",
      paragraphs
    );
    expect(idx).toBe(1);
  });

  it("finds token overlap match", () => {
    const idx = findBestParagraphIndex("appendicitis surgical emergency iliac fossa pain", paragraphs);
    expect(idx).toBe(2);
  });

  it("returns -1 when no significant overlap", () => {
    const idx = findBestParagraphIndex("quantum physics string theory", paragraphs);
    expect(idx).toBe(-1);
  });
});

// ── deriveFallbackGuide ──

describe("deriveFallbackGuide", () => {
  const sampleBlocks: TextBlock[] = [
    { type: "heading", content: "Cardiac Physiology" },
    {
      type: "paragraph",
      content:
        "The cardiac cycle consists of systole and diastole phases that coordinate to pump blood through the cardiovascular system.",
    },
    { type: "heading", content: "Valvular Disease" },
    {
      type: "paragraph",
      content:
        "Mitral stenosis results from rheumatic heart disease and causes increased left atrial pressure leading to pulmonary congestion.",
    },
  ];

  const sampleSections = buildNoteSections(sampleBlocks);

  it("returns guide with blueprint data when available", () => {
    const blueprint = {
      learningObjectives: ["Understand cardiac physiology", "Identify valvular diseases"],
      highYieldPoints: ["Mitral stenosis key finding", "Cardiac cycle phases"],
      keyConcepts: ["Systole", "Diastole", "Valve competence"],
    };
    const guide = deriveFallbackGuide("Cardiology", sampleSections, sampleBlocks, blueprint as unknown as import("@/lib/types/section").SectionBlueprint);
    expect(guide.objectives.length).toBeGreaterThan(0);
    expect(guide.roadmap.length).toBeGreaterThan(0);
  });

  it("generates fallback from section titles and content", () => {
    const guide = deriveFallbackGuide("Cardiology", sampleSections, sampleBlocks);
    expect(guide.roadmap.length).toBeGreaterThan(0);
    expect(guide.objectives.length).toBeGreaterThan(0);
    expect(guide.examAngles.length).toBeGreaterThan(0);
    expect(guide.recallPrompts.length).toBeGreaterThan(0);
  });

  it("handles empty sections gracefully", () => {
    const guide = deriveFallbackGuide("Empty", [], []);
    expect(guide.roadmap).toBeDefined();
    expect(guide.objectives).toBeDefined();
    expect(guide.highYield).toBeDefined();
  });

  it("produces unique objectives vs high yield", () => {
    const guide = deriveFallbackGuide("Cardiology", sampleSections, sampleBlocks);
    const objectiveSet = new Set(guide.objectives.map((s) => s.toLowerCase()));
    for (const hy of guide.highYield) {
      expect(objectiveSet.has(hy.toLowerCase())).toBe(false);
    }
  });
});
