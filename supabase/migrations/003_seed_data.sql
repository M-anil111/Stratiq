-- Insert default organization for Mindshare Consulting Inc
INSERT INTO organizations (id, name, slug, primary_color, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mindshare Consulting Inc', 'mindshare', '#0EA5E9', 'starter');

-- Insert directory/citation sites for Off-Page link building
-- These use the default org ID
WITH org AS (SELECT '00000000-0000-0000-0000-000000000001'::UUID AS id)
INSERT INTO directory_sites (organization_id, name, url, sort_order) VALUES
  ((SELECT id FROM org), 'Google Maps', 'maps.google.com', 1),
  ((SELECT id FROM org), 'Bing Maps', 'bing.com/maps', 2),
  ((SELECT id FROM org), 'MapQuest', 'mapquest.com', 3),
  ((SELECT id FROM org), 'Open Maps', 'openstreetmap.org', 4),
  ((SELECT id FROM org), 'Apple Maps', 'maps.apple.com', 5),
  ((SELECT id FROM org), 'BBB', 'bbb.org', 6),
  ((SELECT id FROM org), 'Manta', 'manta.com', 7),
  ((SELECT id FROM org), 'Nextdoor', 'nextdoor.com', 8),
  ((SELECT id FROM org), 'Angi', 'angi.com', 9),
  ((SELECT id FROM org), 'Just Landed', 'justlanded.com', 10),
  ((SELECT id FROM org), 'Merchant Circle', 'merchantcircle.com', 11),
  ((SELECT id FROM org), 'Company.com', 'company.com', 12),
  ((SELECT id FROM org), 'Ailoq', 'ailoq.com', 13),
  ((SELECT id FROM org), 'Kompass', 'us.kompass.com', 14),
  ((SELECT id FROM org), 'eLocal', 'elocal.com', 15),
  ((SELECT id FROM org), 'Storeboard', 'storeboard.com', 16),
  ((SELECT id FROM org), 'Lacartes', 'lacartes.com', 17),
  ((SELECT id FROM org), 'Spoke', 'spoke.com', 18),
  ((SELECT id FROM org), 'AboutUs', 'aboutus.com', 19),
  ((SELECT id FROM org), 'EZlocal', 'ezlocal.com', 20),
  ((SELECT id FROM org), 'Tupalo', 'tupalo.com', 21),
  ((SELECT id FROM org), 'Yelp', 'yelp.com', 22),
  ((SELECT id FROM org), 'Yellow Pages', 'yellowpages.com', 23),
  ((SELECT id FROM org), 'Foursquare', 'foursquare.com', 24),
  ((SELECT id FROM org), 'Cylex', 'cylex.us.com', 25),
  ((SELECT id FROM org), 'CitySearch', 'citysearch.com', 26),
  ((SELECT id FROM org), 'Kudzu', 'kudzu.com', 27),
  ((SELECT id FROM org), 'Brownbook', 'brownbook.net', 28),
  ((SELECT id FROM org), 'Hotfrog', 'hotfrog.com', 29);
