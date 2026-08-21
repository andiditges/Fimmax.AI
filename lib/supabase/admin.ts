import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-Role-Client - umgeht RLS komplett. NIE im Client-Code importieren,
// nur in API-Routen für Operationen, die die normale auth.users-Berechtigung
// nicht abbildet (z.B. auth.admin.deleteUser - Nutzer können ihren eigenen
// Auth-Account nicht selbst über die Client-SDK löschen).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
