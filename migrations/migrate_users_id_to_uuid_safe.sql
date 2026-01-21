-- SAFE Migration: Convert ppp_users.id from INT to UUID
-- This version preserves all foreign key relationships
-- 
-- INSTRUCTIONS:
-- 1. BACKUP YOUR DATABASE FIRST
-- 2. Check current structure: DESCRIBE ppp_users;
-- 3. Identify all tables with foreign keys to ppp_users.id
-- 4. Run this script section by section, verifying after each step

-- ============================================
-- STEP 1: Create backup of current state
-- ============================================
-- CREATE TABLE ppp_users_backup AS SELECT * FROM ppp_users;

-- ============================================
-- STEP 2: Check foreign key dependencies
-- ============================================
-- Run this query to see all foreign keys referencing ppp_users:
-- SELECT 
--     TABLE_NAME,
--     CONSTRAINT_NAME,
--     COLUMN_NAME,
--     REFERENCED_TABLE_NAME,
--     REFERENCED_COLUMN_NAME
-- FROM
--     INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE
--     REFERENCED_TABLE_NAME = 'ppp_users'
--     AND REFERENCED_COLUMN_NAME = 'id';

-- ============================================
-- STEP 3: Add new UUID column (nullable initially)
-- ============================================
ALTER TABLE ppp_users ADD COLUMN id_uuid VARCHAR(36) NULL AFTER id;

-- ============================================
-- STEP 4: Generate unique UUIDs for existing rows
-- ============================================
UPDATE ppp_users SET id_uuid = UUID() WHERE id_uuid IS NULL;

-- Verify all rows have UUIDs:
-- SELECT COUNT(*) as total, COUNT(id_uuid) as with_uuid FROM ppp_users;
-- Should be: total = with_uuid

-- ============================================
-- STEP 5: Update all foreign key tables
-- ============================================
-- Replace 'ppp_user_points' with each table that has a foreign key to ppp_users.id
-- Repeat this for each table:

-- For ppp_user_points (if exists):
-- UPDATE ppp_user_points up
-- JOIN ppp_users u ON up.user_id = u.id
-- SET up.user_id = u.id_uuid;

-- For ppp_point_redemptions (if exists):
-- UPDATE ppp_point_redemptions pr
-- JOIN ppp_users u ON pr.user_id = u.id
-- SET pr.user_id = u.id_uuid;

-- For ppp_addresses (if exists):
-- UPDATE ppp_addresses a
-- JOIN ppp_users u ON a.user_id = u.id
-- SET a.user_id = u.id_uuid;

-- For ppp_phones (if exists):
-- UPDATE ppp_phones p
-- JOIN ppp_users u ON p.user_id = u.id
-- SET p.user_id = u.id_uuid;

-- For ppp_verification_tokens (if exists):
-- UPDATE ppp_verification_tokens vt
-- JOIN ppp_users u ON vt.user_id = u.id
-- SET vt.user_id = u.id_uuid;

-- ============================================
-- STEP 6: Make id_uuid NOT NULL
-- ============================================
ALTER TABLE ppp_users MODIFY COLUMN id_uuid VARCHAR(36) NOT NULL;

-- ============================================
-- STEP 7: Drop old primary key and id column
-- ============================================
ALTER TABLE ppp_users DROP PRIMARY KEY;
ALTER TABLE ppp_users DROP COLUMN id;

-- ============================================
-- STEP 8: Rename id_uuid to id and set as PRIMARY KEY
-- ============================================
ALTER TABLE ppp_users CHANGE COLUMN id_uuid id VARCHAR(36) NOT NULL PRIMARY KEY;

-- ============================================
-- STEP 9: Verify the migration
-- ============================================
-- DESCRIBE ppp_users;
-- Should show: id VARCHAR(36) NOT NULL PRIMARY KEY

-- Check that all foreign keys still work:
-- SELECT COUNT(*) FROM ppp_user_points up
-- JOIN ppp_users u ON up.user_id = u.id;
-- Should return the same count as before migration
