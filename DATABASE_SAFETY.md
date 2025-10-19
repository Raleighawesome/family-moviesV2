# Database Safety Guide

## 🚨 CRITICAL: Prevent Data Loss

This guide ensures you never lose database data when making changes.

## Quick Reference

### ✅ DO: Safe Database Operations
```bash
# Create a backup before any changes
./scripts/backup-local-db.sh

# Create new migration for schema changes
npx supabase migration new add_new_feature

# Apply migrations (safe - preserves data)
npx supabase migration up --local

# Regenerate TypeScript types
npx supabase gen types typescript --local > lib/supabase/types.ts
```

### ❌ DON'T: Dangerous Operations
```bash
# ❌ NEVER run these without a backup!
npx supabase db reset --local
npx supabase db reset

# ❌ NEVER run these in production!
DROP DATABASE
TRUNCATE TABLE
```

## Backup Procedures

### Creating a Backup
```bash
# Run this BEFORE any database changes
./scripts/backup-local-db.sh
```

This creates a timestamped backup in `./backups/` and keeps the 5 most recent backups.

### Restoring from Backup
```bash
# List available backups
ls -lt backups/

# Restore a specific backup
npx supabase db reset --local  # Only if needed to clear current state
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres < backups/local_db_backup_YYYYMMDD_HHMMSS.sql
```

## Schema Change Workflow

When you need to modify the database structure:

### Step 1: Create a Migration
```bash
npx supabase migration new descriptive_name
```

This creates a new file in `supabase/migrations/`

### Step 2: Write Your SQL Changes
Edit the migration file:
```sql
-- Example: Adding a new column
ALTER TABLE public.family_prefs
ADD COLUMN new_feature text[] DEFAULT '{}';
```

### Step 3: Apply the Migration
```bash
# Preserves all existing data!
npx supabase migration up --local
```

### Step 4: Regenerate Types
```bash
npx supabase gen types typescript --local > lib/supabase/types.ts
```

### Step 5: Update Application Code
- Remove any `@ts-ignore` or `as any` type assertions
- Update queries to use the new schema
- Test thoroughly

## When Database Reset Is Necessary

**99% of the time, you DON'T need to reset the database.** Migrations handle schema changes safely.

Only reset if:
- Starting completely fresh for testing
- Recovering from a corrupted local development database
- Explicitly instructed by documentation

**If you must reset:**
1. ✅ Create a backup first: `./scripts/backup-local-db.sh`
2. ✅ Note the backup file path
3. ✅ Confirm you understand all data will be lost
4. ✅ Run: `npx supabase db reset --local`
5. ✅ If needed, restore: `psql ... < backups/[backup-file].sql`

## Cursor AI Integration

The `.cursorrules` file in this repository instructs Cursor AI to:
- Never run database reset commands without explicit permission
- Always create backups before risky operations
- Use migrations instead of resets for schema changes
- Ask for confirmation when operations might delete data

## Local vs Production

### Local Database (127.0.0.1:54321)
- Used for development
- Safe to reset (with backups!)
- Data is not shared with other developers

### Production Database (Supabase Cloud)
- Contains real user data
- **NEVER** reset or modify directly
- Only change via tested migrations
- Always use staging environment first

## Emergency Data Recovery

If data is accidentally deleted:

1. **Check for backups:**
   ```bash
   ls -lt backups/
   ```

2. **Restore most recent backup:**
   ```bash
   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres < backups/[latest-backup].sql
   ```

3. **If no backup exists:**
   - Data cannot be recovered
   - Check if you have seed data in `supabase/seed.sql`
   - Re-enter critical data manually
   - Learn from the mistake and always backup going forward

## Best Practices

1. **Before ANY database work:** `./scripts/backup-local-db.sh`
2. **Use migrations, not resets** for schema changes
3. **Test in local first**, then staging, then production
4. **Keep backups** - the script keeps 5 automatically
5. **Read the migration** before applying it
6. **Never modify** applied migrations - create new ones

## Questions?

- Check the Supabase docs: https://supabase.com/docs/guides/cli
- Review recent migrations in `supabase/migrations/`
- Ask before running destructive commands

---

**Remember: It's faster to create a backup than to recreate lost data!** 🎯
