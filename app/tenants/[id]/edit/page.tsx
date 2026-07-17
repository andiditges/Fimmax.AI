import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { TenantForm } from '@/components/tenants/tenant-form'
import { Tenant } from '@/lib/types'

export default async function EditTenant({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', id).single()

  if (!tenant) notFound()

  return <TenantForm tenant={tenant as Tenant} />
}
