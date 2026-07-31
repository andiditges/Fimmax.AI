import { NextResponse } from 'next/server'
import { getLandlordNews } from '@/lib/news'

export async function GET() {
  const news = await getLandlordNews()
  return NextResponse.json(news)
}
