import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";

function ThrowingChild() {
  throw new Error("Test error");
}

function GoodChild() {
  return <p>All good</p>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Reload Page")).toBeInTheDocument();
  });
});
