import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { AssetForm } from '@/components/assets/asset-form'
import { Asset } from '@/lib/types'

export default async function EditAsset({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const { data: asset } = await supabase.from('assets').select('*').eq('id', id).single()

  if (!asset) notFound()

  return <AssetForm asset={asset as Asset} />
}
