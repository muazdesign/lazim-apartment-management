-- Optional starter data. Run AFTER creating your first user via
-- Supabase Dashboard (Authentication → Add user), then promote them:
--
--   update public.profiles set role = 'tech_admin', full_name = 'Your Name'
--   where email = 'you@example.com';

-- A few units to get started
insert into public.units (unit_number, floor, bedrooms, bathrooms, size_sqm, monthly_rent, status) values
  ('1A', 1, 1, 1, 45.0,  900, 'vacant'),
  ('1B', 1, 2, 1, 62.5, 1250, 'vacant'),
  ('2A', 2, 2, 2, 70.0, 1400, 'vacant'),
  ('2B', 2, 3, 2, 88.0, 1800, 'vacant')
on conflict (unit_number) do nothing;

-- Current-year tax parameters (example: 12% flat rate, no deduction)
insert into public.tax_parameters (tax_year, tax_rate, standard_deduction)
values (extract(year from current_date)::int, 0.12, 0)
on conflict (tax_year) do nothing;
