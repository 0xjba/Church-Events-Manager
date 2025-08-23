-- Add authentication fields to participants table
ALTER TABLE participants ADD COLUMN username VARCHAR(50) UNIQUE;
ALTER TABLE participants ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE participants ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE participants ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE participants ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE participants ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Add indexes for performance
CREATE INDEX idx_participants_username ON participants(username);
CREATE INDEX idx_participants_active ON participants(is_active);
CREATE INDEX idx_participants_created_by ON participants(created_by);

-- Make profile_id nullable since participants won't need profiles anymore
ALTER TABLE participants ALTER COLUMN profile_id DROP NOT NULL;