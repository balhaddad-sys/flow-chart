const { extractJsonFromText } = require('../ai/aiClient');

describe('aiClient', () => {
  describe('extractJsonFromText', () => {
    it('parses clean JSON', () => {
      const result = extractJsonFromText('{"key": "value"}');
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('strips markdown code fences', () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = extractJsonFromText(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('handles leading text before JSON', () => {
      const input = 'Here is the result: {"key": "value"}';
      const result = extractJsonFromText(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('handles trailing text after JSON', () => {
      const input = '{"key": "value"} Hope this helps!';
      const result = extractJsonFromText(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('handles JSON arrays', () => {
      const input = '[1, 2, 3]';
      const result = extractJsonFromText(input);
      expect(JSON.parse(result)).toEqual([1, 2, 3]);
    });

    it('handles nested JSON', () => {
      const input = '{"outer": {"inner": [1, 2]}}';
      const result = extractJsonFromText(input);
      expect(JSON.parse(result)).toEqual({ outer: { inner: [1, 2] } });
    });

    it('throws on no JSON content', () => {
      expect(() => extractJsonFromText('no json here')).toThrow();
    });
  });
});
