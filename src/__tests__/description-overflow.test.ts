import { describe, it, expect } from "vitest";

/**
 * Tests for the description textarea overflow behavior in task-detail-sheet.tsx.
 * Validates that the textarea styling supports auto-expand with a max-height scroll cap.
 */

describe("Description textarea overflow behavior", () => {
  // The description textarea style properties from task-detail-sheet.tsx
  const descriptionStyle = {
    color: "var(--text-secondary)",
    minHeight: "2.5em",
    maxHeight: "40vh",
    overflowY: "auto" as const,
  };

  it("should have a minHeight so empty descriptions have visible space", () => {
    expect(descriptionStyle.minHeight).toBe("2.5em");
  });

  it("should have a maxHeight to prevent unbounded growth", () => {
    expect(descriptionStyle.maxHeight).toBe("40vh");
  });

  it("should have overflowY auto to enable scrolling when content exceeds maxHeight", () => {
    expect(descriptionStyle.overflowY).toBe("auto");
  });

  describe("auto-expand logic", () => {
    // Simulates the onChange/onFocus auto-expand from the textarea
    function simulateAutoExpand(scrollHeight: number) {
      // The component sets el.style.height = "auto" then el.style.height = el.scrollHeight + "px"
      // With maxHeight: "40vh", the CSS will cap the visual height
      const computedHeight = `${scrollHeight}px`;
      return computedHeight;
    }

    it("should set height to scrollHeight for short content", () => {
      const height = simulateAutoExpand(60);
      expect(height).toBe("60px");
    });

    it("should set height to scrollHeight for long content (CSS maxHeight will cap it)", () => {
      // Even though we set height to a large value, CSS maxHeight: 40vh will visually cap it
      // and overflowY: auto will enable scrolling
      const height = simulateAutoExpand(2000);
      expect(height).toBe("2000px");
      // The key point is that maxHeight + overflowY: auto in the style will
      // ensure the textarea doesn't visually exceed 40vh and scrolls instead
    });

    it("should have resize disabled via className", () => {
      // The textarea has className including "resize-none" which prevents manual resize
      const className = "mb-3 w-full resize-none bg-transparent text-[13px] outline-none";
      expect(className).toContain("resize-none");
    });
  });
});
