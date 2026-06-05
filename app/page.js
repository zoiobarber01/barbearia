'use client'
import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export default function Home() {
  useEffect(() => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    sb.auth.getSession().then(({ data: { session } }) => {
      window.location.href = session ? '/dashboard' : '/login'
    })
  }, [])
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#080808',color:'#C9A227',fontSize:'18px'}}>✂️ Carregando...</div>
}
