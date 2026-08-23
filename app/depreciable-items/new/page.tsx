'use client'
import { useSearchParams } from 'next/navigation'
import { DepreciableItemForm } from '@/components/depreciable-items/depreciable-item-form'

export default function NewDepreciableItem() {
  const searchParams = useSearchParams()
  const propertyId = searchParams.get('property') ?? undefined
  return <DepreciableItemForm propertyId={propertyId} />
}
