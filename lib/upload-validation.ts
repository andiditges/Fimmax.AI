// Kein SVG: SVGs können Skripte enthalten und wären beim direkten Öffnen
// (statt als <img> eingebettet) ein Stored-XSS-Risiko. Beschränkt Uploads
// auf gängige, ungefährliche Formate statt des generischen "image/*".
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf']
