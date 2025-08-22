-- Update the INSERT policy to allow the trigger function to create profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a new policy that allows both user insertion and system insertion (for triggers)
CREATE POLICY "Allow profile creation" ON public.profiles
FOR INSERT 
WITH CHECK (
  -- Allow users to insert their own profile
  auth.uid() = user_id 
  OR 
  -- Allow system functions (like triggers) to insert profiles
  -- This is safe because triggers run during signup process
  current_setting('role') = 'postgres'
);