import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { euro, formatDate, propertyLabel } from '@/lib/format'
import { ENERGY_CERTIFICATE_TYPE_LABELS, PROPERTY_CONDITION_GRADE_LABELS, PropertyConditionGrade, Property, UserSettings } from '@/lib/types'

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  senderLine: { fontSize: 7, color: '#666', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 16 },
  coverImage: { width: '100%', height: 220, objectFit: 'cover', borderRadius: 4, marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  rowLabel: { color: '#555' },
  rowValue: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  note: { fontSize: 7.5, color: '#777', marginTop: 6, lineHeight: 1.4 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  galleryItem: { width: '48%', marginBottom: 10 },
  galleryImage: { width: '100%', height: 130, objectFit: 'cover', borderRadius: 4 },
  galleryCaption: { fontSize: 8, color: '#666', marginTop: 3 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 7, color: '#999', textAlign: 'center' },
})

export interface ExposeLoanRow {
  name: string
  rate: number
  remaining: number
  annuity: number
}

export interface ExposeFinancing {
  totalRemaining: number
  ltvPercent: number | null
  loans: ExposeLoanRow[]
}

export interface ExposeRentInfo {
  currentColdRentAnnual: number
  currentRentPerSqm: number | null
  tenantCount: number
}

export interface ExposeImage {
  dataUri: string
  caption: string | null
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

export function ExposeDocument({
  property,
  landlord,
  generatedAt,
  coverImage,
  galleryImages,
  rentInfo,
  financing,
}: {
  property: Property
  landlord: UserSettings | null
  generatedAt: Date
  coverImage: string | null
  galleryImages: ExposeImage[]
  rentInfo: ExposeRentInfo
  financing: ExposeFinancing | null
}) {
  const conditionEntries: [string, PropertyConditionGrade][] = [
    ['Fenster', property.condition_windows],
    ['Elektro', property.condition_electrical],
    ['Sanitär / Bad', property.condition_bathroom],
    ['Heizung', property.condition_heating],
  ].filter((c): c is [string, PropertyConditionGrade] => c[1] !== null)

  const senderOneLine = landlord
    ? [landlord.landlord_name, landlord.address_line, [landlord.postal_code, landlord.city].filter(Boolean).join(' ')]
        .filter(Boolean).join(' · ')
    : ''

  return (
    <Document title={`Objekt-Exposé - ${propertyLabel(property)}`}>
      <Page size="A4" style={styles.page}>
        {senderOneLine && <Text style={styles.senderLine}>{senderOneLine}</Text>}

        {coverImage && <Image src={coverImage} style={styles.coverImage} />}

        <Text style={styles.title}>{propertyLabel(property)}</Text>
        <Text style={styles.subtitle}>Objekt-Exposé · Stand {formatDate(generatedAt)}</Text>

        <Text style={styles.sectionTitle}>Objektdaten</Text>
        <Row label="Baujahr" value={String(property.build_year)} />
        {property.living_area_sqm && <Row label="Wohnfläche" value={`${property.living_area_sqm} m²`} />}
        {property.rooms && <Row label="Zimmeranzahl" value={String(property.rooms)} />}
        {conditionEntries.length > 0 && (
          <Row label="Zustand" value={conditionEntries.map(([l, g]) => `${l}: ${PROPERTY_CONDITION_GRADE_LABELS[g]}`).join(', ')} />
        )}
        {property.heating_year && <Row label="Baujahr Heizung" value={String(property.heating_year)} />}
        {property.renovation_note && <Row label="Sanierungsnotiz" value={property.renovation_note} />}
        {(property.energy_certificate_type || property.energy_efficiency_class || property.energy_certificate_value) && (
          <>
            {property.energy_certificate_type && (
              <Row label="Energieausweis" value={ENERGY_CERTIFICATE_TYPE_LABELS[property.energy_certificate_type]} />
            )}
            {property.energy_certificate_value && <Row label="Energiekennwert" value={`${property.energy_certificate_value} kWh/(m²·a)`} />}
            {property.energy_efficiency_class && <Row label="Energieeffizienzklasse" value={property.energy_efficiency_class} />}
            <Text style={styles.note}>Angaben zum Energieausweis gem. § 87 GEG – ohne Gewähr, bitte anhand des Originalausweises prüfen.</Text>
          </>
        )}

        <Text style={styles.sectionTitle}>Wert & Kauf</Text>
        <Row label="Kaufpreis" value={euro(property.purchase_price)} />
        <Row label="Aktueller Marktwert" value={euro(property.current_value ?? property.purchase_price)} />
        <Row label="Besitzübergang" value={formatDate(property.purchase_date)} />

        <Text style={styles.sectionTitle}>Vermietungssituation</Text>
        <Row label="Aktuelle Kaltmiete (Ist, p.a.)" value={euro(rentInfo.currentColdRentAnnual)} />
        {rentInfo.currentRentPerSqm != null && <Row label="Kaltmiete pro m²" value={`${rentInfo.currentRentPerSqm.toFixed(2)} €/m²`} />}
        <Row label="Anzahl Mietparteien" value={String(rentInfo.tenantCount)} />
        {(property.comparable_rent_min || property.comparable_rent_max) && (
          <Row
            label="Ortsübliche Vergleichsmiete"
            value={`${euro(property.comparable_rent_min ?? property.comparable_rent_max ?? 0)}–${euro(property.comparable_rent_max ?? property.comparable_rent_min ?? 0)} /m²`}
          />
        )}

        {financing && (
          <>
            <Text style={styles.sectionTitle}>Finanzierung (Beleihung)</Text>
            <Row label="Restschuld gesamt" value={euro(financing.totalRemaining)} />
            {financing.ltvPercent != null && <Row label="Beleihungsauslauf (LTV)" value={`${financing.ltvPercent.toFixed(1)}%`} />}
            {financing.loans.map((l, i) => (
              <Row key={i} label={l.name} value={`${l.rate}% · Rate ${euro(l.annuity)} · Restschuld ${euro(l.remaining)}`} />
            ))}
          </>
        )}

        <Text style={styles.footer}>Erstellt mit Fimmax.AI am {formatDate(generatedAt)} · Ohne Gewähr, keine Rechts- oder Anlageberatung.</Text>
      </Page>

      {galleryImages.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Bilder</Text>
          <View style={styles.galleryGrid}>
            {galleryImages.map((img, i) => (
              <View key={i} style={styles.galleryItem}>
                <Image src={img.dataUri} style={styles.galleryImage} />
                {img.caption && <Text style={styles.galleryCaption}>{img.caption}</Text>}
              </View>
            ))}
          </View>
          <Text style={styles.footer}>Erstellt mit Fimmax.AI am {formatDate(generatedAt)} · Ohne Gewähr, keine Rechts- oder Anlageberatung.</Text>
        </Page>
      )}
    </Document>
  )
}
