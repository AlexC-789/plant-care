-- The claim insert evaluates new_claim_code() as `authenticated`: grant it explicitly instead of relying on PUBLIC.
grant execute on function public.new_claim_code() to authenticated;
