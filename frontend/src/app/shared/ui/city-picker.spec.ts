import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { CityPicker } from './city-picker';

const city = (id: number, name: string, country: string) => makeCity({ id, name, country });
const CITIES = [
  city(1, 'Berlin', 'DE'),
  city(2, 'Venice', 'IT'),
  city(3, 'Nice', 'FR'),
  city(4, 'Zurich', 'CH'),
];

describe('CityPicker', () => {
  let fixture: ComponentFixture<CityPicker>;
  let element: HTMLElement;
  let input: HTMLInputElement;
  let emitted: (number | null)[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(CityPicker);
    fixture.componentRef.setInput('label', 'From');
    fixture.componentRef.setInput('cities', CITIES);
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((id) => emitted.push(id));
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    input = element.querySelector('input') as HTMLInputElement;
  });

  async function type(text: string): Promise<void> {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function press(key: string): Promise<void> {
    input.dispatchEvent(new KeyboardEvent('keydown', { key }));
    await fixture.whenStable();
  }

  const options = () =>
    Array.from(element.querySelectorAll('[role="option"]')).map((o) =>
      o.querySelector('.picker__name')?.textContent?.trim(),
    );

  it('is a labelled, collapsed combobox', () => {
    expect(element.querySelector('label')?.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('[role="listbox"]')).toBeNull();
  });

  it('filters as you type, ignoring accents, names starting with the text first', async () => {
    await type('nice');
    expect(options()).toEqual(['Nice', 'Venice']);
    expect(input.getAttribute('aria-expanded')).toBe('true');

    await type('zür');
    expect(options()).toEqual(['Zurich']);

    await type('xyz');
    expect(element.querySelector('.picker__empty')?.textContent).toContain('No matching city');
  });

  it('moves with the arrow keys and chooses with Enter', async () => {
    await type('nice');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-0$/);

    await press('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-1$/);
    await press('Enter');

    expect(emitted).toEqual([2]);
    expect(element.querySelector('[role="listbox"]')).toBeNull();
  });

  it('chooses with a click', async () => {
    await press('ArrowDown');
    const berlin = Array.from(element.querySelectorAll<HTMLElement>('[role="option"]')).find((o) =>
      o.textContent?.includes('Berlin'),
    );
    berlin?.click();

    expect(emitted).toEqual([1]);
  });

  it('shows the chosen city, and Escape discards unfinished typing', async () => {
    fixture.componentRef.setInput('value', 4);
    await fixture.whenStable();
    expect(input.value).toBe('Zurich');

    await type('ber');
    await press('Escape');

    expect(input.value).toBe('Zurich');
    expect(emitted).toEqual([]);
  });

  it('lists the other end of the route but does not let it be chosen', async () => {
    fixture.componentRef.setInput('excludeId', 1);
    await type('ber');

    const option = element.querySelector<HTMLElement>('[role="option"]');
    expect(option?.getAttribute('aria-disabled')).toBe('true');
    expect(option?.textContent).toContain('already chosen');

    option?.click();
    await press('Enter');
    expect(emitted).toEqual([]);
  });

  it('clears the choice with its clear button', async () => {
    fixture.componentRef.setInput('value', 1);
    await fixture.whenStable();

    const clear = element.querySelector<HTMLButtonElement>('button[aria-label="Clear From"]');
    clear?.click();

    expect(emitted).toEqual([null]);
  });
});
