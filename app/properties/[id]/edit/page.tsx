import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { PropertyForm } from '@/components/properties/property-form'
import { Property } from '@/lib/types'

export default async function EditProperty({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const { data: property } = await supabase.from('properties').select('*').eq('id', id).single()

  if (!property) notFound()

  return <PropertyForm property={property as Property} />
}
