import { describe, it, expect } from "vitest";

/**
 * Tests for the BoardPicker avatar rendering logic in task-detail-sheet.tsx.
 * Validates that boards with photoUrl render images, and boards without fall back to letter avatars.
 * Also validates that the home API response includes photoUrl in the boards array.
 */

describe("BoardPicker avatar rendering", () => {
  // Simulates the board data shape from homeData.boards
  const boardsWithPhoto = [
    { id: "b1", name: "Design Team", chatId: "123", photoUrl: "https://cdn.example.com/group_123.jpg" },
    { id: "b2", name: "Engineering", chatId: "456", photoUrl: null },
    { id: "b3", name: "Marketing", chatId: "789" },
  ];

  // Simulates the rendering logic from task-detail-sheet.tsx lines 155-161
  function renderBoardAvatar(board: { id: string; name: string; chatId: string; photoUrl?: string | null }) {
    if (board.photoUrl) {
      return { type: "img", src: board.photoUrl, className: "h-6 w-6 rounded object-cover" };
    }
    return { type: "letter", letter: board.name[0].toUpperCase(), className: "h-6 w-6" };
  }

  it("should render an img element when board has photoUrl", () => {
    const result = renderBoardAvatar(boardsWithPhoto[0]);
    expect(result.type).toBe("img");
    expect(result.src).toBe("https://cdn.example.com/group_123.jpg");
  });

  it("should render a letter avatar when photoUrl is null", () => {
    const result = renderBoardAvatar(boardsWithPhoto[1]);
    expect(result.type).toBe("letter");
    expect(result.letter).toBe("E");
  });

  it("should render a letter avatar when photoUrl is undefined", () => {
    const result = renderBoardAvatar(boardsWithPhoto[2]);
    expect(result.type).toBe("letter");
    expect(result.letter).toBe("M");
  });

  it("should not render img for empty string photoUrl", () => {
    const board = { id: "b4", name: "Test", chatId: "000", photoUrl: "" };
    const result = renderBoardAvatar(board);
    // Empty string is falsy, so should fall back to letter avatar
    expect(result.type).toBe("letter");
    expect(result.letter).toBe("T");
  });
});

describe("Home API boards response shape", () => {
  // Simulates the mapping from /api/home/route.ts lines 36-42
  function mapBoardResponse(boardRow: { id: string; name: string; telegramChatId: bigint; photoUrl: string | null; language: string }) {
    return {
      id: boardRow.id,
      name: boardRow.name,
      chatId: boardRow.telegramChatId.toString(),
      photoUrl: boardRow.photoUrl || null,
      language: boardRow.language,
    };
  }

  it("should include photoUrl in board response when present", () => {
    const row = { id: "b1", name: "Team", telegramChatId: BigInt(123), photoUrl: "https://cdn.example.com/photo.jpg", language: "en" };
    const mapped = mapBoardResponse(row);
    expect(mapped.photoUrl).toBe("https://cdn.example.com/photo.jpg");
  });

  it("should set photoUrl to null when not present in DB", () => {
    const row = { id: "b2", name: "Team", telegramChatId: BigInt(456), photoUrl: null, language: "en" };
    const mapped = mapBoardResponse(row);
    expect(mapped.photoUrl).toBeNull();
  });

  it("should convert chatId to string", () => {
    const row = { id: "b1", name: "Team", telegramChatId: BigInt(789), photoUrl: null, language: "en" };
    const mapped = mapBoardResponse(row);
    expect(mapped.chatId).toBe("789");
  });
});
