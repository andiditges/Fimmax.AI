import Link from 'next/link'
import { DepreciableItem } from '@/lib/types'
import { calcAnnualMovableAfa } from '@/lib/afa'
import { formatDate } from '@/lib/format'
import { SensitiveEuro } from '@/components/privacy/sensitive'

export function DepreciableItemList({ items }: { items: DepreciableItem[] }) {
  return (
    <div className="space-y-2">
      {items.map(item => {
        const acquisitionYear = new Date(item.acquisition_date).getFullYear()
        const lastYear = acquisitionYear + item.usage_duration_years - 1
        return (
          <Link key={item.id} href={`/depreciable-items/${item.id}/edit`} className="block">
            <div className="flex items-center justify-between gap-3 flex-wrap py-2 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 hover:dark:bg-gray-950 -mx-2 px-2 rounded-lg transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.description}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Anschaffung {formatDate(item.acquisition_date)} · AfA {acquisitionYear}–{lastYear} ({item.usage_duration_years} Jahre)
                </p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100"><SensitiveEuro seed={`${item.id}-cost`} amount={item.acquisition_cost} /></p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  <SensitiveEuro seed={`${item.id}-afa`} amount={calcAnnualMovableAfa(item)} />/Jahr
                </p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
