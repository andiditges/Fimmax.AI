'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReceiptForm } from '@/components/receipts/receipt-form'
import { DuplicateCandidate } from '@/lib/receipt-duplicates'

export default function NewReceipt() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const defaultPropertyId = searchParams.get('property') ?? undefined
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null; expected_non_allocable_operating_cost_annual: number | null }[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [existingReceipts, setExistingReceipts] = useState<DuplicateCandidate[]>([])

  useState(() => {
    supabase.from('properties').select('id, address, unit, unit_label, expected_non_allocable_operating_cost_annual').then(({ data }) => {
      setProperties(data ?? [])
    })
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
    supabase.from('receipts').select('id, property_id, receipt_date, amount, vendor, description').then(({ data }) => {
      setExistingReceipts(data ?? [])
    })
  })

  return <ReceiptForm mode="new" properties={properties} userId={userId} defaultPropertyId={defaultPropertyId} existingReceipts={existingReceipts} />
}
