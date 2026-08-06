'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReceiptForm } from '@/components/receipts/receipt-form'

export default function NewReceipt() {
  const supabase = createClient()
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null; expected_non_allocable_operating_cost_annual: number | null }[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label, expected_non_allocable_operating_cost_annual').then(({ data }) => {
      setProperties(data ?? [])
    })
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  })

  return <ReceiptForm mode="new" properties={properties} userId={userId} />
}
