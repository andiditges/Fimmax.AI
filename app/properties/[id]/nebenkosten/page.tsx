import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { NebenkostenForm } from '@/components/nebenkosten/nebenkosten-form'
import { Abrechnungsschreiben } from '@/components/nebenkosten/abrechnungsschreiben'
import { Card } from '@/components/ui/card'
import { sumAdvancePaymentsForYear } from '@/lib/operating-costs'
import { propertyLabel } from '@/lib/format'
import { OperatingCost, Property, Tenant, UserSettings, UtilitySettlement } from '@/lib/types'

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

  const [{ data: property }, { data: costs }, { data: settlement }, { data: tenants }, { data: userSettings }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('operating_costs').select('*').eq('property_id', id).eq('year', year),
    supabase.from('utility_settlements').select('*').eq('property_id', id).eq('year', year).maybeSingle(),
    supabase.from('tenants').select('*').eq('property_id', id),
    supabase.from('user_settings').select('*').maybeSingle(),
  ])

  if (!property) notFound()

  const p = property as Property
  const tenantList = (tenants ?? []) as Tenant[]
  const costList = (costs ?? []) as OperatingCost[]
  const advancePayments = sumAdvancePaymentsForYear(tenantList, year)
  const settings = userSettings as UserSettings | null
  const hasLandlordAddress = !!(settings?.landlord_name && settings?.address_line)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href={`/properties/${id}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← {propertyLabel(p)}</Link>
          <h1 className="text-2xl font-bold text-gray-900">Nebenkostenassistent {year}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {p.is_self_managed
              ? 'Selbst verwaltet – alle Kostenarten hier eintragen, damit nichts vergessen wird.'
              : 'Fremd verwaltet – Summen aus der Jahresabrechnung der Hausverwaltung übertragen.'}
            {' '}Am Ende steht nicht nur eine Übersicht, sondern ein fertiges Abrechnungsschreiben je Mieter zum Download.
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

      {!hasLandlordAddress && (
        <Card className="bg-amber-50 border-amber-100">
          <p className="text-sm text-gray-700">
            Für ein fertiges Abrechnungsschreiben fehlen noch deine Absenderdaten.{' '}
            <Link href="/einstellungen" className="text-blue-600 hover:underline font-medium">Jetzt in den Einstellungen eintragen →</Link>
          </p>
        </Card>
      )}

      <NebenkostenForm
        property={p}
        year={year}
        existingCosts={costList}
        settlement={settlement as UtilitySettlement | null}
        advancePaymentsForYear={advancePayments}
        tenants={tenantList}
      />

      <Abrechnungsschreiben
        property={p}
        year={year}
        tenants={tenantList}
        costs={costList}
        settlement={settlement as UtilitySettlement | null}
      />
    </div>
  )
}
