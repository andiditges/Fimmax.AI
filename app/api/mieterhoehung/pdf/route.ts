import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { calcIndexmieteStatus, latestVpiReading } from '@/lib/vpi'
import { MieterhoehungsschreibenDocument } from '@/lib/pdf/mieterhoehungsschreiben'
import { Property, RentalAgreement, Tenant, UserSettings, VpiReading } from '@/lib/types'

export async function GET(req: NextRequest) {
  await requireUser()
  const supabase = await createClient()
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  const agreementId = req.nextUrl.searchParams.get('agreementId')
  if (!tenantId || !agreementId) {
    return NextResponse.json({ error: 'tenantId und agreementId erforderlich' }, { status: 400 })
  }

  const [{ data: tenant }, { data: agreement }, { data: readings }, { data: settingsData }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('rental_agreements').select('*').eq('id', agreementId).single(),
    supabase.from('vpi_readings').select('*'),
    supabase.from('user_settings').select('*').maybeSingle(),
  ])

  if (!tenant || !agreement) return NextResponse.json({ error: 'Mietverhältnis nicht gefunden' }, { status: 404 })

  const { data: property } = await supabase.from('properties').select('*').eq('id', (agreement as RentalAgreement).property_id).single()
  if (!property) return NextResponse.json({ error: 'Objekt nicht gefunden' }, { status: 404 })

  const latest = latestVpiReading((readings ?? []) as VpiReading[])
  if (!latest) return NextResponse.json({ error: 'Noch kein VPI-Indexstand erfasst' }, { status: 400 })

  const status = calcIndexmieteStatus(agreement as RentalAgreement, latest)
  if (!status) return NextResponse.json({ error: 'Kein gültiger Indexmiete-Status für dieses Mietverhältnis' }, { status: 400 })

  const element = MieterhoehungsschreibenDocument({
    property: property as Property,
    tenant: tenant as Tenant,
    status,
    landlord: (settingsData as UserSettings) ?? null,
    generatedAt: new Date(),
  })
  const buffer = await renderToBuffer(element)

  const safeTenant = (tenant as Tenant).name.replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, '-')
  const filename = `mieterhoehung-indexmiete-${safeTenant}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
