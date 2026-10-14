import { describe, expect, it } from "vitest";
import { planMoveSwaps } from "./exam.service";

const ids = Array.from({ length: 25 }, (_, i) => `e${i + 1}`);
function apply(list: string[], steps: [string, string][]) {
  const out = [...list];
  for (const [a, b] of steps) {
    const ia = out.indexOf(a), ib = out.indexOf(b);
    [out[ia], out[ib]] = [out[ib]!, out[ia]!];
  }
  return out;
}

describe("planMoveSwaps", () => {
  it("moves position 11 to position 3", () => {
    const r = apply(ids, planMoveSwaps(ids, "e11", 3));
    expect(r.slice(0, 4)).toEqual(["e1", "e2", "e11", "e3"]);
    expect(r).toHaveLength(25);
  });
  it("moves page 3 item (pos 22) to page 1 (pos 1)", () => {
    const r = apply(ids, planMoveSwaps(ids, "e22", 1));
    expect(r[0]).toBe("e22");
    expect(r[22]).toBe("e23");
  });
  it("moves down and clamps", () => {
    const r = apply(ids, planMoveSwaps(ids, "e1", 99));
    expect(r[24]).toBe("e1");
  });
});
