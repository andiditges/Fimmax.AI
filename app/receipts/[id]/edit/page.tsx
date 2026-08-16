'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReceiptForm } from '@/components/receipts/receipt-form'
import { Receipt, ReceiptItem } from '@/lib/types'

export default function EditReceipt() {
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const [properties, setProperties] = useState<{ id: string; address: string; unit: string | null; unit_label: string | null; expected_non_allocable_operating_cost_annual: number | null }[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('properties').select('id, address, unit, unit_label, expected_non_allocable_operating_cost_annual').then(({ data }) => {
      setProperties(data ?? [])
    })
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
    Promise.all([
      supabase.from('receipts').select('*').eq('id', params.id).single(),
      supabase.from('receipt_items').select('*').eq('receipt_id', params.id),
    ]).then(([{ data: r }, { data: i }]) => {
      if (r) setReceipt(r)
      setItems(i ?? [])
      setLoaded(true)
    })
  }, [params.id, supabase])

  if (!loaded || !receipt) return <p className="text-sm text-gray-400 dark:text-gray-500">Lädt...</p>

  return (
    <ReceiptForm
      mode="edit"
      receiptId={receipt.id}
      properties={properties}
      userId={userId}
      initialReceipt={receipt}
      initialItems={items}
    />
  )
}
