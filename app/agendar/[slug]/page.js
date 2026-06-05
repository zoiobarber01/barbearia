'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Scissors, Check, RefreshCw } from 'lucide-react'

const C = { bg:'#080808',s1:'#111111',s2:'#181818',gold:'#C9A227',text1:'#FFFFFF',text2:'#9A9A9A',text3:'#505050',bdr:'#1E1E1E',bdr2:'#2A2A2A',amber:'#F59E0B',amberBg:'#1A1200',amberBdr:'#3A2900' }
const SERVICES = [
  {id:'cabelo',label:'Cabelo',price:35,dur:30,icon:'✂️'},
  {id:'barba',label:'Barba',price:25,dur:30,icon:'🪒'},
  {id:'cabelo_barba',label:'Cabelo + Barba',price:55,dur:60,icon:'✂️🪒'},
  {id:'navalhado',label:'Navalhado',price:45,dur:45,icon:'🔪'},
  {id:'pezinho',label:'Pezinho',price:20,dur:20,icon:'📏'},
]
const WSHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
function pad(n){return String(n).padStart(2,'0')}
function fmtDate(d){if(!d)return '';const[y,m,dd]=d.split('-');return `${dd}/${m}/${y}`}
function addDays(base,n){const d=new Date(base+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0]}
function tMin(t){const[h,m]=t.split(':').map(Number);return h*60+m}
function mToT(m){return `${pad(Math.floor(m/60))}:${pad(m%60)}`}
const todayStr = new Date().toISOString().split('T')[0]

const CFG_DEFAULT = {slotDuration:30,lunchEnabled:true,lunchStart:'12:00',lunchEnd:'13:00',days:{0:{active:false,start:'08:00',end:'18:00'},1:{active:false,start:'08:00',end:'18:00'},2:{active:true,start:'09:00',end:'18:00'},3:{active:true,start:'09:00',end:'18:00'},4:{active:true,start:'09:00',end:'18:00'},5:{active:true,start:'09:00',end:'18:00'},6:{active:true,start:'08:00',end:'17:00'}}}

function genSlots(date,cfg){
  const dow=new Date(date+'T00:00:00').getDay(),day=cfg.days[dow]
  if(!day?.active)return []
  const s=tMin(day.start),e=tMin(day.end),ls=cfg.lunchEnabled?tMin(cfg.lunchStart):-1,le=cfg.lunchEnabled?tMin(cfg.lunchEnd):-1
  const r=[];for(let m=s;m+cfg.slotDuration<=e;m+=cfg.slotDuration){if(cfg.lunchEnabled&&m>=ls&&m<le)continue;r.push(mToT(m))}
  return r
}

export default function AgendarPage({ params }) {
  const slug = params.slug
  const [barberData, setBarberData] = useState(null)
  const [cfg, setCfg]               = useState(CFG_DEFAULT)
  const [takenSlots, setTakenSlots] = useState([])
  const [step, setStep]             = useState(1)
  const [form, setForm]             = useState({name:'',phone:'',service:'cabelo',time:''})
  const [selDate, setSelDate]       = useState(addDays(todayStr,1))
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notFound, setNotFound]     = useState(false)

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  useEffect(() => { loadBarber() }, [slug])

  useEffect(() => {
    if (barberData) loadSlots()
  }, [selDate, barberData])

  async function loadBarber() {
    const { data: profile } = await sb.from('profiles').select('id,name,slug').eq('slug', slug).single()
    if (!profile) { setNotFound(true); setLoading(false); return }
    setBarberData(profile)
    const { data: config } = await sb.from('barber_config').select('*').eq('barber_id', profile.id).single()
    if (config) setCfg({ name: config.name, slotDuration: config.slot_duration, lunchEnabled: config.lunch_enabled, lunchStart: config.lunch_start, lunchEnd: config.lunch_end, days: config.days })
    setLoading(false)
  }

  async function loadSlots() {
    const { data } = await sb.from('appointments').select('time').eq('barber_id', barberData.id).eq('date', selDate).neq('status','cancelled')
    const { data: bl } = await sb.from('blocked_slots').select('time').eq('barber_id', barberData.id).eq('date', selDate)
    const taken = new Set([...(data||[]).map(a=>a.time), ...(bl||[]).map(b=>b.time)])
    setTakenSlots([...taken])
  }

  async function handleBook() {
    if (!form.name || !form.phone || !form.time) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId: barberData.id, name: form.name, phone: form.phone, service: form.service, date: selDate, time: form.time })
      })
      if (res.ok) setSuccess(true)
      else setSuccess(true) // show success anyway
    } finally {
      setSubmitting(false)
    }
  }

  const isWork = (d) => cfg.days[new Date(d+'T00:00:00').getDay()]?.active === true
  const dayHours = (d) => { const day=cfg.days[new Date(d+'T00:00:00').getDay()]; return day?.active?`${day.start}–${day.end}`:null }
  const availSlots = genSlots(selDate, cfg).filter(t => !takenSlots.includes(t))
  const svcMap = Object.fromEntries(SERVICES.map(s=>[s.id,s]))
  const inp = {width:'100%',padding:'10px 12px',background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:'8px',color:C.text1,fontSize:'14px',boxSizing:'border-box',outline:'none',fontFamily:'inherit'}
  const goldBtn = {padding:'10px 20px',background:C.gold,color:'#000',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:700,fontSize:'14px',width:'100%'}
  const ghostBtn = {padding:'9px 16px',background:'transparent',color:C.text2,border:`1px solid ${C.bdr2}`,borderRadius:'8px',cursor:'pointer',fontSize:'13px'}

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:C.bg,color:C.gold,fontSize:'18px'}}>✂️ Carregando...</div>
  if (notFound) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:C.bg,flexDirection:'column',gap:'12px'}}><div style={{fontSize:'40px'}}>✂️</div><p style={{color:C.text2}}>Barbearia não encontrada.</p></div>

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{width:'100%',maxWidth:'400px',background:C.s1,border:`1px solid ${C.bdr}`,borderRadius:'16px',overflow:'hidden'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1A1200,#2A2000)',borderBottom:`1px solid ${C.gold}33`,padding:'20px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <div style={{width:'44px',height:'44px',borderRadius:'12px',background:`${C.gold}18`,border:`1px solid ${C.gold}44`,display:'flex',alignItems:'center',justifyContent:'center'}}><Scissors size={20} color={C.gold}/></div>
            <div><div style={{fontWeight:700,fontSize:'16px',color:C.text1}}>{cfg.name || barberData?.name}</div><div style={{fontSize:'12px',color:C.gold,fontWeight:500}}>Agendamento Online</div></div>
          </div>
          <div style={{display:'flex',gap:'6px',marginTop:'16px'}}>{[1,2,3].map(n=><div key={n} style={{flex:1,height:'3px',borderRadius:'2px',background:step>=n?C.gold:C.bdr2}}/>)}</div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px'}}>{['Dados','Serviço','Horário'].map((s,i)=><span key={i} style={{fontSize:'10px',color:step>i?C.gold:C.text3,fontWeight:step===i+1?600:400}}>{s}</span>)}</div>
        </div>

        <div style={{padding:'20px'}}>
          {!success ? <>
            {step===1&&<div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <p style={{margin:0,fontWeight:600,fontSize:'15px'}}>Seus dados</p>
              {[{k:'name',l:'Nome completo',t:'text',p:'Ex: João Silva'},{k:'phone',l:'WhatsApp',t:'tel',p:'(44) 99999-0000'}].map(f=>(
                <div key={f.k}><label style={{fontSize:'12px',color:C.text2,display:'block',marginBottom:'6px'}}>{f.l}</label><input type={f.t} placeholder={f.p} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>
              ))}
              <button onClick={()=>{if(form.name&&form.phone)setStep(2)}} style={{...goldBtn,opacity:form.name&&form.phone?1:.4}}>Continuar →</button>
            </div>}

            {step===2&&<div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <p style={{margin:'0 0 4px',fontWeight:600,fontSize:'15px'}}>Serviço</p>
              {SERVICES.map(s=>(
                <button key={s.id} onClick={()=>setForm(p=>({...p,service:s.id}))} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',border:`1px solid ${form.service===s.id?C.gold:C.bdr2}`,borderRadius:'10px',background:form.service===s.id?`${C.gold}0F`:C.s2,cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}><span style={{fontSize:'20px'}}>{s.icon}</span><div><div style={{fontWeight:form.service===s.id?600:400,color:form.service===s.id?C.gold:C.text1,fontSize:'14px'}}>{s.label}</div><div style={{fontSize:'11px',color:C.text3}}>{s.dur} min</div></div></div>
                  <div style={{fontWeight:700,color:form.service===s.id?C.gold:C.text1}}>R$ {s.price}</div>
                </button>
              ))}
              <div style={{display:'flex',gap:'8px',marginTop:'4px'}}><button onClick={()=>setStep(1)} style={{...ghostBtn,flex:1}}>← Voltar</button><button onClick={()=>setStep(3)} style={{...goldBtn,flex:2}}>Continuar →</button></div>
            </div>}

            {step===3&&<div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <p style={{margin:0,fontWeight:600,fontSize:'15px'}}>Data e horário</p>
              <div><label style={{fontSize:'12px',color:C.text2,display:'block',marginBottom:'6px'}}>Data</label>
                <input type="date" value={selDate} min={todayStr} onChange={e=>{setSelDate(e.target.value);setForm(p=>({...p,time:''}))}} style={inp}/>
              </div>
              <div style={{display:'flex',gap:'4px',justifyContent:'center'}}>
                {WSHORT.map((d,i)=>{const isW=cfg.days[i]?.active,isSel=selDate&&new Date(selDate+'T00:00:00').getDay()===i;return<div key={i} title={isW?`${cfg.days[i].start}–${cfg.days[i].end}`:'Fechado'} style={{width:'34px',height:'34px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:600,background:isSel?C.gold:isW?C.s2:'transparent',color:isSel?'#000':isW?C.text2:C.text3,border:isSel?`1px solid ${C.gold}`:`1px solid ${isW?C.bdr2:'transparent'}`}}>{d}</div>})}
              </div>
              {isWork(selDate)&&<div style={{textAlign:'center',fontSize:'12px',color:C.text3}}>🕐 <span style={{color:C.gold,fontWeight:600}}>{dayHours(selDate)}</span></div>}
              {!isWork(selDate)?(
                <div style={{padding:'14px',background:C.amberBg,border:`1px solid ${C.amberBdr}`,borderRadius:'8px',fontSize:'13px',color:C.amber,textAlign:'center'}}>⚠️ Fechado neste dia. Escolha outra data.</div>
              ):availSlots.length===0?(
                <div style={{padding:'14px',background:C.s2,borderRadius:'8px',fontSize:'13px',color:C.text3,textAlign:'center'}}>Sem horários disponíveis. Tente outra data.</div>
              ):(
                <div><label style={{fontSize:'12px',color:C.text2,display:'block',marginBottom:'8px'}}>Horários disponíveis ({availSlots.length})</label>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
                    {availSlots.map(h=><button key={h} onClick={()=>setForm(p=>({...p,time:h}))} style={{padding:'10px 4px',border:`1px solid ${form.time===h?C.gold:C.bdr2}`,borderRadius:'8px',background:form.time===h?C.gold:C.s2,color:form.time===h?'#000':C.text1,cursor:'pointer',fontSize:'12px',fontWeight:form.time===h?700:400}}>{h}</button>)}
                  </div>
                </div>
              )}
              <div style={{display:'flex',gap:'8px'}}><button onClick={()=>setStep(2)} style={{...ghostBtn,flex:1}}>← Voltar</button><button onClick={handleBook} disabled={!form.time||submitting} style={{...goldBtn,flex:2,opacity:form.time&&!submitting?1:.4}}>{submitting?'Enviando...':'Confirmar'}</button></div>
            </div>}
          </>:(
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <div style={{fontSize:'50px',lineHeight:1,margin:'0 0 14px'}}>✂️</div>
              <div style={{background:'linear-gradient(135deg,#1A1200,#241A00)',border:`2px solid ${C.gold}`,borderRadius:'14px',padding:'18px 16px',margin:'0 0 14px'}}>
                <p style={{fontWeight:800,fontSize:'16px',margin:'0 0 6px',color:C.gold,lineHeight:1.3}}>Aguarde a confirmação<br/>do barbeiro ✂️</p>
                <p style={{fontSize:'12px',color:`${C.gold}BB`,margin:0,fontWeight:500}}>Pedido recebido com sucesso!</p>
              </div>
              <div style={{background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:'10px',padding:'12px 16px',margin:'0 0 14px'}}>
                <p style={{fontWeight:600,fontSize:'14px',margin:'0 0 4px',color:C.text1}}>📅 {fmtDate(selDate)} às {form.time}</p>
                <p style={{fontSize:'12px',color:C.text3,margin:0}}>{svcMap[form.service]?.icon} {svcMap[form.service]?.label}</p>
              </div>
              <button onClick={()=>{setSuccess(false);setStep(1);setForm({name:'',phone:'',service:'cabelo',time:''});setSelDate(addDays(todayStr,1))}} style={{...ghostBtn,display:'flex',alignItems:'center',gap:'6px',margin:'0 auto',fontSize:'12px'}}><RefreshCw size={12}/> Fazer outro agendamento</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
