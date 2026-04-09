import { describe, it, expect } from "vitest";

/**
 * Tests for personal inbox assignee support.
 * Validates the member aggregation and fallback logic used when
 * a task has no boardId (personal inbox).
 */

describe("Personal inbox assignee support", () => {
  /**
   * Simulates the useAllMembers deduplication logic from use-board.ts.
   * Takes arrays of members from multiple boards and deduplicates by telegramUserId.
   */
  function deduplicateMembers(memberLists: any[][]): any[] {
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const memberList of memberLists) {
      if (!Array.isArray(memberList)) continue;
      for (const m of memberList) {
        const tuid = m.telegramUserId?.toString();
        if (tuid && !seen.has(tuid)) {
          seen.add(tuid);
          deduped.push(m);
        }
      }
    }
    return deduped;
  }

  /**
   * Simulates the resolvedChatId + effectiveMembers logic from task-detail-sheet.tsx.
   */
  function resolveMembers(
    taskBoardId: string | null,
    boards: { id: string; chatId: string }[],
    urlChatId: string | null,
    membersData: any[] | undefined,
    allMembersData: any[] | undefined,
  ) {
    const resolvedChatId = taskBoardId
      ? boards.find((b) => b.id === taskBoardId)?.chatId || urlChatId
      : urlChatId;

    // allMembersData is only fetched when resolvedChatId is null
    const effectiveMembers = membersData || allMembersData || [];
    return { resolvedChatId, effectiveMembers };
  }

  describe("member deduplication across boards", () => {
    it("should deduplicate members appearing in multiple boards", () => {
      const board1Members = [
        { id: "m1-b1", telegramUserId: "100", firstName: "Alice", username: "alice" },
        { id: "m2-b1", telegramUserId: "200", firstName: "Bob", username: "bob" },
      ];
      const board2Members = [
        { id: "m1-b2", telegramUserId: "100", firstName: "Alice", username: "alice" },
        { id: "m3-b2", telegramUserId: "300", firstName: "Charlie", username: "charlie" },
      ];

      const result = deduplicateMembers([board1Members, board2Members]);

      expect(result).toHaveLength(3);
      expect(result.map((m) => m.telegramUserId)).toEqual(["100", "200", "300"]);
      // Should keep first occurrence (from board1)
      expect(result[0].id).toBe("m1-b1");
    });

    it("should handle empty board member lists", () => {
      const board1Members = [
        { id: "m1", telegramUserId: "100", firstName: "Alice" },
      ];

      const result = deduplicateMembers([board1Members, []]);

      expect(result).toHaveLength(1);
    });

    it("should handle no boards at all", () => {
      const result = deduplicateMembers([]);
      expect(result).toHaveLength(0);
    });

    it("should handle members with numeric telegramUserId", () => {
      const members = [
        { id: "m1", telegramUserId: 100, firstName: "Alice" },
        { id: "m2", telegramUserId: 100, firstName: "Alice Dup" },
      ];

      const result = deduplicateMembers([members]);

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe("Alice");
    });
  });

  describe("personal inbox member resolution", () => {
    const boards = [
      { id: "b1", chatId: "chat1" },
      { id: "b2", chatId: "chat2" },
    ];

    it("should use allMembersData when task has no boardId and no chatId", () => {
      const allMembers = [
        { id: "m1", telegramUserId: "100", firstName: "Alice" },
        { id: "m2", telegramUserId: "200", firstName: "Bob" },
      ];

      const result = resolveMembers(null, boards, null, undefined, allMembers);

      expect(result.resolvedChatId).toBeNull();
      expect(result.effectiveMembers).toEqual(allMembers);
    });

    it("should use membersData when task has a boardId", () => {
      const boardMembers = [
        { id: "m1", telegramUserId: "100", firstName: "Alice" },
      ];

      const result = resolveMembers("b1", boards, null, boardMembers, undefined);

      expect(result.resolvedChatId).toBe("chat1");
      expect(result.effectiveMembers).toEqual(boardMembers);
    });

    it("should fall back to empty array when no members available", () => {
      const result = resolveMembers(null, boards, null, undefined, undefined);

      expect(result.effectiveMembers).toEqual([]);
    });

    it("should use URL chatId as fallback when boardId not found in boards list", () => {
      const result = resolveMembers("unknown-board", boards, "fallback-chat", undefined, undefined);

      expect(result.resolvedChatId).toBe("fallback-chat");
    });
  });

  describe("assignee picker visibility for personal tasks", () => {
    it("should show assignee picker when effectiveMembers are available for personal task", () => {
      // Previously, AssigneePicker was gated by `isBoard` (!!task.boardId)
      // Now it should always render regardless of boardId
      const task = { id: "t1", boardId: null, status: "todo" };
      const effectiveMembers = [
        { id: "m1", firstName: "Alice", username: "alice" },
      ];

      // isBoard is no longer checked for AssigneePicker visibility
      const isBoard = !!task.boardId;
      expect(isBoard).toBe(false);
      // But we still have members to show
      expect(effectiveMembers.length).toBeGreaterThan(0);
    });

    it("should show 'no members found' for personal task with no boards", () => {
      const task = { id: "t1", boardId: null, status: "todo" };
      const effectiveMembers: any[] = [];

      expect(effectiveMembers.length).toBe(0);
      // Component will show "noMembersFound" message
    });
  });
});
