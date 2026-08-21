import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STORAGE_BUCKETS = ['receipts', 'contracts', 'hoa-documents', 'utility-statements', 'property-images']

// Tabellen ohne property_id-Kaskade (properties selbst kaskadiert per
// on-delete-cascade in alle Kind-Tabellen: tenants, receipts, loans,
// reminders, hoa_documents, receipt_items, property_images, ...).
const USER_SCOPED_TABLES = ['assets', 'vpi_readings', 'user_settings', 'feedback', 'events', 'ai_category_gaps']

// Upload-Pfade sind pro Bucket unterschiedlich tief verschachtelt
// (<userId>/<propertyId>/<kategorie>/<jahr>/<datei>), storage.list()
// liefert aber nur eine Ebene - rekursiv auflösen, bis nur noch Dateien übrig sind.
async function collectFilePaths(supabase: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const { data: entries } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
  if (!entries || entries.length === 0) return []

  const paths: string[] = []
  for (const entry of entries) {
    const entryPath = `${prefix}/${entry.name}`
    if (entry.id === null) {
      paths.push(...await collectFilePaths(supabase, bucket, entryPath))
    } else {
      paths.push(entryPath)
    }
  }
  return paths
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  for (const bucket of STORAGE_BUCKETS) {
    const filePaths = await collectFilePaths(supabase, bucket, user.id)
    if (filePaths.length > 0) {
      await supabase.storage.from(bucket).remove(filePaths)
    }
  }

  const { error: propertiesError } = await supabase.from('properties').delete().eq('user_id', user.id)
  if (propertiesError) {
    return NextResponse.json({ error: 'Objekte konnten nicht gelöscht werden: ' + propertiesError.message }, { status: 500 })
  }

  for (const table of USER_SCOPED_TABLES) {
    await supabase.from(table).delete().eq('user_id', user.id)
  }

  const admin = createAdminClient()
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    return NextResponse.json({ error: 'Daten wurden gelöscht, Account-Löschung schlug fehl: ' + deleteUserError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
