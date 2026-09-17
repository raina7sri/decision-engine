type WeightedScore = { weightedTotal: number; maximum: number };

const points = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
const percentage = (score: WeightedScore) => Math.round(score.maximum ? score.weightedTotal / score.maximum * 100 : 0);

export const weightedScoreLabel = (score: WeightedScore) =>
  `${points(score.weightedTotal)} / ${points(score.maximum)} · ${percentage(score)}%`;

export const weightedScoreExplanation = (score: WeightedScore) =>
  `${percentage(score)}% means ${points(score.weightedTotal)} of ${points(score.maximum)} possible weighted points in this comparison. It reflects fit against the selected criteria and weights - not a probability of commercial success.`;
