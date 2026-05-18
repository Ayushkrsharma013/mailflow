import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/LandingPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <LandingPage user={user} />
}
