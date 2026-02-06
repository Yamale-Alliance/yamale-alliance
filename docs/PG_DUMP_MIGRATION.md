# Using pg_dump to Migrate Supabase Data

This guide shows you how to export data from your old Supabase database and import it into a new one using `pg_dump` and `psql`.

## Prerequisites

1. **Install PostgreSQL client tools** (if not already installed):
   ```bash
   # macOS
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   
   # Windows
   # Download from: https://www.postgresql.org/download/windows/
   ```

2. **Get connection strings from both Supabase projects:**
   - Old project: Settings → Database → Connection string → URI
   - New project: Settings → Database → Connection string → URI

## Step 1: Get Connection Strings

### From Supabase Dashboard:

1. Go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Select **URI** tab
4. Copy the connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

⚠️ **Important**: Replace `[YOUR-PASSWORD]` with your actual database password (found in Settings → Database → Database password).

## Step 2: Export Data from Old Database

### Option A: Full Database Dump (Recommended)

```bash
# Export everything (schema + data)
pg_dump "postgresql://postgres:[OLD-PASSWORD]@db.[OLD-PROJECT-REF].supabase.co:5432/postgres" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f backup.sql
```

### Option B: Data Only (if schema already exists)

```bash
# Export only data (no CREATE TABLE statements)
pg_dump "postgresql://postgres:[OLD-PASSWORD]@db.[OLD-PROJECT-REF].supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-acl \
  -f data-only.sql
```

### Option C: Specific Tables Only

```bash
# Export only specific tables
pg_dump "postgresql://postgres:[OLD-PASSWORD]@db.[OLD-PROJECT-REF].supabase.co:5432/postgres" \
  --table=countries \
  --table=categories \
  --table=laws \
  --table=pricing_plans \
  --table=admin_audit_log \
  --table=ai_chat_states \
  --no-owner \
  --no-acl \
  -f tables-only.sql
```

## Step 3: Prepare New Database

**IMPORTANT**: Run migrations first on the new database before importing data!

1. Go to new Supabase project → **SQL Editor**
2. Run all migration files in order:
   - `001_initial_laws.sql`
   - `002_pricing_plans.sql`
   - `003_admin_audit_log.sql`
   - `004_ai_chat_states.sql`

This ensures the schema exists before importing data.

## Step 4: Import Data into New Database

### Option A: Using psql (Recommended)

```bash
# Import the dump file
psql "postgresql://postgres:[NEW-PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres" \
  -f backup.sql
```

### Option B: Using Supabase SQL Editor

1. Open the `backup.sql` file in a text editor
2. Copy the contents
3. Go to new Supabase project → **SQL Editor**
4. Paste and run

⚠️ **Note**: For large files (>1MB), use `psql` command line instead.

## Step 5: Handle Sequences (Important!)

After importing, you may need to reset sequences:

```sql
-- Run this in your new Supabase SQL Editor
SELECT setval('countries_id_seq', (SELECT MAX(id) FROM countries));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('laws_id_seq', (SELECT MAX(id) FROM laws));
SELECT setval('pricing_plans_id_seq', (SELECT MAX(id) FROM pricing_plans));
SELECT setval('admin_audit_log_id_seq', (SELECT MAX(id) FROM admin_audit_log));
```

## Complete Example Script

Here's a complete bash script you can save and run:

```bash
#!/bin/bash

# Configuration
OLD_DB="postgresql://postgres:[OLD-PASSWORD]@db.[OLD-PROJECT-REF].supabase.co:5432/postgres"
NEW_DB="postgresql://postgres:[NEW-PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres"
BACKUP_FILE="supabase_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "🔄 Exporting from old database..."
pg_dump "$OLD_DB" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "$BACKUP_FILE"

echo "✅ Export complete: $BACKUP_FILE"
echo "📦 File size: $(du -h $BACKUP_FILE | cut -f1)"

echo ""
echo "⚠️  IMPORTANT: Make sure you've run migrations on the new database first!"
read -p "Press Enter to continue with import..."

echo "🔄 Importing to new database..."
psql "$NEW_DB" -f "$BACKUP_FILE"

echo "✅ Import complete!"
echo "🔧 Don't forget to reset sequences (see Step 5 above)"
```

## Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to old project
supabase link --project-ref [OLD-PROJECT-REF]

# Dump database
supabase db dump -f backup.sql

# Link to new project
supabase link --project-ref [NEW-PROJECT-REF]

# Restore database
supabase db reset  # This will run migrations first
psql "$(supabase db url)" -f backup.sql
```

## Troubleshooting

### "password authentication failed"
- Double-check your database password in Supabase Settings → Database
- Make sure you replaced `[YOUR-PASSWORD]` in the connection string

### "relation does not exist"
- Run migrations on the new database first (Step 3)
- The schema must exist before importing data

### "permission denied"
- Use the **Service Role** connection string if available
- Or ensure you're using the postgres user credentials

### "duplicate key value violates unique constraint"
- The data already exists - you may need to truncate tables first:
  ```sql
  TRUNCATE TABLE countries, categories, laws, pricing_plans, admin_audit_log, ai_chat_states CASCADE;
  ```

### Large file timeout
- Use `psql` command line instead of SQL Editor
- Or split the file into smaller chunks

## Data-Only Migration (Recommended for Production)

If you've already run migrations, use data-only export:

```bash
# Export data only
pg_dump "postgresql://postgres:[OLD-PASSWORD]@db.[OLD-PROJECT-REF].supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-acl \
  --table=countries \
  --table=categories \
  --table=laws \
  --table=pricing_plans \
  --table=admin_audit_log \
  --table=ai_chat_states \
  -f data-only.sql

# Import
psql "postgresql://postgres:[NEW-PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres" \
  -f data-only.sql
```

## Verify Migration

After importing, verify the data:

```sql
-- Check row counts
SELECT 'countries' as table_name, COUNT(*) as count FROM countries
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'laws', COUNT(*) FROM laws
UNION ALL
SELECT 'pricing_plans', COUNT(*) FROM pricing_plans
UNION ALL
SELECT 'admin_audit_log', COUNT(*) FROM admin_audit_log
UNION ALL
SELECT 'ai_chat_states', COUNT(*) FROM ai_chat_states;
```

## Security Notes

⚠️ **Never commit backup files to git** - they contain sensitive data!

Add to `.gitignore`:
```
*.sql
backup.sql
data-only.sql
supabase_backup_*.sql
```

## Quick Reference

```bash
# Export
pg_dump "CONNECTION_STRING" --no-owner --no-acl -f backup.sql

# Import
psql "CONNECTION_STRING" -f backup.sql

# Data only export
pg_dump "CONNECTION_STRING" --data-only --no-owner --no-acl -f data.sql

# Specific tables
pg_dump "CONNECTION_STRING" --table=table1 --table=table2 -f tables.sql
```
