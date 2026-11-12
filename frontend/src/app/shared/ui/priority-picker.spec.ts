import { TestBed } from '@angular/core/testing';
import { TripPriority } from '../../core/api/models';
import { PriorityPicker } from './priority-picker';

describe('PriorityPicker', () => {
  it('shows the four priorities with their meaning and emits the chosen one', async () => {
    const fixture = TestBed.createComponent(PriorityPicker);
    fixture.componentRef.setInput('value', 'BALANCED');
    fixture.componentRef.setInput('name', 'test-priority');
    const emitted: TripPriority[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const radios = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.map((radio) => radio.value)).toEqual([
      'BALANCED',
      'FASTEST',
      'CHEAPEST',
      'GREENEST',
    ]);
    expect(radios.every((radio) => radio.name === 'test-priority')).toBe(true);
    expect(radios[0].checked).toBe(true);
    expect(element.querySelector('legend')?.textContent).toContain('What matters most?');
    expect(element.textContent).toContain('Lowest CO₂ emissions');

    radios[3].checked = true;
    radios[3].dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['GREENEST']);
  });
});
