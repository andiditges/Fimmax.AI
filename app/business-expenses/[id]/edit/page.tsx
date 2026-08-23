import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { BusinessExpenseForm } from '@/components/business-expenses/business-expense-form'
import { BusinessExpense } from '@/lib/types'

export default async function EditBusinessExpense({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const supabase = await createClient()
  const { data: expense } = await supabase.from('business_expenses').select('*').eq('id', id).single()

  if (!expense) notFound()

  return <BusinessExpenseForm expense={expense as BusinessExpense} />
}
