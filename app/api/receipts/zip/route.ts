import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { propertyLabel } from '@/lib/format'
import { Property, Receipt } from '@/lib/types'

export async function GET(req: NextRequest) {
  await requireUser()
  const supabase = await createClient()
  const propertyId = req.nextUrl.searchParams.get('propertyId')
  const year = req.nextUrl.searchParams.get('year')
  if (!propertyId) return NextResponse.json({ error: 'propertyId fehlt' }, { status: 400 })

  const { data: property } = await supabase.from('properties').select('*').eq('id', propertyId).single()
  if (!property) return NextResponse.json({ error: 'Objekt nicht gefunden' }, { status: 404 })

  let query = supabase.from('receipts').select('*').eq('property_id', propertyId).not('file_url', 'is', null)
  if (year) query = query.eq('tax_year', parseInt(year))
  const { data: receiptsData } = await query
  const recs = (receiptsData ?? []) as Receipt[]

  if (recs.length === 0) return NextResponse.json({ error: 'Keine Belege mit hinterlegter Datei gefunden' }, { status: 404 })

  const zip = new JSZip()
  for (const r of recs) {
    if (!r.file_url) continue
    const { data, error } = await supabase.storage.from('receipts').download(r.file_url)
    if (error || !data) continue
    const ext = r.file_url.split('.').pop() ?? 'dat'
    const safeVendor = (r.vendor ?? r.description ?? 'beleg').replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, '-')
    zip.file(`${r.receipt_date}_${safeVendor}.${ext}`, await data.arrayBuffer())
  }

  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  const safeAddress = propertyLabel(property as Property).replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, '-')
  const filename = `belege-${safeAddress}${year ? `-${year}` : ''}.zip`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
