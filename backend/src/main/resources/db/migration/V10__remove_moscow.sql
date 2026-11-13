-- Removes Moscow from the seeded cities (seeded in V7).
-- Trips with a Moscow stop are deleted first (their trip_stop rows go with them through
-- ON DELETE CASCADE). Dropping only the stop could leave fewer than 2 stops or two equal
-- consecutive stops, which the domain forbids. The in-memory database holds no real user
-- data when migrations run; the demo seeder does not use Moscow.
DELETE FROM trip
WHERE id IN (SELECT s.trip_id
             FROM trip_stop s
                      JOIN city c ON c.id = s.city_id
             WHERE c.name = 'Moscow'
               AND c.country = 'RU');

DELETE FROM city
WHERE name = 'Moscow'
  AND country = 'RU';
