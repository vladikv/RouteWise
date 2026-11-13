-- Short- and long-haul flight CO2 (feat/globe-map); the long-haul column is added in V6.
-- PLANE CO2 per passenger-km: UK DEFRA greenhouse gas conversion factors 2023, economy class,
-- including radiative forcing. Short-haul (great-circle distance up to 3700 km, the DEFRA
-- short/long-haul boundary): 0.18287 kg CO2e; long-haul: 0.20011 kg CO2e.
-- max_distance_km covers half the Earth's circumference, so every city pair can be flown.
UPDATE transport_mode
SET co2_grams_per_km = 183, long_haul_co2_grams_per_km = 200, max_distance_km = 20100
WHERE code = 'PLANE';
