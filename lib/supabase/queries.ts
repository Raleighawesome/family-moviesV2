// Common database queries
import { createClient } from './server'

// Get the current user's primary household
export async function getCurrentHousehold() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the first household the user is a member of
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(*)')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return null
  }

  return membership.households
}

// Get user's profile in current household
export async function getCurrentProfile() {
  const household = await getCurrentHousehold()
  if (!household) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .eq('household_id', household.id)
    .single()

  return profile
}
