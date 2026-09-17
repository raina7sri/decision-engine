import { test } from "node:test";
import assert from "node:assert/strict";
import { positioningModel, positioningProvenance } from "./data.ts";
import { compare, createDecisionRecord, importDecisionRecord } from "./decision-record.ts";
import { weightedScoreLabel, weightedScoreExplanation } from "./score-presentation.ts";

test("historical framework keeps synthetic seed arithmetic and provenance", () => {
  const model = positioningModel();
  assert.deepEqual(model.criteria.map(c => c.weight), [2, 2, 2, 2, 2, 1, 1, 1, 1, 1]);
  const leader = compare(model).leaders[0];
  assert.equal(leader.option.id, "ai-visible");
  assert.equal(leader.weightedTotal, 130);
  assert.equal(leader.maximum, 150);
  assert.equal(weightedScoreLabel(leader), "130 / 150 · 87%");
  assert.match(positioningProvenance, /historical framework/);
  for (const option of model.options) {
    assert.match(option.evidenceSummary, /scores, rationales, and evidence are synthetic/);
  }
});

test("score copy follows edited weights and scores without changing the model", () => {
  const model = positioningModel();
  model.criteria[0].weight = 1.5;
  model.options[0].scores.clarity.value = 2;
  const before = structuredClone(model);
  const result = compare(model).results.find(r => r.option.id === "ai-visible")!;
  assert.equal(weightedScoreLabel(result), "115 / 145 · 79%");
  assert.match(weightedScoreExplanation(result), /^79% means 115 of 145 possible weighted points/);
  assert.match(weightedScoreExplanation(result), /not a probability of commercial success/);
  assert.deepEqual(model, before);
  model.options[0].scores.clarity.value = null;
  assert.equal(compare(model).leaders.length, 0);
  assert.equal(weightedScoreLabel({ weightedTotal: 0, maximum: 0 }), "0 / 0 · 0%");
});

test("import retains user-authored evidence instead of replacing it with seed provenance", () => {
  const model = positioningModel();
  model.options[0].evidenceSummary = "User-authored evidence";
  const record = createDecisionRecord(model, { id: "copy-regression", now: "2026-09-17T00:00:00.000Z", origin: "blank" });
  assert.equal(importDecisionRecord(JSON.parse(JSON.stringify(record))).record.model.options[0].evidenceSummary, "User-authored evidence");
});
