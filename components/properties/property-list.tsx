'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ThresholdBadge } from '@/components/threshold-badge'
import { calcAnnualAfa } from '@/lib/afa'
import { calc15Threshold } from '@/lib/threshold15'
import { getReceiptAllocations } from '@/lib/receipt-allocations'
import { sumRentForYear } from '@/lib/rent-schedule'
import { euro, propertyLabel } from '@/lib/format'
import { Property, Receipt, ReceiptItem, Tenant, RentalAgreement, RentAdjustment } from '@/lib/types'

export function PropertyList({
  properties,
  receipts,
  receiptItems = [],
  tenants,
  rentalAgreements,
  rentAdjustments,
  currentYear,
}: {
  properties: Property[]
  receipts: Receipt[]
  receiptItems?: ReceiptItem[]
  tenants: Tenant[]
  rentalAgreements: RentalAgreement[]
  rentAdjustments: RentAdjustment[]
  currentYear: number
}) {
  const router = useRouter()

  if (properties.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-gray-400 mb-4">Noch keine Immobilien hinterlegt.</p>
        <Link href="/properties/new" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          Erste Immobilie anlegen
        </Link>
      </Card>
    )
  }

  const agreementsByTenant = rentalAgreements.reduce((acc, a) => {
    if (a.tenant_id) (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentalAgreement[]>)
  const adjustmentsByTenant = rentAdjustments.reduce((acc, a) => {
    (acc[a.tenant_id] ??= []).push(a)
    return acc
  }, {} as Record<string, RentAdjustment[]>)

  const allocations = getReceiptAllocations(receipts, receiptItems)

  return (
    <div className="space-y-3">
      {properties.map(p => {
        const propAllocations = allocations.filter(a => a.property_id === p.id)
        const threshold = calc15Threshold(p, propAllocations)
        const yearExpenses = propAllocations.filter(a => a.tax_year === currentYear).reduce((s, a) => s + a.amount, 0)
        const receiptCount = new Set(propAllocations.map(a => a.receipt_id)).size
        const propTenants = tenants.filter(t => t.property_id === p.id)
        const yearIncome = sumRentForYear(propTenants, agreementsByTenant, adjustmentsByTenant, currentYear)

        return (
          <div key={p.id} onClick={() => router.push(`/properties/${p.id}`)}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{propertyLabel(p)}</p>
                  <p className="text-sm text-gray-500 mt-0.5">AfA: {euro(calcAnnualAfa(p))} / Jahr · {p.afa_rate}% · Bj. {p.build_year}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ThresholdBadge status={threshold} />
                  <Link
                    href={`/properties/${p.id}/nebenkosten`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  >
                    Nebenkostenassistent →
                  </Link>
                </div>
              </div>
              <div className="mt-3 flex gap-6 text-sm">
                <span className="text-green-600">Einnahmen: <strong>{euro(yearIncome)}</strong></span>
                <span className="text-red-500">Ausgaben: <strong>{euro(yearExpenses)}</strong></span>
                <span className="text-gray-500">{receiptCount} Belege</span>
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
