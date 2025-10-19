import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthUsers() {
  console.log('🔍 Checking auth users...\n');

  // Get all users from auth.users
  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.users.length} user(s):\n`);

  for (const user of users.users) {
    console.log(`📧 Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email Confirmed: ${user.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
    console.log('');
  }
}

checkAuthUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
