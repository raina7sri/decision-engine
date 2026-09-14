import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecisionRecord, emptyScore, confirmDecision, touchDecisionRecord, renderDecisionRecordMarkdown } from "./decision-record.ts";

test("Markdown preserves table structure and distinguishes invalidated confirmation from current draft", () => {
  const now = "2026-09-13T00:00:00.000Z";
  const record = createDecisionRecord({
    question: "Fictional vendor decision",
    criteria: [{ id: "fit", name: "Fit | usability", description: "Line one\nLine two", weight: 1, minimum: 5 }],
    options: [
      { id: "a", name: "Vendor A", thesis: "", evidenceSummary: "Synthetic fixture", evidenceState: "Hypothesis", scores: { fit: { ...emptyScore(), value: 8 } } },
      { id: "b", name: "Vendor B", thesis: "", evidenceSummary: "Synthetic fixture", evidenceState: "Hypothesis", scores: { fit: { ...emptyScore(), value: 4 } } },
    ],
  }, { id: "markdown-fixture", now, origin: "blank" });
  record.decisionDraft.recordedBy = "Fictional reviewer";
  const confirmed = confirmDecision(record, now);
  const changed = touchDecisionRecord(confirmed, { decisionDraft: { ...confirmed.decisionDraft, rationale: "Reconsider after pilot" } }, "2026-09-14T00:00:00.000Z", "Decision rationale changed");
  const report = renderDecisionRecordMarkdown(changed);
  assert.ok(report.includes("Fit \\| usability | Line one<br>Line two"));
  assert.ok(report.includes("≥ 5/10"));
  assert.ok(report.includes("Ineligible: Fit \\| usability"));
  assert.ok(report.includes("## Earlier final decision — invalidated"));
  assert.ok(report.includes("## Current decision draft"));
  assert.ok(report.includes("Reconsider after pilot"));
  assert.ok(report.includes("Decision rationale changed"));
});
