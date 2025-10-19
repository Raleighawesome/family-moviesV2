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

async function checkHouseholdMembers() {
  console.log('🔍 Checking household members...\n');

  // Get all household members
  const { data: members, error } = await supabase
    .from('household_members')
    .select('*, households(name)');

  if (error) {
    console.error('❌ Error fetching household members:', error);
    return;
  }

  console.log(`Found ${members.length} household member(s):\n`);

  for (const member of members) {
    console.log(`👤 User ID: ${member.user_id}`);
    console.log(`   Household: ${member.households?.name || 'Unknown'}`);
    console.log(`   Household ID: ${member.household_id}`);
    console.log(`   Role: ${member.role}`);
    console.log(`   Profile ID: ${member.profile_id || 'None'}`);
    console.log('');
  }

  // Get auth users
  const { data: authUsers } = await supabase.auth.admin.listUsers();

  console.log('\n📊 Summary:');
  console.log(`   Auth Users: ${authUsers?.users.length || 0}`);
  console.log(`   Household Members: ${members.length}`);

  if (authUsers && authUsers.users.length > members.length) {
    console.log('\n⚠️  Warning: Some users are not linked to any household!');
    for (const user of authUsers.users) {
      const isMember = members.some(m => m.user_id === user.id);
      if (!isMember) {
        console.log(`   - ${user.email} (${user.id})`);
      }
    }
  }
}

checkHouseholdMembers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
