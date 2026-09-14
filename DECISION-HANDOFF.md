# Portable decision contracts

The executable contracts and operations live in `app/decision-record.ts`. This document describes the current **DecisionRecord 3.1** and **MOSAlignmentHandoff 2.1**. Schema version and record revision are different: `schemaVersion` describes the format; `version` advances as a particular record is edited or confirmed.

## DecisionRecord 3.1

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `recordType` | Literal `3.1` and `DecisionRecord` |
| `id`, `version` | Stable nonempty record ID and positive integer revision |
| `status` | `draft` or `decided`; decided requires a current confirmed final decision |
| `provenance` | Created/updated ISO timestamps; source `gtm-decision-engine` (a compatibility identifier, not a GTM-only requirement); origin `blank`, `positioning-example`, or `imported`; nullable template metadata; optional migration origin |
| `model` | Decision question, criteria, options, and score assessments |
| `decisionDraft` | Editable selection, rationale, tradeoffs, assumptions, constraints, named recorder, optional role text, review trigger, and nullable comparison-prefill fingerprint |
| `finalDecision` | Null, a confirmed snapshot, or an invalidated earlier snapshot |
| `limitations` | Human/system boundary statements accompanying the record |

### Model

At least one criterion and two options are required. Criterion and option IDs must each be unique. Every option has exactly one score entry for every criterion and no orphan score keys.

- Criterion: `id`, `name`, `description`, positive finite `weight`, and `minimum` (null or integer 0–10). Null disables the Must meet requirement. Zero is an enabled threshold of zero.
- Option: `id`, `name`, `thesis`, `evidenceSummary`, `evidenceState` (`Hypothesis`, `Directional`, or `Validated`), and `scores` keyed by criterion ID. Evidence state is human-entered, not a verification result.
- Score assessment: `value` (null or integer 0–10), `rationale`, `sourceReference`, and `uncertainty`. Null is unknown; 0 is scored. Notes survive even when a value is blank.

For each option, weighted total is the sum of score × weight over entered scores. Maximum is 10 × the sum of **all** criterion weights. Coverage is known weight divided by all weight. Partial totals are not normalized into a leader. Ranking requires the entire comparison to be complete. Failed or unresolved requirements prevent eligibility. Only one eligible top score produces a deterministic recommendation; ties and no eligible options produce none.

### Human decision and invalidation

Confirmation requires a named decision question, all criteria/options named, every score completed, an eligible selected option, nonblank rationale, and nonblank `recordedBy`. The human can choose an eligible option other than the calculated leader, including resolving a tie. The engine does not authenticate the recorder.

A final snapshot adds `selectedOptionName`, `status`, `confirmedAt`, `comparisonFingerprint`, `attestation: { method: "human_attestation" }`, and `sourceBasis: "current_weighted_comparison_plus_human_judgment"`. Invalidated snapshots also retain `invalidatedAt` and `invalidatedReason`.

`comparisonPrefillFingerprint` tracks deterministic draft provenance. The comparison fingerprint is an FNV-1a change detector, not a cryptographic signature. `touchDecisionRecord` increments the record revision and invalidates a confirmed decision after comparison or decision-detail changes. The earlier snapshot remains inspectable; a fresh confirmation is required. Use the shared operations instead of treating UI state as the contract.

## JSON and Markdown

`importDecisionRecord` validates current JSON and intentionally migrates supported older formats. Current-schema JSON export/import preserves the canonical record, including incomplete scores, evidence notes, provenance, and invalidated decisions. Do not depend on unknown extension fields being retained: Zod strips fields outside the contract.

DecisionRecord 3.0 migrates its older non-negotiables representation into criterion-level thresholds; formerly disabled minimums stay disabled. Earlier Decision Engine v2 payloads (DecisionRecord 1.0 and MOSAlignmentHandoff 1.0) are supported by the legacy migration. Do not assume arbitrary versions or every MOS wrapper can be imported as a backup. Use the nested canonical record with an adapter-aware consumer when appropriate.

`renderDecisionRecordMarkdown` validates and renders the record in shared logic. Reports include matrix, weights, requirements, blank/zero state, totals, option context, score notes, draft/final/invalidated decision details, recorder, provenance, review trigger, and limitations. Table pipes are escaped and cell newlines become `<br>`. Reports are for reading, not lossless import. User-authored prose should be treated as untrusted Markdown when rendered elsewhere.

## MOSAlignmentHandoff 2.1

`prepareMosAlignment` requires a valid current confirmed decision and rechecks confirmation eligibility and the comparison fingerprint. It returns:

| Field | Value |
| --- | --- |
| `schemaVersion`, `recordType` | `2.1`, `MOSAlignmentHandoff` |
| `decisionRef` | Decision ID, revision, and DecisionRecord schema version |
| `workflow` | `alignment_only` |
| `generationAllowed` | `false` |
| `messagingApproval` | `not_granted` |
| `decisionRecord` | Complete DecisionRecord 3.1 snapshot |
| `selectedDirection` | Selected option with its scores and context |
| `requiredBeforeGeneration` | Approved versioned Messaging Foundation; approved claims, proof, terminology; persona and asset specification; resolved brief without mandatory-claim conflicts |

MOS is optional and no MOS setup is needed for generic decisions. Export is manual; this repository does not modify or call an MOS repository. Consumers must validate the contract, preserve source identity/revision, and keep messaging approval separate. Source edits do not automatically revoke or replace a previously downloaded/imported snapshot. Automatic stale-state synchronization is not implemented.
