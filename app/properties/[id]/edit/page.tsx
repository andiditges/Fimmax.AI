import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { PropertyForm } from '@/components/properties/property-form'
import { IncidentalCostItem, Property } from '@/lib/types'

export default async function EditProperty({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const [{ data: property }, { data: incidentalCostItems }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('incidental_cost_items').select('*').eq('property_id', id),
  ])

  if (!property) notFound()

  return <PropertyForm property={property as Property} incidentalCostItems={(incidentalCostItems ?? []) as IncidentalCostItem[]} />
}
