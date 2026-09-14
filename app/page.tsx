"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight, BrainCircuit, Check, ChevronDown, Clipboard,
  Download, FileJson, FileText, GitBranch, Import, Info, Link2, Plus, RotateCcw, Save,
  Scale, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { blankModel, positioningModel, stageMeta, systemTools } from "./data";
import {
  compare, confirmDecision, createDecisionRecord, decisionRecordSchema, emptyScore,
  importDecisionRecord, prepareMosAlignment, renderDecisionRecordMarkdown, syncDecisionDraftWithComparison, touchDecisionRecord,
  type DecisionDraft, type DecisionModel, type DecisionRecord, type ScoreAssessment,
} from "./decision-record";
import { DecisionHandoff } from "./decision-handoff";

const ACTIVE_KEY = "gtm-decision-engine:active:v3";
const SAVED_KEY = "gtm-decision-engine:saved:v3";
const PREVIOUS_KEY = "gtm-decision-engine:previous:v3";
const INITIAL_TIME = "2026-09-13T00:00:00.000Z";
const initialRecord = createDecisionRecord(blankModel(), { id: "loading-draft", now: INITIAL_TIME, origin: "blank" });

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
const timestamp = () => new Date().toISOString();
const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
const downloadJson = (payload: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const downloadText = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

type PendingReplacement = { label: string; record: DecisionRecord; message: string };
type ActiveScore = { optionId: string; criterionId: string } | null;

function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild>
      <button type="button" className="info-button" aria-label={label} onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(value => !value); }}>
        <Info className="h-3.5 w-3.5"/>
      </button>
    </TooltipTrigger>
    <TooltipContent sideOffset={8} className="max-w-72 border border-white/12 bg-[#f8f5ec] px-3 py-2 text-sm leading-5 text-[#120d22] shadow-xl">{children}</TooltipContent>
  </Tooltip>;
}

export default function Home() {
  const [view, setView] = useState<"decision"|"system">("decision");
  const [record, setRecord] = useState<DecisionRecord>(initialRecord);
  const [hydrated, setHydrated] = useState(false);
  const [savedAvailable, setSavedAvailable] = useState(false);
  const [previousAvailable, setPreviousAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeScore, setActiveScore] = useState<ActiveScore>(null);
  const [pendingReplacement, setPendingReplacement] = useState<PendingReplacement | null>(null);
  const [selectedToolId, setSelectedToolId] = useState("decision");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const active = window.localStorage.getItem(ACTIVE_KEY);
        if (active) {
          setRecord(importDecisionRecord(JSON.parse(active)).record);
          setNotice("Recovered the active draft saved in this browser.");
        } else {
          setRecord(createDecisionRecord(blankModel(), { id: uid("decision"), now: timestamp(), origin: "blank" }));
        }
        setSavedAvailable(Boolean(window.localStorage.getItem(SAVED_KEY)));
        setPreviousAvailable(Boolean(window.localStorage.getItem(PREVIOUS_KEY)));
      } catch {
        setRecord(createDecisionRecord(blankModel(), { id: uid("decision"), now: timestamp(), origin: "blank" }));
        setNotice("The previous browser draft could not be read. A new blank draft is active.");
      } finally {
        setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(record));
  }, [hydrated, record]);

  const model = record.model;
  const summary = useMemo(() => compare(model), [model]);
  const selectedTool = systemTools.find(tool => tool.id === selectedToolId) ?? systemTools[1];
  const scoreContext = activeScore ? {
    option: model.options.find(option => option.id === activeScore.optionId),
    criterion: model.criteria.find(criterion => criterion.id === activeScore.criterionId),
  } : null;

  const replaceModel = (nextModel: DecisionModel, reason = "Comparison inputs changed after confirmation.") => {
    setRecord(current => touchDecisionRecord(current, {
      model: nextModel,
      decisionDraft: syncDecisionDraftWithComparison(nextModel, current.decisionDraft),
    }, timestamp(), reason));
  };
  const mutateModel = (mutator: (model: DecisionModel) => DecisionModel, reason?: string) => {
    const next = mutator(structuredClone(record.model));
    replaceModel(next, reason);
  };
  const updateDraft = (draft: DecisionDraft) => {
    setRecord(current => touchDecisionRecord(current, { decisionDraft: draft }, timestamp(), "Decision details changed after confirmation."));
  };

  const updateCriterion = (id: string, patch: Partial<DecisionModel["criteria"][number]>) => mutateModel(current => ({
    ...current,
    criteria: current.criteria.map(criterion => criterion.id === id ? { ...criterion, ...patch } : criterion),
  }));
  const updateOption = (id: string, patch: Partial<DecisionModel["options"][number]>) => mutateModel(current => ({
    ...current,
    options: current.options.map(option => option.id === id ? { ...option, ...patch } : option),
  }));
  const updateAssessment = (optionId: string, criterionId: string, patch: Partial<ScoreAssessment>) => mutateModel(current => ({
    ...current,
    options: current.options.map(option => option.id === optionId ? {
      ...option,
      scores: { ...option.scores, [criterionId]: { ...option.scores[criterionId], ...patch } },
    } : option),
  }));
  const addCriterion = () => mutateModel(current => {
    const id = uid("criterion");
    return {
      ...current,
      criteria: [...current.criteria, { id, name: "", description: "", weight: 1, minimum: null }],
      options: current.options.map(option => ({ ...option, scores: { ...option.scores, [id]: emptyScore() } })),
    };
  });
  const deleteCriterion = (id: string) => {
    if (model.criteria.length <= 1) return;
    setActiveScore(null);
    mutateModel(current => ({
      ...current,
      criteria: current.criteria.filter(criterion => criterion.id !== id),
      options: current.options.map(option => ({
        ...option,
        scores: Object.fromEntries(Object.entries(option.scores).filter(([criterionId]) => criterionId !== id)),
      })),
    }));
  };
  const addOption = () => mutateModel(current => {
    const id = uid("option");
    return {
      ...current,
      options: [...current.options, {
        id,
        name: `Option ${current.options.length + 1}`,
        thesis: "",
        evidenceSummary: "",
        evidenceState: "Hypothesis",
        scores: Object.fromEntries(current.criteria.map(criterion => [criterion.id, emptyScore()])),
      }],
    };
  });
  const deleteOption = (id: string) => {
    if (model.options.length <= 2) return;
    setActiveScore(null);
    const nextModel = { ...model, options: model.options.filter(option => option.id !== id) };
    const nextDraft = record.decisionDraft.selectedOptionId === id ? { ...record.decisionDraft, selectedOptionId: "" } : record.decisionDraft;
    setRecord(current => touchDecisionRecord(current, { model: nextModel, decisionDraft: nextDraft }, timestamp(), "Comparison inputs changed after confirmation."));
  };

  const makeBlank = () => createDecisionRecord(blankModel(), { id: uid("decision"), now: timestamp(), origin: "blank" });
  const makeExample = () => createDecisionRecord(positioningModel(), {
    id: uid("decision"),
    now: timestamp(),
    origin: "positioning-example",
    template: { id: "positioning-10-original", name: "Original 10-Criteria Positioning Model", syntheticScores: true },
  });
  const requestReplacement = (label: string, nextRecord: DecisionRecord, message: string) => setPendingReplacement({ label, record: nextRecord, message });
  const confirmReplacement = () => {
    if (!pendingReplacement) return;
    window.localStorage.setItem(PREVIOUS_KEY, JSON.stringify(record));
    setPreviousAvailable(true);
    setRecord(pendingReplacement.record);
    setNotice(pendingReplacement.message);
    setPendingReplacement(null);
  };
  const requestStored = (key: string, label: string) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return setNotice("No browser-local draft is available for that action.");
      const parsed = importDecisionRecord(JSON.parse(raw)).record;
      requestReplacement(label, parsed, `${label} opened. The prior active draft is available to restore.`);
    } catch {
      setNotice("The browser-local draft is incompatible or damaged. The active draft was not changed.");
    }
  };
  const saveBrowserDraft = () => {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(record));
    setSavedAvailable(true);
    setNotice("Draft saved in this browser. Download a backup to move it to another browser or device.");
  };
  const exportRecord = () => {
    const validated = decisionRecordSchema.parse(record);
    downloadJson(validated, `decision-record-${validated.id}-v${validated.version}.json`);
    setNotice("Portable DecisionRecord backup downloaded. It includes blank scores, evidence notes, and any decision history.");
  };
  const exportMarkdown = () => {
    const validated = decisionRecordSchema.parse(record);
    downloadText(renderDecisionRecordMarkdown(validated), `decision-report-${validated.id}-v${validated.version}.md`, "text/markdown;charset=utf-8");
    setNotice("Readable Markdown report downloaded. Use the JSON backup if you need to restore or continue editing the decision.");
  };
  const exportMos = () => {
    try {
      const handoff = prepareMosAlignment(record);
      downloadJson(handoff, `mos-alignment-${record.id}-v${record.version}.json`);
      setNotice("Optional MOS alignment adapter downloaded. Messaging and claim approval are not granted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The MOS adapter could not be created.");
    }
  };
  const importFile = async (file: File) => {
    try {
      const imported = importDecisionRecord(JSON.parse(await file.text()));
      requestReplacement("Imported backup", imported.record, imported.migrated ? "Earlier Decision Engine export migrated to DecisionRecord 3.1. Review it before continuing." : "Portable backup imported. The prior active draft is available to restore.");
    } catch {
      setNotice("Import rejected: malformed or incompatible file. The active draft was not changed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const recordFinalDecision = () => {
    try {
      setRecord(current => confirmDecision(current, timestamp()));
      setNotice("Final decision recorded against the current comparison.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The final decision could not be recorded.");
    }
  };

  async function copyReviewBrief() {
    const brief = [
      `Decision: ${model.question || "[not yet named]"}`,
      "",
      "Criteria:",
      ...model.criteria.map(criterion => `- ${criterion.name || "[unnamed criterion]"}: weight ${criterion.weight}x${criterion.minimum !== null ? `; must score at least ${criterion.minimum}/10` : ""}. ${criterion.description}`),
      "",
      "Options:",
      ...model.options.map(option => `- ${option.name || "[unnamed option]"}: ${option.thesis || "[thesis not entered]"}`),
      "",
      "For every option × criterion pair, propose a 0–10 score and provide: rationale, supporting sources or references, contradictory evidence, and unknowns or uncertainty. Distinguish sourced facts from inference. Do not assume human-entered references are verified. Identify failed must-meet thresholds and material gaps. Do not make the final decision for the human owner.",
    ].join("\n");
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <TooltipProvider><main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#120d22]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><div className="brand-mark">A</div><div className="min-w-0"><p className="font-display truncate text-lg font-semibold">Aurics.AI</p><p className="truncate text-xs text-white/50">AI-Native GTM systems</p></div></div>
        <nav aria-label="Prototype views" className="segmented-control"><button className={view==="decision"?"active":""} onClick={()=>setView("decision")}><Scale className="h-4 w-4"/>Decision engine</button><button className={view==="system"?"active":""} onClick={()=>setView("system")}><GitBranch className="h-4 w-4"/>System map</button></nav>
        <div className="hidden items-center gap-2 text-xs text-white/50 md:flex"><span className="h-2 w-2 rounded-full bg-[#69d7c6]"/>Browser-local autosave</div>
      </div>
    </header>

    {view === "decision" ? <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div className="max-w-3xl">
          <div className="eyebrow"><BrainCircuit className="h-3.5 w-3.5"/>Decision infrastructure</div>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Decision Engine</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-white/62">Compare options against what matters, keep the evidence attached, and preserve the human decision.</p>
        </div>
        <Button onClick={copyReviewBrief} variant="outline" className="self-start border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">{copied?<Check className="h-4 w-4"/>:<Clipboard className="h-4 w-4"/>}{copied?"Review brief copied":"Copy external AI-review brief"}</Button>
      </section>

      <section className="how-to-panel mb-5" aria-labelledby="how-to-title">
        <div className="how-to-intro">
          <p className="step-label">How to use</p>
          <h2 id="how-to-title" className="font-display mt-1 text-lg font-semibold">Structure the comparison. Keep the judgment human.</h2>
        </div>
        <ol className="how-to-steps">
          <li><span>1</span><div><strong>Frame</strong><p>Write the decision and options.</p></div></li>
          <li><span>2</span><div><strong>Compare</strong><p>Set criteria, weights, scores, and evidence.</p></div></li>
          <li><span>3</span><div><strong>Decide</strong><p>Review the recommendation and record the human call.</p></div></li>
          <li><span>4</span><div><strong>Preserve</strong><p>Save locally or download a portable record.</p></div></li>
        </ol>
      </section>

      <section className="panel mb-5 p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_auto_auto] xl:items-end">
          <div>
            <div className="label-with-info"><label className="field-label" htmlFor="decision-question">Decision question</label><InfoTip label="About the decision question">Write one specific choice the group needs to make. A good question names the decision without assuming the answer.</InfoTip></div>
            <Input id="decision-question" placeholder="What decision are you making?" value={model.question} onChange={event => mutateModel(current => ({ ...current, question: event.target.value }))} className="mt-2 h-11 border-white/12 bg-black/15 text-base text-white"/>
          </div>
          <div>
            <div className="label-with-info mb-2"><p className="field-label">Browser-local work</p><InfoTip label="About browser-local work">Your active draft recovers after refresh on this browser and device. “Save draft” creates a checkpoint you can reopen. It is not cloud storage.</InfoTip></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={saveBrowserDraft} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Save className="h-4 w-4"/>Save draft</Button>
              <Button size="sm" variant="outline" disabled={!savedAvailable} onClick={() => requestStored(SAVED_KEY, "Saved browser draft")} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">Reopen saved</Button>
              <Button size="sm" variant="ghost" disabled={!previousAvailable} onClick={() => requestStored(PREVIOUS_KEY, "Prior active draft")} className="text-white/55 hover:bg-white/8 hover:text-white">Restore prior</Button>
            </div>
          </div>
          <div>
            <div className="label-with-info mb-2"><p className="field-label">Portable backup</p><InfoTip label="About portable backups">Use the JSON backup to archive, move, share, restore, or continue editing a decision. Download the Markdown report when you want a readable document for people or GitHub. Markdown cannot be imported back into the Engine. Import never replaces active work without warning.</InfoTip></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportRecord} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Download className="h-4 w-4"/>Download backup</Button>
              <input ref={fileInputRef} className="sr-only" id="decision-import" type="file" accept=".json,application/json" onChange={event => event.target.files?.[0] && void importFile(event.target.files[0])}/>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Import className="h-4 w-4"/>Import backup</Button>
              <Button size="sm" variant="outline" onClick={exportMarkdown} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><FileText className="h-4 w-4"/>Readable report (.md)</Button>
              {record.finalDecision?.status === "confirmed" && <span className="inline-flex items-center gap-1"><Button size="sm" variant="outline" onClick={exportMos} className="border-[#a78bfa]/25 bg-[#a78bfa]/8 text-white hover:bg-[#a78bfa]/15 hover:text-white"><Link2 className="h-4 w-4"/>MOS handoff</Button><InfoTip label="About the optional MOS handoff">Optional downstream file for carrying an approved strategy and its provenance into MOS. It does not approve messaging, claims, proof, or asset generation.</InfoTip></span>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
          <span className="text-xs font-semibold uppercase tracking-[.12em] text-white/35">Start from</span>
          <Button size="sm" variant="ghost" onClick={() => requestReplacement("Blank decision", makeBlank(), "New blank decision opened. The prior active draft is available to restore.")} className="text-white/62 hover:bg-white/8 hover:text-white"><RotateCcw className="h-4 w-4"/>Blank</Button>
          <Button size="sm" variant="ghost" onClick={() => requestReplacement("Positioning example", makeExample(), "Original positioning example loaded.")} className="text-white/62 hover:bg-white/8 hover:text-white"><FileJson className="h-4 w-4"/>10-criteria positioning example</Button>
          <span className="ml-auto text-xs text-white/35">{hydrated ? `Record v${record.version} · changes recover after refresh` : "Recovering browser draft…"}</span>
        </div>
        {notice && <p role="status" className="mt-3 rounded-lg border border-[#a78bfa]/15 bg-[#a78bfa]/7 px-3 py-2 text-sm leading-5 text-[#d5c9ff]">{notice}</p>}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:p-5">
          <div><div className="label-with-info"><p className="step-label">Comparison matrix</p><InfoTip label="How to use the comparison matrix">Score every option from 0–10 against each criterion. Blank means unknown; zero is an explicit score. Add a note to preserve rationale, sources, and uncertainty.</InfoTip></div><h2 className="font-display mt-1 text-xl font-semibold">One view of every criterion and option</h2><p className="mt-1 text-sm text-white/48">1× is baseline influence; 2× counts twice as much. Any positive weight is allowed.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={addCriterion} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Plus className="h-4 w-4"/>Criterion</Button>
            <Button variant="outline" size="sm" onClick={addOption} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Plus className="h-4 w-4"/>Option</Button>
          </div>
        </div>
        <div className="matrix-scroll" role="region" aria-label="Editable decision comparison matrix" tabIndex={0}>
          <table className="decision-matrix" style={{ minWidth: `${520 + model.options.length * 170}px` }}>
            <thead>
              <tr>
                <th className="criterion-column">Criterion and description</th>
                <th className="weight-column">Weight</th>
                {model.options.map(option => <th key={option.id} className="option-column">
                  <div className="flex items-start gap-1">
                    <Input aria-label="Option name" value={option.name} onChange={event => updateOption(option.id, { name: event.target.value })} className="h-9 min-w-0 border-transparent bg-transparent px-2 font-semibold text-white hover:border-white/12 focus:border-[#a78bfa]/60"/>
                    <Button variant="ghost" size="icon" disabled={model.options.length <= 2} aria-label={`Delete ${option.name || "option"}`} onClick={() => deleteOption(option.id)} className="h-9 w-9 shrink-0 text-white/28 hover:bg-red-400/10 hover:text-red-300"><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </th>)}
                <th className="delete-column"><span className="sr-only">Delete criterion</span></th>
              </tr>
            </thead>
            <tbody>
              {model.criteria.map((criterion, criterionIndex) => <tr key={criterion.id}>
                <td className="criterion-column">
                  <div className="flex items-start gap-2">
                    <span className="criterion-number">{String(criterionIndex + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <Input aria-label={`Criterion ${criterionIndex + 1} name`} placeholder="Criterion name" value={criterion.name} onChange={event => updateCriterion(criterion.id, { name: event.target.value })} className="h-8 border-transparent bg-transparent px-1 font-medium text-white hover:border-white/12 focus:border-[#a78bfa]/60"/>
                      <Input aria-label={`Description for ${criterion.name || `criterion ${criterionIndex + 1}`}`} placeholder="Optional description" value={criterion.description} onChange={event => updateCriterion(criterion.id, { description: event.target.value })} className="mt-1 h-7 border-transparent bg-transparent px-1 text-sm text-white/48 hover:border-white/12 focus:border-[#a78bfa]/60"/>
                      <div className="criterion-requirement">
                        <label><input type="checkbox" checked={criterion.minimum !== null} onChange={event => updateCriterion(criterion.id, { minimum: event.target.checked ? 6 : null })}/><span>Must meet</span></label>
                        <InfoTip label={`About the must-meet threshold for ${criterion.name || `criterion ${criterionIndex + 1}`}`}>Use this only for a true requirement. Example: if Security must score at least 8, an option scoring 7 on Security is ineligible even if it has the highest weighted total. It stays visible for comparison, but cannot be recommended or recorded unless the score or threshold changes.</InfoTip>
                        {criterion.minimum !== null && <><Input aria-label={`Minimum required score for ${criterion.name || "criterion"}`} type="number" min="0" max="10" step="1" value={criterion.minimum} onChange={event => updateCriterion(criterion.id, { minimum: Math.max(0, Math.min(10, Math.round(Number(event.target.value)))) })} className="h-7 w-14 border-white/12 bg-black/20 px-1 text-center text-sm text-white"/><span className="text-xs text-white/38">/10</span></>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="weight-column">
                  <Input aria-label={`Weight for ${criterion.name || `criterion ${criterionIndex + 1}`}`} type="number" min="0.01" step="any" value={criterion.weight} onChange={event => { const value = Number(event.target.value); if (value > 0 && Number.isFinite(value)) updateCriterion(criterion.id, { weight: value }); }} className="h-9 w-20 border-white/12 bg-black/15 text-center font-semibold text-[#f4cc48]"/>
                </td>
                {model.options.map(option => {
                  const assessment = option.scores[criterion.id];
                  const hasNotes = Boolean(assessment.rationale || assessment.sourceReference || assessment.uncertainty);
                  return <td key={option.id} className="score-column">
                    <div className="score-cell">
                      <Input
                        aria-label={`${option.name || "Unnamed option"} score for ${criterion.name || "unnamed criterion"}`}
                        type="number" min="0" max="10" step="1" placeholder="—"
                        value={assessment.value ?? ""}
                        onChange={event => {
                          if (event.target.value === "") return updateAssessment(option.id, criterion.id, { value: null });
                          const value = Number(event.target.value);
                          if (Number.isFinite(value)) updateAssessment(option.id, criterion.id, { value: Math.max(0, Math.min(10, Math.round(value))) });
                        }}
                        className="h-10 w-16 border-white/12 bg-black/15 text-center text-base font-semibold text-white"
                      />
                      <button type="button" className={`note-button ${hasNotes ? "has-notes" : ""}`} aria-label={`Open rationale and evidence for ${option.name || "option"} on ${criterion.name || "criterion"}`} onClick={() => setActiveScore({ optionId: option.id, criterionId: criterion.id })}><FileText className="h-4 w-4"/></button>
                    </div>
                  </td>;
                })}
                <td className="delete-column"><Button variant="ghost" size="icon" disabled={model.criteria.length <= 1} aria-label={`Delete ${criterion.name || "criterion"}`} onClick={() => deleteCriterion(criterion.id)} className="text-white/25 hover:bg-red-400/10 hover:text-red-300"><Trash2 className="h-4 w-4"/></Button></td>
              </tr>)}
            </tbody>
            <tfoot>
              <tr>
                <th className="criterion-column"><span className="font-display text-base">Weighted total</span><span className="ml-2 text-xs font-normal text-white/38">full maximum denominator</span></th>
                <th className="weight-column">{formatNumber(summary.totalWeight)}×</th>
                {summary.results.map(result => <th key={result.option.id} className="score-column">
                  <span className="text-base text-[#f4cc48]">{formatNumber(result.weightedTotal)}</span>
                  <span className="text-white/35"> / {formatNumber(result.maximum)}</span>
                  {!result.complete && <span className="mt-1 block text-xs font-normal text-white/45">partial · {Math.round(result.coverage)}% filled</span>}
                </th>)}
                <th className="delete-column"/>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
        <div className="space-y-5">
          <details className="panel group">
            <summary className="details-summary"><span><span className="label-with-info"><span className="step-label">Optional context</span><InfoTip label="About optional context">Use this when a short thesis or evidence summary will help another person understand the options. Score-specific support belongs in the note beside each score.</InfoTip></span><span className="font-display mt-1 block text-lg font-semibold">Option thesis and evidence summary</span></span><ChevronDown className="h-5 w-5 text-white/40 transition group-open:rotate-180"/></summary>
            <div className="grid gap-4 border-t border-white/8 p-4 md:grid-cols-2 sm:p-5">
              {model.options.map(option => <div key={option.id} className="rounded-xl border border-white/8 bg-black/10 p-4">
                <p className="font-medium text-white/85">{option.name || "Unnamed option"}</p>
                <label className="field-label mt-4 block" htmlFor={`thesis-${option.id}`}>Thesis</label>
                <Textarea id={`thesis-${option.id}`} value={option.thesis} onChange={event => updateOption(option.id, { thesis: event.target.value })} className="mt-2 min-h-20 border-white/12 bg-black/15 text-white"/>
                <label className="field-label mt-4 block" htmlFor={`evidence-${option.id}`}>Evidence summary</label>
                <Textarea id={`evidence-${option.id}`} value={option.evidenceSummary} onChange={event => updateOption(option.id, { evidenceSummary: event.target.value })} className="mt-2 min-h-20 border-white/12 bg-black/15 text-white"/>
                <label className="field-label mt-4 block" htmlFor={`evidence-state-${option.id}`}>Human evidence label</label>
                <select id={`evidence-state-${option.id}`} className="select-control mt-2" value={option.evidenceState} onChange={event => updateOption(option.id, { evidenceState: event.target.value as typeof option.evidenceState })}><option>Hypothesis</option><option>Directional</option><option>Validated</option></select>
              </div>)}
            </div>
          </details>

          <DecisionHandoff record={record} onDraftChange={updateDraft} onConfirm={recordFinalDecision}/>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <section className="panel glow-panel overflow-hidden">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center justify-between gap-3"><p className="step-label">Comparison status</p><span className={`state-pill ${summary.complete ? summary.leaders.length ? "good" : "blocked" : "watch"}`}>{summary.complete ? summary.leaders.length ? "Complete" : "No eligible option" : "Incomplete"}</span></div>
              {!summary.complete ? <><h2 className="font-display mt-4 text-2xl font-semibold">No leader yet</h2><p className="mt-2 text-sm leading-6 text-white/55">Partial totals stay usable, but blanks are not normalized away. Enter every score before treating the comparison as ranked.</p></> : summary.leaders.length === 0 ? <><h2 className="font-display mt-4 text-2xl font-semibold">No eligible option</h2><p className="mt-2 text-sm leading-6 text-white/55">Every option misses at least one must-meet threshold. Revisit the options or the requirement.</p></> : summary.hasTie ? <><h2 className="font-display mt-4 text-2xl font-semibold">Tie at current weights</h2><p className="mt-2 text-sm leading-6 text-white/55">{summary.leaders.map(result => result.option.name || "Unnamed option").join(" and ")} share the top weighted total.</p></> : <><p className="mt-4 text-sm text-white/45">Leading at current weights</p><h2 className="font-display mt-1 text-2xl font-semibold">{summary.leaders[0].option.name || "Unnamed option"}</h2><p className="mt-2 text-sm leading-6 text-white/55">This is a deterministic comparison, not a probability of success or the final human decision.</p></>}
            </div>
            <div className="space-y-4 p-5">
              {summary.results.map(result => <div key={result.option.id}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-white/72">{result.option.name || "Unnamed option"}</span><span className="font-semibold">{formatNumber(result.weightedTotal)} / {formatNumber(result.maximum)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/7"><div className="h-full rounded-full bg-gradient-to-r from-[#f4cc48] to-[#a78bfa]" style={{width:`${result.percentage}%`}}/></div>
                <p className="mt-1 text-xs text-white/42">{result.complete ? "All scores entered" : `${Math.round(result.coverage)}% of weighted criteria scored`}{result.failedMinimums.length ? ` · Fails: ${result.failedMinimums.map(item => item.name).join(", ")}` : ""}</p>
              </div>)}
            </div>
          </section>
        </aside>
      </div>
    </div> : <SystemMap selectedToolId={selectedToolId} setSelectedToolId={setSelectedToolId} selectedTool={selectedTool}/>}

    <footer className="mx-auto flex max-w-[1600px] flex-col justify-between gap-2 border-t border-white/8 px-4 py-6 text-xs text-white/34 sm:flex-row sm:px-6 lg:px-8"><span>Aurics.AI · Strategy + systems + ship</span><span>DecisionRecord schema 3.1 · browser-local by default</span></footer>

    <Dialog open={Boolean(activeScore)} onOpenChange={open => !open && setActiveScore(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/12 bg-[#19122e] text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Score rationale and evidence</DialogTitle>
          <DialogDescription className="text-white/55">{scoreContext?.option?.name || "Option"} × {scoreContext?.criterion?.name || "criterion"}</DialogDescription>
        </DialogHeader>
        {activeScore && scoreContext?.option && scoreContext.criterion && (() => {
          const assessment = scoreContext.option.scores[activeScore.criterionId];
          return <div className="space-y-4">
            <div><label className="field-label" htmlFor="score-dialog-value">Score · blank means unknown</label><Input id="score-dialog-value" type="number" min="0" max="10" step="1" placeholder="—" value={assessment.value ?? ""} onChange={event => updateAssessment(activeScore.optionId, activeScore.criterionId, { value: event.target.value === "" ? null : Math.max(0, Math.min(10, Math.round(Number(event.target.value)))) })} className="mt-2 w-24 border-white/12 bg-black/20 text-white"/></div>
            <div><label className="field-label" htmlFor="score-rationale">Rationale</label><Textarea id="score-rationale" value={assessment.rationale} onChange={event => updateAssessment(activeScore.optionId, activeScore.criterionId, { rationale: event.target.value })} className="mt-2 min-h-24 border-white/12 bg-black/20 text-white"/></div>
            <div><label className="field-label" htmlFor="score-source">Supporting source or reference</label><Textarea id="score-source" value={assessment.sourceReference} onChange={event => updateAssessment(activeScore.optionId, activeScore.criterionId, { sourceReference: event.target.value })} className="mt-2 min-h-20 border-white/12 bg-black/20 text-white"/></div>
            <div><label className="field-label" htmlFor="score-uncertainty">Uncertainty or caveat</label><Textarea id="score-uncertainty" value={assessment.uncertainty} onChange={event => updateAssessment(activeScore.optionId, activeScore.criterionId, { uncertainty: event.target.value })} className="mt-2 min-h-20 border-white/12 bg-black/20 text-white"/></div>
            <div className="flex gap-2 rounded-lg border border-[#f4cc48]/15 bg-[#f4cc48]/6 p-3 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#f4cc48]"/>Human-entered sources are references. The Decision Engine does not independently retrieve or verify them.</div>
          </div>;
        })()}
        <DialogFooter><Button variant="outline" onClick={() => setActiveScore(null)} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(pendingReplacement)} onOpenChange={open => !open && setPendingReplacement(null)}>
      <AlertDialogContent className="border-white/12 bg-[#19122e] text-white">
        <AlertDialogHeader><AlertDialogTitle>Replace the active draft?</AlertDialogTitle><AlertDialogDescription className="text-white/55">{pendingReplacement?.label} will become active. The current draft will be kept as “Prior active draft” so it can be restored.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">Keep current</AlertDialogCancel><AlertDialogAction onClick={confirmReplacement} className="bg-[#f4cc48] text-[#120d22] hover:bg-[#ffe274]">Replace and preserve current</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main></TooltipProvider>;
}

function SystemMap({selectedToolId,setSelectedToolId,selectedTool}:{selectedToolId:string;setSelectedToolId:(id:string)=>void;selectedTool:(typeof systemTools)[number]}) {
  const Icon = selectedTool.icon;
  return <div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8">
    <section className="mb-8 max-w-4xl"><div className="eyebrow"><GitBranch className="h-3.5 w-3.5"/>System architecture</div><h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From customer truth to compounding GTM</h1><p className="mt-3 max-w-3xl text-base leading-7 text-white/62">Each system performs a specific job, hands governed context to the next, and returns market evidence to the strategic foundation.</p></section>
    <section className="stage-rail" aria-label="GTM system stages">{stageMeta.map((stage,index)=><div key={stage.key} className="stage-head" style={{"--stage-color":stage.color} as CSSProperties}><div className="flex items-center gap-3"><span className="stage-index">{String(index+1).padStart(2,"0")}</span><div><h2 className="font-display text-base font-semibold">{stage.label}</h2><p className="mt-0.5 text-xs text-white/38">{stage.question}</p></div></div>{index<stageMeta.length-1&&<ArrowRight className="stage-arrow h-4 w-4"/>}</div>)}</section>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,.65fr)]">
      <section className="system-board">{stageMeta.map(stage=><div key={stage.key} className="stage-column" style={{"--stage-color":stage.color} as CSSProperties}><div className="mobile-stage-label"><span/>{stage.label}</div><div className="space-y-3">{systemTools.filter(tool=>tool.stage===stage.key).map(tool=>{const ToolIcon=tool.icon;return <button key={tool.id} onClick={()=>setSelectedToolId(tool.id)} className={`tool-card ${selectedToolId===tool.id?"active":""}`}><span className="tool-icon"><ToolIcon className="h-4 w-4"/></span><span className="min-w-0"><span className="block text-xs text-white/38">{tool.status}</span><strong className="font-display mt-1 block text-left text-base leading-snug">{tool.name}</strong></span></button>})}</div></div>)}<div className="feedback-line"><RotateCcw className="h-4 w-4"/>Evidence returns to customer insight, positioning, and the MOS</div></section>
      <aside className="panel detail-panel p-5 sm:p-6 xl:sticky xl:top-24 xl:self-start"><div className="flex items-start justify-between gap-4"><span className="tool-icon large"><Icon className="h-5 w-5"/></span><span className="state-pill good">{selectedTool.status}</span></div><p className="mt-5 text-xs font-semibold uppercase tracking-[.16em] text-white/35">{stageMeta.find(stage=>stage.key===selectedTool.stage)?.label}</p><h2 className="font-display mt-2 text-2xl font-semibold">{selectedTool.name}</h2><p className="mt-3 text-sm leading-6 text-white/60">{selectedTool.job}</p><div className="mt-6 space-y-4"><div className="detail-row"><span>Inputs</span><p>{selectedTool.inputs}</p></div><div className="detail-row"><span>Outputs</span><p>{selectedTool.outputs}</p></div><div className="detail-row"><span>Feeds</span><p>{selectedTool.feeds}</p></div></div><div className="mt-6 grid gap-3"><div className="boundary-card human"><span>Human judgment</span><p>{selectedTool.human}</p></div><div className="boundary-card system"><span>System execution</span><p>{selectedTool.system}</p></div></div>{"repositoryUrl" in selectedTool&&selectedTool.repositoryUrl&&<div className="mt-5 flex flex-wrap gap-4 text-sm"><a href={selectedTool.repositoryUrl} className="text-[#a9c3ff] underline underline-offset-4">GitHub repository</a><a href={selectedTool.deploymentUrl} className="text-[#a9c3ff] underline underline-offset-4">Open Decision Engine</a></div>}{"roadmap" in selectedTool&&selectedTool.roadmap&&<div className="mt-4 rounded-xl border border-[#7ea6ff]/20 bg-[#7ea6ff]/8 p-4 text-sm text-white/65"><span className="font-semibold text-[#a9c3ff]">Roadmap:</span> {selectedTool.roadmap}</div>}</aside>
    </div>
    <section className="mt-5 grid gap-5 md:grid-cols-3"><div className="system-principle"><span>01</span><h3>One source of strategic truth</h3><p>Positioning, claims, persona, proof, and priorities move together.</p></div><div className="system-principle"><span>02</span><h3>Human approval at consequential points</h3><p>AI prepares, checks, and explains. People own decisions and exceptions.</p></div><div className="system-principle"><span>03</span><h3>Learning returns to the foundation</h3><p>Visibility, responses, and customer proof improve the next decision.</p></div></section>
  </div>;
}
