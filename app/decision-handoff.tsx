"use client";

import { CheckCircle2, ChevronDown, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compare, comparisonRecommendation, type DecisionDraft, type DecisionRecord } from "./decision-record";

const joinLines = (values: string[]) => values.join("\n");
const splitLines = (value: string) => value.split("\n").map(line => line.trim()).filter(Boolean);
const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

export function DecisionHandoff({
  record,
  onDraftChange,
  onConfirm,
}: {
  record: DecisionRecord;
  onDraftChange: (draft: DecisionDraft) => void;
  onConfirm: () => void;
}) {
  const summary = compare(record.model);
  const recommendation = comparisonRecommendation(record.model);
  const draft = record.decisionDraft;
  const selected = summary.results.find(result => result.option.id === draft.selectedOptionId);
  const canConfirm = summary.complete && Boolean(selected?.eligible) && Boolean(record.model.question.trim() && draft.selectedOptionId && draft.rationale.trim() && draft.recordedBy.trim());
  const update = <K extends keyof DecisionDraft>(key: K, value: DecisionDraft[K]) => onDraftChange({
    ...draft,
    [key]: value,
    ...((key === "selectedOptionId" || key === "rationale") ? { comparisonPrefillFingerprint: null } : {}),
  });

  return <section className="panel p-5 sm:p-6" id="final-decision">
    <div>
      <p className="step-label">Final decision</p>
      <h2 className="font-display mt-1 text-xl font-semibold">Record the human decision</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">A complete decision record requires a named human to confirm the selected option and rationale. Working drafts can still be saved, reopened, and downloaded before then.</p>
    </div>

    {record.finalDecision?.status === "confirmed" && <div className="mt-5 flex gap-3 rounded-xl border border-[#69d7c6]/20 bg-[#69d7c6]/8 p-4 text-sm text-[#a8eee4]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/><div><strong>Final decision recorded by {record.finalDecision.recordedBy}.</strong><p className="mt-1 text-white/58">Source: the current weighted comparison plus human judgment. It remains current until the comparison or decision details change.</p></div></div>}
    {record.finalDecision?.status === "invalidated" && <div className="mt-5 flex gap-3 rounded-xl border border-[#f4cc48]/20 bg-[#f4cc48]/8 p-4 text-sm text-[#f4d66f]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0"/><div><strong>Earlier confirmation invalidated.</strong><p className="mt-1 text-white/58">{record.finalDecision.invalidatedReason} Review and record the decision again when ready.</p></div></div>}

    <div className="decision-basis mt-5">
      <div className="flex items-start gap-3">
        <span className="basis-icon"><Sparkles className="h-4 w-4"/></span>
        <div>
          <p className="text-sm font-semibold text-white/85">Prepared from the comparison</p>
          {!summary.complete && <p className="mt-1 text-sm leading-5 text-white/50">No recommendation is prepared until every score is entered. Blank remains unknown, not zero.</p>}
          {summary.complete && summary.leaders.length === 0 && <p className="mt-1 text-sm leading-5 text-white/50">No option meets every must-meet threshold. Resolve the requirement or options before recording a decision.</p>}
          {summary.hasTie && <p className="mt-1 text-sm leading-5 text-white/50">The comparison is tied between {summary.leaders.map(result => result.option.name || "Unnamed option").join(" and ")}. A human must choose and explain the tradeoff.</p>}
          {recommendation && <p className="mt-1 text-sm leading-5 text-white/50">Suggested option: <strong className="text-white/75">{recommendation.selectedOptionName}</strong> at {formatNumber(recommendation.weightedTotal)} / {formatNumber(recommendation.maximum)}. The selection and draft rationale were populated from current scores and weights.</p>}
        </div>
      </div>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div>
        <label className="field-label" htmlFor="chosen-direction">Selected option</label>
        <select id="chosen-direction" className="select-control mt-2" value={draft.selectedOptionId} onChange={event => update("selectedOptionId", event.target.value)}>
          <option value="">Choose explicitly</option>
          {record.model.options.map(option => <option key={option.id} value={option.id}>{option.name || "Unnamed option"}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="recorded-by">Recorded by</label>
        <Input id="recorded-by" placeholder="Name of the person recording the decision" value={draft.recordedBy} onChange={event => update("recordedBy", event.target.value)} className="mt-2 border-white/12 bg-black/15 text-white"/>
      </div>
      <div>
        <label className="field-label" htmlFor="decision-role">Role or decision authority · optional</label>
        <Input id="decision-role" placeholder="e.g. VP Marketing, decision owner" value={draft.decisionRole} onChange={event => update("decisionRole", event.target.value)} className="mt-2 border-white/12 bg-black/15 text-white"/>
      </div>
      <div className="rounded-xl border border-white/8 bg-black/10 p-3">
        <p className="field-label">Decision source</p>
        <p className="mt-2 text-sm leading-5 text-white/62">Current weighted comparison + human judgment</p>
        <p className="mt-1 text-xs leading-5 text-white/38">The engine prepares a recommendation. Recording it is the human attestation.</p>
      </div>
      <div className="md:col-span-2">
        <label className="field-label" htmlFor="decision-rationale">Rationale</label>
        <Textarea id="decision-rationale" value={draft.rationale} onChange={event => update("rationale", event.target.value)} className="mt-2 min-h-28 border-white/12 bg-black/15 text-white"/>
        {draft.comparisonPrefillFingerprint && <p className="mt-2 text-xs text-[#bca7ff]">Drafted deterministically from current scores and weights. Review and edit before recording.</p>}
      </div>
    </div>

    <details className="decision-context group mt-5">
      <summary className="details-summary"><span><span className="step-label">Decision context</span><span className="font-display mt-1 block text-base font-semibold">Tradeoffs, assumptions, constraints, and review trigger</span></span><ChevronDown className="h-5 w-5 text-white/40 transition group-open:rotate-180"/></summary>
      <div className="grid gap-4 border-t border-white/8 p-4 md:grid-cols-2">
        {([
          ["tradeoffs", "Accepted tradeoffs · one per line"],
          ["assumptions", "Assumptions · one per line"],
          ["constraints", "Constraints · one per line"],
        ] as const).map(([key, label]) => <div key={key}>
          <label className="field-label" htmlFor={`decision-${key}`}>{label}</label>
          <Textarea id={`decision-${key}`} value={joinLines(draft[key])} onChange={event => update(key, splitLines(event.target.value))} className="mt-2 min-h-24 border-white/12 bg-black/15 text-white"/>
        </div>)}
        <div>
          <label className="field-label" htmlFor="review-trigger">Validation or review trigger</label>
          <Textarea id="review-trigger" value={draft.reviewTrigger} onChange={event => update("reviewTrigger", event.target.value)} className="mt-2 min-h-24 border-white/12 bg-black/15 text-white"/>
        </div>
      </div>
    </details>

    <details className="decision-context group mt-5">
      <summary className="details-summary"><span><span className="step-label">Example</span><span className="font-display mt-1 block text-base font-semibold">See a recorded final decision</span></span><ChevronDown className="h-5 w-5 text-white/40 transition group-open:rotate-180"/></summary>
      <div className="border-t border-white/8 p-4 sm:p-5">
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div><dt className="field-label">Decision</dt><dd className="mt-1.5 leading-5 text-white/72">Which positioning should we lead with?</dd></div>
          <div><dt className="field-label">Selected option</dt><dd className="mt-1.5 leading-5 text-white/72">AI-visible positioning</dd></div>
          <div><dt className="field-label">Recorded by</dt><dd className="mt-1.5 leading-5 text-white/72">Example decision owner · VP Marketing</dd></div>
          <div><dt className="field-label">Source</dt><dd className="mt-1.5 leading-5 text-white/72">Current weighted comparison + human judgment</dd></div>
          <div className="md:col-span-2"><dt className="field-label">Rationale</dt><dd className="mt-1.5 leading-5 text-white/72">The option leads the completed comparison and best balances customer clarity with future visibility. The decision owner reviewed the evidence and accepted the implementation tradeoff.</dd></div>
          <div><dt className="field-label">Review trigger</dt><dd className="mt-1.5 leading-5 text-white/72">Revisit after 10 customer interviews or 90 days.</dd></div>
          <div><dt className="field-label">Status</dt><dd className="mt-1.5 leading-5 text-[#89eadc]">Recorded against the current comparison</dd></div>
        </dl>
      </div>
    </details>

    <div className="mt-5 rounded-xl border border-[#f4cc48]/16 bg-[#f4cc48]/6 p-4">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#f4cc48]"/><div><p className="text-sm font-semibold text-[#f4d66f]">Judgment stays human</p><p className="mt-1 text-sm leading-5 text-white/52">The engine makes priorities and evidence inspectable. It does not verify sources, choose the strategy, or approve downstream messaging.</p></div></div>
    </div>

    <div className="mt-5">
      <p className="mb-3 max-w-3xl text-sm leading-6 text-white/52">Clicking “Record final decision” marks this DecisionRecord as decided and adds the date, selected option, rationale, decision context, recorder, and a fingerprint tying the decision to the current comparison. It does not send or approve anything elsewhere. If the comparison or decision details change later, the recorded confirmation is invalidated.</p>
      <Button onClick={onConfirm} disabled={!canConfirm} className="bg-[#f4cc48] text-[#120d22] hover:bg-[#ffe274]">Record final decision</Button>
    </div>
    {!summary.complete && <p className="mt-3 text-sm text-white/48">Complete every score before recording the final decision.</p>}
    {summary.complete && !draft.recordedBy.trim() && <p className="mt-3 text-sm text-white/48">Add the name of the person recording the decision.</p>}
  </section>;
}
