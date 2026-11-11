-- Country codes are ISO 3166-1 alpha-2.
INSERT INTO city (name, country, latitude, longitude) VALUES
    ('Amsterdam',  'NL', 52.3676,   4.9041),
    ('Barcelona',  'ES', 41.3874,   2.1686),
    ('Berlin',     'DE', 52.5200,  13.4050),
    ('Brussels',   'BE', 50.8503,   4.3517),
    ('Budapest',   'HU', 47.4979,  19.0402),
    ('Cologne',    'DE', 50.9375,   6.9603),
    ('Copenhagen', 'DK', 55.6761,  12.5683),
    ('Frankfurt',  'DE', 50.1109,   8.6821),
    ('Hamburg',    'DE', 53.5511,   9.9937),
    ('Krakow',     'PL', 50.0647,  19.9450),
    ('Lisbon',     'PT', 38.7223,  -9.1393),
    ('Ljubljana',  'SI', 46.0569,  14.5058),
    ('London',     'GB', 51.5074,  -0.1278),
    ('Lyon',       'FR', 45.7640,   4.8357),
    ('Madrid',     'ES', 40.4168,  -3.7038),
    ('Milan',      'IT', 45.4642,   9.1900),
    ('Munich',     'DE', 48.1351,  11.5820),
    ('Paris',      'FR', 48.8566,   2.3522),
    ('Prague',     'CZ', 50.0755,  14.4378),
    ('Rome',       'IT', 41.9028,  12.4964),
    ('Stockholm',  'SE', 59.3293,  18.0686),
    ('Venice',     'IT', 45.4408,  12.3155),
    ('Vienna',     'AT', 48.2082,  16.3738),
    ('Warsaw',     'PL', 52.2297,  21.0122),
    ('Zurich',     'CH', 47.3769,   8.5417);

-- Typical European averages. Cost and CO2 are per traveler, except CAR,
-- which is per vehicle (the comparison engine divides by travelers).
-- PLANE overhead covers airport transfer, security and boarding.
INSERT INTO transport_mode (code, avg_speed_kmh, cost_per_km, co2_grams_per_km, fixed_overhead_minutes, max_distance_km) VALUES
    ('TRAIN', 110, 0.120,  35,  30,  2000),
    ('BUS',    75, 0.060,  27,  20,  2500),
    ('CAR',    90, 0.200, 170,  10,  3000),
    ('BIKE',   18, 0.000,   0,  10,   150),
    ('PLANE', 750, 0.150, 250, 150, 10000);
