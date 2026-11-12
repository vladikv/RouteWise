import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherSummary } from '../../core/api/models';
import { WeatherCard } from './weather-card';

const VIENNA: WeatherSummary = {
  city: 'Vienna',
  date: '2030-05-04',
  description: 'Rain',
  temperatureMinC: 4.2,
  temperatureMaxC: 9.4,
  precipitationProbabilityPercent: 90,
  windSpeedMaxKmh: 38.6,
  hazards: ['RAIN', 'STRONG_WIND'],
};
const BERLIN: WeatherSummary = {
  city: 'Berlin',
  date: '2030-05-04',
  description: 'Clear sky',
  temperatureMinC: null,
  temperatureMaxC: null,
  precipitationProbabilityPercent: null,
  windSpeedMaxKmh: null,
  hazards: [],
};

describe('WeatherCard', () => {
  let fixture: ComponentFixture<WeatherCard>;
  let card: HTMLElement;

  async function render(weather: WeatherSummary[]): Promise<void> {
    fixture = TestBed.createComponent(WeatherCard);
    fixture.componentRef.setInput('weather', weather);
    fixture.componentRef.setInput('date', '2030-05-04');
    await fixture.whenStable();
    card = fixture.nativeElement as HTMLElement;
  }

  const text = (element: Element | null): string =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows each city with description, temperatures, precipitation and wind', async () => {
    await render([BERLIN, VIENNA]);

    expect(text(card.querySelector('h3'))).toBe('Weather on May 4, 2030');
    expect(card.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
      card.querySelector('h3')?.id,
    );
    const items = card.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(text(items[1])).toContain('Vienna');
    expect(text(items[1])).toContain('Rain');
    expect(text(items[1])).toContain('4 to 9 °C');
    expect(text(items[1])).toContain('90% precipitation');
    expect(text(items[1])).toContain('wind up to 39 km/h');
  });

  it('names every hazard in words with a warning sign', async () => {
    await render([VIENNA]);

    const hazards = Array.from(card.querySelectorAll('.weather__hazard')).map(text);
    expect(hazards).toEqual(['⚠ Rain', '⚠ Strong wind']);
  });

  it('leaves out figures the forecast does not have, and shows no hazards for a calm day', async () => {
    await render([BERLIN]);

    const item = card.querySelector('li');
    expect(item?.querySelector('.weather__name')?.textContent).toBe('Berlin');
    expect(item?.querySelector('.weather__description')?.textContent).toBe('Clear sky');
    expect(item?.querySelector('.weather__facts')?.textContent?.trim()).toBe('');
    expect(card.querySelector('.weather__hazard')).toBeNull();
  });

  it('says so when there is no forecast for the date', async () => {
    await render([]);

    expect(card.querySelector('ul')).toBeNull();
    expect(text(card.querySelector('.weather__empty'))).toContain('No forecast for this date');
  });
});
