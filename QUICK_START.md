# Quick Start - Database Safety

## Before You Start Working

Always have Supabase running locally:
```bash
npx supabase start
```

## Common Tasks

### 🔄 Making Schema Changes

```bash
# 1. Create backup (ALWAYS FIRST!)
npm run db:backup

# 2. Create migration
npx supabase migration new add_my_feature

# 3. Edit the migration file in supabase/migrations/

# 4. Apply migration
npm run db:migrate

# 5. Update TypeScript types
npm run db:types
```

### 💾 Create Backup

```bash
npm run db:backup
```

Backups are stored in `./backups/` with timestamps.

### 🔍 View Backups

```bash
ls -lt backups/
```

### ↩️ Restore from Backup

```bash
# If database is corrupted, reset it first
npx supabase db reset --local

# Then restore
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres < backups/[backup-file].sql
```

## NPM Scripts Reference

| Command | What It Does |
|---------|-------------|
| `npm run db:backup` | Create database backup |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:types` | Regenerate TypeScript types |
| `npm run seed` | Run seed script for family movies |
| `npm run seed:popular` | Seed popular movies from TMDB |

## ⚠️ Never Run These Without Backup

- `npx supabase db reset`
- `npx supabase db reset --local`
- Any SQL with `DROP` or `TRUNCATE`

## 📚 Full Documentation

- [DATABASE_SAFETY.md](./DATABASE_SAFETY.md) - Complete safety guide
- [.cursorrules](./.cursorrules) - AI rules for this project

## 🆘 Emergency Contact

If you accidentally delete data:
1. Check `./backups/` directory
2. Restore latest backup (see above)
3. If no backup exists, data cannot be recovered
4. Always backup before risky operations!
