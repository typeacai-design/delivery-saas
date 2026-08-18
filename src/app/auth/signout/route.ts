import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function signout(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url))
}



export async function POST(request: Request) { return signout(request) }
export async function GET(request: Request) { return signout(request) }

