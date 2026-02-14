const { extractJson } = require("../ai/geminiClient");

describe("geminiClient", () => {
  describe("extractJson", () => {
    it("parses clean JSON", () => {
      expect(extractJson('{"ok":true}')).toEqual({ ok: true });
    });

    it("repairs trailing commas", () => {
      expect(extractJson('{"items":[1,2,3,],}')).toEqual({ items: [1, 2, 3] });
    });

    it("extracts fenced JSON from noisy output", () => {
      const input = `Sure, here is the result:
\`\`\`json
{
  "a": 1
}
\`\`\``;
      expect(extractJson(input)).toEqual({ a: 1 });
    });

    it("repairs malformed quotes", () => {
      const input = '{name:"Cardiology", "difficulty":3}';
      expect(extractJson(input)).toEqual({ name: "Cardiology", difficulty: 3 });
    });

    it("throws when no JSON can be found", () => {
      expect(() => extractJson("this is not json")).toThrow();
    });
  });
});
