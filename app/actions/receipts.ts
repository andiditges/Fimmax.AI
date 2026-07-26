'use server'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'

export async function getReceiptSignedUrl(filePath: string): Promise<string | null> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(filePath, 300)
  if (error) return null
  return data.signedUrl
}
