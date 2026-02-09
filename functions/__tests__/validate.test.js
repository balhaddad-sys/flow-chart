const { requireStrings, requireInt } = require('../middleware/validate');

// Mock firebase-functions
jest.mock('firebase-functions', () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
      }
    },
  },
}));

describe('validate middleware', () => {
  describe('requireStrings', () => {
    it('accepts valid strings', () => {
      expect(() => {
        requireStrings({ name: 'test' }, [{ field: 'name', maxLen: 100 }]);
      }).not.toThrow();
    });

    it('rejects empty strings', () => {
      expect(() => {
        requireStrings({ name: '' }, [{ field: 'name', maxLen: 100 }]);
      }).toThrow('non-empty string');
    });

    it('rejects missing fields', () => {
      expect(() => {
        requireStrings({}, [{ field: 'name', maxLen: 100 }]);
      }).toThrow('non-empty string');
    });

    it('rejects strings exceeding maxLen', () => {
      expect(() => {
        requireStrings({ name: 'a'.repeat(101) }, [{ field: 'name', maxLen: 100 }]);
      }).toThrow('at most 100');
    });

    it('validates multiple fields', () => {
      expect(() => {
        requireStrings(
          { courseId: 'abc', sectionId: 'def' },
          [
            { field: 'courseId', maxLen: 128 },
            { field: 'sectionId', maxLen: 128 },
          ]
        );
      }).not.toThrow();
    });
  });

  describe('requireInt', () => {
    it('accepts valid integers', () => {
      const result = requireInt({ count: 5 }, 'count', 1, 10);
      expect(result).toBe(5);
    });

    it('returns default when field is undefined', () => {
      const result = requireInt({}, 'count', 1, 10, 5);
      expect(result).toBe(5);
    });

    it('rejects out-of-range values', () => {
      expect(() => {
        requireInt({ count: 100 }, 'count', 1, 10);
      }).toThrow('between 1 and 10');
    });

    it('rejects non-integer values', () => {
      expect(() => {
        requireInt({ count: 3.5 }, 'count', 1, 10);
      }).toThrow('integer');
    });

    it('rejects missing required fields', () => {
      expect(() => {
        requireInt({}, 'count', 1, 10);
      }).toThrow('required');
    });
  });
});
