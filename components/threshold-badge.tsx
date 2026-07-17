'use client'
import { ThresholdStatus } from '@/lib/types'
import { euro } from '@/lib/format'

const COLORS = {
  safe: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-orange-100 text-orange-800',
  exceeded: 'bg-red-100 text-red-800',
}

const LABELS = {
  safe: '15%-Hürde: OK',
  warning: '15%-Hürde: Achtung',
  danger: '15%-Hürde: Kritisch',
  exceeded: '15%-Hürde: Überschritten!',
}

export function ThresholdBadge({ status }: { status: ThresholdStatus }) {
  if (!status.within_3_years) return null
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${COLORS[status.alert_level]}`}>
      {LABELS[status.alert_level]} ({status.percentage.toFixed(0)}%)
    </span>
  )
}

export function ThresholdBar({ status }: { status: ThresholdStatus }) {
  if (!status.within_3_years) return null
  const pct = Math.min(status.percentage, 100)
  const barColor =
    status.alert_level === 'exceeded' ? 'bg-red-500' :
    status.alert_level === 'danger' ? 'bg-orange-400' :
    status.alert_level === 'warning' ? 'bg-yellow-400' : 'bg-green-400'

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Renovierungskosten (3-Jahres-Fenster)</span>
        <span>{euro(status.renovation_total)} / {euro(status.threshold_15)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {status.alert_level === 'exceeded' && (
        <p className="text-xs text-red-600 mt-1">
          Die 15%-Grenze ist überschritten – diese Kosten müssen aktiviert und abgeschrieben werden (§ 6 Abs. 1 Nr. 1a EStG).
        </p>
      )}
    </div>
  )
}
