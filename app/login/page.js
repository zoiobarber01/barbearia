'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Scissors } from 'lucide-react'

const C = { bg:'#080808',s1:'#111111',s2:'#181818',gold:'#C9A227',text1:'#FFFFFF',text2:'#9A9A9A',bdr2:'#2A2A2A',red:'#EF4444',redBg:'#1A0505' }

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou senha incorretos. Tente novamente.')
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  const inp = { width:'100%',padding:'12px 14px',background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:'8px',color:C.text1,fontSize:'14px',boxSizing:'border-box',outline:'none',fontFamily:'inherit' }

  return (
    <div style={{ minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ width:'100%',maxWidth:'380px' }}>
        {/* Logo */}
        <div style={{ textAlign:'center',marginBottom:'32px' }}>
          <div style={{ width:'56px',height:'56px',borderRadius:'14px',background:C.gold,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',boxShadow:`0 0 30px ${C.gold}44` }}>
            <Scissors size={28} color="#000"/>
          </div>
          <h1 style={{ fontSize:'24px',fontWeight:700,margin:'0 0 6px' }}>BarberPro</h1>
          <p style={{ color:C.text2,fontSize:'14px',margin:0 }}>Entre na sua conta</p>
        </div>

        {/* Card */}
        <div style={{ background:C.s1,border:`1px solid #1E1E1E`,borderRadius:'16px',padding:'28px' }}>
          {error && (
            <div style={{ padding:'12px 14px',background:C.redBg,border:`1px solid ${C.red}44`,borderRadius:'8px',marginBottom:'16px',fontSize:'13px',color:C.red }}>{error}</div>
          )}

          <form onSubmit={handleLogin} style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
            <div>
              <label style={{ fontSize:'12px',color:C.text2,display:'block',marginBottom:'6px' }}>Email</label>
              <input type="email" required placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:'12px',color:C.text2,display:'block',marginBottom:'6px' }}>Senha</label>
              <input type="password" required placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} style={inp}/>
            </div>
            <button type="submit" disabled={loading}
              style={{ padding:'12px',background:C.gold,color:'#000',border:'none',borderRadius:'8px',cursor:loading?'wait':'pointer',fontWeight:700,fontSize:'15px',marginTop:'4px',opacity:loading?.7:1 }}>
              {loading ? '⏳ Entrando...' : '✂️ Entrar'}
            </button>
          </form>

          <div style={{ textAlign:'center',marginTop:'20px',paddingTop:'20px',borderTop:`1px solid #1E1E1E` }}>
            <p style={{ color:C.text2,fontSize:'13px',margin:0 }}>
              Não tem conta?{' '}
              <a href="/signup" style={{ color:C.gold,textDecoration:'none',fontWeight:500 }}>Criar conta grátis →</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
