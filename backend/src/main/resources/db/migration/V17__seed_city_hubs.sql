-- Hub cities for connecting flights (feat/hub-connections); schema in V16. Data only.
--
-- Twenty of the world's busiest connecting airports, chosen so that every continent has at least one:
-- Europe: Frankfurt, Istanbul, London, Paris, Amsterdam; Middle East: Dubai, Doha;
-- Asia: Singapore, Hong Kong, Bangkok, Seoul, Tokyo; Oceania: Sydney;
-- North America: New York, Atlanta, Los Angeles, Panama City; South America: São Paulo;
-- Africa: Addis Ababa, Johannesburg.
--
-- A hub that is added or removed changes in a new migration, never by editing this one.
UPDATE city SET hub = TRUE WHERE name IN (
    'Frankfurt', 'Istanbul', 'London', 'Paris', 'Amsterdam',
    'Dubai', 'Doha',
    'Singapore', 'Hong Kong', 'Bangkok', 'Seoul', 'Tokyo',
    'Sydney',
    'New York', 'Atlanta', 'Los Angeles', 'Panama City',
    'São Paulo',
    'Addis Ababa', 'Johannesburg');
