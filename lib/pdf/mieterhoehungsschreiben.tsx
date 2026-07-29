import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import type { IndexmieteStatus } from '@/lib/vpi'
import type { Property, Tenant, UserSettings } from '@/lib/types'

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 56, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  senderLine: { fontSize: 7, color: '#666', marginBottom: 20, textDecoration: 'underline' },
  addressBlock: { marginBottom: 24, lineHeight: 1.4 },
  dateLine: { textAlign: 'right', marginBottom: 20 },
  subject: { fontFamily: 'Helvetica-Bold', marginBottom: 14, fontSize: 11 },
  paragraph: { marginBottom: 10, lineHeight: 1.5 },
  resultBox: { marginTop: 2, marginBottom: 12, padding: 12, backgroundColor: '#f3f4f6' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#1a1a1a', fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 8, color: '#555', marginTop: 12, lineHeight: 1.4 },
  signature: { marginTop: 24 },
  footer: { position: 'absolute', bottom: 24, left: 56, right: 56, fontSize: 7, color: '#999', textAlign: 'center' },
})

// Gemäß § 557b Abs. 2 BGB ist die erhöhte Miete von Beginn des übernächsten
// Monats nach Zugang der Erklärung an zu entrichten (nicht wie bei § 558 der
// dritte Monat - die Indexmiete braucht keine Zustimmung des Mieters, die
// Erklärung ist nur formal zuzustellen). "Übernächster Monat" ab generatedAt:
// bei Zugang im November wäre das Januar.
function uebernaechsterMonatsErster(generatedAt: Date): Date {
  return new Date(generatedAt.getFullYear(), generatedAt.getMonth() + 2, 1)
}

export function MieterhoehungsschreibenDocument({
  property,
  tenant,
  status,
  landlord,
  generatedAt,
}: {
  property: Property
  tenant: Tenant
  status: IndexmieteStatus
  landlord: UserSettings | null
  generatedAt: Date
}) {
  const [propStreet, propCityLine] = property.address.split(',').map(s => s.trim())
  const unitLine = property.unit_label || property.unit
  const salutation = tenant.name.includes('&') || tenant.name.includes(' und ')
    ? `Sehr geehrte Damen und Herren,`
    : `Sehr geehrte(r) ${tenant.name},`

  const senderOneLine = landlord
    ? [landlord.landlord_name, landlord.address_line, [landlord.postal_code, landlord.city].filter(Boolean).join(' ')]
        .filter(Boolean).join(' · ')
    : ''

  const delta = status.possible_new_rent - status.current_rent
  const voraussichtlichAb = uebernaechsterMonatsErster(generatedAt)

  return (
    <Document title={`Mieterhoehung Indexmiete - ${tenant.name} - ${propertyLabel(property)}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.footer} fixed>Erstellt am {formatDate(generatedAt)} mit Fimmax.AI</Text>

        {senderOneLine && <Text style={styles.senderLine}>{senderOneLine}</Text>}

        <View style={styles.addressBlock}>
          <Text>{tenant.name}</Text>
          {propStreet && <Text>{propStreet}</Text>}
          {propCityLine && <Text>{propCityLine}</Text>}
        </View>

        <Text style={styles.dateLine}>
          {landlord?.city || propCityLine || ''}, {formatDate(generatedAt)}
        </Text>

        <Text style={styles.subject}>
          Mieterhöhung nach § 557b BGB (Indexmiete) für die Wohnung {property.address}
          {unitLine ? ` (${unitLine})` : ''}
        </Text>

        <Text style={styles.paragraph}>{salutation}</Text>
        <Text style={styles.paragraph}>
          für Ihr Mietverhältnis wurde vertraglich eine Indexmiete gemäß § 557b BGB vereinbart. Danach
          richtet sich die Miete nach der Entwicklung des vom Statistischen Bundesamt veröffentlichten
          Verbraucherpreisindex für Deutschland (VPI).
        </Text>
        <Text style={styles.paragraph}>
          Der VPI stand zum {formatDate(status.base_date)} (Basis der letzten Mietfestsetzung) bei{' '}
          {status.base_value.toFixed(1)} Punkten. Der zuletzt veröffentlichte Wert für {formatDate(status.latest_month)}{' '}
          liegt bei {status.latest_value.toFixed(1)} Punkten. Das entspricht einer Steigerung von{' '}
          {status.percent_change >= 0 ? '+' : ''}{status.percent_change.toFixed(2)} %.
        </Text>

        <View style={styles.resultBox}>
          <View style={styles.resultRow}>
            <Text>Bisherige monatliche Kaltmiete</Text>
            <Text>{euro(status.current_rent)}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text>Anpassung entsprechend Indexentwicklung</Text>
            <Text>{delta >= 0 ? '+' : ''}{euro(delta)}</Text>
          </View>
          <View style={styles.resultTotalRow}>
            <Text>Neue monatliche Kaltmiete</Text>
            <Text>{euro(status.possible_new_rent)}</Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          Die erhöhte Miete ist gemäß § 557b Abs. 2 BGB von Beginn des übernächsten Monats nach Zugang
          dieses Schreibens bei Ihnen an zu entrichten – bei Zugang dieses Schreibens im Verlauf dieses
          Monats voraussichtlich ab dem {formatDate(voraussichtlichAb)}. Bitte überweisen Sie ab diesem
          Zeitpunkt den neuen Betrag auf das Ihnen bekannte Konto.
        </Text>

        <Text style={[styles.paragraph, styles.signature]}>
          Bei Fragen zu dieser Mieterhöhung stehe ich Ihnen gerne zur Verfügung.
        </Text>
        <Text style={styles.paragraph}>Mit freundlichen Grüßen</Text>
        <Text>{landlord?.landlord_name || ''}</Text>

        <Text style={styles.note}>
          Rechnerisch auf Basis der beim Vertragsschluss vereinbarten Indexklausel ermittelt. Bitte vor
          Versand prüfen, ob die Angaben (insbesondere das genaue Zugangsdatum und der daraus folgende
          Wirksamkeitstermin) für Ihren Einzelfall zutreffen – dies ersetzt keine Rechtsberatung.
        </Text>
      </Page>
    </Document>
  )
}
