-- Clear existing participants and judges to allow recreation with bcrypt passwords
-- This will remove all existing participants and judges with old SHA-256 passwords

-- First, remove any foreign key references
DELETE FROM scores WHERE participant_id IN (SELECT id FROM participants);
DELETE FROM results WHERE participant_id IN (SELECT id FROM participants);
DELETE FROM results WHERE group_id IN (SELECT id FROM groups);

-- Clear participants and judges tables
DELETE FROM participants;
DELETE FROM judges;

-- Reset sequences if they exist
ALTER SEQUENCE IF EXISTS participants_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS judges_id_seq RESTART WITH 1;
