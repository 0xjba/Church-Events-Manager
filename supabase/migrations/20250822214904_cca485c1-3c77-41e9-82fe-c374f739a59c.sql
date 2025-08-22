-- Try to mark the corrupted user as deleted to free up the email
UPDATE auth.users 
SET 
  deleted_at = NOW(),
  email = NULL
WHERE id = 'abbcc480-3ab6-4c7f-87f2-65f211b92c4b';

-- Verify the update
SELECT id, email, deleted_at FROM auth.users WHERE id = 'abbcc480-3ab6-4c7f-87f2-65f211b92c4b';