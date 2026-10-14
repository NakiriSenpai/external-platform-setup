import type { AttemptStatus } from "@/types/attempt";

/** Status attempt yang dihitung sebagai "Sudah Dikerjakan". */
export const FINISHED_ATTEMPT_STATUSES: readonly AttemptStatus[] = ["submitted", "expired"];

export function isFinishedAttempt(status: AttemptStatus): boolean {
  return FINISHED_ATTEMPT_STATUSES.includes(status);
}

/** Exam ID yang punya minimal satu attempt selesai sah milik user. */
export function finishedExamIdsFrom(
  attempts: readonly { exam_id: string; status: AttemptStatus }[],
): string[] {
  return [...new Set(attempts.filter((a) => isFinishedAttempt(a.status)).map((a) => a.exam_id))];
}
