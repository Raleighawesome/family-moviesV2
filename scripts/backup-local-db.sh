#!/bin/bash
# Backup local Supabase database
# Usage: ./scripts/backup-local-db.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/local_db_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup of local database..."
npx supabase db dump --local -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Backup created successfully: $BACKUP_FILE"

  # Keep only the 5 most recent backups
  echo "Cleaning up old backups (keeping 5 most recent)..."
  ls -t "$BACKUP_DIR"/local_db_backup_*.sql | tail -n +6 | xargs rm -f 2>/dev/null

  echo "Done!"
else
  echo "❌ Backup failed"
  exit 1
fi
