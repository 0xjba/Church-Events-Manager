-- Add performance indexes for authentication queries
CREATE INDEX IF NOT EXISTS idx_participants_username_active ON participants(username, is_active);
CREATE INDEX IF NOT EXISTS idx_judges_username_active ON judges(username, is_active);
