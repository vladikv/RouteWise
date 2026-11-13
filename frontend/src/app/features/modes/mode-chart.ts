import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TransportMode } from '../../core/api/models';
import { ModeIcon } from '../../shared/ui/mode-icon';
import { TabOption, Tabs } from '../../shared/ui/tabs';
import { MODE_LABELS } from '../../shared/util/labels';

type Metric = 'speed' | 'cost' | 'co2' | 'distance';

interface MetricDefinition {
  id: Metric;
  label: string;
  /** What a longer bar means, so the chart reads without a legend. */
  hint: string;
  value: (mode: TransportMode) => number;
  format: (value: number) => string;
}

const count = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const METRICS: MetricDefinition[] = [
  {
    id: 'speed',
    label: 'Speed',
    hint: 'Longer is faster',
    value: (mode) => mode.avgSpeedKmh,
    format: (value) => `${count.format(value)} km/h`,
  },
  {
    id: 'cost',
    label: 'Cost',
    hint: 'Longer is more expensive per km',
    value: (mode) => mode.costPerKm,
    format: (value) => money.format(value),
  },
  {
    id: 'co2',
    label: 'CO₂',
    hint: 'Longer is more CO₂ per km',
    value: (mode) => mode.co2GramsPerKm,
    format: (value) => `${count.format(value)} g`,
  },
  {
    id: 'distance',
    label: 'Max. distance',
    hint: 'Longer reaches farther',
    value: (mode) => mode.maxDistanceKm,
    format: (value) => `${count.format(value)} km`,
  },
];

let nextId = 0;

/**
 * Horizontal bars of one mode parameter at a time (chosen with tabs), every bar proportional to the
 * largest shown value. The table below lists all parameters as text.
 */
@Component({
  selector: 'app-mode-chart',
  imports: [ModeIcon, Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mode-chart.html',
  styleUrl: './mode-chart.scss',
})
export class ModeChart {
  readonly modes = input.required<TransportMode[]>();

  protected readonly tabs: TabOption<Metric>[] = METRICS.map(({ id, label }) => ({
    value: id,
    label,
  }));
  protected readonly metric = signal<Metric>('speed');
  protected readonly tabsId = `mode-metric-${nextId++}`;
  protected readonly labels = MODE_LABELS;
  protected readonly columns = METRICS;

  protected readonly definition = computed(
    () => METRICS.find(({ id }) => id === this.metric()) ?? METRICS[0],
  );

  protected readonly rows = computed(() => {
    const { value, format } = this.definition();
    const modes = this.modes();
    const largest = Math.max(...modes.map(value), 0);
    return modes.map((mode) => ({
      mode,
      percent: largest > 0 ? (value(mode) / largest) * 100 : 0,
      text: format(value(mode)),
    }));
  });

  protected readonly table = computed(() =>
    this.modes().map((mode) => ({
      mode,
      cells: METRICS.map(({ value, format }) => format(value(mode))),
    })),
  );
}
