import { Advice, Comparison, TripDraft } from '../../../core/api/models';

/** Hand-written fixtures for comparison, advice and draft specs. */

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
  options: [
    {
      mode: 'TRAIN',
      available: true,
      unavailableReason: null,
      distanceKm: 628.3,
      durationMinutes: 373,
      totalCost: 150.8,
      co2Kg: 44,
      score: 87,
      recommended: true,
      notes: [],
    },
    {
      mode: 'CAR',
      available: true,
      unavailableReason: null,
      distanceKm: 680.7,
      durationMinutes: 484,
      totalCost: 136.14,
      co2Kg: 115.7,
      score: 52,
      recommended: false,
      notes: ['Rain expected in Vienna, CAR score reduced'],
    },
    {
      mode: 'BIKE',
      available: false,
      unavailableReason: 'Route of 681 km exceeds the BIKE limit of 150 km',
      distanceKm: 680.7,
      durationMinutes: null,
      totalCost: null,
      co2Kg: null,
      score: 0,
      recommended: false,
      notes: [],
    },
  ],
};

export const ADVICE: Advice = {
  tripId: 7,
  recommendedMode: 'TRAIN',
  summary: 'Take the train from Berlin to Vienna.',
  tips: ['Alternative: car, 1 h 51 min slower.', 'Pack an umbrella.'],
  source: 'RULES',
};

export const DRAFT: TripDraft = {
  title: 'Berlin to Vienna',
  origin: { id: 3, name: 'Berlin', country: 'DE' },
  destination: null,
  departureDate: '2099-05-20',
  travelers: 3,
  priority: 'CHEAPEST',
  notes: null,
  source: 'RULES',
  warnings: ['No destination city recognised.'],
};
