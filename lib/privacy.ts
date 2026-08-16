// Deterministische Fake-Daten für den Datenschutz-/Demomodus. Kein RNG - der
// Hash aus der echten Entity-ID sorgt dafür, dass derselbe Mieter/dieselbe
// Immobilie auf jeder Seite denselben Fake-Wert zeigt.

const FIRST_NAMES = [
  'Max', 'Anna', 'Peter', 'Julia', 'Thomas', 'Sarah', 'Michael', 'Laura',
  'Stefan', 'Nina', 'Andreas', 'Lisa', 'Christian', 'Sophie', 'Daniel', 'Maria',
]

const LAST_NAMES = [
  'Mustermann', 'Schmidt', 'Müller', 'Weber', 'Fischer', 'Wagner', 'Becker',
  'Hoffmann', 'Schulz', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Zimmermann', 'Krüger',
]

const STREETS = [
  'Musterstraße', 'Hauptstraße', 'Gartenweg', 'Lindenallee', 'Bahnhofstraße',
  'Schulstraße', 'Bergweg', 'Kirchplatz', 'Ahornweg', 'Rosenweg',
]

const CITIES = [
  { plz: '50667', ort: 'Köln' },
  { plz: '10115', ort: 'Berlin' },
  { plz: '80331', ort: 'München' },
  { plz: '20095', ort: 'Hamburg' },
  { plz: '70173', ort: 'Stuttgart' },
  { plz: '60311', ort: 'Frankfurt am Main' },
  { plz: '01067', ort: 'Dresden' },
  { plz: '30159', ort: 'Hannover' },
]

function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function fakeName(seed: string): string {
  const h = hashSeed(seed)
  return `${FIRST_NAMES[h % FIRST_NAMES.length]} ${LAST_NAMES[(h >> 4) % LAST_NAMES.length]}`
}

export function fakeAddress(seed: string): string {
  const h = hashSeed(seed)
  const street = STREETS[h % STREETS.length]
  const houseNumber = (h % 60) + 1
  const city = CITIES[(h >> 4) % CITIES.length]
  return `${street} ${houseNumber}, ${city.plz} ${city.ort}`
}

// Verzerrt einen echten Betrag deterministisch um ±25%, damit Beträge in der
// Demo plausibel aussehen, ohne die echte Zahl preiszugeben. Vorzeichen und
// Größenordnung bleiben erhalten.
export function fakeAmount(seed: string, real: number): number {
  const h = hashSeed(seed)
  const factor = 0.75 + (h % 1000) / 1000 * 0.5 // 0.75 – 1.25
  return Math.round(real * factor)
}
