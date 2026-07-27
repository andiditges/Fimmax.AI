import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import type { TenantAllocation } from '@/lib/operating-costs'
import type { Property, UserSettings } from '@/lib/types'

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 56, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  senderLine: { fontSize: 7, color: '#666', marginBottom: 28, textDecoration: 'underline' },
  addressBlock: { marginBottom: 36, lineHeight: 1.4 },
  dateLine: { textAlign: 'right', marginBottom: 28 },
  subject: { fontFamily: 'Helvetica-Bold', marginBottom: 16, fontSize: 11 },
  paragraph: { marginBottom: 12, lineHeight: 1.5 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 4, marginTop: 12, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 4 },
  colLabel: { flex: 1 },
  colAmount: { width: 80, textAlign: 'right' },
  totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 5, marginTop: 2, fontFamily: 'Helvetica-Bold' },
  resultBox: { marginTop: 20, padding: 14, backgroundColor: '#f3f4f6' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#1a1a1a', fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 8, color: '#555', marginTop: 16, lineHeight: 1.4 },
  signature: { marginTop: 40 },
  footer: { position: 'absolute', bottom: 24, left: 56, right: 56, fontSize: 7, color: '#999', textAlign: 'center' },
})

export function BetriebskostenabrechnungDocument({
  property,
  year,
  allocation,
  landlord,
  generatedAt,
  totalBillableTenants,
}: {
  property: Property
  year: number
  allocation: TenantAllocation
  landlord: UserSettings | null
  generatedAt: Date
  totalBillableTenants: number
}) {
  const [propStreet, propCityLine] = property.address.split(',').map(s => s.trim())
  const unitLine = property.unit_label || property.unit
  const salutation = allocation.tenant.name.includes('&') || allocation.tenant.name.includes(' und ')
    ? `Sehr geehrte Damen und Herren,`
    : `Sehr geehrte(r) ${allocation.tenant.name},`

  const senderOneLine = landlord
    ? [landlord.landlord_name, landlord.address_line, [landlord.postal_code, landlord.city].filter(Boolean).join(' ')]
        .filter(Boolean).join(' · ')
    : ''

  const isSharedAllocation = totalBillableTenants > 1

  return (
    <Document title={`Betriebskostenabrechnung ${year} - ${propertyLabel(property)}`}>
      <Page size="A4" style={styles.page}>
        {senderOneLine && <Text style={styles.senderLine}>{senderOneLine}</Text>}

        <View style={styles.addressBlock}>
          <Text>{allocation.tenant.name}</Text>
          {propStreet && <Text>{propStreet}</Text>}
          {propCityLine && <Text>{propCityLine}</Text>}
        </View>

        <Text style={styles.dateLine}>
          {landlord?.city || propCityLine || ''}, {formatDate(generatedAt)}
        </Text>

        <Text style={styles.subject}>
          Betriebskostenabrechnung für den Zeitraum 01.01.{year} – 31.12.{year}
          {unitLine ? ` – ${unitLine}` : ''}
        </Text>

        <Text style={styles.paragraph}>{salutation}</Text>
        <Text style={styles.paragraph}>
          anbei erhalten Sie die Abrechnung der umlagefähigen Betriebskosten für den oben genannten
          Abrechnungszeitraum für die von Ihnen gemietete Einheit {property.address}
          {unitLine ? ` (${unitLine})` : ''}.
        </Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colLabel}>Kostenart</Text>
          <Text style={styles.colAmount}>Betrag</Text>
        </View>
        {allocation.rows.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={styles.colLabel}>Keine umlagefähigen Kosten erfasst</Text>
            <Text style={styles.colAmount}>{euro(0)}</Text>
          </View>
        )}
        {allocation.rows.map((r, i) => (
          <View style={styles.tableRow} key={i}>
            <Text style={styles.colLabel}>{r.label}</Text>
            <Text style={styles.colAmount}>{euro(r.amount)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.colLabel}>Summe umlagefähige Betriebskosten</Text>
          <Text style={styles.colAmount}>{euro(allocation.total)}</Text>
        </View>

        <View style={styles.resultBox}>
          <View style={styles.resultRow}>
            <Text>Ihr Anteil an den Betriebskosten</Text>
            <Text>{euro(allocation.total)}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text>Geleistete Nebenkostenvorauszahlungen</Text>
            <Text>{euro(allocation.advancePayments)}</Text>
          </View>
          <View style={styles.resultTotalRow}>
            <Text>{allocation.balance >= 0 ? 'Nachzahlung' : 'Guthaben (Rückzahlung an Sie)'}</Text>
            <Text>{euro(Math.abs(allocation.balance))}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Verteilerschlüssel: {isSharedAllocation
            ? 'Kosten wurden Ihnen entweder direkt zugeordnet oder anteilig nach der Anzahl der im Abrechnungszeitraum aktiven Mietmonate auf alle Mietparteien der Einheit verteilt.'
            : 'Alleinmieter der Einheit – volle Kosten zugeordnet.'}
        </Text>
        <Text style={styles.note}>
          Etwaige Einwendungen gegen diese Abrechnung können innerhalb von 12 Monaten nach Zugang geltend gemacht werden.
          Belege können auf Wunsch eingesehen werden.
        </Text>

        <Text style={[styles.paragraph, styles.signature]}>
          Bei Fragen zu dieser Abrechnung stehe ich Ihnen gerne zur Verfügung.
        </Text>
        <Text style={styles.paragraph}>Mit freundlichen Grüßen</Text>
        <Text>{landlord?.landlord_name || ''}</Text>

        <Text style={styles.footer}>Erstellt am {formatDate(generatedAt)} mit Fimmax.AI</Text>
      </Page>
    </Document>
  )
}
