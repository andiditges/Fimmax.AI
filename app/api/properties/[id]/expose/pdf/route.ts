import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { ExposeDocument, ExposeImage, ExposeFinancing } from '@/lib/pdf/expose'
import { currentRentAmount } from '@/lib/rent-schedule'
import { isUtilityBillableTenant } from '@/lib/operating-costs'
import { getLoanStatus, aggregateLoanChains } from '@/lib/amortization'
import { propertyLabel, propertyValue } from '@/lib/format'
import { Loan, LoanSpecialPayment, Property, PropertyImage, RentAdjustment, RentalAgreement, Tenant, UserSettings } from '@/lib/types'

const MAX_GALLERY_IMAGES = 12

function mimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/properties/[id]/expose/pdf'>) {
  await requireUser()
  const supabase = await createClient()
  const { id: propertyId } = await ctx.params
  const includeFinancing = _req.nextUrl.searchParams.get('financing') === '1'
  const currentYear = new Date().getFullYear()

  const [{ data: property }, { data: tenantsData }, { data: imagesData }, { data: settingsData }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).single(),
    supabase.from('tenants').select('*').eq('property_id', propertyId),
    supabase.from('property_images').select('*').eq('property_id', propertyId).order('is_cover', { ascending: false }).order('created_at'),
    supabase.from('user_settings').select('*').maybeSingle(),
  ])

  if (!property) return NextResponse.json({ error: 'Objekt nicht gefunden' }, { status: 404 })

  const p = property as Property
  const tenants = (tenantsData ?? []) as Tenant[]
  const images = (imagesData ?? []) as PropertyImage[]

  const { data: rentalAgreements } = tenants.length
    ? await supabase.from('rental_agreements').select('*').in('tenant_id', tenants.map(t => t.id))
    : { data: [] as RentalAgreement[] }
  const { data: rentAdjustments } = tenants.length
    ? await supabase.from('rent_adjustments').select('*').in('tenant_id', tenants.map(t => t.id))
    : { data: [] as RentAdjustment[] }
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const agreementsByTenant = agreementList.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)

  const activeTenants = tenants.filter(t => !t.move_out_date && isUtilityBillableTenant(t))
  const currentColdRent = activeTenants.reduce((sum, t) => sum + (currentRentAmount(agreementsByTenant[t.id] ?? []) ?? 0), 0)
  const currentRentPerSqm = p.living_area_sqm ? currentColdRent / p.living_area_sqm : null

  let financing: ExposeFinancing | null = null
  if (includeFinancing) {
    const { data: loansData } = await supabase.from('loans').select('*').eq('property_id', propertyId)
    const loans = (loansData ?? []) as Loan[]
    const { data: allSpecialPayments } = loans.length
      ? await supabase.from('loan_special_payments').select('*').in('loan_id', loans.map(l => l.id))
      : { data: [] as LoanSpecialPayment[] }
    const specialPaymentsByLoanId = loans.reduce((acc, l) => {
      acc[l.id] = (allSpecialPayments ?? []).filter(sp => sp.loan_id === l.id)
      return acc
    }, {} as Record<string, LoanSpecialPayment[]>)

    const loanChains = aggregateLoanChains(loans, specialPaymentsByLoanId)
    const totalRemaining = loanChains.reduce((s, c) => s + c.remaining, 0)
    const value = propertyValue(p)
    financing = {
      totalRemaining,
      ltvPercent: value > 0 ? (totalRemaining / value) * 100 : null,
      loans: loans.map(l => {
        const status = getLoanStatus(l, specialPaymentsByLoanId[l.id] ?? [])
        return { name: l.name, rate: l.nominal_interest_rate, remaining: status.remaining_balance, annuity: status.current_annuity_amount }
      }),
    }
  }

  const galleryImages: ExposeImage[] = []
  let coverImage: string | null = null
  for (const img of images.slice(0, MAX_GALLERY_IMAGES)) {
    const { data: blob, error } = await supabase.storage.from('property-images').download(img.file_path)
    if (error || !blob) continue
    const buffer = Buffer.from(await blob.arrayBuffer())
    const dataUri = `data:${mimeType(img.file_path)};base64,${buffer.toString('base64')}`
    if (img.is_cover && !coverImage) coverImage = dataUri
    else galleryImages.push({ dataUri, caption: img.caption })
  }

  const element = ExposeDocument({
    property: p,
    landlord: (settingsData as UserSettings) ?? null,
    generatedAt: new Date(),
    coverImage,
    galleryImages,
    rentInfo: {
      currentColdRentAnnual: currentColdRent,
      currentRentPerSqm,
      tenantCount: activeTenants.length,
    },
    financing,
  })
  const buffer = await renderToBuffer(element)

  const safeAddress = propertyLabel(p).replace(/[^a-zA-Z0-9-_äöüÄÖÜß]+/g, '-')
  const filename = `expose-${safeAddress}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
