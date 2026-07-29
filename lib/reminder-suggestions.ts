import { addMonths, differenceInCalendarMonths } from 'date-fns'
import { formatDate } from './format'
import { nextAgreementStep } from './rent-schedule'
import { Property, ReminderCategory, RentalAgreement, Tenant } from './types'

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface ReminderSuggestion {
  property_id: string
  tenant_id: string
  category: ReminderCategory
  title: string
  description: string
  due_date: string
}

/**
 * Schlägt eine Erinnerung je indexmiete-berechtigtem Mietverhältnis vor, das
 * bis zum geplanten Erhöhungstermin (Standard: 01.01. des Folgejahres) die
 * 12-Monats-Frist nach § 557b BGB erreicht hat - unabhängig davon, ob das
 * schon heute, ab September oder erst kurz vor dem Termin der Fall ist, da
 * ohnehin gebündelt zu diesem einen Termin verschickt werden soll. Enthält
 * bewusst keinen vorgerechneten Erhöhungsbetrag, da der VPI-Wert bis zum
 * Versand noch steigen kann - der Betrag soll erst dann mit dem dann
 * aktuellsten Wert berechnet werden.
 */
export function suggestIndexmieteReminders(
  items: { tenant: Tenant; property: Property; agreement: RentalAgreement }[],
  targetIncreaseDate: string,
  reminderDate: string
): ReminderSuggestion[] {
  const eligible = items.filter(
    (item): item is typeof item & { agreement: RentalAgreement & { index_base_date: string } } =>
      !!item.agreement.index_base_date &&
      differenceInCalendarMonths(new Date(targetIncreaseDate), new Date(item.agreement.index_base_date)) >= 12
  )
  return eligible.map(({ tenant, property, agreement }): ReminderSuggestion => ({
    property_id: property.id,
    tenant_id: tenant.id,
    category: 'mieterhoehung',
    title: `Indexmieterhöhung verschicken: ${tenant.name}`,
    description: `Mietverhältnis ist zum ${formatDate(targetIncreaseDate)} erhöhungsberechtigt nach § 557b BGB (Basis: ${formatDate(agreement.index_base_date)}). Erhöhungsschreiben mit dem dann aktuellsten VPI-Wert berechnen und verschicken, damit die neue Miete zum ${formatDate(targetIncreaseDate)} gilt.`,
    due_date: reminderDate,
  }))
}

/**
 * Schlägt eine Erinnerung je Staffelmiete-Mietverhältnis mit einer
 * bevorstehenden Stufe vor (leadMonths vor dem vertraglich bereits
 * feststehenden Stufen-Datum). Rein informativ zur Kontrolle/Kenntnisnahme -
 * die neue Miethöhe wird von generateRentSchedule/currentAgreement bereits
 * automatisch zum Stichtag angewendet, hier muss nichts Aktives ausgelöst
 * werden.
 */
export function suggestStaffelReminders(
  items: { tenant: Tenant; property: Property; agreements: RentalAgreement[] }[],
  asOfDate: Date,
  leadMonths: number = 1
): ReminderSuggestion[] {
  return items
    .map(({ tenant, property, agreements }): ReminderSuggestion | null => {
      const next = nextAgreementStep(agreements, asOfDate)
      if (!next) return null
      const reminderDate = iso(addMonths(new Date(next.start_date), -leadMonths))
      return {
        property_id: property.id,
        tenant_id: tenant.id,
        category: 'mieterhoehung',
        title: `Staffelmiete-Stufe prüfen: ${tenant.name}`,
        description: `Nächste Staffelstufe ab ${formatDate(next.start_date)}: neue Miete ${next.rent_amount.toFixed(2)} €. Wird im System automatisch berücksichtigt (siehe Mietverlauf) - diese Erinnerung ist nur zur Kontrolle/Kenntnisnahme, keine Aktion zwingend erforderlich.`,
        due_date: reminderDate,
      }
    })
    .filter((x): x is ReminderSuggestion => x !== null)
}
