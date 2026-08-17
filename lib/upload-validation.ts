// Kein SVG: SVGs können Skripte enthalten und wären beim direkten Öffnen
// (statt als <img> eingebettet) ein Stored-XSS-Risiko. Beschränkt Uploads
// auf gängige, ungefährliche Formate statt des generischen "image/*".
// HEIC/HEIF ergänzt, weil iPhones Fotos standardmäßig in diesem Format
// aufnehmen und manche Browser/Einstellungen sie unkonvertiert hochladen -
// die KI-Analyse kann das Format (noch) nicht lesen, siehe analyze-receipt
// route, aber der Beleg soll trotzdem gespeichert werden können.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf']
