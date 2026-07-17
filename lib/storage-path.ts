export function buildStoragePath(userId: string, propertyId: string, category: string, year: number, filename: string) {
  return `${userId}/${propertyId}/${category}/${year}/${Date.now()}-${filename}`
}
