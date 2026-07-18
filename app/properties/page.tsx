import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { PropertyList } from '@/components/properties/property-list'
import { RoofedImmobilie } from '@/components/roofed'
import { Property, Receipt, Tenant, RentalAgreement, RentAdjustment } from '@/lib/types'

export default async function PropertiesOverview() {
  await requireUser()
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [{ data: properties }, { data: receipts }, { data: tenants }, { data: rentalAgreements }, { data: rentAdjustments }] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase.from('receipts').select('*'),
    supabase.from('tenants').select('*'),
    supabase.from('rental_agreements').select('*'),
    supabase.from('rent_adjustments').select('*'),
  ])

  const props = (properties ?? []) as Property[]
  const recs = (receipts ?? []) as Receipt[]
  const tenantList = (tenants ?? []) as Tenant[]
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine <RoofedImmobilie suffix="n" /></h1>
          <p className="text-gray-500 text-sm mt-1">{props.length} <RoofedImmobilie suffix={props.length !== 1 ? 'n' : ''} /> im Portfolio</p>
        </div>
        <Link href="/properties/new" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap">
          + Neue <RoofedImmobilie />
        </Link>
      </div>

      <PropertyList properties={props} receipts={recs} tenants={tenantList} rentalAgreements={agreementList} rentAdjustments={adjustmentList} currentYear={currentYear} />
    </div>
  )
}
