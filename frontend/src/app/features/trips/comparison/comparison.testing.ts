import { Advice, Comparison, ModeOption, TripDraft } from '../../../core/api/models';
import { LegComparison, legComparison } from './leg-comparison';

/** Hand-written fixtures for comparison, advice and draft specs. */

const BERLIN = { id: 3, name: 'Berlin', country: 'DE' };
const PRAGUE = { id: 18, name: 'Prague', country: 'CZ' };
const VIENNA = { id: 23, name: 'Vienna', country: 'AT' };

const TRAIN: ModeOption = {
  mode: 'TRAIN',
  available: true,
  unavailableReason: null,
  unavailableCode: null,
  distanceKm: 628.3,
  durationMinutes: 373,
  totalCost: 150.8,
  co2Kg: 44,
  score: 87,
  recommended: true,
  notes: [],
};

const CAR: ModeOption = {
  mode: 'CAR',
  available: true,
  unavailableReason: null,
  unavailableCode: null,
  distanceKm: 680.7,
  durationMinutes: 484,
  totalCost: 136.14,
  co2Kg: 115.7,
  score: 52,
  recommended: false,
  notes: ['Rain expected in Vienna, CAR score reduced'],
};

const BIKE: ModeOption = {
  mode: 'BIKE',
  available: false,
  unavailableReason: 'Route of 681 km exceeds the BIKE limit of 150 km',
  unavailableCode: 'TOO_FAR',
  distanceKm: 680.7,
  durationMinutes: null,
  totalCost: null,
  co2Kg: null,
  score: 0,
  recommended: false,
  notes: [],
};

/** Berlin to Vienna: one leg, train recommended, car available, bike too far, rain in Vienna. */
export const COMPARISON: Comparison = {
  tripId: 7,
  departureDate: '2099-05-20',
  travelers: 2,
  priority: 'GREENEST',
  distanceKm: 523.6,
  currency: 'EUR',
  weather: [
    {
      city: 'Vienna',
      date: '2099-05-20',
      description: 'Rain',
      temperatureMinC: 4.2,
      temperatureMaxC: 8.6,
      precipitationProbabilityPercent: 90,
      windSpeedMaxKmh: 20,
      hazards: ['RAIN'],
    },
  ],
  weatherStatus: 'PARTIAL',
  legs: [
    {
      index: 0,
      from: BERLIN,
      to: VIENNA,
      distanceKm: 523.6,
      options: [TRAIN, CAR, BIKE],
      recommendedMode: 'TRAIN',
      unavailableGroups: [
        {
          code: 'TOO_FAR',
          modes: ['BIKE'],
          message: 'Too far between Berlin and Vienna for: bike',
        },
      ],
    },
  ],
  recommendedItinerary: { modes: ['TRAIN'], durationMinutes: 373, totalCost: 150.8, co2Kg: 44 },
  singleModeTotals: [
    {
      mode: 'TRAIN',
      available: true,
      unavailableReason: null,
      unavailableCode: null,
      durationMinutes: 373,
      totalCost: 150.8,
      co2Kg: 44,
    },
    {
      mode: 'CAR',
      available: true,
      unavailableReason: null,
      unavailableCode: null,
      durationMinutes: 484,
      totalCost: 136.14,
      co2Kg: 115.7,
    },
    {
      mode: 'BIKE',
      available: false,
      unavailableReason:
        'Leg 1 (Berlin to Vienna): Route of 681 km exceeds the BIKE limit of 150 km',
      unavailableCode: 'TOO_FAR',
      durationMinutes: null,
      totalCost: null,
      co2Kg: null,
    },
  ],
  unavailableGroups: [
    {
      code: 'TOO_FAR',
      modes: ['BIKE'],
      message: 'Not possible for the whole trip: bike (too far between Berlin and Vienna)',
    },
  ],
};

/** The single leg of {@link COMPARISON}, as the chart and the table get it. */
export const LEG_COMPARISON: LegComparison = legComparison(COMPARISON, 0);

/**
 * Berlin → Prague → Vienna: train then bus (510 min, 58 EUR, 17 kg). Train throughout:
 * 490 min, 85 EUR, 19 kg; bus throughout: 570 min, 38 EUR, 15 kg; bike not possible.
 */
export const MULTI_COMPARISON: Comparison = {
  ...COMPARISON,
  priority: 'BALANCED',
  distanceKm: 532,
  weather: [],
  weatherStatus: 'OUT_OF_RANGE',
  legs: [
    {
      index: 0,
      from: BERLIN,
      to: PRAGUE,
      distanceKm: 280,
      options: [
        option('TRAIN', 240, 40, 10, true),
        option('BUS', 300, 20, 8, false),
        {
          ...BIKE,
          unavailableReason: 'Route of 364 km exceeds the BIKE limit of 150 km',
          unavailableCode: 'TOO_FAR',
        },
      ],
      recommendedMode: 'TRAIN',
      unavailableGroups: [
        {
          code: 'TOO_FAR',
          modes: ['BIKE'],
          message: 'Too far between Berlin and Prague for: bike',
        },
      ],
    },
    {
      index: 1,
      from: PRAGUE,
      to: VIENNA,
      distanceKm: 252,
      options: [option('BUS', 270, 18, 7, true), option('TRAIN', 250, 45, 9, false)],
      recommendedMode: 'BUS',
      unavailableGroups: [],
    },
  ],
  recommendedItinerary: { modes: ['TRAIN', 'BUS'], durationMinutes: 510, totalCost: 58, co2Kg: 17 },
  singleModeTotals: [
    {
      mode: 'TRAIN',
      available: true,
      unavailableReason: null,
      unavailableCode: null,
      durationMinutes: 490,
      totalCost: 85,
      co2Kg: 19,
    },
    {
      mode: 'BUS',
      available: true,
      unavailableReason: null,
      unavailableCode: null,
      durationMinutes: 570,
      totalCost: 38,
      co2Kg: 15,
    },
    {
      mode: 'BIKE',
      available: false,
      unavailableReason:
        'Leg 1 (Berlin to Prague): Route of 364 km exceeds the BIKE limit of 150 km',
      unavailableCode: 'TOO_FAR',
      durationMinutes: null,
      totalCost: null,
      co2Kg: null,
    },
  ],
  unavailableGroups: [
    {
      code: 'TOO_FAR',
      modes: ['BIKE'],
      message: 'Not possible for the whole trip: bike (too far between Berlin and Prague)',
    },
  ],
};

export const ADVICE: Advice = {
  tripId: 7,
  recommendedModes: ['TRAIN'],
  summary: 'Take the train from Berlin to Vienna.',
  legs: ['Leg 1, Berlin to Vienna: train, 6 h 13 min, 150.80 EUR and 44.0 kg CO₂.'],
  tips: ['Alternative: car, 1 h 51 min slower.', 'Pack an umbrella.'],
  source: 'RULES',
};

export const DRAFT: TripDraft = {
  title: 'Berlin to Vienna',
  stops: [{ id: 3, name: 'Berlin', country: 'DE' }, null],
  departureDate: '2099-05-20',
  travelers: 3,
  priority: 'CHEAPEST',
  notes: null,
  source: 'RULES',
  warnings: ['Fewer than two stops recognised.'],
};

function option(
  mode: ModeOption['mode'],
  minutes: number,
  cost: number,
  co2: number,
  recommended: boolean,
): ModeOption {
  return {
    mode,
    available: true,
    unavailableReason: null,
    unavailableCode: null,
    distanceKm: 300,
    durationMinutes: minutes,
    totalCost: cost,
    co2Kg: co2,
    score: recommended ? 80 : 60,
    recommended,
    notes: [],
  };
}
