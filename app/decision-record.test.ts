import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compare,
  comparisonRecommendation,
  confirmDecision,
  createDecisionRecord,
  emptyScore,
  importDecisionRecord,
  prepareMosAlignment,
  renderDecisionRecordMarkdown,
  syncDecisionDraftWithComparison,
  touchDecisionRecord,
  type DecisionModel,
} from "./decision-record.ts";

const now = "2026-09-13T00:00:00.000Z";
const score = (value: number | null, rationale = "") => ({ ...emptyScore(), value, rationale });
const model = (): DecisionModel => ({
  question: "Which fictional vendor should Operations choose?",
  criteria: [
    { id: "fit", name: "Workflow fit", description: "Fits the operating model", weight: 2, minimum: null },
    { id: "ease", name: "Ease of use", description: "Usable without training", weight: 1, minimum: null },
  ],
  options: [
    { id: "a", name: "Vendor A", thesis: "", evidenceSummary: "", evidenceState: "Directional", scores: { fit: score(8), ease: score(9) } },
    { id: "b", name: "Vendor B", thesis: "", evidenceSummary: "", evidenceState: "Hypothesis", scores: { fit: score(7), ease: score(8) } },
  ],
});
const draft = () => ({ selectedOptionId: "a", rationale: "Best fit for the fictional workflow", tradeoffs: ["Higher setup effort"], assumptions: ["Volume remains stable"], constraints: ["Fictional budget cap"], recordedBy: "Fictional operations lead", decisionRole: "Decision owner", reviewTrigger: "After the pilot", comparisonPrefillFingerprint: null });
const record = () => ({ ...createDecisionRecord(model(), { id: "test-only", now, origin: "blank" }), decisionDraft: draft() });

test("weighted arithmetic uses the full possible weight", () => {
  const summary = compare(model());
  assert.equal(summary.results[0].weightedTotal, 25);
  assert.equal(summary.results[0].maximum, 30);
  assert.equal(summary.results[0].percentage, 25 / 30 * 100);
});

test("blank is not zero and partial scores never produce a leader", () => {
  const partial = model();
  partial.options[0].scores.ease.value = null;
  const summary = compare(partial);
  const a = summary.results.find(result => result.option.id === "a")!;
  assert.equal(a.weightedTotal, 16);
  assert.equal(a.percentage, 16 / 30 * 100);
  assert.equal(a.coverage, 2 / 3 * 100);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.leaders, []);
  partial.options[0].scores.ease.value = 0;
  const explicitZero = compare(partial);
  assert.equal(explicitZero.complete, true);
  assert.equal(explicitZero.results[0].weightedTotal, 16);
});

test("ties are explicit and do not invent a single winner", () => {
  const tied = model();
  tied.options[1].scores = { fit: score(8), ease: score(9) };
  const summary = compare(tied);
  assert.equal(summary.hasTie, true);
  assert.deepEqual(summary.leaders.map(result => result.option.id), ["a", "b"]);
});

test("must-meet thresholds live directly on criteria", () => {
  const input = model();
  input.options[0].scores.fit.value = 5;
  assert.equal(compare(input).results[0].eligible, true);
  input.criteria[0].minimum = 6;
  assert.equal(compare(input).results[0].eligible, false);
});

test("a failed or unresolved minimum blocks only final confirmation", () => {
  const failed = record();
  failed.model.criteria[0].minimum = 6;
  failed.model.options[0].scores.fit.value = 5;
  assert.throws(() => confirmDecision(failed, now), /must-meet threshold/);
  failed.model.options[0].scores.fit.value = null;
  assert.throws(() => confirmDecision(failed, now), /Complete every score/);
});

test("score notes and blank values survive JSON export and import", () => {
  const input = record();
  input.model.options[0].scores.ease = {
    value: null,
    rationale: "Not yet tested",
    sourceReference: "Fictional pilot notes",
    uncertainty: "Sample is too small",
  };
  const imported = importDecisionRecord(JSON.parse(JSON.stringify(input)));
  assert.equal(imported.migrated, false);
  assert.deepEqual(imported.record, input);
});

test("a final decision survives round trip and produces alignment-only MOS handoff", () => {
  const decided = confirmDecision(record(), now);
  const imported = importDecisionRecord(JSON.parse(JSON.stringify(decided))).record;
  assert.deepEqual(imported.finalDecision, decided.finalDecision);
  const handoff = prepareMosAlignment(imported);
  assert.equal(handoff.generationAllowed, false);
  assert.equal(handoff.messagingApproval, "not_granted");
  assert.equal(handoff.decisionRef.schemaVersion, "3.1");
  assert.equal(handoff.schemaVersion, "2.1");
  assert.equal(imported.finalDecision?.sourceBasis, "current_weighted_comparison_plus_human_judgment");
});

test("editing the comparison invalidates rather than silently retaining confirmation", () => {
  const decided = confirmDecision(record(), now);
  const changed = structuredClone(decided);
  changed.model.options[0].scores.fit.value = 7;
  const updated = touchDecisionRecord(decided, { model: changed.model }, "2026-09-13T01:00:00.000Z", "Comparison inputs changed after confirmation.");
  assert.equal(updated.status, "draft");
  assert.equal(updated.finalDecision?.status, "invalidated");
  assert.throws(() => prepareMosAlignment(updated), /current final decision/);
});

test("malformed and incompatible imports are rejected", () => {
  assert.throws(() => importDecisionRecord({ recordType: "DecisionRecord", schemaVersion: "99.0" }));
  assert.throws(() => importDecisionRecord({ recordType: "DecisionRecord", schemaVersion: "3.0", id: "broken" }));
});

test("Decision Engine v2 MOS handoffs migrate intentionally", () => {
  const legacy = {
    schemaVersion: "1.0",
    recordType: "MOSAlignmentHandoff",
    decisionRecord: {
      schemaVersion: "1.0",
      recordType: "DecisionRecord",
      id: "legacy-id",
      version: 1,
      status: "decided",
      createdAt: now,
      source: "gtm-decision-engine",
      model: {
        question: "Legacy choice?",
        criteria: [{ id: "fit", name: "Fit", description: "", weight: 2, gate: true, minimum: 6 }],
        options: [
          { id: "a", name: "A", thesis: "", evidence: "Legacy evidence", evidenceState: "Directional", scores: { fit: 8 } },
          { id: "b", name: "B", thesis: "", evidence: "Legacy evidence", evidenceState: "Hypothesis", scores: { fit: 7 } },
        ],
      },
      humanDecision: {
        selectedOptionId: "a",
        businessContext: "Legacy context",
        rationale: "Legacy rationale",
        acceptedTradeoffs: ["Legacy tradeoff"],
        assumptions: ["Legacy assumption"],
        validationSteps: ["Legacy validation"],
        reviewTrigger: "Legacy trigger",
        approver: "Legacy owner",
        overrideRationale: "",
        criteriaConfirmed: true,
      },
      approval: { method: "human_attestation", approvedAt: now },
      limitations: [],
    },
  };
  const result = importDecisionRecord(legacy);
  assert.equal(result.migrated, true);
  assert.equal(result.record.schemaVersion, "3.1");
  assert.equal(result.record.finalDecision?.status, "confirmed");
  assert.equal(result.record.model.options[0].scores.fit.value, 8);
  assert.match(result.record.provenance.migratedFrom!, /v2/);
});

test("generic non-GTM decisions require no MOS fields or code changes", () => {
  const generic = createDecisionRecord(model(), { id: "vendor-decision", now, origin: "blank" });
  assert.equal(generic.recordType, "DecisionRecord");
  assert.equal("mos" in generic, false);
  assert.equal(compare(generic.model).complete, true);
});

test("records are isolated from later source mutations", () => {
  const source = model();
  const created = createDecisionRecord(source, { id: "isolated", now, origin: "blank" });
  source.options[0].scores.fit.value = 1;
  assert.equal(created.model.options[0].scores.fit.value, 8);
});

test("a unique complete leader produces an editable comparison recommendation", () => {
  const recommendation = comparisonRecommendation(model());
  assert.equal(recommendation?.selectedOptionId, "a");
  assert.match(recommendation?.rationale ?? "", /current weighted comparison recommends Vendor A/);
  const synced = syncDecisionDraftWithComparison(model(), {
    selectedOptionId: "", rationale: "", tradeoffs: [], assumptions: [], constraints: [], recordedBy: "", decisionRole: "", reviewTrigger: "", comparisonPrefillFingerprint: null,
  });
  assert.equal(synced.selectedOptionId, "a");
  assert.ok(synced.comparisonPrefillFingerprint);
});

test("ties and incomplete comparisons do not auto-select an option", () => {
  const tied = model();
  tied.options[1].scores = { fit: score(8), ease: score(9) };
  assert.equal(comparisonRecommendation(tied), null);
  tied.options[1].scores.ease.value = null;
  assert.equal(comparisonRecommendation(tied), null);
});

test("DecisionRecord 3.0 drafts migrate without activating disabled minimums", () => {
  const current = record();
  const v30 = {
    ...current,
    schemaVersion: "3.0",
    provenance: { ...current.provenance, migratedFrom: undefined },
    model: { ...current.model, nonNegotiablesEnabled: false, criteria: current.model.criteria.map((criterion, index) => ({ ...criterion, minimum: index === 0 ? 9 : null })) },
    decisionDraft: {
      selectedOptionId: current.decisionDraft.selectedOptionId,
      rationale: current.decisionDraft.rationale,
      tradeoffs: current.decisionDraft.tradeoffs,
      assumptions: current.decisionDraft.assumptions,
      constraints: current.decisionDraft.constraints,
      decisionOwner: current.decisionDraft.recordedBy,
      reviewTrigger: current.decisionDraft.reviewTrigger,
    },
  };
  const migrated = importDecisionRecord(JSON.parse(JSON.stringify(v30)));
  assert.equal(migrated.record.schemaVersion, "3.1");
  assert.equal(migrated.record.model.criteria[0].minimum, null);
  assert.equal(migrated.record.decisionDraft.recordedBy, "Fictional operations lead");
});

test("Markdown report is readable and preserves blank versus zero plus score notes", () => {
  const input = record();
  input.model.options[0].scores.ease = {
    value: null,
    rationale: "Not yet tested",
    sourceReference: "Fictional pilot notes",
    uncertainty: "Sample is too small",
  };
  input.model.options[1].scores.ease.value = 0;
  const report = renderDecisionRecordMarkdown(input);
  assert.match(report, /Human-readable companion/);
  assert.match(report, /Blank \(—\) means unknown or unentered\. Zero \(0\) is an explicit score/);
  assert.match(report, /Not yet tested/);
  assert.match(report, /Fictional pilot notes/);
  assert.match(report, /\| Ease of use \| Usable without training \| 1× \| — \| — \| 0 \|/);
});

test("Markdown report includes confirmed human decision provenance", () => {
  const report = renderDecisionRecordMarkdown(confirmDecision(record(), now));
  assert.match(report, /## Final decision/);
  assert.match(report, /\*\*Recorded by:\*\* Fictional operations lead/);
  assert.match(report, /\*\*Source:\*\* Current weighted comparison \+ human judgment/);
  assert.match(report, /After the pilot/);
});
