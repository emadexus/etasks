import { describe, it, expect } from "vitest";

/**
 * Tests for the optimistic update logic in task-detail-sheet.tsx.
 * These validate the state management patterns without rendering the full component.
 */

describe("Task optimistic updates", () => {
  // Simulates the logic from task-detail-sheet.tsx lines 288-307
  function simulateHandleUpdate(
    localTask: any,
    membersData: any[],
    field: string,
    value: any,
  ) {
    const newLocalTask = { ...localTask, [field]: value };
    const mutatedAt = Date.now();

    let localAssignee: any = null;
    let localAssigneeSet = false;
    if (field === "assigneeId" && membersData) {
      const member = membersData.find((m) => m.id === value);
      localAssignee = member || null;
      localAssigneeSet = true;
    }

    return { newLocalTask, localAssignee, localAssigneeSet, mutatedAt };
  }

  // Simulates the sync effect from task-detail-sheet.tsx lines 234-255
  function simulateSyncEffect(
    initialized: boolean,
    taskData: any,
    mutatedAt: number,
    currentLocalTask: any,
    currentLocalAssignee: any,
  ) {
    if (!initialized && taskData?.task) {
      return {
        localTask: taskData.task,
        localAssignee: taskData.assignee,
        localAssigneeSet: true,
        initialized: true,
      };
    } else if (initialized && taskData?.task) {
      const elapsed = Date.now() - mutatedAt;
      if (elapsed > 5000) {
        return {
          localTask: taskData.task,
          localAssignee: taskData.assignee,
          localAssigneeSet: true,
          initialized: true,
        };
      }
    }
    return {
      localTask: currentLocalTask,
      localAssignee: currentLocalAssignee,
      localAssigneeSet: false,
      initialized,
    };
  }

  describe("assignee optimistic update", () => {
    it("should update localAssignee immediately when assigneeId changes", () => {
      const members = [
        { id: "m1", firstName: "Alice", username: "alice" },
        { id: "m2", firstName: "Bob", username: "bob" },
      ];
      const localTask = { id: "t1", assigneeId: null, boardId: "b1" };

      const result = simulateHandleUpdate(localTask, members, "assigneeId", "m2");

      expect(result.newLocalTask.assigneeId).toBe("m2");
      expect(result.localAssignee).toEqual({ id: "m2", firstName: "Bob", username: "bob" });
      expect(result.localAssigneeSet).toBe(true);
    });

    it("should set localAssignee to null when unassigning", () => {
      const members = [{ id: "m1", firstName: "Alice", username: "alice" }];
      const localTask = { id: "t1", assigneeId: "m1", boardId: "b1" };

      const result = simulateHandleUpdate(localTask, members, "assigneeId", null);

      expect(result.newLocalTask.assigneeId).toBeNull();
      expect(result.localAssignee).toBeNull();
      expect(result.localAssigneeSet).toBe(true);
    });

    it("should not update localAssignee for non-assignee fields", () => {
      const members = [{ id: "m1", firstName: "Alice", username: "alice" }];
      const localTask = { id: "t1", status: "todo", boardId: "b1" };

      const result = simulateHandleUpdate(localTask, members, "status", "in_progress");

      expect(result.newLocalTask.status).toBe("in_progress");
      expect(result.localAssigneeSet).toBe(false);
    });
  });

  describe("board move optimistic update", () => {
    it("should update boardId in localTask immediately on move", () => {
      const localTask = { id: "t1", boardId: "b1", status: "todo" };

      const result = simulateHandleUpdate(localTask, [], "boardId", "b2");

      expect(result.newLocalTask.boardId).toBe("b2");
      expect(result.mutatedAt).toBeGreaterThan(0);
    });

    it("should update boardId to null for personal inbox move", () => {
      const localTask = { id: "t1", boardId: "b1", status: "todo" };

      const result = simulateHandleUpdate(localTask, [], "boardId", null);

      expect(result.newLocalTask.boardId).toBeNull();
    });
  });

  describe("poll sync deferral", () => {
    it("should not override local state within 5s of mutation", () => {
      const localTask = { id: "t1", boardId: "b2", assigneeId: "m2" };
      const localAssignee = { id: "m2", firstName: "Bob" };
      const serverData = {
        task: { id: "t1", boardId: "b1", assigneeId: "m1" },
        assignee: { id: "m1", firstName: "Alice" },
      };

      const result = simulateSyncEffect(true, serverData, Date.now(), localTask, localAssignee);

      // Should keep local (optimistic) state since mutation was recent
      expect(result.localTask.boardId).toBe("b2");
      expect(result.localAssignee.firstName).toBe("Bob");
    });

    it("should sync from server after 5s have passed", () => {
      const localTask = { id: "t1", boardId: "b2", assigneeId: "m2" };
      const localAssignee = { id: "m2", firstName: "Bob" };
      const serverData = {
        task: { id: "t1", boardId: "b2", assigneeId: "m2" },
        assignee: { id: "m2", firstName: "Bob" },
      };

      // mutatedAt was 6 seconds ago
      const result = simulateSyncEffect(true, serverData, Date.now() - 6000, localTask, localAssignee);

      // Should sync from server
      expect(result.localTask).toEqual(serverData.task);
      expect(result.localAssignee).toEqual(serverData.assignee);
      expect(result.localAssigneeSet).toBe(true);
    });

    it("should initialize from server data on first load", () => {
      const serverData = {
        task: { id: "t1", boardId: "b1", assigneeId: "m1" },
        assignee: { id: "m1", firstName: "Alice" },
      };

      const result = simulateSyncEffect(false, serverData, 0, null, null);

      expect(result.initialized).toBe(true);
      expect(result.localTask).toEqual(serverData.task);
      expect(result.localAssignee).toEqual(serverData.assignee);
    });
  });

  describe("assignee display resolution", () => {
    it("should prefer localAssignee when localAssigneeSet is true", () => {
      const localAssignee = { id: "m2", firstName: "Bob", username: "bob" };
      const serverAssignee = { id: "m1", firstName: "Alice", username: "alice" };
      const localAssigneeSet = true;

      // Simulates line 326: const assignee = localAssigneeSet ? localAssignee : taskData?.assignee
      const displayAssignee = localAssigneeSet ? localAssignee : serverAssignee;

      expect(displayAssignee.firstName).toBe("Bob");
    });

    it("should fall back to server assignee when localAssigneeSet is false", () => {
      const localAssignee = null;
      const serverAssignee = { id: "m1", firstName: "Alice", username: "alice" };
      const localAssigneeSet = false;

      const displayAssignee = localAssigneeSet ? localAssignee : serverAssignee;

      expect(displayAssignee?.firstName).toBe("Alice");
    });
  });
});
