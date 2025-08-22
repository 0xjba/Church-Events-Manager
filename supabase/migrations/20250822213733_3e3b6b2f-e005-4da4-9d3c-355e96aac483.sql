-- Delete the manually created admin user
DELETE FROM public.profiles WHERE username = 'jobin';

-- Note: The auth.users record will be cleaned up automatically