begin;

-- Supabase creates this SECURITY DEFINER helper when automatic RLS is enabled.
-- Keep the managed event-trigger behavior while preventing API roles from
-- invoking the helper directly. Local environments without the helper remain
-- compatible with this migration.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable()
    from public, anon, authenticated;
  end if;
end;
$$;

commit;
