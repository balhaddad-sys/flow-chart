/**
 * @file storage.test.ts
 * @description Tests for file validation logic (validateFile).
 * We mock the firebase client to avoid initializing Firebase in tests.
 */

jest.mock("./client", () => ({
  storage: {},
  db: {},
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

import { validateFile } from "./storage";

// Helper: create a minimal File-like object
function makeFile(name: string, type: string, sizeBytes: number): File {
  // Use a small actual buffer for small sizes, mock size for large files
  if (sizeBytes <= 1024 * 1024) {
    const buffer = new ArrayBuffer(sizeBytes);
    return new File([buffer], name, { type });
  }
  // For large files, create tiny file but override size
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

describe("validateFile", () => {
  describe("valid files", () => {
    it("accepts a PDF file", () => {
      const file = makeFile("notes.pdf", "application/pdf", 1024);
      expect(validateFile(file)).toBeNull();
    });

    it("accepts a PPTX file", () => {
      const file = makeFile(
        "slides.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        2048
      );
      expect(validateFile(file)).toBeNull();
    });

    it("accepts a DOCX file", () => {
      const file = makeFile(
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        4096
      );
      expect(validateFile(file)).toBeNull();
    });

    it("accepts a file at exactly 100MB", () => {
      const file = makeFile("big.pdf", "application/pdf", 100 * 1024 * 1024);
      expect(validateFile(file)).toBeNull();
    });
  });

  describe("unsupported file types", () => {
    it("rejects a plain text file", () => {
      const file = makeFile("readme.txt", "text/plain", 100);
      expect(validateFile(file)).toContain("Unsupported file type");
    });

    it("rejects a JPEG image", () => {
      const file = makeFile("photo.jpg", "image/jpeg", 5000);
      expect(validateFile(file)).toContain("Unsupported file type");
    });

    it("rejects an Excel file", () => {
      const file = makeFile(
        "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1024
      );
      expect(validateFile(file)).toContain("Unsupported file type");
    });

    it("rejects a ZIP file", () => {
      const file = makeFile("archive.zip", "application/zip", 1024);
      expect(validateFile(file)).toContain("Unsupported file type");
    });

    it("rejects a file with empty MIME type", () => {
      const file = makeFile("unknown", "", 1024);
      expect(validateFile(file)).toContain("Unsupported file type");
    });
  });

  describe("file size limits", () => {
    it("rejects a file over 100MB", () => {
      const file = makeFile("huge.pdf", "application/pdf", 100 * 1024 * 1024 + 1);
      expect(validateFile(file)).toContain("too large");
    });

    it("rejects a much larger file", () => {
      const file = makeFile("massive.pdf", "application/pdf", 500 * 1024 * 1024);
      expect(validateFile(file)).toContain("too large");
    });
  });

  describe("type check takes priority over size check", () => {
    it("returns type error even if also too large", () => {
      const file = makeFile("big.txt", "text/plain", 200 * 1024 * 1024);
      expect(validateFile(file)).toContain("Unsupported file type");
    });
  });
});
