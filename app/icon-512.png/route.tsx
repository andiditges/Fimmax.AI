import { ImageResponse } from 'next/og'
import { AppIconElement } from '@/lib/app-icon'

// Eigene, stabile Route (statt der speziellen icon.tsx-Konvention), damit
// manifest.ts eine feste URL zum Verlinken hat - für "Zum Homescreen
// hinzufügen" auf Android/Chrome.
export async function GET() {
  return new ImageResponse(<AppIconElement size={512} />, { width: 512, height: 512 })
}
