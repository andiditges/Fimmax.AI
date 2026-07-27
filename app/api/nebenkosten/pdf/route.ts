import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { allocateOperatingCostsToTenants } from '@/lib/operating-costs'
import { BetriebskostenabrechnungDocument } from '@/lib/pdf/betriebskostenabrechnung'
import { OperatingCost, Property, Tenant, UserSettings } from '@/lib/types'

export async function GET(req: NextRequest) {
  await requireUser()
  const supabase = await createClient()
  const propertyId = req.nextUrl.searchParams.get('propertyId')
  const yearParam = req.nextUrl.searchParams.get('year')
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!propertyId || !yearParam || !tenantId) {
    return NextResponse.json({ error: 'propertyId, year und tenantId erforderlich' }, { status: 400 })
  }
  const year = parseInt(yearParam)

  const [{ data: property }, { data: costsData }, { data: tenantsData }, { data: settingsData }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).single(),
    supabase.from('operating_costs').select('*').eq('property_id', propertyId).eq('year', year),
    supabase.from('tenants').select('*').eq('property_id', propertyId),
    supabase.from('user_settings').select('*').maybeSingle(),
  ])

  if (!property) return NextResponse.json({ error: 'Objekt nicht gefunden' }, { status: 404 })

  const tenants = (tenantsData ?? []) as Tenant[]
  const costs = (costsData ?? []) as OperatingCost[]
  const allocations = allocateOperatingCostsToTenants(costs, tenants, year)
  const allocation = allocations.find(a => a.tenant.id === tenantId)
  if (!allocation) {
    return NextResponse.json({ error: 'Mieter nicht gefunden oder für diese Abrechnung nicht relevant (z.B. Garage/Stellplatz)' }, { status: 404 })
  }

  const element = BetriebskostenabrechnungDocument({
    property: property as Property,
    year,
    allocation,
    landlord: (settingsData as UserSettings) ?? null,
    generatedAt: new Date(),
    totalBillableTenants: allocations.length,
  })
  const buffer = await renderToBuffer(element)

  const safeTenant = allocation.tenant.name.replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, '-')
  const filename = `nebenkostenabrechnung-${year}-${safeTenant}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
