import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { RentChangeForm } from '@/components/tenants/rent-change-form'
import { RentHistoryRow } from '@/components/tenants/rent-history-row'
import { RentAdjustmentForm } from '@/components/tenants/rent-adjustment-form'
import { currentRentAmount } from '@/lib/rent-schedule'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { Tenant, Property, RentalAgreement, RentAdjustment } from '@/lib/types'

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', id).single()
  if (!tenant) notFound()

  const t = tenant as Tenant

  const [{ data: property }, { data: agreements }, { data: adjustments }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', t.property_id).single(),
    supabase.from('rental_agreements').select('*').eq('tenant_id', id).order('start_date'),
    supabase.from('rent_adjustments').select('*').eq('tenant_id', id).order('month'),
  ])

  const p = property as Property
  const agreementList = (agreements ?? []) as RentalAgreement[]
  const adjustmentList = (adjustments ?? []) as RentAdjustment[]
  const rent = currentRentAmount(agreementList)

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/properties/${t.property_id}`} className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">
          ← {p ? propertyLabel(p) : 'Immobilie'}
        </Link>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t.name}</h1>
          <Link href={`/tenants/${t.id}/edit`} className="text-sm text-blue-600 hover:underline">Bearbeiten</Link>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Einzug {formatDate(t.move_in_date)}{t.move_out_date ? ` · Auszug ${formatDate(t.move_out_date)}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Aktuelle Miete</CardTitle>
          <p className="text-2xl font-bold text-gray-900">{rent !== null ? euro(rent) : '–'}</p>
          {t.furnishing_surcharge != null && (
            <p className="text-xs text-gray-400 mt-1">davon {euro(t.furnishing_surcharge)} Küche/Stellplatz/Möbel</p>
          )}
        </Card>
        <Card>
          <CardTitle>Mietverhältnis</CardTitle>
          <p className="text-2xl font-bold text-gray-900">{t.move_out_date ? 'Beendet' : 'Aktiv'}</p>
        </Card>
      </div>

      {t.note && (
        <Card>
          <CardTitle>Notiz</CardTitle>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{t.note}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Miethistorie ({agreementList.length})</CardTitle>
        </div>
        {agreementList.length > 0 && (
          <div className="space-y-2 mb-4">
            {agreementList.map(a => <RentHistoryRow key={a.id} agreement={a} />)}
          </div>
        )}
        <RentChangeForm tenantId={t.id} propertyId={t.property_id} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Abweichende Monate ({adjustmentList.length})</CardTitle>
        </div>
        {adjustmentList.length > 0 && (
          <div className="space-y-2 mb-4">
            {adjustmentList.map(a => (
              <div key={a.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-600">{formatDate(a.month)}{a.note ? ` · ${a.note}` : ''}</span>
                <span className="font-medium text-gray-900">{euro(a.override_amount)}</span>
              </div>
            ))}
          </div>
        )}
        <RentAdjustmentForm tenantId={t.id} />
      </Card>
    </div>
  )
}
