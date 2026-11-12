import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Advice } from '../../../core/api/models';

/** The advisor's explanation of the recommendation, and who wrote it. */
@Component({
  selector: 'app-advice-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = advice();
    <p class="summary">{{ data.summary }}</p>
    @if (data.legs.length > 1) {
      <ol class="legs" aria-label="Leg by leg">
        @for (leg of data.legs; track $index) {
          <li>{{ leg }}</li>
        }
      </ol>
    }
    @if (data.tips.length > 0) {
      <ul class="tips">
        @for (tip of data.tips; track tip) {
          <li>{{ tip }}</li>
        }
      </ul>
    }
    <p class="source muted">
      <span class="badge">{{ data.source === 'AI' ? 'AI advisor' : 'Rule-based advisor' }}</span>
      @if (data.source === 'AI') {
        Written by AI from the comparison above; the recommended mode itself is computed.
      } @else {
        Generated from the comparison above without AI.
      }
    </p>
  `,
  styles: `
    .summary {
      font-size: 1.0625rem;
      font-weight: 600;
    }

    .tips {
      display: grid;
      gap: var(--space-2);
      margin: 0 0 var(--space-4);
      padding-left: 1.25rem;
    }

    .source {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: 0.875rem;
    }
  `,
})
export class AdvicePanel {
  readonly advice = input.required<Advice>();
}
