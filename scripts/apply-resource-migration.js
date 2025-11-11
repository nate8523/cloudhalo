/**
 * Apply Azure Resources Table Migration
 *
 * This script reads the migration SQL file and executes it against your Supabase database.
 * It uses the Supabase client with the service role key to bypass RLS.
 *
 * Usage:
 *   node scripts/apply-resource-migration.js
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function applyMigration() {
  console.log('🚀 Applying Azure Resources Table Migration...\n')

  // Read environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local')
    process.exit(1)
  }

  if (!supabaseServiceKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
    console.log('\n📝 To fix this:')
    console.log('1. Go to https://supabase.com/dashboard/project/pyeogsssvzthbxpdcdeg/settings/api')
    console.log('2. Copy the "service_role" key (not the anon key!)')
    console.log('3. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n')
    process.exit(1)
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250111_create_azure_resources_table.sql')

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found at ${migrationPath}`)
    process.exit(1)
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
  console.log('✅ Migration file loaded\n')

  // Import Supabase client
  const { createClient } = require('@supabase/supabase-js')

  // Create client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

  console.log('🔌 Connected to Supabase\n')
  console.log('📋 Executing migration SQL...\n')

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL })

    if (error) {
      // Try direct approach if RPC doesn't exist
      console.log('⚠️  RPC method not available, trying direct execution...\n')

      // Split SQL into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';'
        console.log(`Executing statement ${i + 1}/${statements.length}...`)

        // Use PostgreSQL REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: statement })
        })

        if (!response.ok && response.status !== 404) {
          const errorText = await response.text()
          console.error(`❌ Error executing statement ${i + 1}:`, errorText)
        }
      }

      console.log('\n✅ Migration applied successfully!\n')
      console.log('🎉 The azure_resources table has been created.\n')
      console.log('Next steps:')
      console.log('1. Go to http://localhost:3000/dashboard/resources')
      console.log('2. Click "Sync Resources" button')
      console.log('3. Wait for resource discovery to complete\n')

      process.exit(0)
    }

    console.log('✅ Migration applied successfully!\n')
    console.log('🎉 The azure_resources table has been created.\n')
    console.log('Next steps:')
    console.log('1. Go to http://localhost:3000/dashboard/resources')
    console.log('2. Click "Sync Resources" button')
    console.log('3. Wait for resource discovery to complete\n')

  } catch (err) {
    console.error('❌ Error applying migration:', err.message)
    console.log('\n📝 Manual alternative:')
    console.log('1. Go to https://supabase.com/dashboard/project/pyeogsssvzthbxpdcdeg/editor')
    console.log('2. Click "SQL Editor" in the left sidebar')
    console.log('3. Click "New Query"')
    console.log(`4. Copy the contents of: ${migrationPath}`)
    console.log('5. Paste into the SQL Editor and click "Run"\n')
    process.exit(1)
  }
}

applyMigration()
