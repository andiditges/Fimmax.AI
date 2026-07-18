import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card, CardTitle } from '@/components/ui/card'
import { ThresholdBadge, ThresholdBar } from '@/components/threshold-badge'
import { ReminderRow } from '@/components/reminders/reminder-row'
import { TaxExportButton } from '@/components/tax-export-button'
import { calcAnnualAfa } from '@/lib/afa'
import { calc15Threshold } from '@/lib/threshold15'
import { getLoanStatus } from '@/lib/amortization'
import { buildTaxExportRow } from '@/lib/tax-export'
import { generateRentSchedule, currentRentAmount } from '@/lib/rent-schedule'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { CATEGORY_LABELS, HOA_RESOLUTION_STATUS_LABELS, HoaDocument, HoaResolution, HoaResolutionStatus, Property, Receipt, Reminder, Loan, LoanSpecialPayment, Tenant, RentalAgreement, RentAdjustment } from '@/lib/types'

const HOA_STATUS_COLORS: Record<HoaResolutionStatus, string> = {
  offen: 'bg-gray-100 text-gray-700',
  in_umsetzung: 'bg-yellow-100 text-yellow-800',
  umgesetzt: 'bg-green-100 text-green-800',
}

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()

  const [{ data: property }, { data: receipts }, { data: tenants }, { data: loans }, { data: reminders }, { data: hoaDocuments }, { data: hoaResolutions }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase.from('receipts').select('*').eq('property_id', id).order('receipt_date', { ascending: false }),
    supabase.from('tenants').select('*').eq('property_id', id),
    supabase.from('loans').select('*').eq('property_id', id),
    supabase.from('reminders').select('*').eq('property_id', id).order('status').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('hoa_documents').select('*').eq('property_id', id).order('year', { ascending: false }),
    supabase.from('hoa_resolutions').select('*').eq('property_id', id).gte('year', currentYear - 2).order('year', { ascending: false }),
  ])

  if (!property) notFound()

  const p = property as Property
  const recs = (receipts ?? []) as Receipt[]
  const tenantList = (tenants ?? []) as Tenant[]
  const propertyLoans = (loans ?? []) as Loan[]
  const reminderList = (reminders ?? []) as Reminder[]
  const hoaDocs = (hoaDocuments ?? []) as HoaDocument[]
  const hoaResolutionList = (hoaResolutions ?? []) as HoaResolution[]
  const reminderById = Object.fromEntries(reminderList.map(r => [r.id, r]))

  const { data: rentalAgreements } = tenantList.length
    ? await supabase.from('rental_agreements').select('*').in('tenant_id', tenantList.map(t => t.id))
    : { data: [] as RentalAgreement[] }
  const { data: rentAdjustments } = tenantList.length
    ? await supabase.from('rent_adjustments').select('*').in('tenant_id', tenantList.map(t => t.id))
    : { data: [] as RentAdjustment[] }
  const agreementList = (rentalAgreements ?? []) as RentalAgreement[]
  const adjustmentList = (rentAdjustments ?? []) as RentAdjustment[]
  const agreementsByTenant = agreementList.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = adjustmentList.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)

  const { data: allSpecialPayments } = propertyLoans.length
    ? await supabase.from('loan_special_payments').select('*').in('loan_id', propertyLoans.map(l => l.id))
    : { data: [] as LoanSpecialPayment[] }

  const loanStatuses = propertyLoans.map(l => ({
    loan: l,
    status: getLoanStatus(l, (allSpecialPayments ?? []).filter(sp => sp.loan_id === l.id)),
  }))

  const threshold = calc15Threshold(p, recs)
  const annualAfa = calcAnnualAfa(p)

  const yearRecs = recs.filter(r => r.tax_year === currentYear)
  const yearExpenses = yearRecs.reduce((s, r) => s + r.amount, 0)
  const yearIncome = tenantList.reduce((sum, t) => {
    const schedule = generateRentSchedule(
      t,
      agreementsByTenant[t.id] ?? [],
      adjustmentsByTenant[t.id] ?? [],
      new Date(currentYear, 0, 1),
      new Date(currentYear, 11, 1)
    )
    return sum + schedule.reduce((s, e) => s + e.amount, 0)
  }, 0)

  const byCategory = CATEGORY_LABELS
  const categoryTotals = Object.keys(byCategory).map(cat => ({
    cat,
    label: byCategory[cat as keyof typeof byCategory],
    total: yearRecs.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
  })).filter(c => c.total > 0)

  const taxExportRow = buildTaxExportRow(p, currentYear, recs, yearIncome)
  const openReminders = reminderList.filter(r => r.status !== 'erledigt')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/properties" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← Immobilien</Link>
          <h1 className="text-2xl font-bold text-gray-900">{propertyLabel(p)}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Baujahr {p.build_year} · AfA {p.afa_rate}% · {p.is_self_managed ? 'Selbst verwaltet' : 'Fremd verwaltet'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ThresholdBadge status={threshold} />
          <Link href={`/properties/${id}/edit`} className="text-sm text-blue-600 hover:underline">Bearbeiten</Link>
          <TaxExportButton rows={[taxExportRow]} filename={`steuer-export-${p.address.replace(/\s+/g, '-')}-${currentYear}.csv`} label={`Steuer-Export ${currentYear} (CSV)`} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardTitle className="min-h-10">Einnahmen {currentYear}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-green-600 break-words">{euro(yearIncome)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ausgaben {currentYear}</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-red-500 break-words">{euro(yearExpenses)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">AfA / Jahr</CardTitle>
          <p className="text-lg md:text-2xl font-bold text-blue-600 break-words">{euro(annualAfa)}</p>
        </Card>
        <Card>
          <CardTitle className="min-h-10">Ergebnis vor AfA</CardTitle>
          <p className={`text-lg md:text-2xl font-bold break-words ${yearIncome - yearExpenses >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {euro(yearIncome - yearExpenses)}
          </p>
        </Card>
      </div>

      {/* Nebenkosten */}
      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Nebenkosten</CardTitle>
            <p className="text-sm text-gray-500">Betriebskosten-Checkliste für die Abrechnung an deine Mieter</p>
          </div>
          <Link href={`/properties/${id}/nebenkosten`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">Öffnen →</Link>
        </div>
      </Card>

      {/* To-Dos & Erinnerungen */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">To-Dos & Erinnerungen ({openReminders.length} offen)</h2>
          <Link href={`/reminders/new?property=${id}`} className="text-sm text-blue-600 hover:underline">+ Erinnerung</Link>
        </div>
        {reminderList.length === 0 ? (
          <Card className="text-center py-8 text-gray-400">Noch keine Erinnerungen</Card>
        ) : (
          <div className="space-y-2">
            {reminderList.map(r => (
              <ReminderRow
                key={r.id}
                reminder={r}
                dependsOnTitle={r.depends_on_id ? reminderById[r.depends_on_id]?.title : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* 15%-Hürde */}
      {threshold.within_3_years && (
        <Card>
          <CardTitle>15%-Hürde (§ 6 Abs. 1 Nr. 1a EStG)</CardTitle>
          <ThresholdBar status={threshold} />
        </Card>
      )}

      {/* Ausgaben nach Kategorie */}
      {categoryTotals.length > 0 && (
        <Card>
          <CardTitle>Ausgaben {currentYear} nach Kategorie</CardTitle>
          <div className="mt-3 space-y-2">
            {categoryTotals.map(c => (
              <div key={c.cat} className="flex justify-between text-sm">
                <span className="text-gray-600">{c.label}</span>
                <span className="font-medium text-gray-900">{euro(c.total)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Gesamt</span>
              <span>{euro(yearExpenses)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Finanzierung */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Finanzierung ({propertyLoans.length})</h2>
          <Link href={`/loans/new?property=${id}`} className="text-sm text-blue-600 hover:underline">+ Kredit erfassen</Link>
        </div>
        {loanStatuses.length === 0 ? (
          <Card className="text-center py-8 text-gray-400">Noch keine Kredite hinterlegt</Card>
        ) : (
          <div className="space-y-2">
            {loanStatuses.map(({ loan, status }) => (
              <Link key={loan.id} href={`/loans/${loan.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{loan.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{loan.nominal_interest_rate}% Sollzins · {euro(status.current_annuity_amount)} / {loan.payment_frequency}</p>
                      {loan.planned_renovation_amount && (
                        <p className="text-xs text-amber-700 mt-0.5">Davon {euro(loan.planned_renovation_amount)} für Renovierung/Sanierung eingeplant</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{euro(status.remaining_balance)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Mieter & Miete */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Mieter & Miete ({tenantList.length})</h2>
          <Link href={`/tenants/new?property=${id}`} className="text-sm text-blue-600 hover:underline">+ Mieter erfassen</Link>
        </div>
        {tenantList.length === 0 ? (
          <Card className="text-center py-8 text-gray-400">Noch keine Mieter hinterlegt</Card>
        ) : (
          <div className="space-y-2">
            {tenantList.map(t => {
              const agreements = agreementsByTenant[t.id] ?? []
              const rent = currentRentAmount(agreements)
              const activeAgreement = [...agreements].sort((a, b) => a.start_date.localeCompare(b.start_date)).pop()
              return (
                <Link key={t.id} href={`/tenants/${t.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {activeAgreement ? `seit ${formatDate(activeAgreement.start_date)}` : `Einzug ${formatDate(t.move_in_date)}`}
                          {t.move_out_date ? ` · Auszug ${formatDate(t.move_out_date)}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{rent !== null ? euro(rent) : '–'}</span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Belegliste */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Belege ({recs.length})</h2>
          <Link href={`/receipts/new?property=${id}`} className="text-sm text-blue-600 hover:underline">+ Beleg erfassen</Link>
        </div>
        {recs.length === 0 ? (
          <Card className="text-center py-8 text-gray-400">Noch keine Belege</Card>
        ) : (
          <div className="space-y-2">
            {recs.map(r => (
              <Card key={r.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.vendor ?? r.description ?? '–'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.receipt_date).toLocaleDateString('de-DE')} · {CATEGORY_LABELS[r.category]}
                      {r.is_renovation && ' · Renovierung'}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{euro(r.amount)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* WEG-Dokumente & Beschlüsse */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">WEG-Dokumente & Beschlüsse</h2>
          <Link href={`/hoa/new?property=${id}`} className="text-sm text-blue-600 hover:underline">+ Dokument hochladen</Link>
        </div>
        {hoaDocs.length === 0 && hoaResolutionList.length === 0 ? (
          <Card className="text-center py-8 text-gray-400">Noch keine WEG-Dokumente hinterlegt</Card>
        ) : (
          <div className="space-y-4">
            {hoaDocs.length > 0 && (
              <div className="space-y-2">
                {hoaDocs.map(doc => (
                  <Card key={doc.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {doc.year}{doc.meeting_date ? ` · ${formatDate(doc.meeting_date)}` : ''}
                        </p>
                      </div>
                      {doc.file_url && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">📄 Protokoll hinterlegt</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {hoaResolutionList.length > 0 && (
              <Card>
                <CardTitle>Beschlüsse (letzte 3 Jahre)</CardTitle>
                <div className="mt-3 space-y-3">
                  {hoaResolutionList.map(res => (
                    <div key={res.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-gray-900">{res.title}</p>
                        {res.description && <p className="text-xs text-gray-500 mt-0.5">{res.description}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{res.year}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${HOA_STATUS_COLORS[res.status]}`}>
                        {HOA_RESOLUTION_STATUS_LABELS[res.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
