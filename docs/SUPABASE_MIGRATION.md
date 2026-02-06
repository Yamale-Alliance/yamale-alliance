# Migrating to a New Supabase Account

This guide will help you switch your Yamalé application to a new Supabase project.

## Step 1: Get Your New Supabase Credentials

1. Go to your new Supabase project: https://supabase.com/dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Service Role Key** (under "Project API keys" → "service_role" - keep this secret!)

## Step 2: Update Environment Variables

### Local Development (`.env`)

Update these values in your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-new-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Update:
   - `NEXT_PUBLIC_SUPABASE_URL` → Your new project URL
   - `SUPABASE_SERVICE_ROLE_KEY` → Your new service role key
4. **Redeploy** your application after updating

## Step 3: Run Migrations on New Database

Your new Supabase database needs to have the same schema. Run all migrations in order:

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your new project
supabase link --project-ref your-new-project-ref

# Run migrations
supabase db push
```

### Option B: Manual SQL Execution

1. Go to your new Supabase project → **SQL Editor**
2. Run each migration file in order:
   - `001_initial_laws.sql`
   - `002_pricing_plans.sql`
   - `003_admin_audit_log.sql`
   - `004_ai_chat_states.sql`

You can find these files in: `supabase/migrations/`

## Step 4: Migrate Data (Optional)

If you want to copy data from your old database:

### Using Supabase Dashboard

1. **Export from old database:**
   - Go to old project → **Database** → **Backups**
   - Create a backup or use the SQL editor to export data

2. **Import to new database:**
   - Go to new project → **SQL Editor**
   - Run the exported SQL

### Using pg_dump (Advanced)

```bash
# Export from old database
pg_dump "postgresql://postgres:[PASSWORD]@[OLD_HOST]:5432/postgres" > backup.sql

# Import to new database
psql "postgresql://postgres:[PASSWORD]@[NEW_HOST]:5432/postgres" < backup.sql
```

## Step 5: Verify Connection

After updating environment variables:

1. **Restart your local dev server:**
   ```bash
   npm run dev
   ```

2. **Test the connection:**
   - Visit `/library` - should load laws
   - Visit `/admin-panel` - should load admin features
   - Check browser console for any errors

3. **Check API routes:**
   - `/api/laws` should return data
   - `/api/pricing` should return pricing plans

## Step 6: Update Scripts (If Needed)

If you use the import scripts (`scripts/import-pdf-law.mjs`, `scripts/seed-ghana-laws.mjs`), they will automatically use the new `.env` values.

## Troubleshooting

### "Missing Supabase env" Error
- Ensure `.env` has both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Restart your dev server after updating `.env`

### "Table does not exist" Error
- Run migrations on the new database (Step 3)
- Check that all migration files were executed

### "Permission denied" Error
- Verify you're using the **Service Role Key** (not the anon key)
- Service Role Key bypasses Row Level Security (RLS)

### Data Not Showing
- Check that migrations ran successfully
- Verify data was migrated (if applicable)
- Check browser console for API errors

## Important Notes

⚠️ **Security:**
- Never commit `.env` file to git
- Service Role Key has full database access - keep it secret
- Use environment variables in production (Vercel, etc.)

⚠️ **Data Loss:**
- Switching databases means starting fresh unless you migrate data
- Backup your old database before switching if you need the data

⚠️ **RLS Policies:**
- If you had Row Level Security policies, you'll need to recreate them
- Check Supabase dashboard → **Authentication** → **Policies**

## Next Steps

After migration:
1. ✅ Update environment variables (local + production)
2. ✅ Run migrations on new database
3. ✅ Migrate data (if needed)
4. ✅ Test all features
5. ✅ Update any external services that reference the old database URL
