CREATE OR REPLACE FUNCTION public.find_profile_by_email(_email text)
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_by_email(text) TO authenticated;