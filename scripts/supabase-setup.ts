/**
 * Supabase Setup Script
 * 
 * This script uses the Supabase service_role key (never exposed in the browser)
 * to:
 * 1. Verify database state (restaurants, tables, categories, products, profiles)
 * 2. Create demo auth users with known passwords (if they don't exist)
 * 3. Create profiles and restaurant_users entries for demo staff
 * 4. Set up server_table_assignments
 * 
 * NOTE: This script does NOT execute DDL (GRANT, CREATE FUNCTION).
 * Those changes must be applied via the migration file:
 *   supabase/migrations/20261013000001_fix_permissions_and_profile_trigger.sql
 * 
 * Apply the migration using one of these methods:
 * A) Supabase Dashboard -> SQL Editor -> paste and run the migration SQL
 * B) Supabase CLI: supabase db push --project-ref dlgyrqxlfcjwddruxcqu
 *    (requires supabase link with database password)
 * 
 * The service role key is read from:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable, OR
 * - restaurant-saas/backend/.env file (SUPABASE_SERVICE_ROLE_KEY=...)
 * - Do NOT hardcode secrets in this script
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load backend .env for service role key if not in environment
config();
config({ path: resolve('restaurant-saas/backend/.env') });

const supabaseUrl: string = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const REST_ID: string = 'a0000000-0000-0000-0000-000000000001';

// Demo staff credentials
const demoStaff = [
  { email: 'manager@zoobar.tn', password: 'Manager123!', fullName: 'Yassine Gérant', username: 'MANAGER_01', role: 'MANAGER' as const },
  { email: 'karim@zoobar.tn', password: 'Server123!', fullName: 'Karim Serveur', username: 'U873', role: 'SERVER' as const },
  { email: 'sarra@zoobar.tn', password: 'Server123!', fullName: 'Sarra Serveuse', username: 'U874', role: 'SERVER' as const },
  { email: 'nabil@zoobar.tn', password: 'Server123!', fullName: 'Nabil Serveur', username: 'NABIL', role: 'SERVER' as const },
];

async function main() {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log('=== Supabase Database Setup ===\n');

  // Step 1: Verify database state
  console.log('1. Verifying database state...');
  const { data: restaurants, error: rErr } = await admin.from('restaurants').select('*');
  console.log(`   Restaurants: ${restaurants?.length || 0}`, rErr?.message || '');
  
  const { data: tables, error: tErr } = await admin.from('tables').select('count');
  console.log(`   Tables: ${tables?.length || 0}`, tErr?.message || '');
  
  const { data: categories, error: cErr } = await admin.from('categories').select('count');
  console.log(`   Categories: ${categories?.length || 0}`, cErr?.message || '');
  
  const { data: products, error: pErr } = await admin.from('products').select('count');
  console.log(`   Products: ${products?.length || 0}`, pErr?.message || '');

  const { data: profiles, error: profErr } = await admin.from('profiles').select('*');
  console.log(`   Profiles: ${profiles?.length || 0}`, profErr?.message || '');

  const { data: restUsers, error: ruErr } = await admin.from('restaurant_users').select('*');
  console.log(`   Restaurant users: ${restUsers?.length || 0}`, ruErr?.message || '');

  const { data: serverAssigns, error: saErr } = await admin.from('server_table_assignments').select('*');
  console.log(`   Server assignments: ${serverAssigns?.length || 0}`, saErr?.message || '');

  // Step 2: Create demo auth users and profiles
  console.log('\n2. Creating demo auth users...');
  
  // Get existing users
  const { data: { users: existingUsers }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) console.log('   List users error:', listErr.message);
  
  for (const staff of demoStaff) {
    const existingUser = existingUsers?.find(u => u.email === staff.email);
    
    if (existingUser) {
      console.log(`   [SKIP] ${staff.email} — already exists (${existingUser.id})`);
      
      // Ensure profile exists
      const existingProfile = profiles?.find(p => p.id === existingUser.id);
      if (!existingProfile) {
        console.log(`   Creating profile for ${staff.email}...`);
        await admin.from('profiles').upsert({
          id: existingUser.id,
          email: staff.email,
          full_name: staff.fullName,
          username: staff.username,
          role: staff.role,
          is_active: true,
        });
        console.log(`   [OK] Profile created for ${staff.email}`);
      } else {
        console.log(`   Profile already exists for ${staff.email}`);
      }
      
      // Ensure restaurant_user exists
      const existingRU = restUsers?.find(ru => ru.user_id === existingUser.id);
      if (!existingRU) {
        await admin.from('restaurant_users').upsert({
          restaurant_id: REST_ID,
          user_id: existingUser.id,
          role: staff.role,
        });
        console.log(`   [OK] Restaurant user link created for ${staff.email}`);
      } else {
        console.log(`   Restaurant user link exists for ${staff.email}`);
      }
    } else {
      console.log(`   Creating ${staff.email}...`);
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: staff.email,
        password: staff.password,
        email_confirm: true,
        user_metadata: {
          full_name: staff.fullName,
          username: staff.username,
          role: staff.role,
        },
      });
      
      if (createErr || !newUser?.user) {
        console.log(`   [ERROR] Could not create ${staff.email}:`, createErr?.message);
        continue;
      }
      
      console.log(`   [OK] Created ${staff.email} (${newUser.user.id})`);
      
      // Create profile
      await admin.from('profiles').insert({
        id: newUser.user.id,
        email: staff.email,
        full_name: staff.fullName,
        username: staff.username,
        role: staff.role,
        is_active: true,
      });
      console.log(`   [OK] Profile created for ${staff.email}`);
      
      // Create restaurant_user link
      await admin.from('restaurant_users').insert({
        restaurant_id: REST_ID,
        user_id: newUser.user.id,
        role: staff.role,
      });
      console.log(`   [OK] Restaurant user link created for ${staff.email}`);
    }
  }

  // Step 3: Ensure server assignments (for demo)
  console.log('\n3. Setting up server assignments...');
  const tables_data = await admin.from('tables').select('id, table_number');
  const rest_profiles = await admin.from('profiles').select('id, username, role').eq('role', 'SERVER');
  
  if (rest_profiles.data && rest_profiles.data.length >= 2 && tables_data.data && tables_data.data.length >= 10) {
    const server1 = rest_profiles.data[0];
    const server2 = rest_profiles.data[1];
    
    const assignments = [
      { server_id: server1.id, table_id: tables_data.data[0].id },
      { server_id: server1.id, table_id: tables_data.data[1].id },
      { server_id: server1.id, table_id: tables_data.data[2].id },
      { server_id: server1.id, table_id: tables_data.data[6].id },
      { server_id: server2.id, table_id: tables_data.data[3].id },
      { server_id: server2.id, table_id: tables_data.data[4].id },
      { server_id: server2.id, table_id: tables_data.data[5].id },
      { server_id: server2.id, table_id: tables_data.data[7].id },
      { server_id: server2.id, table_id: tables_data.data[8].id },
      { server_id: server2.id, table_id: tables_data.data[9].id },
    ];
    
    for (const assign of assignments) {
      await admin.from('server_table_assignments').upsert(
        { server_id: assign.server_id, table_id: assign.table_id, restaurant_id: REST_ID },
        { onConflict: 'server_id,table_id' }
      );
    }
    console.log('   [OK] Server assignments configured');
  }

  // Step 4: Write credentials file
  const credsPath = resolve(process.cwd(), '.env.demo-credentials');
  const credsContent = `# Demo credentials (auto-generated by setup script)
# IMPORTANT: Store these securely. Never commit to version control.
# These are for demo/training purposes only.

# Manager
MANAGER_EMAIL=manager@zoobar.tn
MANAGER_PASSWORD=Manager123!

# Servers
SERVER_KARIM_EMAIL=karim@zoobar.tn
SERVER_KARIM_PASSWORD=Server123!

SERVER_SARRA_EMAIL=sarra@zoobar.tn
SERVER_SARRA_PASSWORD=Server123!

SERVER_NABIL_EMAIL=nabil@zoobar.tn
SERVER_NABIL_PASSWORD=Server123!

# Restaurant
RESTAURANT_ID=a0000000-0000-0000-0000-000000000001
`;
  writeFileSync(credsPath, credsContent);
  console.log('\n4. Demo credentials written to .env.demo-credentials');

  // Summary
  console.log('\n=== Setup Complete ===');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Manager: manager@zoobar.tn / Manager123!');
  console.log('  Server:  karim@zoobar.tn / Server123!');
  console.log('  Server:  sarra@zoobar.tn / Server123!');
  console.log('  Server:  nabil@zoobar.tn / Server123!');
  console.log('');
  console.log('IMPORTANT: Apply the database migration:');
  console.log('  supabase/migrations/20261013000001_fix_permissions_and_profile_trigger.sql');
  console.log('');
  console.log('This migration is REQUIRED for:');
  console.log('  - GRANT SELECT on restaurants TO authenticated (staff can read restaurant info)');
  console.log('  - GRANT SELECT on categories, products TO anon (public menu access)');
  console.log('  - GRANT SELECT/INSERT on tables, sessions, orders, order_items TO anon (QR client)');
  console.log('  - Profile creation trigger (auto-creates profiles on signup)');
  console.log('');
  console.log('Apply via Supabase Dashboard SQL Editor or: supabase db push --linked');
}

main().catch(console.error);
