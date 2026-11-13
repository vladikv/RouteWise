-- Geography for worldwide cities (feat/globe-map).
-- The defaults fit the 25 cities seeded in V2 (all in Europe, all on the Eurasian landmass);
-- they are dropped right away so new rows must state their values.
--
-- landmass: a ground-connected region. Fixed links count (Channel Tunnel, Øresund and
-- Great Belt bridges), ferries do not. Ground modes are only offered within one landmass.
-- label_rank: 1 = labelled first on the map, 3 = only when zoomed in.
ALTER TABLE city ADD COLUMN continent VARCHAR(20) DEFAULT 'EUROPE' NOT NULL;
ALTER TABLE city ADD COLUMN landmass VARCHAR(30) DEFAULT 'EURASIA' NOT NULL;
ALTER TABLE city ADD COLUMN capital BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE city ADD COLUMN label_rank INTEGER DEFAULT 3 NOT NULL;

ALTER TABLE city ALTER COLUMN continent DROP DEFAULT;
ALTER TABLE city ALTER COLUMN landmass DROP DEFAULT;
ALTER TABLE city ALTER COLUMN capital DROP DEFAULT;
ALTER TABLE city ALTER COLUMN label_rank DROP DEFAULT;

ALTER TABLE city ADD CONSTRAINT ck_city_continent
    CHECK (continent IN ('AFRICA', 'ASIA', 'EUROPE', 'NORTH_AMERICA', 'OCEANIA', 'SOUTH_AMERICA'));
ALTER TABLE city ADD CONSTRAINT ck_city_label_rank CHECK (label_rank BETWEEN 1 AND 3);

-- Long-haul CO2 factor for PLANE; co2_grams_per_km is then the short-haul factor.
-- NULL for every other mode (one factor at any distance).
ALTER TABLE transport_mode ADD COLUMN long_haul_co2_grams_per_km INTEGER;
ALTER TABLE transport_mode ADD CONSTRAINT ck_transport_mode_long_haul_co2
    CHECK (long_haul_co2_grams_per_km IS NULL OR long_haul_co2_grams_per_km >= 0);
