import { getLoanStatus, simulateSpecialPayment } from './amortization'
import { calc15Threshold } from './threshold15'
import { euro, propertyLabel } from './format'
import {
  Asset,
  Loan,
  LoanSpecialPayment,
  PortfolioFinancialSummary,
  Property,
  PropertyReserve,
  Receipt,
  Reminder,
  Tip,
} from './types'

export interface TipsInput {
  properties: Property[]
  loans: Loan[]
  specialPaymentsByLoan: Record<string, LoanSpecialPayment[]>
  assets: Asset[]
  reserves: PropertyReserve[]
  receipts: Receipt[]
  reminders: Reminder[]
  portfolio: PortfolioFinancialSummary
}

const EPS = 0.01

/**
 * Rein regelbasiert (kein KI-Call) – alles, was sich deterministisch aus den
 * vorhandenen Daten ableiten lässt, damit es kostenlos bei jedem Seitenaufruf
 * neu berechnet werden kann statt bei jedem Aufruf einen Claude-Call auszulösen.
 */
export function generateTips(input: TipsInput): Tip[] {
  const tips: Tip[] = []

  const sondertilgung = sondertilgungTip(input)
  if (sondertilgung) tips.push(sondertilgung)

  const cashPuffer = cashPufferTip(input)
  if (cashPuffer) tips.push(cashPuffer)

  const aktienquote = aktienquoteTip(input)
  if (aktienquote) tips.push(aktienquote)

  tips.push(...schwelle15Tips(input))
  tips.push(...reminderTips(input))
  tips.push(...risikoTips(input))

  const rank: Record<Tip['severity'], number> = { aktion: 0, warnung: 1, info: 2 }
  return tips.sort((a, b) => rank[a.severity] - rank[b.severity])
}

function sondertilgungTip({ loans, specialPaymentsByLoan, assets, portfolio, properties }: TipsInput): Tip | null {
  const propertyById = Object.fromEntries(properties.map(p => [p.id, p]))
  const candidates = loans
    .map(loan => ({ loan, status: getLoanStatus(loan, specialPaymentsByLoan[loan.id] ?? []) }))
    .filter(c => c.status.remaining_balance > EPS)

  if (candidates.length === 0) return null

  const worst = candidates.reduce((a, b) => (b.loan.nominal_interest_rate > a.loan.nominal_interest_rate ? b : a))

  const liquidReserve = assets
    .filter(a => a.category === 'tagesgeld_festgeld')
    .reduce((s, a) => s + a.current_value, 0)
  const safetyBuffer = 3 * (portfolio.monthly_debt_service + portfolio.monthly_operating_cost_runrate)
  const available = Math.floor((liquidReserve - safetyBuffer) / 500) * 500

  if (available < 500) return null

  const suggested = Math.min(available, worst.status.remaining_balance)
  const sim = simulateSpecialPayment(worst.loan, specialPaymentsByLoan[worst.loan.id] ?? [], suggested)
  const property = propertyById[worst.loan.property_id]

  return {
    id: 'sondertilgung',
    severity: 'aktion',
    title: `Sondertilgung: ${worst.loan.name} hat mit ${worst.loan.nominal_interest_rate}% deinen schlechtesten Zins`,
    body: `Nach Abzug einer Reserve von ${euro(safetyBuffer)} (3 Monate Rate + Kosten) hättest du noch ${euro(suggested)} aus deinem Tagesgeld/Festgeld übrig${property ? ` für ${propertyLabel(property)}` : ''}. Das würde dir ${euro(sim.interest_saved_total)} Zinsen sparen und die Restlaufzeit um ${sim.months_saved} Monate verkürzen.`,
    cta: { label: 'Zum Kredit', href: `/loans/${worst.loan.id}` },
  }
}

function cashPufferTip({ assets, reserves, portfolio }: TipsInput): Tip | null {
  const liquid = assets.filter(a => a.category === 'tagesgeld_festgeld').reduce((s, a) => s + a.current_value, 0)
    + reserves.reduce((s, r) => s + r.current_value, 0)
  const monthlyBurn = portfolio.monthly_debt_service + portfolio.monthly_operating_cost_runrate
  if (monthlyBurn <= 0) return null

  const monthsCovered = liquid / monthlyBurn
  if (monthsCovered >= 3) return null

  return {
    id: 'cash-puffer',
    severity: 'warnung',
    title: 'Cash-Puffer knapp',
    body: `Dein Tagesgeld/Festgeld plus Rücklagen (${euro(liquid)}) deckt aktuell nur ${monthsCovered.toFixed(1)} Monate deiner Kreditraten + Kosten (${euro(monthlyBurn)}/Monat). Üblich empfohlen werden 3-6 Monate als Puffer für Leerstand oder Mietausfall.`,
    cta: { label: 'Zu Finanzen', href: '/finanzen' },
  }
}

function aktienquoteTip({ assets }: TipsInput): Tip | null {
  const totalAssets = assets.reduce((s, a) => s + a.current_value, 0)
  if (totalAssets < 1000) return null

  const wertpapiere = assets.filter(a => a.category === 'wertpapiere').reduce((s, a) => s + a.current_value, 0)
  const share = wertpapiere / totalAssets
  if (share <= 0.7) return null

  return {
    id: 'aktienquote',
    severity: 'info',
    title: 'Wertpapiere machen einen großen Teil deiner liquiden Anlagen aus',
    body: `Wertpapiere sind ${(share * 100).toFixed(0)}% deiner erfassten Anlagen (ohne Immobilien) - ${euro(wertpapiere)} von ${euro(totalAssets)}. Nicht falsch, aber wenig Puffer außerhalb des Aktienmarkts für kurzfristigen Bedarf (z.B. Sondertilgung, Leerstand).`,
    cta: { label: 'Zu Finanzen', href: '/finanzen' },
  }
}

function schwelle15Tips({ properties, receipts }: TipsInput): Tip[] {
  return properties
    .map(p => ({ p, status: calc15Threshold(p, receipts.filter(r => r.property_id === p.id)) }))
    .filter(({ status }) => status.within_3_years && status.alert_level !== 'safe')
    .map(({ p, status }) => ({
      id: `schwelle15-${p.id}`,
      severity: (status.alert_level === 'exceeded' ? 'warnung' : 'info') as Tip['severity'],
      title: `${propertyLabel(p)}: 15%-Grenze bei anschaffungsnahen Herstellungskosten ${status.alert_level === 'exceeded' ? 'überschritten' : 'in Sicht'}`,
      body: status.alert_level === 'exceeded'
        ? `Renovierungsbelege innerhalb der ersten 3 Jahre summieren sich auf ${euro(status.renovation_total)} - über der 15%-Grenze von ${euro(status.threshold_15)} (bezogen auf den Gebäudewert). Diese Kosten sind steuerlich als Anschaffungskosten zu aktivieren statt sofort abziehbar - für die nächste Steuererklärung relevant.`
        : `Renovierungsbelege innerhalb der ersten 3 Jahre stehen bei ${status.percentage.toFixed(0)}% der 15%-Grenze (${euro(status.renovation_total)} von ${euro(status.threshold_15)}). Weitere Renovierungen in diesem Zeitraum könnten die Grenze reißen.`,
      cta: { label: 'Zur Immobilie', href: `/properties/${p.id}` },
    }))
}

function reminderTips({ reminders, properties }: TipsInput): Tip[] {
  const propertyById = Object.fromEntries(properties.map(p => [p.id, p]))
  const today = new Date()

  return reminders
    .filter(r => r.status !== 'erledigt' && r.due_date)
    .map(r => ({ r, dueDate: new Date(r.due_date as string) }))
    .filter(({ dueDate }) => dueDate.getTime() - today.getTime() < 30 * 24 * 60 * 60 * 1000)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 3)
    .map(({ r, dueDate }) => {
      const overdue = dueDate < today
      const property = propertyById[r.property_id]
      return {
        id: `reminder-${r.id}`,
        severity: (overdue ? 'aktion' : 'info') as Tip['severity'],
        title: `${overdue ? 'Überfällig' : 'Bald fällig'}: ${r.title}`,
        body: `${property ? propertyLabel(property) + ' · ' : ''}fällig am ${dueDate.toLocaleDateString('de-DE')}${r.description ? ` - ${r.description}` : ''}`,
        cta: { label: 'Zu Erinnerungen', href: '/reminders' },
      }
    })
}

function risikoTips({ properties }: TipsInput): Tip[] {
  return properties
    .filter(p => p.risk_score != null && p.risk_score >= 7)
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, 2)
    .map(p => ({
      id: `risiko-${p.id}`,
      severity: 'warnung' as Tip['severity'],
      title: `${propertyLabel(p)}: erhöhtes Standortrisiko (${p.risk_score}/10)`,
      body: p.risk_summary ?? 'Details in der Risikoeinschätzung der Immobilie.',
      cta: { label: 'Zur Immobilie', href: `/properties/${p.id}` },
    }))
}
