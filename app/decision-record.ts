import { z } from "zod";

export const DECISION_RECORD_SCHEMA_VERSION = "3.1" as const;
export const MOS_HANDOFF_SCHEMA_VERSION = "2.1" as const;

const idText = z.string().trim().min(1);
const isoDate = z.string().datetime();

export const scoreNoteSchema = z.object({
  rationale: z.string(),
  sourceReference: z.string(),
  uncertainty: z.string(),
});

export const scoreAssessmentSchema = scoreNoteSchema.extend({
  value: z.number().int().min(0).max(10).nullable(),
});

export const criterionSchema = z.object({
  id: idText,
  name: z.string(),
  description: z.string(),
  weight: z.number().positive().finite(),
  minimum: z.number().int().min(0).max(10).nullable(),
});

export const optionSchema = z.object({
  id: idText,
  name: z.string(),
  thesis: z.string(),
  evidenceSummary: z.string(),
  evidenceState: z.enum(["Hypothesis", "Directional", "Validated"]),
  scores: z.record(scoreAssessmentSchema),
});

export const modelSchema = z.object({
  question: z.string(),
  criteria: z.array(criterionSchema).min(1),
  options: z.array(optionSchema).min(2),
}).superRefine((model, ctx) => {
  for (const [key, values] of [["criteria", model.criteria], ["options", model.options]] as const) {
    if (new Set(values.map(value => value.id)).size !== values.length) {
      ctx.addIssue({ code: "custom", path: [key], message: "IDs must be unique" });
    }
  }
  const criterionIds = new Set(model.criteria.map(criterion => criterion.id));
  for (const [optionIndex, option] of model.options.entries()) {
    for (const criterion of model.criteria) {
      if (!(criterion.id in option.scores)) {
        ctx.addIssue({ code: "custom", path: ["options", optionIndex, "scores", criterion.id], message: "Every option must preserve a score entry for every criterion" });
      }
    }
    for (const scoreKey of Object.keys(option.scores)) {
      if (!criterionIds.has(scoreKey)) {
        ctx.addIssue({ code: "custom", path: ["options", optionIndex, "scores", scoreKey], message: "Score refers to an unknown criterion" });
      }
    }
  }
});

export type ScoreAssessment = z.infer<typeof scoreAssessmentSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type DecisionOption = z.infer<typeof optionSchema>;
export type DecisionModel = z.infer<typeof modelSchema>;

export const decisionDraftSchema = z.object({
  selectedOptionId: z.string(),
  rationale: z.string(),
  tradeoffs: z.array(z.string()),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  recordedBy: z.string(),
  decisionRole: z.string(),
  reviewTrigger: z.string(),
  comparisonPrefillFingerprint: z.string().nullable(),
});

export const finalDecisionSchema = decisionDraftSchema.extend({
  selectedOptionName: z.string(),
  status: z.enum(["confirmed", "invalidated"]),
  confirmedAt: isoDate,
  comparisonFingerprint: idText,
  attestation: z.object({ method: z.literal("human_attestation") }),
  sourceBasis: z.literal("current_weighted_comparison_plus_human_judgment"),
  invalidatedAt: isoDate.optional(),
  invalidatedReason: z.string().optional(),
});

export const provenanceSchema = z.object({
  createdAt: isoDate,
  updatedAt: isoDate,
  source: z.literal("gtm-decision-engine"),
  origin: z.enum(["blank", "positioning-example", "imported"]),
  template: z.object({ id: idText, name: idText, syntheticScores: z.boolean() }).nullable(),
  migratedFrom: z.string().optional(),
});

export const decisionRecordSchema = z.object({
  schemaVersion: z.literal(DECISION_RECORD_SCHEMA_VERSION),
  recordType: z.literal("DecisionRecord"),
  id: idText,
  version: z.number().int().positive(),
  status: z.enum(["draft", "decided"]),
  provenance: provenanceSchema,
  model: modelSchema,
  decisionDraft: decisionDraftSchema,
  finalDecision: finalDecisionSchema.nullable(),
  limitations: z.array(z.string()),
}).superRefine((record, ctx) => {
  const confirmed = record.finalDecision?.status === "confirmed";
  if ((record.status === "decided") !== confirmed) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Record status must match the final decision status" });
  }
  if (confirmed && record.finalDecision?.comparisonFingerprint !== comparisonFingerprint(record.model)) {
    ctx.addIssue({ code: "custom", path: ["finalDecision", "comparisonFingerprint"], message: "Confirmed decision no longer matches the comparison" });
  }
  if (record.decisionDraft.selectedOptionId && !record.model.options.some(option => option.id === record.decisionDraft.selectedOptionId)) {
    ctx.addIssue({ code: "custom", path: ["decisionDraft", "selectedOptionId"], message: "Draft selection must refer to a current option" });
  }
});

export type DecisionDraft = z.infer<typeof decisionDraftSchema>;
export type FinalDecision = z.infer<typeof finalDecisionSchema>;
export type DecisionRecord = z.infer<typeof decisionRecordSchema>;

const limitations = [
  "Scores, notes, and source references are human-entered and have not been independently verified.",
  "A final decision is a local human attestation, not an authenticated signature.",
  "A strategic decision does not approve marketing claims, messaging, or an MOS version.",
];

export const emptyScore = (): ScoreAssessment => ({ value: null, rationale: "", sourceReference: "", uncertainty: "" });
export const emptyDecisionDraft = (): DecisionDraft => ({ selectedOptionId: "", rationale: "", tradeoffs: [], assumptions: [], constraints: [], recordedBy: "", decisionRole: "", reviewTrigger: "", comparisonPrefillFingerprint: null });

export function createDecisionRecord(modelInput: unknown, input: {
  id: string;
  now: string;
  origin: "blank" | "positioning-example" | "imported";
  template?: { id: string; name: string; syntheticScores: boolean } | null;
}): DecisionRecord {
  const model = normalizeModel(modelSchema.parse(modelInput));
  return decisionRecordSchema.parse({
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
    recordType: "DecisionRecord",
    id: input.id,
    version: 1,
    status: "draft",
    provenance: {
      createdAt: input.now,
      updatedAt: input.now,
      source: "gtm-decision-engine",
      origin: input.origin,
      template: input.template ?? null,
    },
    model,
    decisionDraft: syncDecisionDraftWithComparison(model, emptyDecisionDraft()),
    finalDecision: null,
    limitations,
  });
}

export function normalizeModel(model: DecisionModel): DecisionModel {
  const criterionIds = new Set(model.criteria.map(criterion => criterion.id));
  return {
    ...model,
    criteria: model.criteria.map(criterion => ({ ...criterion })),
    options: model.options.map(option => ({
      ...option,
      scores: Object.fromEntries(model.criteria.map(criterion => [criterion.id, option.scores[criterion.id] ? { ...option.scores[criterion.id] } : emptyScore()])),
    })).map(option => ({ ...option, scores: Object.fromEntries(Object.entries(option.scores).filter(([key]) => criterionIds.has(key))) })),
  };
}

export function comparisonFingerprint(model: DecisionModel): string {
  const serialized = JSON.stringify({
    question: model.question,
    criteria: model.criteria,
    options: model.options,
  });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function compare(modelInput: DecisionModel) {
  const model = normalizeModel(modelInput);
  const totalWeight = model.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const maximum = totalWeight * 10;
  const results = model.options.map(option => {
    const known = model.criteria.filter(criterion => option.scores[criterion.id].value !== null);
    const knownWeight = known.reduce((sum, criterion) => sum + criterion.weight, 0);
    const weightedTotal = known.reduce((sum, criterion) => sum + option.scores[criterion.id].value! * criterion.weight, 0);
    const configuredMinimums = model.criteria.filter(criterion => criterion.minimum !== null);
    const failedMinimums = configuredMinimums.filter(criterion => option.scores[criterion.id].value !== null && option.scores[criterion.id].value! < criterion.minimum!);
    const unresolvedMinimums = configuredMinimums.filter(criterion => option.scores[criterion.id].value === null);
    return {
      option,
      weightedTotal,
      maximum,
      percentage: maximum ? weightedTotal / maximum * 100 : 0,
      coverage: totalWeight ? knownWeight / totalWeight * 100 : 0,
      complete: known.length === model.criteria.length,
      eligible: failedMinimums.length === 0 && unresolvedMinimums.length === 0,
      failedMinimums,
      unresolvedMinimums,
    };
  });
  const complete = results.every(result => result.complete);
  const eligibleRanked = complete ? results.filter(result => result.eligible).toSorted((a, b) => b.weightedTotal - a.weightedTotal) : [];
  const topTotal = eligibleRanked[0]?.weightedTotal;
  const leaders = topTotal === undefined ? [] : eligibleRanked.filter(result => result.weightedTotal === topTotal);
  return { results, totalWeight, maximum, complete, eligibleRanked, leaders, hasTie: leaders.length > 1 };
}

export function comparisonRecommendation(modelInput: DecisionModel) {
  const model = normalizeModel(modelInput);
  const summary = compare(model);
  if (!summary.complete || summary.leaders.length !== 1) return null;
  const leader = summary.leaders[0];
  const strongestCriteria = model.criteria
    .map(criterion => ({
      name: criterion.name || "Unnamed criterion",
      contribution: leader.option.scores[criterion.id].value! * criterion.weight,
    }))
    .toSorted((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(item => item.name);
  const strongestText = strongestCriteria.length ? ` Its strongest weighted contributions are ${strongestCriteria.join(", ")}.` : "";
  return {
    selectedOptionId: leader.option.id,
    selectedOptionName: leader.option.name,
    weightedTotal: leader.weightedTotal,
    maximum: leader.maximum,
    strongestCriteria,
    comparisonFingerprint: comparisonFingerprint(model),
    rationale: `The current weighted comparison recommends ${leader.option.name || "this option"} at ${leader.weightedTotal} out of ${leader.maximum}.${strongestText} Review the evidence, tradeoffs, and assumptions before recording the human decision.`,
  };
}

export function syncDecisionDraftWithComparison(model: DecisionModel, draft: DecisionDraft): DecisionDraft {
  const recommendation = comparisonRecommendation(model);
  if (!recommendation) {
    return draft.comparisonPrefillFingerprint ? {
      ...draft,
      selectedOptionId: "",
      rationale: "",
      comparisonPrefillFingerprint: null,
    } : draft;
  }
  const mayPrefill = (!draft.selectedOptionId && !draft.rationale.trim()) || Boolean(draft.comparisonPrefillFingerprint);
  if (!mayPrefill) return draft;
  return {
    ...draft,
    selectedOptionId: recommendation.selectedOptionId,
    rationale: recommendation.rationale,
    comparisonPrefillFingerprint: recommendation.comparisonFingerprint,
  };
}

function requireConfirmable(record: DecisionRecord, draft: DecisionDraft) {
  const model = record.model;
  if (!model.question.trim() || model.criteria.some(criterion => !criterion.name.trim()) || model.options.some(option => !option.name.trim())) {
    throw new Error("Name the decision, every criterion, and every option before recording a final decision.");
  }
  const summary = compare(model);
  if (!summary.complete) throw new Error("Complete every score before recording a final decision. Blank is not zero.");
  const selected = summary.results.find(result => result.option.id === draft.selectedOptionId);
  if (!selected) throw new Error("Choose an option before recording a final decision.");
  if (!selected.eligible) throw new Error("The selected option does not meet every configured must-meet threshold.");
  if (!draft.rationale.trim()) throw new Error("Add the rationale for the final decision.");
  if (!draft.recordedBy.trim()) throw new Error("Name the person recording the final decision.");
}

export function confirmDecision(recordInput: unknown, now: string): DecisionRecord {
  const record = decisionRecordSchema.parse(recordInput);
  requireConfirmable(record, record.decisionDraft);
  const finalDecision: FinalDecision = {
    ...record.decisionDraft,
    selectedOptionName: record.model.options.find(option => option.id === record.decisionDraft.selectedOptionId)!.name,
    status: "confirmed",
    confirmedAt: now,
    comparisonFingerprint: comparisonFingerprint(record.model),
    attestation: { method: "human_attestation" },
    sourceBasis: "current_weighted_comparison_plus_human_judgment",
  };
  return decisionRecordSchema.parse({
    ...record,
    version: record.version + 1,
    status: "decided",
    provenance: { ...record.provenance, updatedAt: now },
    finalDecision,
  });
}

export function touchDecisionRecord(recordInput: unknown, patch: Partial<Pick<DecisionRecord, "model" | "decisionDraft">>, now: string, reason: string): DecisionRecord {
  const record = decisionRecordSchema.parse(recordInput);
  const comparisonChanged = patch.model !== undefined && comparisonFingerprint(patch.model) !== comparisonFingerprint(record.model);
  const decisionDetailsChanged = patch.decisionDraft !== undefined && JSON.stringify(patch.decisionDraft) !== JSON.stringify(record.decisionDraft);
  const shouldInvalidate = record.finalDecision?.status === "confirmed" && (comparisonChanged || decisionDetailsChanged);
  const finalDecision = shouldInvalidate ? {
    ...record.finalDecision!,
    status: "invalidated" as const,
    invalidatedAt: now,
    invalidatedReason: reason,
  } : record.finalDecision;
  return decisionRecordSchema.parse({
    ...record,
    ...patch,
    version: record.version + 1,
    status: finalDecision?.status === "confirmed" ? "decided" : "draft",
    provenance: { ...record.provenance, updatedAt: now },
    finalDecision,
  });
}

const legacyCriterionSchema = z.object({ id: idText, name: idText, description: z.string(), weight: z.number().positive().finite(), gate: z.boolean(), minimum: z.number().int().min(0).max(10) });
const legacyOptionSchema = z.object({ id: idText, name: idText, thesis: z.string(), evidence: z.string(), evidenceState: z.enum(["Hypothesis", "Directional", "Validated"]), scores: z.record(z.number().int().min(0).max(10).nullable()) });
const legacyRecordSchema = z.object({
  schemaVersion: z.literal("1.0"), recordType: z.literal("DecisionRecord"), id: idText, version: z.number().int().positive(), status: z.literal("decided"), createdAt: isoDate,
  model: z.object({ question: idText, criteria: z.array(legacyCriterionSchema).min(1), options: z.array(legacyOptionSchema).min(2) }),
  humanDecision: z.object({ selectedOptionId: idText, businessContext: idText, rationale: idText, acceptedTradeoffs: z.array(idText), assumptions: z.array(idText), validationSteps: z.array(idText), reviewTrigger: idText, approver: idText, overrideRationale: z.string(), criteriaConfirmed: z.literal(true) }),
});

function migrateLegacyRecord(input: unknown): DecisionRecord {
  const wrapper = z.object({ recordType: z.literal("MOSAlignmentHandoff"), decisionRecord: z.unknown() }).safeParse(input);
  const legacy = legacyRecordSchema.parse(wrapper.success ? wrapper.data.decisionRecord : input);
  const model: DecisionModel = normalizeModel({
    question: legacy.model.question,
    criteria: legacy.model.criteria.map(criterion => ({ id: criterion.id, name: criterion.name, description: criterion.description, weight: criterion.weight, minimum: criterion.gate ? criterion.minimum : null })),
    options: legacy.model.options.map(option => ({
      id: option.id,
      name: option.name,
      thesis: option.thesis,
      evidenceSummary: option.evidence,
      evidenceState: option.evidenceState,
      scores: Object.fromEntries(legacy.model.criteria.map(criterion => [criterion.id, { ...emptyScore(), value: option.scores[criterion.id] ?? null }])),
    })),
  });
  const decisionDraft: DecisionDraft = {
    selectedOptionId: legacy.humanDecision.selectedOptionId,
    rationale: legacy.humanDecision.rationale,
    tradeoffs: legacy.humanDecision.acceptedTradeoffs,
    assumptions: legacy.humanDecision.assumptions,
    constraints: [legacy.humanDecision.businessContext],
    recordedBy: legacy.humanDecision.approver,
    decisionRole: "",
    reviewTrigger: legacy.humanDecision.reviewTrigger,
    comparisonPrefillFingerprint: null,
  };
  const base = createDecisionRecord(model, { id: legacy.id, now: legacy.createdAt, origin: "imported" });
  const migrated = {
    ...base,
    version: legacy.version,
    provenance: { ...base.provenance, origin: "imported" as const, migratedFrom: wrapper.success ? "Decision Engine v2 MOSAlignmentHandoff 1.0" : "Decision Engine v2 DecisionRecord 1.0" },
    decisionDraft,
  };
  return confirmDecision(migrated, legacy.createdAt);
}

const v30DecisionDraftSchema = z.object({
  selectedOptionId: z.string(), rationale: z.string(), tradeoffs: z.array(z.string()), assumptions: z.array(z.string()), constraints: z.array(z.string()), decisionOwner: z.string(), reviewTrigger: z.string(),
});
const v30FinalDecisionSchema = v30DecisionDraftSchema.extend({
  selectedOptionName: z.string(), status: z.enum(["confirmed", "invalidated"]), confirmedAt: isoDate, comparisonFingerprint: idText,
  attestation: z.object({ method: z.literal("human_attestation") }), invalidatedAt: isoDate.optional(), invalidatedReason: z.string().optional(),
});
const v30ModelSchema = z.object({
  question: z.string(), nonNegotiablesEnabled: z.boolean(), criteria: z.array(criterionSchema).min(1), options: z.array(optionSchema).min(2),
});
const v30RecordSchema = z.object({
  schemaVersion: z.literal("3.0"), recordType: z.literal("DecisionRecord"), id: idText, version: z.number().int().positive(), status: z.enum(["draft", "decided"]),
  provenance: provenanceSchema, model: v30ModelSchema, decisionDraft: v30DecisionDraftSchema, finalDecision: v30FinalDecisionSchema.nullable(), limitations: z.array(z.string()),
});

function migrateV30Record(input: unknown): DecisionRecord {
  const old = v30RecordSchema.parse(input);
  const model = normalizeModel({
    question: old.model.question,
    criteria: old.model.criteria.map(criterion => ({ ...criterion, minimum: old.model.nonNegotiablesEnabled ? criterion.minimum : null })),
    options: old.model.options,
  });
  const decisionDraft: DecisionDraft = syncDecisionDraftWithComparison(model, {
    selectedOptionId: old.decisionDraft.selectedOptionId,
    rationale: old.decisionDraft.rationale,
    tradeoffs: old.decisionDraft.tradeoffs,
    assumptions: old.decisionDraft.assumptions,
    constraints: old.decisionDraft.constraints,
    recordedBy: old.decisionDraft.decisionOwner,
    decisionRole: "",
    reviewTrigger: old.decisionDraft.reviewTrigger,
    comparisonPrefillFingerprint: null,
  });
  const finalDecision = old.finalDecision ? {
    selectedOptionId: old.finalDecision.selectedOptionId,
    selectedOptionName: old.finalDecision.selectedOptionName,
    rationale: old.finalDecision.rationale,
    tradeoffs: old.finalDecision.tradeoffs,
    assumptions: old.finalDecision.assumptions,
    constraints: old.finalDecision.constraints,
    recordedBy: old.finalDecision.decisionOwner,
    decisionRole: "",
    reviewTrigger: old.finalDecision.reviewTrigger,
    comparisonPrefillFingerprint: null,
    status: old.finalDecision.status,
    confirmedAt: old.finalDecision.confirmedAt,
    comparisonFingerprint: old.finalDecision.status === "confirmed" ? comparisonFingerprint(model) : old.finalDecision.comparisonFingerprint,
    attestation: old.finalDecision.attestation,
    sourceBasis: "current_weighted_comparison_plus_human_judgment" as const,
    invalidatedAt: old.finalDecision.invalidatedAt,
    invalidatedReason: old.finalDecision.invalidatedReason,
  } : null;
  return decisionRecordSchema.parse({
    ...old,
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
    provenance: { ...old.provenance, migratedFrom: "Decision Engine DecisionRecord 3.0" },
    model,
    decisionDraft,
    finalDecision,
  });
}

export function importDecisionRecord(input: unknown): { record: DecisionRecord; migrated: boolean } {
  const current = decisionRecordSchema.safeParse(input);
  if (current.success) return { record: current.data, migrated: false };
  const v30 = v30RecordSchema.safeParse(input);
  if (v30.success) return { record: migrateV30Record(v30.data), migrated: true };
  return { record: migrateLegacyRecord(input), migrated: true };
}

export function prepareMosAlignment(input: unknown) {
  const record = decisionRecordSchema.parse(input);
  if (record.finalDecision?.status !== "confirmed") throw new Error("Record a current final decision before creating an MOS alignment handoff.");
  requireConfirmable(record, record.finalDecision);
  if (record.finalDecision.comparisonFingerprint !== comparisonFingerprint(record.model)) throw new Error("The final decision was invalidated by later comparison edits.");
  return {
    schemaVersion: MOS_HANDOFF_SCHEMA_VERSION,
    recordType: "MOSAlignmentHandoff" as const,
    decisionRef: { id: record.id, version: record.version, schemaVersion: record.schemaVersion },
    workflow: "alignment_only" as const,
    generationAllowed: false,
    messagingApproval: "not_granted" as const,
    decisionRecord: record,
    selectedDirection: record.model.options.find(option => option.id === record.finalDecision!.selectedOptionId)!,
    requiredBeforeGeneration: ["Approved versioned Messaging Foundation", "Approved claims, proof, and terminology", "Persona and asset specification", "Resolved brief without mandatory-claim conflicts"],
  };
}

const markdownCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
const markdownValue = (value: string, fallback = "Not provided") => value.trim() || fallback;
const markdownList = (values: string[]) => values.length ? values.map(value => `- ${value}`).join("\n") : "- Not provided";
const scoreText = (value: number | null) => value === null ? "—" : String(value);

export function renderDecisionRecordMarkdown(input: unknown): string {
  const record = decisionRecordSchema.parse(input);
  const summary = compare(record.model);
  const lines: string[] = [
    `# Decision Record: ${markdownValue(record.model.question, "Untitled decision")}`,
    "",
    "> Human-readable companion to the portable DecisionRecord. Use the JSON backup—not this document—to restore or continue editing the decision.",
    "",
    "## Record details",
    "",
    `- **Status:** ${record.status === "decided" ? "Decided" : "Draft"}`,
    `- **Record ID:** \`${record.id}\``,
    `- **Schema:** DecisionRecord ${record.schemaVersion}`,
    `- **Record version:** ${record.version}`,
    `- **Created:** ${record.provenance.createdAt}`,
    `- **Last updated:** ${record.provenance.updatedAt}`,
    `- **Origin:** ${record.provenance.origin}`,
  ];

  if (record.provenance.template) lines.push(`- **Template:** ${record.provenance.template.name}`);
  if (record.provenance.migratedFrom) lines.push(`- **Migrated from:** ${record.provenance.migratedFrom}`);

  lines.push(
    "",
    "## Comparison",
    "",
    `| Criterion | Description | Weight | Must meet | ${record.model.options.map(option => markdownCell(markdownValue(option.name, "Unnamed option"))).join(" | ")} |`,
    `| --- | --- | ---: | ---: | ${record.model.options.map(() => "---:").join(" | ")} |`,
  );

  for (const criterion of record.model.criteria) {
    lines.push(`| ${markdownCell(markdownValue(criterion.name, "Unnamed criterion"))} | ${markdownCell(markdownValue(criterion.description, "—"))} | ${criterion.weight}× | ${criterion.minimum === null ? "—" : `≥ ${criterion.minimum}/10`} | ${record.model.options.map(option => scoreText(option.scores[criterion.id].value)).join(" | ")} |`);
  }

  lines.push(
    `| **Weighted total** |  | **${summary.totalWeight}×** |  | ${summary.results.map(result => `**${result.weightedTotal} / ${result.maximum}**`).join(" | ")} |`,
    `| **Eligibility** |  |  |  | ${summary.results.map(result => !result.complete ? "Incomplete" : result.eligible ? "Eligible" : `Ineligible: ${result.failedMinimums.map(item => markdownCell(item.name)).join(", ")}`).join(" | ")} |`,
    "",
    "_Blank (—) means unknown or unentered. Zero (0) is an explicit score._",
  );

  const optionContext = record.model.options.filter(option => option.thesis.trim() || option.evidenceSummary.trim());
  if (optionContext.length) {
    lines.push("", "## Option context");
    for (const option of optionContext) {
      lines.push(
        "",
        `### ${markdownValue(option.name, "Unnamed option")}`,
        "",
        `- **Evidence label:** ${option.evidenceState}`,
        `- **Thesis:** ${markdownValue(option.thesis)}`,
        `- **Evidence summary:** ${markdownValue(option.evidenceSummary)}`,
      );
    }
  }

  const notedScores = record.model.options.flatMap(option => record.model.criteria.flatMap(criterion => {
    const assessment = option.scores[criterion.id];
    return assessment.rationale.trim() || assessment.sourceReference.trim() || assessment.uncertainty.trim()
      ? [{ option, criterion, assessment }]
      : [];
  }));
  if (notedScores.length) {
    lines.push("", "## Score notes", "", "_Human-entered sources are references and have not been independently verified by the Decision Engine._");
    for (const { option, criterion, assessment } of notedScores) {
      lines.push(
        "",
        `### ${markdownValue(option.name, "Unnamed option")} × ${markdownValue(criterion.name, "Unnamed criterion")} — ${scoreText(assessment.value)}/10`,
        "",
        `- **Rationale:** ${markdownValue(assessment.rationale)}`,
        `- **Supporting source/reference:** ${markdownValue(assessment.sourceReference)}`,
        `- **Uncertainty/caveat:** ${markdownValue(assessment.uncertainty)}`,
      );
    }
  }

  const appendDecisionDetails = (title: string, decision: DecisionDraft & Partial<FinalDecision>) => {
    lines.push(
      "",
      `## ${title}`,
      "",
      `- **Selected option:** ${record.model.options.find(option => option.id === decision.selectedOptionId)?.name || decision.selectedOptionName || "Not selected"}`,
      `- **Recorded by:** ${markdownValue(decision.recordedBy)}`,
      `- **Role/decision authority:** ${markdownValue(decision.decisionRole)}`,
    );
    if (decision.confirmedAt) lines.push(`- **Recorded at:** ${decision.confirmedAt}`);
    if (decision.sourceBasis) lines.push("- **Source:** Current weighted comparison + human judgment");
    if (decision.status === "invalidated") {
      lines.push(
        "- **Confirmation status:** Invalidated",
        `- **Invalidated at:** ${decision.invalidatedAt || "Not recorded"}`,
        `- **Reason:** ${markdownValue(decision.invalidatedReason || "")}`,
      );
    }
    lines.push(
      "",
      "### Rationale",
      "",
      markdownValue(decision.rationale),
      "",
      "### Accepted tradeoffs",
      "",
      markdownList(decision.tradeoffs),
      "",
      "### Assumptions",
      "",
      markdownList(decision.assumptions),
      "",
      "### Constraints",
      "",
      markdownList(decision.constraints),
      "",
      "### Validation or review trigger",
      "",
      markdownValue(decision.reviewTrigger),
    );
  };

  if (record.finalDecision) {
    appendDecisionDetails(record.finalDecision.status === "confirmed" ? "Final decision" : "Earlier final decision — invalidated", record.finalDecision);
    if (record.finalDecision.status === "invalidated") appendDecisionDetails("Current decision draft", record.decisionDraft);
  } else {
    appendDecisionDetails("Decision draft — not yet recorded", record.decisionDraft);
  }

  lines.push("", "## Known limitations", "", ...record.limitations.map(limitation => `- ${limitation}`), "");
  return lines.join("\n");
}
