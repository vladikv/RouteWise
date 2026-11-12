import { ModeOption } from '../../../core/api/models';
import { LegComparison } from './leg-comparison';
import { MODE_LABELS, durationLabel } from '../../../shared/util/labels';

/**
 * One concrete takeaway from a comparison, computed only from its numbers:
 * what the recommended mode saves against the highest-emitting alternative, or,
 * if it is itself the highest emitter, how much time it gains.
 * Null when there is nothing to compare (no recommendation or a single mode).
 */
export function comparisonInsight(comparison: LegComparison): string | null {
  const recommended = comparison.options.find((option) => option.recommended);
  const others = comparison.options.filter((option) => option.available && !option.recommended);
  if (!recommended || others.length === 0) {
    return null;
  }
  const name = MODE_LABELS[recommended.mode];

  const dirtiest = others.reduce((worst, option) => (co2(option) > co2(worst) ? option : worst));
  const savedCo2 = Math.round(co2(dirtiest) - co2(recommended));
  if (savedCo2 > 0) {
    const savedCost = Math.round(cost(dirtiest) - cost(recommended));
    const money = savedCost > 0 ? ` and ${formatMoney(savedCost, comparison.currency)}` : '';
    return `${name} instead of ${lower(dirtiest)} saves ${savedCo2} kg CO₂${money}.`;
  }

  const nextFastest = others.reduce((best, option) =>
    minutes(option) < minutes(best) ? option : best,
  );
  const savedMinutes = minutes(nextFastest) - minutes(recommended);
  if (savedMinutes > 0) {
    return `${name} is ${durationLabel(savedMinutes)} faster than ${lower(nextFastest)}, the next fastest option.`;
  }
  return null;
}

const co2 = (option: ModeOption): number => option.co2Kg ?? 0;
const cost = (option: ModeOption): number => option.totalCost ?? 0;
const minutes = (option: ModeOption): number => option.durationMinutes ?? 0;
const lower = (option: ModeOption): string => MODE_LABELS[option.mode].toLowerCase();

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
