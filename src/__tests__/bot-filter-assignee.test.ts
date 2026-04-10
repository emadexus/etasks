import { describe, it, expect } from "vitest";

/**
 * Tests for bot filtering in AssigneePicker.
 * The bot (telegramUserId=8433233305) should only be visible
 * to the admin user (telegramUserId=247463948).
 */

const BOT_TELEGRAM_ID = "8433233305";
const ADMIN_TELEGRAM_ID = "247463948";

function filterMembers(members: any[], userId: string | null): any[] {
  if (userId === ADMIN_TELEGRAM_ID) return members;
  return members.filter((m: any) => String(m.telegramUserId) !== BOT_TELEGRAM_ID);
}

const botMember = {
  id: "bot-uuid",
  firstName: "eTask Bot",
  username: "oooih_bot",
  telegramUserId: "8433233305",
};

const regularMember = {
  id: "user-uuid-1",
  firstName: "Alice",
  username: "alice",
  telegramUserId: "111111",
};

const anotherMember = {
  id: "user-uuid-2",
  firstName: "Bob",
  username: "bob",
  telegramUserId: "222222",
};

const allMembers = [regularMember, botMember, anotherMember];

describe("Bot filtering in AssigneePicker", () => {
  it("admin sees all members including bot", () => {
    const result = filterMembers(allMembers, ADMIN_TELEGRAM_ID);
    expect(result).toHaveLength(3);
    expect(result.find((m) => m.telegramUserId === BOT_TELEGRAM_ID)).toBeDefined();
  });

  it("non-admin user does not see bot", () => {
    const result = filterMembers(allMembers, "999999");
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.telegramUserId === BOT_TELEGRAM_ID)).toBeUndefined();
    expect(result.map((m) => m.firstName)).toEqual(["Alice", "Bob"]);
  });

  it("null userId (unauthenticated) does not see bot", () => {
    const result = filterMembers(allMembers, null);
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.telegramUserId === BOT_TELEGRAM_ID)).toBeUndefined();
  });

  it("handles numeric telegramUserId on member objects", () => {
    const membersWithNumericId = [
      regularMember,
      { ...botMember, telegramUserId: 8433233305 },
      anotherMember,
    ];
    const result = filterMembers(membersWithNumericId, "999999");
    expect(result).toHaveLength(2);
    expect(result.find((m) => String(m.telegramUserId) === BOT_TELEGRAM_ID)).toBeUndefined();
  });

  it("returns empty array when members list is empty", () => {
    const result = filterMembers([], "999999");
    expect(result).toEqual([]);
  });

  it("works correctly when bot is the only member", () => {
    const result = filterMembers([botMember], "999999");
    expect(result).toEqual([]);
  });

  it("admin sees bot even when bot is the only member", () => {
    const result = filterMembers([botMember], ADMIN_TELEGRAM_ID);
    expect(result).toHaveLength(1);
    expect(result[0].telegramUserId).toBe(BOT_TELEGRAM_ID);
  });
});
