-- Airport of each city (feat/airport-availability): the IATA code of the airport travellers use for the city.
-- NULL means no working airport, and then the plane is not offered on a leg to or from that city.
ALTER TABLE city ADD COLUMN airport_code VARCHAR(3);
ALTER TABLE city ADD CONSTRAINT ck_city_airport_code CHECK (airport_code IS NULL OR REGEXP_LIKE(airport_code, '^[A-Z]{3}$'));
