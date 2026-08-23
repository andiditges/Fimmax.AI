import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { DepreciableItemForm } from '@/components/depreciable-items/depreciable-item-form'
import { DepreciableItem } from '@/lib/types'

export default async function EditDepreciableItem({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const { data: item } = await supabase.from('depreciable_items').select('*').eq('id', id).single()

  if (!item) notFound()

  return <DepreciableItemForm item={item as DepreciableItem} />
}
