import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/get-user'
import { UserSettingsForm } from '@/components/settings/user-settings-form'
import { DeleteAccountSection } from '@/components/settings/delete-account-section'
import { UserSettings } from '@/lib/types'

export default async function EinstellungenPage() {
  await requireUser()
  const supabase = await createClient()
  const { data: settings } = await supabase.from('user_settings').select('*').maybeSingle()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Einstellungen</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Deine Vermieter-Stammdaten – werden als Absender für generierte Schreiben verwendet (z.B. die Nebenkostenabrechnung im Nebenkostenassistenten).
        </p>
      </div>
      <UserSettingsForm settings={settings as UserSettings | null} />
      <DeleteAccountSection />
    </div>
  )
}
