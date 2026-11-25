-- Connecting hubs (feat/hub-connections): a leg longer than the plane's range is flown with one connection
-- at a hub city. A hub must have a working airport.
ALTER TABLE city ADD COLUMN hub BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE city ADD CONSTRAINT ck_city_hub_airport CHECK (hub = FALSE OR airport_code IS NOT NULL);
