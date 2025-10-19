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

async function linkUserToHousehold() {
  console.log('🔗 Linking user to household...\n');

  // Get the current auth user
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  if (!authUsers || authUsers.users.length === 0) {
    console.error('❌ No auth users found');
    return;
  }

  const user = authUsers.users[0];
  console.log(`📧 Found user: ${user.email} (${user.id})`);

  // Check if user is already linked to a household
  const { data: existingMember } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (existingMember) {
    console.log('✅ User is already linked to a household');
    return;
  }

  // Get existing households
  const { data: households } = await supabase
    .from('households')
    .select('*')
    .limit(1);

  let householdId: string;

  if (households && households.length > 0) {
    // Clean up old household member records first
    console.log('🧹 Cleaning up old household member records...');
    const { error: deleteError } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', households[0].id);

    if (deleteError) {
      console.error('❌ Error cleaning up old members:', deleteError);
    }

    householdId = households[0].id;
    console.log(`🏠 Using existing household: ${households[0].name} (${householdId})`);
  } else {
    // Create a new household
    console.log('🏠 Creating new household...');
    const { data: newHousehold, error: householdError } = await supabase
      .from('households')
      .insert({
        name: `${user.email?.split('@')[0]}'s Family`,
      })
      .select()
      .single();

    if (householdError || !newHousehold) {
      console.error('❌ Error creating household:', householdError);
      return;
    }

    householdId = newHousehold.id;
    console.log(`✅ Created household: ${newHousehold.name} (${householdId})`);
  }

  // Link user to household
  console.log('🔗 Linking user to household...');
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({
      household_id: householdId,
      user_id: user.id,
      role: 'admin',
    });

  if (memberError) {
    console.error('❌ Error linking user to household:', memberError);
    return;
  }

  console.log('✅ Successfully linked user to household!');
  console.log('\nYou can now log in with:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: (your password)`);
}

linkUserToHousehold()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
