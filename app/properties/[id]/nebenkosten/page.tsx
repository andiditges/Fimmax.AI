import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { NebenkostenForm } from '@/components/nebenkosten/nebenkosten-form'
import { sumAdvancePaymentsForYear } from '@/lib/operating-costs'
import { propertyLabel } from '@/lib/format'
import { OperatingCost, Property, Tenant, UtilitySettlement } from '@/lib/types'

export default async function NebenkostenPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}) {
  await requireUser()
  const { id } = await params
  const { year: yearParam } = await searchParams
  const supabase = await createClient()
  const thisYear = new Date().getFullYear()
  const year = yearParam ? parseInt(yearParam) : thisYear - 1
  const yearOptions = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3]

  const [{ data: property }, { data: costs }, { data: settlement }, { data: tenants }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('operating_costs').select('*').eq('property_id', id).eq('year', year),
    supabase.from('utility_settlements').select('*').eq('property_id', id).eq('year', year).maybeSingle(),
    supabase.from('tenants').select('*').eq('property_id', id),
  ])

  if (!property) notFound()

  const p = property as Property
  const advancePayments = sumAdvancePaymentsForYear((tenants ?? []) as Tenant[], year)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href={`/properties/${id}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← {propertyLabel(p)}</Link>
          <h1 className="text-2xl font-bold text-gray-900">Nebenkosten {year}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {p.is_self_managed
              ? 'Selbst verwaltet – alle Kostenarten hier eintragen, damit nichts vergessen wird.'
              : 'Fremd verwaltet – Summen aus der Jahresabrechnung der Hausverwaltung übertragen.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {yearOptions.map(y => (
            <Link
              key={y}
              href={`/properties/${id}/nebenkosten?year=${y}`}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${y === year ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <NebenkostenForm
        property={p}
        year={year}
        existingCosts={(costs ?? []) as OperatingCost[]}
        settlement={settlement as UtilitySettlement | null}
        advancePaymentsForYear={advancePayments}
      />
    </div>
  )
}
