import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { Card } from '@/components/ui/card'
import { SensitiveEuro } from '@/components/privacy/sensitive'
import { formatDate } from '@/lib/format'
import { BUSINESS_EXPENSE_CATEGORY_LABELS, BusinessExpense } from '@/lib/types'

export default async function BusinessExpensesPage() {
  await requireUser()
  const supabase = await createClient()
  const { data: expenses } = await supabase.from('business_expenses').select('*').order('expense_date', { ascending: false })
  const expenseList = (expenses ?? []) as BusinessExpense[]

  const byYear = expenseList.reduce((acc, e) => {
    (acc[e.tax_year] ??= []).push(e)
    return acc
  }, {} as Record<number, BusinessExpense[]>)
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Betriebsausgaben</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Ausgaben außerhalb der Anlage V – z.B. für ein eigenes Gewerbe/eine Selbständigkeit neben der Vermietung (EÜR/Anlage G/S). Fließt bewusst nicht in die Anlage-V-Werbungskosten der Steuerübersicht ein.
          </p>
        </div>
        <Link href="/business-expenses/new" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors whitespace-nowrap">
          + Ausgabe erfassen
        </Link>
      </div>

      {expenseList.length === 0 ? (
        <Card className="text-center py-12 text-gray-400 dark:text-gray-500">Noch keine Betriebsausgaben erfasst</Card>
      ) : (
        <div className="space-y-6">
          {years.map(year => {
            const yearExpenses = byYear[year]
            const yearTotal = yearExpenses.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={year}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{year}</h2>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <SensitiveEuro seed={`business-expenses-${year}`} amount={yearTotal} />
                  </span>
                </div>
                <Card>
                  <div className="space-y-2">
                    {yearExpenses.map(e => (
                      <Link key={e.id} href={`/business-expenses/${e.id}/edit`} className="block">
                        <div className="flex items-center justify-between gap-3 flex-wrap py-2 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 hover:dark:bg-gray-950 -mx-2 px-2 rounded-lg transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {[e.vendor, e.description].filter(Boolean).join(' – ') || BUSINESS_EXPENSE_CATEGORY_LABELS[e.category]}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {formatDate(e.expense_date)} · {BUSINESS_EXPENSE_CATEGORY_LABELS[e.category]}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            <SensitiveEuro seed={`${e.id}-amount`} amount={e.amount} />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
