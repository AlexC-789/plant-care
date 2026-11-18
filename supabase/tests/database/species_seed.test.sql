begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select cmp_ok((select count(*)::int from public.species where origin = 'curated'), '>=', 150, 'at least 150 curated species');
select is((select count(distinct scientific_name)::int from public.species where origin = 'curated'),
  (select count(*)::int from public.species where origin = 'curated'), 'scientific names are unique');
select is((select count(*)::int from public.species where origin = 'curated'
  and (light is null or watering is null or moisture_category is null or description is null or checked_against is null)),
  0, 'every curated row has light, watering, moisture, description and checked_against');
select is((select count(*)::int from public.species where origin = 'curated' and cardinality(common_names) = 0),
  0, 'every curated row has a common name');
select is((select count(*)::int from public.species where origin = 'curated' and checked_against not like 'GBIF%'),
  0, 'every curated row records GBIF as its name check');
select is((select count(*)::int from public.species where search_text ilike '%swiss cheese plant%'), 1, 'search finds a curated plant by common name');

select * from finish();
rollback;
