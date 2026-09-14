import { BarChart3, Eye, Layers3, MessageSquareText, Scale, Search, ShieldCheck } from "lucide-react";
import { emptyScore, type DecisionModel } from "./decision-record";

export type StageKey = "insight"|"foundation"|"activation"|"feedback"|"scale";

export const blankModel = (): DecisionModel => ({
  question: "",
  criteria: [{ id: "criterion-1", name: "", description: "", weight: 1, minimum: null }],
  options: ["Option 1", "Option 2"].map((name, index) => ({
    id: `option-${index + 1}`,
    name,
    thesis: "",
    evidenceSummary: "",
    evidenceState: "Hypothesis" as const,
    scores: { "criterion-1": emptyScore() },
  })),
});

export const positioningModel = (): DecisionModel => {
  const criteria = [
    {id:"clarity",name:"Ease of Understanding",description:"Can the intended audience explain it quickly and accurately?",weight:2,minimum:null},
    {id:"need",name:"Customer Needs Match",description:"Does it address a primary customer problem supported by evidence?",weight:2,minimum:null},
    {id:"value",name:"Immediate Value Clarity",description:"Is the outcome and reason to care apparent without a long explanation?",weight:2,minimum:null},
    {id:"durability",name:"Tech Pivot Protection",description:"Does the value remain useful as underlying AI capabilities improve?",weight:2,minimum:null},
    {id:"discovery",name:"AEO-Friendly",description:"Does it connect to language and queries buyers use in AI search?",weight:2,minimum:null},
    {id:"difference",name:"Unique vs. Competitors",description:"Does it create a meaningful and supportable reason to choose this option?",weight:1,minimum:null},
    {id:"price",name:"Pricing Justification",description:"Can the promised value support the intended commercial model?",weight:1,minimum:null},
    {id:"screenshot",name:"Marketing Screenshot",description:"Can the promise be shown clearly and credibly in a simple marketing screenshot?",weight:1,minimum:null},
    {id:"future",name:"Future-Facing",description:"Does it leave room for intended product and market expansion?",weight:1,minimum:null},
    {id:"partner",name:"Partner Potential",description:"Does it give relevant partners a credible reason to participate?",weight:1,minimum:null},
  ];
  const makeScores = (values: number[]) => Object.fromEntries(criteria.map((criterion, index) => [
    criterion.id,
    { ...emptyScore(), value: values[index], rationale: "Illustrative score only; replace with your judgment and evidence." },
  ]));
  return {
    question:"Which positioning should lead the company narrative?",
    criteria,
    options:[
      {id:"ai-visible",name:"AI-visible content",thesis:"Lead with helping B2B companies become visible, understood, and selected inside AI-generated answers.",evidenceSummary:"Synthetic example assembled to demonstrate the comparison workflow.",evidenceState:"Hypothesis",scores:makeScores([9,9,9,8,10,8,8,8,8,8])},
      {id:"branded",name:"Branded/customizable content",thesis:"Lead with producing brand-consistent content that teams can customize.",evidenceSummary:"Synthetic example assembled to demonstrate the comparison workflow.",evidenceState:"Hypothesis",scores:makeScores([9,8,7,5,5,6,7,7,6,6])},
      {id:"velocity",name:"Content velocity",thesis:"Lead with producing more content, faster, through AI-assisted execution.",evidenceSummary:"Synthetic example assembled to demonstrate the comparison workflow.",evidenceState:"Hypothesis",scores:makeScores([8,7,7,4,6,5,5,7,7,5])},
    ],
  };
};

export const stageMeta:Array<{key:StageKey;label:string;question:string;color:string}> = [
  {key:"insight",label:"Customer insight",question:"What is true?",color:"#69d7c6"},
  {key:"foundation",label:"Foundation building",question:"What will we choose?",color:"#f4cc48"},
  {key:"activation",label:"Activation",question:"How will it reach market?",color:"#a78bfa"},
  {key:"feedback",label:"Feedback loop",question:"What is the market telling us?",color:"#ff8f70"},
  {key:"scale",label:"Scale",question:"What becomes reusable?",color:"#7ea6ff"},
];

export const systemTools = [
  {id:"research",name:"AI-Native Customer Research",stage:"insight" as StageKey,status:"Working workflow",icon:Search,job:"Supplements human interviews by consolidating market evidence, customer language, alternatives, pains, and objections.",inputs:"Interviews, calls, reviews, market sources, competitive signals",outputs:"Problem evidence, persona language, objections, hypotheses",feeds:"GTM Decision Engine and Messaging OS",human:"Sets the research question, judges source quality, and decides what counts as signal.",system:"Finds, clusters, compares, and synthesizes patterns across sources."},
  {id:"decision",name:"GTM Decision Engine",stage:"foundation" as StageKey,status:"Prototype built",icon:Scale,job:"Compares strategic options against company-specific criteria, weights, true must-meet thresholds, and evidence.",inputs:"Strategic options, stakeholder priorities, evidence, company constraints",outputs:"Comparison, tradeoffs, assumptions, portable decision record",feeds:"Customer validation and optional Messaging OS adapter",human:"Defines the decision, approves criteria, challenges scores, and records the final call.",system:"Structures the comparison, preserves evidence notes, prepares a deterministic recommendation, and exposes missing scores."},
  {id:"mos",name:"Messaging Operating System",stage:"foundation" as StageKey,status:"Built · Interactive next",icon:Layers3,job:"Turns one approved narrative source into consistent, persona-adapted messaging across channels and stages.",inputs:"Story Spine, persona, priority matrix, claims, evidence, voice",outputs:"Governed message foundation, asset briefs, validation rules",feeds:"Every activation system",human:"Approves the story, claims, priorities, terminology, voice, and consequential changes.",system:"Resolves briefs, adapts messages, generates drafts, and checks alignment."},
  {id:"response",name:"Customer Response Engine",stage:"activation" as StageKey,status:"Shipped · Open source",icon:MessageSquareText,job:"Applies an organizational playbook to customer-facing communications and surfaces only the decisions requiring judgment.",inputs:"Incoming communication, approved playbook, business context, escalation rules",outputs:"Analysis, explained draft, escalation recommendation, approved response",feeds:"Customer signal repository and playbook updates",human:"Sets policy, resolves exceptions, approves sensitive responses, and owns the relationship.",system:"Classifies, applies the playbook, drafts, explains, and routes exceptions."},
  {id:"visibility",name:"AI Visibility Scorecard",stage:"feedback" as StageKey,status:"Shipped · Open source",icon:Eye,job:"Measures whether AI assistants select, cite, describe, and recommend the brand accurately across priority queries.",inputs:"Priority queries, brand claims, competitors, AI-assistant responses",outputs:"Visibility gaps, assistant-level failures, citation and message findings",feeds:"Positioning, MOS, content priorities, and technical AEO work",human:"Chooses the commercially important queries and decides which gaps merit action.",system:"Runs checks, normalizes results, scores patterns, and flags changes.",roadmap:"Add Google AI Overviews as a measured surface."},
  {id:"proof",name:"Customer Proof AI Layer",stage:"feedback" as StageKey,status:"Shipped · Open source",icon:ShieldCheck,job:"Turns rough customer material into governed proof that Product Marketing, Customer Marketing, Sales, and CS can reuse.",inputs:"Transcripts, QBR notes, call excerpts, permissions, claim standards",outputs:"Approved Customer Proof Records with scope, evidence, and usage controls",feeds:"MOS claims, sales proof, customer marketing, PR, and the next positioning decision",human:"Approves the claim, permission, context, and allowable use.",system:"Extracts evidence, structures records, detects overstatement, and retrieves relevant proof."},
  {id:"propagation",name:"Governed Propagation",stage:"scale" as StageKey,status:"System capability",icon:BarChart3,job:"Carries approved context, claims, proof, and rules across teams, channels, and repeatable workflows.",inputs:"Approved MOS context, proof records, playbooks, feedback signals",outputs:"Consistent assets, reusable briefs, automated checks, institutional learning",feeds:"Every GTM team and the next operating cycle",human:"Sets decision rights, approval gates, quality standards, and change control.",system:"Retrieves context, adapts execution, validates outputs, and propagates approved updates."},
];
