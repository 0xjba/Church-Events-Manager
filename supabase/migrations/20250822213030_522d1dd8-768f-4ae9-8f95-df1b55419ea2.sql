-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update the handle_new_user function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'participant'),
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- Backfill existing profiles with email from auth.users
UPDATE public.profiles 
SET email = auth_users.email 
FROM auth.users auth_users 
WHERE profiles.user_id = auth_users.id 
AND profiles.email IS NULL;