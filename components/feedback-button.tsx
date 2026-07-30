'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type FeedbackType = 'feedback' | 'problem'

export function FeedbackButton() {
  const pathname = usePathname()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('feedback')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  function close() {
    setOpen(false)
    setType('feedback')
    setMessage('')
    setSent(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    const { error } = await supabase.from('feedback').insert({ type, message: message.trim(), page_path: pathname })
    setSending(false)
    if (error) { alert('Fehler: ' + error.message); return }
    setSent(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-gray-900 text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        aria-label="Feedback geben oder Problem melden"
      >
        <MessageCircle size={16} />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" onClick={close}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">Feedback & Problem melden</p>
              <button type="button" onClick={close} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Schließen">
                <X size={18} />
              </button>
            </div>

            {sent ? (
              <div className="px-4 py-8 flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="text-green-600" size={32} />
                <p className="text-sm text-gray-700">Danke! Ist angekommen.</p>
                <button type="button" onClick={close} className="mt-2 text-sm text-blue-600 hover:underline">Schließen</button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="p-4 space-y-3">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setType('feedback')}
                    className={`flex-1 py-2 transition-colors ${type === 'feedback' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    Feedback / Idee
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('problem')}
                    className={`flex-1 py-2 border-l border-gray-200 transition-colors ${type === 'problem' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    Problem melden
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={type === 'problem' ? 'Was ist schiefgelaufen?' : 'Was fehlt dir, oder was sollten wir besser machen?'}
                  rows={5}
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
                <button type="submit" disabled={sending}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {sending ? 'Wird gesendet...' : 'Senden'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
