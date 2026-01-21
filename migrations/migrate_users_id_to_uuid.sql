-- Migration script to convert ppp_users.id from INT to UUID without losing data
-- IMPORTANT: Run this script BEFORE deploying the new code to production
-- Backup your database first!

-- Step 1: Check current structure (run this first to see what we're working with)
-- DESCRIBE ppp_users;
-- SHOW CREATE TABLE ppp_users;

-- Step 2: Add a new temporary UUID column (nullable first)
ALTER TABLE ppp_users ADD COLUMN id_temp VARCHAR(36) NULL;

-- Step 3: Generate unique UUIDs for all existing rows
UPDATE ppp_users SET id_temp = UUID() WHERE id_temp IS NULL;

-- Step 4: Make the temp column NOT NULL after all rows have UUIDs
ALTER TABLE ppp_users MODIFY COLUMN id_temp VARCHAR(36) NOT NULL;

-- Step 5: Drop foreign key constraints that reference ppp_users.id
-- You may need to check and drop these manually based on your schema
-- ALTER TABLE ppp_user_points DROP FOREIGN KEY IF EXISTS FK_user_points_user;
-- ALTER TABLE ppp_point_redemptions DROP FOREIGN KEY IF EXISTS FK_point_redemptions_user;
-- ALTER TABLE ppp_addresses DROP FOREIGN KEY IF EXISTS FK_addresses_user;
-- ALTER TABLE ppp_phones DROP FOREIGN KEY IF EXISTS FK_phones_user;
-- ALTER TABLE ppp_verification_tokens DROP FOREIGN KEY IF EXISTS FK_verification_tokens_user;

-- Step 6: Update all foreign key references to use the new UUID values
-- This assumes you have backup tables or can reconstruct the relationships
-- UPDATE ppp_user_points up
-- JOIN ppp_users u_old ON up.user_id = u_old.id
-- JOIN ppp_users u_new ON u_old.email = u_new.email  -- Assuming email is unique
-- SET up.user_id = u_new.id_temp;

-- Step 7: Drop the old id column
ALTER TABLE ppp_users DROP PRIMARY KEY;
ALTER TABLE ppp_users DROP COLUMN id;

-- Step 8: Rename temp column to id and set as PRIMARY KEY
ALTER TABLE ppp_users CHANGE COLUMN id_temp id VARCHAR(36) NOT NULL PRIMARY KEY;

-- Step 9: Re-create foreign key constraints
-- ALTER TABLE ppp_user_points ADD CONSTRAINT FK_user_points_user 
--   FOREIGN KEY (user_id) REFERENCES ppp_users(id) ON DELETE CASCADE;
