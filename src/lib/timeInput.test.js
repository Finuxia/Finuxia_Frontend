import { describe, expect, it } from "vitest";
import { parseTimeInput } from "./timeInput";

describe("parseTimeInput", () => {
  it.each([
    ["9:30am", "09:30"],
    ["930p", "21:30"],
    ["2 PM", "14:00"],
    ["12am", "00:00"],
    ["12:45pm", "12:45"],
    ["14:00", "14:00"],
    ["0930", "09:30"],
    [" 7 ", "07:00"],
    ["23:59", "23:59"],
  ])("parses %s as %s", (raw, expected) => expect(parseTimeInput(raw)).toBe(expected));

  it.each(["", "  ", "tomorrow", "24:00", "9:60", "0pm", "13am", "930amx", ":30"])("rejects %j", (raw) =>
    expect(parseTimeInput(raw)).toBeNull()
  );
});
