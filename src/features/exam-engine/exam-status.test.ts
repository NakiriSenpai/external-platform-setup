import { describe, expect, it } from "vitest";
import { finishedExamIdsFrom } from "./exam-status";

describe("finishedExamIdsFrom", () => {
  it("submitted attempt counts as finished", () => {
    expect(finishedExamIdsFrom([{ exam_id: "a", status: "submitted" }])).toEqual(["a"]);
  });
  it("expired (time up) attempt counts as finished", () => {
    expect(finishedExamIdsFrom([{ exam_id: "a", status: "expired" }])).toEqual(["a"]);
  });
  it("cancelled attempt is not finished", () => {
    expect(finishedExamIdsFrom([{ exam_id: "a", status: "cancelled" }])).toEqual([]);
  });
  it("in-progress attempt is not finished", () => {
    expect(finishedExamIdsFrom([{ exam_id: "a", status: "in_progress" }])).toEqual([]);
  });
});
