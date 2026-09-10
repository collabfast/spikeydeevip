-- Fix production 401/403s reading site_settings.homepage_hero from the public homepage.
-- Root cause: anon/authenticated roles were missing base table GRANTs on site_settings
-- (RLS policy existed but PostgREST still rejects access without the underlying GRANT).
-- Also narrows the SELECT policy to only the homepage_hero row instead of all settings.

drop policy if exists "Public can read site settings" on public.site_settings;

create policy "Public can read homepage hero settings"
  on public.site_settings
  for select
  to anon, authenticated
  using (setting_key = 'homepage_hero');

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
