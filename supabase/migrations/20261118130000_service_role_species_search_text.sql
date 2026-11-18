-- species.search_text is a generated column calling this function, so inserting a species (identify,
-- search) needs execute on it. Hosted doesn't give service_role that by default (local does).
grant execute on function public.species_search_text(text, text[]) to service_role;
