'use client'

import { useState, useMemo, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'
import {
  Calendar, Users, LayoutDashboard, Scissors, Bell,
  ChevronLeft, ChevronRight, Plus, Check, X, Clock,
  Phone, Cake, DollarSign, Package, Link, RefreshCw,
  Star, Settings, Lock, Unlock, Coffee, Search, LogOut
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

/* ─── TEMA ─────────────────────────────────────── */
const C = {
  bg:"#080808",s1:"#111111",s2:"#181818",s3:"#222222",
  gold:"#C9A227",text1:"#FFFFFF",text2:"#9A9A9A",text3:"#505050",
  bdr:"#1E1E1E",bdr2:"#2A2A2A",
  green:"#22C55E",greenBg:"#071A0E",greenBdr:"#0F3A1E",
  amber:"#F59E0B",amberBg:"#1A1200",amberBdr:"#3A2900",
  red:"#EF4444",redBg:"#1A0505",
  blue:"#60A5FA",blueBg:"#070D1A",
}

/* ─── HELPERS ──────────────────────────────────── */
function pad(n) { return String(n).padStart(2,"0") }
function fmtDate(d) { if(!d)return ""; const[y,m,dd]=d.split("-"); return `${dd}/${m}/${y}` }
function addDays(base,n) { const d=new Date(base+"T00:00:00"); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0] }
function getWeekDays(anchor) {
  const d=new Date(anchor+"T00:00:00"),dow=d.getDay()
  const mon=new Date(d); mon.setDate(d.getDate()-dow+(dow===0?-6:1))
  return Array.from({length:7},(_,i)=>{const dd=new Date(mon);dd.setDate(mon.getDate()+i);return dd.toISOString().split("T")[0]})
}
function tMin(t){const[h,m]=t.split(":").map(Number);return h*60+m}
function mToT(m){return `${pad(Math.floor(m/60))}:${pad(m%60)}`}
function relDate(d){
  if(!d)return ""
  const diff=Math.round((new Date(todayStr+"T00:00:00")-new Date(d+"T00:00:00"))/86400000)
  if(diff===0)return "Hoje"; if(diff===1)return "Ontem"; if(diff>0)return `${diff} dias atrás`; return fmtDate(d)
}

/* ─── CONSTANTES ───────────────────────────────── */
const SERVICES = [
  {id:"cabelo",       label:"Cabelo",         price:35,icon:"✂️"},
  {id:"barba",        label:"Barba",           price:25,icon:"🪒"},
  {id:"cabelo_barba", label:"Cabelo + Barba",  price:55,icon:"✂️🪒"},
  {id:"navalhado",    label:"Navalhado",       price:45,icon:"🔪"},
  {id:"pezinho",      label:"Pezinho",         price:20,icon:"📏"},
]
const WSHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
const WFULL  = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
const SLOTS  = [15,20,30,45,60]

const CFG_DEFAULT = {
  name:"Minha Barbearia", slotDuration:30, lunchEnabled:true, lunchStart:"12:00", lunchEnd:"13:00",
  days:{
    0:{active:false,start:"08:00",end:"18:00"},1:{active:false,start:"08:00",end:"18:00"},
    2:{active:true, start:"09:00",end:"19:00"},3:{active:true, start:"09:00",end:"19:00"},
    4:{active:true, start:"09:00",end:"19:00"},5:{active:true, start:"09:00",end:"19:00"},
    6:{active:true, start:"08:00",end:"17:00"},
  }
}

const NOTIF_DATA = [
  {id:"confirmacao",icon:"✅",label:"Confirmação",       desc:"Ao confirmar pedido",     trigger:"Na confirmação",  color:"#22C55E",enabled:true, tmpl:"Olá {nome}! ✂️ Seu agendamento na *{barbearia}* foi *confirmado*.\n\n📅 *{data}* às *{horario}*\n✂️ {servico}\n\nTe esperamos! 🔥"},
  {id:"lembrete",  icon:"⏰",label:"Lembrete",           desc:"1 dia antes",             trigger:"1 dia antes",     color:"#60A5FA",enabled:true, tmpl:"Oi {nome}! 👋 Lembrete: seu horário na *{barbearia}* é *amanhã às {horario}*.\n✂️ {servico}\n\nFaltas? Avise! 🙏"},
  {id:"aniversario",icon:"🎂",label:"Aniversário",       desc:"No dia do aniversário",   trigger:"No dia",          color:"#F59E0B",enabled:true, tmpl:"🎉 Feliz aniversário, *{nome}*!\n\n{barbearia} te deseja um dia incrível! 🎂\n\nAgende: {link}"},
  {id:"retorno",   icon:"🔄",label:"Retorno",            desc:"25+ dias sem visita",     trigger:"Após 30 dias",    color:"#C9A227",enabled:false,tmpl:"Oi {nome}! 😢 Sentimos sua falta na *{barbearia}*.\n\nBora agendar? 👉 {link}"},
]
const SAMPLE = {nome:"Carlos Silva",barbearia:"Minha Barbearia",data:"05/06/2026",horario:"10:00",servico:"Cabelo",link:"barbearia.app"}
function fillTmpl(t,s){return Object.entries(s).reduce((r,[k,v])=>r.replaceAll(`{${k}}`,v),t)}

const today    = new Date()
const todayStr = today.toISOString().split("T")[0]
const mStr     = todayStr.slice(0,7)

/* ─── MAPEAMENTO DB → COMPONENTE ──────────────── */
function mapClient(c) {
  return { id:c.id, name:c.name, phone:c.phone||"", email:c.email||"", birthday:c.birthday||"", notes:c.notes||"", hasPlan:c.has_plan||false, planCuts:c.plan_cuts||[false,false,false,false], planMonth:c.plan_month||mStr }
}
function mapAppt(a) {
  return { id:a.id, clientId:a.client_id, clientName:a.client_name||"", date:a.date, time:a.time, service:a.service, status:a.status }
}
function mapCfg(c) {
  return { name:c.name||"Minha Barbearia", slotDuration:c.slot_duration||30, lunchEnabled:c.lunch_enabled!==false, lunchStart:c.lunch_start||"12:00", lunchEnd:c.lunch_end||"13:00", days:c.days||CFG_DEFAULT.days }
}

/* ─── COMPONENTE ───────────────────────────────── */
export default function Dashboard() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const [user,setUser]                     = useState(null)
  const [barberSlug,setBarberSlug]         = useState("")
  const [appLoading,setAppLoading]         = useState(true)
  const [cfg,setCfg]                       = useState(CFG_DEFAULT)
  const [cfgEdit,setCfgEdit]               = useState(CFG_DEFAULT)
  const [clients,setClients]               = useState([])
  const [appts,setAppts]                   = useState([])
  const [blocked,setBlocked]               = useState([])
  const [page,setPage]                     = useState("dashboard")
  const [selDate,setSelDate]               = useState(todayStr)
  const [dashView,setDashView]             = useState("hoje")
  const [showAddAppt,setShowAddAppt]       = useState(false)
  const [showAddCli,setShowAddCli]         = useState(false)
  const [apptF,setApptF]                   = useState({clientId:"",time:"",service:"cabelo"})
  const [cliF,setCliF]                     = useState({name:"",phone:"",email:"",birthday:"",hasPlan:false,notes:""})
  const [err,setErr]                       = useState("")
  const [search,setSearch]                 = useState("")
  const [selfStep,setSelfStep]             = useState(1)
  const [selfDate,setSelfDate]             = useState(addDays(todayStr,1))
  const [selfF,setSelfF]                   = useState({name:"",phone:"",service:"cabelo",time:""})
  const [selfOk,setSelfOk]                 = useState(false)
  const [cfgSaved,setCfgSaved]             = useState(false)
  const [collapsed,setCollapsed]           = useState(false)
  const [notifs,setNotifs]                 = useState(NOTIF_DATA)
  const [editId,setEditId]                 = useState(null)
  const [notifSaved,setNotifSaved]         = useState(false)
  const [qAppt,setQAppt]                   = useState({time:null,mode:"cadastrado",clientId:"",name:"",service:"cabelo"})

  /* ── INIT ── */
  useEffect(()=>{ init() },[])

  async function init() {
    const { data:{ session } } = await sb.auth.getSession()
    if (!session) { window.location.href="/login"; return }
    setUser(session.user)
    await loadData(session.user.id)
  }

  async function loadData(uid) {
    setAppLoading(true)
    try {
      const [cfgRes,cliRes,apptRes,blkRes,profRes] = await Promise.all([
        sb.from("barber_config").select("*").eq("barber_id",uid).maybeSingle(),
        sb.from("clients").select("*").eq("barber_id",uid).order("name"),
        sb.from("appointments").select("*").eq("barber_id",uid).gte("date",addDays(todayStr,-90)).order("date").order("time"),
        sb.from("blocked_slots").select("*").eq("barber_id",uid),
        sb.from("profiles").select("slug,name").eq("id",uid).maybeSingle(),
      ])
      if (cfgRes.data) { const c=mapCfg(cfgRes.data); setCfg(c); setCfgEdit(c) }
      if (cliRes.data)  setClients(cliRes.data.map(mapClient))
      if (apptRes.data) setAppts(apptRes.data.map(mapAppt))
      if (blkRes.data)  setBlocked(blkRes.data.map(b=>({id:b.id,date:b.date,time:b.time})))
      if (profRes.data) setBarberSlug(profRes.data.slug||"")
    } finally {
      setAppLoading(false)
    }
  }

  /* ── SLOTS ── */
  function bookable(date,c){
    const dow=new Date(date+"T00:00:00").getDay(),day=c.days[dow]
    if(!day?.active)return []
    const s=tMin(day.start),e=tMin(day.end),ls=c.lunchEnabled?tMin(c.lunchStart):-1,le=c.lunchEnabled?tMin(c.lunchEnd):-1
    const r=[];for(let m=s;m+c.slotDuration<=e;m+=c.slotDuration){if(c.lunchEnabled&&m>=ls&&m<le)continue;r.push(mToT(m))}
    return r
  }
  function buildGrid(date,c){
    const dow=new Date(date+"T00:00:00").getDay(),day=c.days[dow]
    if(!day?.active)return []
    const s=tMin(day.start),e=tMin(day.end),ls=c.lunchEnabled?tMin(c.lunchStart):-1,le=c.lunchEnabled?tMin(c.lunchEnd):-1
    const r=[];let lDone=false
    for(let m=s;m<e;m+=c.slotDuration){
      if(c.lunchEnabled&&m>=ls&&m<le){if(!lDone){r.push({time:mToT(m),kind:"lunch",lEnd:c.lunchEnd});lDone=true}continue}
      if(m+c.slotDuration<=e)r.push({time:mToT(m),kind:"slot"})
    }
    return r
  }
  const isTaken   =(d,t)=>appts.some(a=>a.date===d&&a.time===t&&a.status!=="cancelled")
  const isBlocked =(d,t)=>blocked.some(b=>b.date===d&&b.time===t)
  const isWork    =(d)=>cfg.days[new Date(d+"T00:00:00").getDay()]?.active===true
  const dayHours  =(d)=>{const day=cfg.days[new Date(d+"T00:00:00").getDay()];return day?.active?`${day.start}–${day.end}`:null}
  const avail     =(d)=>bookable(d,cfg).filter(t=>!isTaken(d,t)&&!isBlocked(d,t))

  /* ── MAPS ── */
  const svcMap=Object.fromEntries(SERVICES.map(s=>[s.id,s]))
  const cliMap=Object.fromEntries(clients.map(c=>[c.id,c]))
  const getCliName=(appt)=>appt.clientId&&cliMap[appt.clientId]?cliMap[appt.clientId].name:appt.clientName||"Cliente"

  /* ── ALERTAS ── */
  const bdayAlerts=useMemo(()=>{
    const now=new Date(todayStr+"T00:00:00")
    return clients.flatMap(c=>{
      if(!c.birthday)return []
      const b=new Date(c.birthday+"T00:00:00"),ty=new Date(now.getFullYear(),b.getMonth(),b.getDate())
      const diff=Math.round((ty-now)/86400000)
      if(diff<0||diff>7)return []
      return [{...c,daysUntil:diff}]
    }).sort((a,b)=>a.daysUntil-b.daysUntil)
  },[clients])

  const returnAlerts=useMemo(()=>{
    const now=new Date(todayStr+"T00:00:00")
    return clients.flatMap(c=>{
      const past=appts.filter(a=>a.clientId===c.id&&a.date<=todayStr).sort((a,b)=>b.date.localeCompare(a.date))
      if(!past.length)return []
      const diff=Math.round((now-new Date(past[0].date+"T00:00:00"))/86400000)
      if(diff<25)return []
      return [{...c,daysSince:diff}]
    }).sort((a,b)=>b.daysSince-a.daysSince)
  },[clients,appts])

  const dayAppts=useMemo(()=>appts.filter(a=>a.date===selDate).sort((a,b)=>a.time.localeCompare(b.time)),[appts,selDate])
  const pendingCount=useMemo(()=>appts.filter(a=>a.status==="pending").length,[appts])

  const clientStats=useMemo(()=>Object.fromEntries(clients.map(c=>{
    const ca=appts.filter(a=>a.clientId===c.id)
    return [c.id,{visits:ca.length,total:ca.reduce((s,a)=>s+(svcMap[a.service]?.price||0),0),lastDate:ca.sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||null}]
  })),[clients,appts])

  const stats=useMemo(()=>{
    const tA=appts.filter(a=>a.date===todayStr)
    const wA=appts.filter(a=>getWeekDays(selDate).includes(a.date))
    const mA=appts.filter(a=>a.date.startsWith(today.toISOString().slice(0,7)))
    const rev=arr=>arr.reduce((s,a)=>s+(svcMap[a.service]?.price||0),0)
    return {
      todayN:tA.length,todayR:rev(tA),weekN:wA.length,weekR:rev(wA),monthN:mA.length,monthR:rev(mA),
      plans:clients.filter(c=>c.hasPlan).length,
      weekChart:getWeekDays(selDate).map(d=>({day:new Date(d+"T00:00:00").toLocaleDateString("pt-BR",{weekday:"short"}),cortes:appts.filter(a=>a.date===d).length,receita:appts.filter(a=>a.date===d).reduce((s,a)=>s+(svcMap[a.service]?.price||0),0)})),
    }
  },[appts,clients,selDate])

  /* ── AÇÕES COM SUPABASE ── */
  const addAppt=async()=>{
    if(!apptF.clientId||!apptF.time){setErr("Preencha todos os campos.");return}
    if(isTaken(selDate,apptF.time)){setErr("⚠️ Horário já ocupado!");return}
    const{data,error}=await sb.from("appointments").insert({barber_id:user.id,client_id:apptF.clientId,date:selDate,time:apptF.time,service:apptF.service,status:"confirmed",created_via:"app"}).select().single()
    if(!error&&data){setAppts(p=>[...p,mapAppt(data)]);setApptF({clientId:"",time:"",service:"cabelo"});setErr("");setShowAddAppt(false)}
    else setErr("Erro ao salvar. Tente novamente.")
  }

  const addQuickAppt=async(time)=>{
    if(isTaken(selDate,time)||isBlocked(selDate,time))return
    let clientId=null,clientName=""
    if(qAppt.mode==="cadastrado"){
      if(!qAppt.clientId)return
      clientId=qAppt.clientId
    } else {
      if(!qAppt.name.trim())return
      clientName=qAppt.name.trim()
      const{data:nc}=await sb.from("clients").insert({barber_id:user.id,name:clientName,phone:"",notes:"(avulso)"}).select().single()
      if(nc){clientId=nc.id;setClients(p=>[...p,mapClient(nc)])}
    }
    const{data}=await sb.from("appointments").insert({barber_id:user.id,client_id:clientId,client_name:clientName,date:selDate,time,service:qAppt.service,status:"confirmed",created_via:"app"}).select().single()
    if(data)setAppts(p=>[...p,mapAppt(data)])
    setQAppt({time:null,mode:"cadastrado",clientId:"",name:"",service:"cabelo"})
  }

  const addClient=async()=>{
    if(!cliF.name||!cliF.phone){setErr("Nome e telefone obrigatórios.");return}
    const{data,error}=await sb.from("clients").insert({barber_id:user.id,name:cliF.name,phone:cliF.phone,email:cliF.email||"",birthday:cliF.birthday||null,notes:cliF.notes||"",has_plan:cliF.hasPlan,plan_cuts:[false,false,false,false],plan_month:mStr}).select().single()
    if(!error&&data){setClients(p=>[...p,mapClient(data)]);setCliF({name:"",phone:"",email:"",birthday:"",hasPlan:false,notes:""});setErr("");setShowAddCli(false)}
    else setErr("Erro ao salvar. Tente novamente.")
  }

  const removeAppt=async(id)=>{
    await sb.from("appointments").delete().eq("id",id)
    setAppts(p=>p.filter(a=>a.id!==id))
  }

  const confirmAppt=async(id)=>{
    await sb.from("appointments").update({status:"confirmed"}).eq("id",id)
    setAppts(p=>p.map(a=>a.id===id?{...a,status:"confirmed"}:a))
  }

  const toggleCut=async(cId,i)=>{
    const cli=clients.find(c=>c.id===cId); if(!cli)return
    const newCuts=cli.planCuts.map((v,j)=>j===i?!v:v)
    await sb.from("clients").update({plan_cuts:newCuts}).eq("id",cId)
    setClients(p=>p.map(c=>c.id!==cId?c:{...c,planCuts:newCuts}))
  }

  const togglePlan=async(cId)=>{
    const cli=clients.find(c=>c.id===cId); if(!cli)return
    await sb.from("clients").update({has_plan:!cli.hasPlan}).eq("id",cId)
    setClients(p=>p.map(c=>c.id!==cId?c:{...c,hasPlan:!c.hasPlan}))
  }

  const blockSlot=async(d,t)=>{
    const{data}=await sb.from("blocked_slots").insert({barber_id:user.id,date:d,time:t}).select().single()
    if(data)setBlocked(p=>[...p,{id:data.id,date:d,time:t}])
  }

  const unblockSlot=async(d,t)=>{
    const blk=blocked.find(b=>b.date===d&&b.time===t)
    if(blk){await sb.from("blocked_slots").delete().eq("id",blk.id);setBlocked(p=>p.filter(b=>!(b.date===d&&b.time===t)))}
  }

  const saveCfg=async()=>{
    await sb.from("barber_config").upsert({barber_id:user.id,name:cfgEdit.name,slot_duration:cfgEdit.slotDuration,lunch_enabled:cfgEdit.lunchEnabled,lunch_start:cfgEdit.lunchStart,lunch_end:cfgEdit.lunchEnd,days:cfgEdit.days,updated_at:new Date().toISOString()})
    await sb.from("profiles").update({name:cfgEdit.name}).eq("id",user.id)
    setCfg({...cfgEdit}); setCfgSaved(true); setTimeout(()=>setCfgSaved(false),2500)
  }

  const selfBook=async()=>{
    if(!selfF.name||!selfF.phone||!selfF.time)return
    const res=await fetch("/api/appointments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({barberId:user.id,name:selfF.name,phone:selfF.phone,service:selfF.service,date:selfDate,time:selfF.time})})
    if(res.ok){const d=await res.json();if(d.appointment){setAppts(p=>[...p,mapAppt(d.appointment)])}}
    setSelfOk(true)
  }

  const handleLogout=async()=>{
    await sb.auth.signOut()
    window.location.href="/login"
  }

  /* ── ESTILOS ── */
  const card={background:C.s1,border:`1px solid ${C.bdr}`,borderRadius:"12px"}
  const inp={width:"100%",padding:"10px 12px",background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:"8px",color:C.text1,fontSize:"14px",boxSizing:"border-box",outline:"none",fontFamily:"inherit"}
  const goldBtn={padding:"10px 20px",background:C.gold,color:"#000",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:700,fontSize:"14px"}
  const ghostBtn={padding:"9px 16px",background:"transparent",color:C.text2,border:`1px solid ${C.bdr2}`,borderRadius:"8px",cursor:"pointer",fontSize:"13px"}
  const sb2=(s)=>s==="confirmed"?{bg:C.greenBg,bdr:C.greenBdr,fg:C.green,lbl:"Confirmado"}:{bg:C.amberBg,bdr:C.amberBdr,fg:C.amber,lbl:"Pendente"}

  const navItems=[
    {id:"dashboard",    icon:LayoutDashboard,label:"Dashboard",    badge:0},
    {id:"agenda",       icon:Calendar,       label:"Agenda",       badge:pendingCount},
    {id:"clientes",     icon:Users,          label:"Clientes",     badge:returnAlerts.length},
    {id:"planos",       icon:Package,        label:"Planos",       badge:0},
    {id:"link",         icon:Link,           label:"Link cliente", badge:0},
    {id:"notificacoes", icon:Bell,           label:"Notificações", badge:0},
    {id:"configuracoes",icon:Settings,       label:"Configurações",badge:0},
  ]

  const filteredClients=useMemo(()=>search.trim()?clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone.includes(search)):clients,[clients,search])

  /* ── LOADING SCREEN ── */
  if(appLoading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,flexDirection:"column",gap:"16px"}}>
      <div style={{width:"48px",height:"48px",borderRadius:"12px",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center"}}><Scissors size={24} color="#000"/></div>
      <p style={{color:C.text2,fontSize:"14px"}}>Carregando seus dados...</p>
    </div>
  )

  /* ── RENDER ── */
  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg,color:C.text1,fontFamily:"Inter,system-ui,sans-serif",fontSize:"14px"}}>

      {/* SIDEBAR */}
      <div style={{width:collapsed?"52px":"210px",flexShrink:0,background:C.s1,borderRight:`1px solid ${C.bdr}`,display:"flex",flexDirection:"column",transition:"width .2s",overflow:"hidden"}}>
        <div style={{padding:"14px 12px",borderBottom:`1px solid ${C.bdr}`,display:"flex",alignItems:"center",gap:"10px",minHeight:"60px"}}>
          <div style={{width:"30px",height:"30px",borderRadius:"8px",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Scissors size={16} color="#000"/></div>
          {!collapsed&&<div><div style={{fontWeight:700,fontSize:"14px"}}>{cfg.name}</div><div style={{fontSize:"11px",color:C.gold}}>Pro</div></div>}
        </div>

        {bdayAlerts.length>0&&<div style={{margin:"8px",padding:"8px 10px",background:C.amberBg,border:`1px solid ${C.amberBdr}`,borderRadius:"8px",display:"flex",alignItems:"center",gap:"6px",overflow:"hidden"}}><Bell size={13} color={C.amber} style={{flexShrink:0}}/>{!collapsed&&<span style={{fontSize:"12px",color:C.amber,whiteSpace:"nowrap"}}>{bdayAlerts.length} aniversário(s)!</span>}</div>}

        <nav style={{padding:"8px",flex:1,overflowY:"auto"}}>
          {navItems.map(it=>(
            <button key={it.id} onClick={()=>{setPage(it.id);setErr("");setShowAddAppt(false);setShowAddCli(false)}}
              style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"9px 10px",borderRadius:"8px",border:"none",cursor:"pointer",marginBottom:"2px",background:page===it.id?`${C.gold}18`:"transparent",color:page===it.id?C.gold:C.text2,fontWeight:page===it.id?600:400,fontSize:"13px",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",position:"relative"}}>
              <it.icon size={16} style={{flexShrink:0}}/>
              {!collapsed&&it.label}
              {it.badge>0&&!collapsed&&<span style={{marginLeft:"auto",minWidth:"18px",height:"18px",borderRadius:"9px",background:C.amber,color:"#000",fontSize:"10px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{it.badge}</span>}
              {it.badge>0&&collapsed&&<span style={{position:"absolute",top:"6px",right:"6px",width:"8px",height:"8px",borderRadius:"50%",background:C.amber}}/>}
            </button>
          ))}
        </nav>

        {/* Link do cliente */}
        {!collapsed&&barberSlug&&<div style={{margin:"0 8px 8px",padding:"8px 10px",background:`${C.gold}0A`,border:`1px solid ${C.gold}22`,borderRadius:"8px"}}>
          <p style={{margin:"0 0 4px",fontSize:"10px",color:C.gold,fontWeight:600}}>SEU LINK</p>
          <p style={{margin:0,fontSize:"10px",color:C.text3,wordBreak:"break-all"}}>/agendar/{barberSlug}</p>
        </div>}

        <button onClick={handleLogout} style={{margin:"8px",padding:"8px",border:`1px solid ${C.bdr2}`,borderRadius:"8px",background:"transparent",cursor:"pointer",color:C.text3,display:"flex",alignItems:"center",justifyContent:collapsed?"center":"flex-start",gap:"8px",fontSize:"12px"}}>
          <LogOut size={14}/>{!collapsed&&"Sair"}
        </button>

        <button onClick={()=>setCollapsed(!collapsed)} style={{margin:"0 8px 8px",padding:"8px",border:`1px solid ${C.bdr2}`,borderRadius:"8px",background:"transparent",cursor:"pointer",color:C.text3,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {collapsed?<ChevronRight size={15}/>:<ChevronLeft size={15}/>}
        </button>
      </div>

      {/* CONTEÚDO */}
      <div style={{flex:1,overflow:"auto",padding:"20px"}}>

        {/* DASHBOARD */}
        {page==="dashboard"&&<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><h1 style={{margin:0,fontSize:"22px",fontWeight:700}}>Olá! 👋</h1><p style={{margin:"2px 0 0",color:C.text2,fontSize:"13px"}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</p></div>
            <div style={{display:"flex",gap:"4px",background:C.s2,padding:"3px",borderRadius:"10px",border:`1px solid ${C.bdr}`}}>
              {["hoje","semana","mês"].map(v=><button key={v} onClick={()=>setDashView(v)} style={{padding:"6px 14px",borderRadius:"8px",border:"none",cursor:"pointer",background:dashView===v?C.gold:"transparent",color:dashView===v?"#000":C.text2,fontSize:"12px",fontWeight:dashView===v?700:400}}>{v}</button>)}
            </div>
          </div>

          {bdayAlerts.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",background:C.amberBg,border:`1px solid ${C.amberBdr}`,borderRadius:"10px"}}><span style={{fontSize:"24px"}}>🎂</span><div><span style={{fontWeight:600,color:C.amber}}>{c.name} </span><span style={{color:C.amber,fontSize:"13px"}}>{c.daysUntil===0?"tem aniversário HOJE! 🎉":`aniversário em ${c.daysUntil} dia(s)`}</span></div></div>)}
          {returnAlerts.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",background:"#0D0A1A",border:"1px solid #4C1D95",borderRadius:"10px"}}><span style={{fontSize:"20px",flexShrink:0}}>🔄</span><div style={{flex:1}}><span style={{fontWeight:600,color:"#A78BFA"}}>{c.name} </span><span style={{color:"#A78BFA",fontSize:"13px"}}>faz {c.daysSince} dias sem corte</span></div><button onClick={()=>setPage("clientes")} style={{fontSize:"11px",background:"transparent",border:"1px solid #7C3AED44",borderRadius:"6px",cursor:"pointer",color:"#A78BFA",padding:"4px 10px"}}>Ver →</button></div>)}

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
            {[
              {label:dashView==="hoje"?"Cortes hoje":dashView==="semana"?"Cortes semana":"Cortes mês",value:dashView==="hoje"?stats.todayN:dashView==="semana"?stats.weekN:stats.monthN,sub:"agendamentos",icon:Scissors,color:C.blue},
              {label:dashView==="hoje"?"Receita hoje":dashView==="semana"?"Receita semana":"Receita mês",value:`R$ ${dashView==="hoje"?stats.todayR:dashView==="semana"?stats.weekR:stats.monthR}`,sub:"faturamento",icon:DollarSign,color:C.green},
              {label:"Clientes",value:clients.length,sub:"cadastrados",icon:Users,color:C.gold},
              {label:"Planos ativos",value:stats.plans,sub:"mensalistas",icon:Star,color:C.amber},
            ].map((s,i)=>(
              <div key={i} style={{...card,padding:"16px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:"-10px",right:"-10px",opacity:.06,transform:"scale(2.5)"}}><s.icon size={40} color={s.color}/></div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}><div style={{width:"28px",height:"28px",borderRadius:"6px",background:`${s.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><s.icon size={14} color={s.color}/></div><span style={{fontSize:"12px",color:C.text2}}>{s.label}</span></div>
                <div style={{fontSize:"26px",fontWeight:700}}>{s.value}</div>
                <div style={{fontSize:"11px",color:C.text3,marginTop:"2px"}}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{...card,padding:"20px"}}>
            <p style={{margin:"0 0 14px",fontWeight:600,fontSize:"15px"}}>Performance da semana</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.weekChart} margin={{top:0,right:0,bottom:0,left:-25}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bdr2} vertical={false}/>
                <XAxis dataKey="day" tick={{fontSize:11,fill:C.text3}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:C.text3}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={{background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:"8px",fontSize:"12px",color:C.text1}} cursor={{fill:`${C.gold}0A`}}/>
                <Bar dataKey="cortes" fill={C.blue} radius={[4,4,0,0]} name="Cortes"/>
                <Bar dataKey="receita" fill={C.gold} radius={[4,4,0,0]} name="Receita (R$)"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{...card,padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
              <p style={{margin:0,fontWeight:600,fontSize:"14px"}}>Hoje — {fmtDate(todayStr)}</p>
              <button onClick={()=>{setPage("agenda");setSelDate(todayStr)}} style={{fontSize:"12px",color:C.gold,background:"transparent",border:`1px solid ${C.gold}44`,borderRadius:"6px",cursor:"pointer",padding:"4px 12px"}}>Ver completa →</button>
            </div>
            {appts.filter(a=>a.date===todayStr).length===0&&<p style={{color:C.text3,fontSize:"13px",margin:0,textAlign:"center",padding:"16px 0"}}>Nenhum agendamento hoje</p>}
            {appts.filter(a=>a.date===todayStr).sort((a,b)=>a.time.localeCompare(b.time)).map(a=>{
              const s=sb2(a.status)
              return <div key={a.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:`1px solid ${C.bdr}`}}>
                <div style={{width:"8px",height:"8px",borderRadius:"50%",background:s.fg,flexShrink:0}}/>
                <span style={{fontWeight:600,minWidth:"46px",fontSize:"13px",color:C.gold}}>{a.time}</span>
                <div style={{flex:1}}><div style={{fontWeight:500,fontSize:"13px"}}>{getCliName(a)}</div><div style={{fontSize:"11px",color:C.text3}}>{svcMap[a.service]?.label} · R$ {svcMap[a.service]?.price}</div></div>
                <span style={{fontSize:"11px",padding:"3px 10px",borderRadius:"20px",background:s.bg,color:s.fg,border:`1px solid ${s.bdr}`,fontWeight:500}}>{s.lbl}</span>
              </div>
            })}
          </div>
        </div>}

        {/* AGENDA */}
        {page==="agenda"&&<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h1 style={{margin:0,fontSize:"20px",fontWeight:700}}>Agenda</h1>
            <button onClick={()=>{setShowAddAppt(true);setErr("");setApptF({clientId:"",time:"",service:"cabelo"})}} style={{...goldBtn,display:"flex",alignItems:"center",gap:"6px"}}><Plus size={15}/> Agendar</button>
          </div>

          <div style={{...card,padding:"12px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
              <button onClick={()=>setSelDate(d=>addDays(getWeekDays(d)[0],-1))} style={{border:"none",background:C.s3,borderRadius:"6px",cursor:"pointer",color:C.text2,width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronLeft size={16}/></button>
              <span style={{flex:1,textAlign:"center",fontWeight:600,fontSize:"13px",color:C.text2}}>{(()=>{const w=getWeekDays(selDate);return `${fmtDate(w[0])} – ${fmtDate(w[6])}`})()}</span>
              <button onClick={()=>setSelDate(d=>addDays(getWeekDays(d)[6],1))} style={{border:"none",background:C.s3,borderRadius:"6px",cursor:"pointer",color:C.text2,width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronRight size={16}/></button>
              <button onClick={()=>setSelDate(todayStr)} style={{padding:"4px 12px",border:`1px solid ${C.gold}55`,borderRadius:"6px",background:"transparent",cursor:"pointer",fontSize:"11px",color:C.gold,fontWeight:600}}>Hoje</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
              {getWeekDays(selDate).map(d=>{
                const count=appts.filter(a=>a.date===d).length,isSel=d===selDate,isT=d===todayStr
                const dow=new Date(d+"T00:00:00").getDay(),dayC=cfg.days[dow],work=dayC?.active
                return <button key={d} onClick={()=>setSelDate(d)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",borderRadius:"10px",border:`1px solid ${isSel?C.gold:C.bdr}`,background:isSel?`${C.gold}18`:isT?`${C.blue}0A`:C.s2,cursor:"pointer",opacity:work?1:.4}}>
                  <span style={{fontSize:"11px",color:isSel?C.gold:C.text3,fontWeight:600,marginBottom:"4px"}}>{WSHORT[dow]}</span>
                  <span style={{fontSize:"18px",fontWeight:700,color:isSel?C.gold:isT?C.blue:C.text1,lineHeight:1}}>{d.split("-")[2]}</span>
                  {work&&<span style={{fontSize:"9px",color:isSel?`${C.gold}CC`:C.text3,marginTop:"3px",whiteSpace:"nowrap"}}>{dayC.start}</span>}
                  <div style={{marginTop:"4px",minHeight:"14px",display:"flex",alignItems:"center"}}>{count>0&&<span style={{fontSize:"10px",background:isSel?C.gold:C.s4||C.s3,color:isSel?"#000":C.text2,borderRadius:"20px",padding:"1px 6px",fontWeight:600}}>{count}</span>}</div>
                </button>
              })}
            </div>
          </div>

          <div style={{display:"flex",gap:"10px"}}>
            <div style={{...card,padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px",flex:1}}>
              <Calendar size={16} color={C.gold}/>
              <span style={{fontWeight:600,fontSize:"14px"}}>{new Date(selDate+"T00:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</span>
              {selDate===todayStr&&<span style={{fontSize:"11px",padding:"2px 8px",background:`${C.blue}18`,color:C.blue,borderRadius:"20px",fontWeight:600}}>Hoje</span>}
              {isWork(selDate)?<span style={{fontSize:"11px",padding:"2px 8px",background:`${C.green}18`,color:C.green,borderRadius:"20px",fontWeight:600}}>🕐 {dayHours(selDate)}</span>:<span style={{fontSize:"11px",padding:"2px 8px",background:C.redBg,color:C.red,borderRadius:"20px",fontWeight:600}}>Folga</span>}
            </div>
            {[{l:"Agendados",v:dayAppts.length},{l:"Confirmados",v:dayAppts.filter(a=>a.status==="confirmed").length},{l:"Pendentes",v:dayAppts.filter(a=>a.status==="pending").length},{l:"Receita",v:`R$ ${dayAppts.reduce((s,a)=>s+(svcMap[a.service]?.price||0),0)}`}].map((s,i)=>(
              <div key={i} style={{...card,padding:"12px 14px",textAlign:"center",minWidth:"80px"}}>
                <div style={{fontSize:"11px",color:C.text3,marginBottom:"4px"}}>{s.l}</div>
                <div style={{fontWeight:700,fontSize:"16px",color:i===2&&s.v>0?C.amber:C.text1}}>{s.v}</div>
              </div>
            ))}
          </div>

          {showAddAppt&&<div style={{...card,padding:"18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}><span style={{fontWeight:600,fontSize:"15px"}}>Novo agendamento — {fmtDate(selDate)}</span><button onClick={()=>setShowAddAppt(false)} style={{border:"none",background:"transparent",cursor:"pointer",color:C.text3}}><X size={18}/></button></div>
            {err&&<div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.red}33`,borderRadius:"8px",marginBottom:"12px",fontSize:"13px",color:C.red}}>{err}</div>}
            {!isWork(selDate)&&<div style={{padding:"10px 14px",background:C.amberBg,border:`1px solid ${C.amberBdr}`,borderRadius:"8px",marginBottom:"12px",fontSize:"13px",color:C.amber}}>⚠️ Dia de folga — o agendamento será criado assim mesmo.</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px"}}>
              {[
                {label:"Cliente *",el:<select value={apptF.clientId} onChange={e=>setApptF(p=>({...p,clientId:e.target.value}))} style={inp}><option value="">Selecione...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>},
                {label:"Horário *",el:<select value={apptF.time} onChange={e=>setApptF(p=>({...p,time:e.target.value}))} style={inp}><option value="">Selecione...</option>{bookable(selDate,cfg).map(h=>{const tk=isTaken(selDate,h),bl=isBlocked(selDate,h);return <option key={h} value={h} disabled={tk||bl}>{h}{tk?" — Ocupado":bl?" — Bloqueado":""}</option>})}</select>},
                {label:"Serviço",el:<select value={apptF.service} onChange={e=>setApptF(p=>({...p,service:e.target.value}))} style={inp}>{SERVICES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label} — R$ {s.price}</option>)}</select>},
              ].map((f,i)=><div key={i}><label style={{fontSize:"12px",color:C.text2,display:"block",marginBottom:"6px"}}>{f.label}</label>{f.el}</div>)}
            </div>
            <div style={{marginTop:"14px",display:"flex",gap:"8px"}}><button onClick={addAppt} style={goldBtn}>Confirmar</button><button onClick={()=>{setShowAddAppt(false);setErr("")}} style={ghostBtn}>Cancelar</button></div>
          </div>}

          {!isWork(selDate)?(
            <div style={{...card,padding:"32px",textAlign:"center"}}><Calendar size={32} color={C.text3} style={{margin:"0 auto 12px"}}/><p style={{color:C.text2,margin:"0 0 12px"}}>Dia configurado como folga</p><button onClick={()=>setPage("configuracoes")} style={ghostBtn}>Alterar nas Configurações →</button></div>
          ):(
            <div style={{...card,overflow:"hidden"}}>
              {buildGrid(selDate,cfg).map((row,idx)=>{
                if(row.kind==="lunch")return <div key={"L"+idx} style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.bdr}`,minHeight:"38px",background:`${C.s2}88`}}><div style={{width:"64px",padding:"0 12px",fontSize:"12px",color:C.text3,flexShrink:0,borderRight:`1px solid ${C.bdr}`,display:"flex",alignItems:"center"}}>{row.time}</div><div style={{flex:1,padding:"0 14px",display:"flex",alignItems:"center",gap:"8px"}}><Coffee size={12} color={C.text3}/><span style={{fontSize:"12px",color:C.text3}}>Almoço até {row.lEnd}</span></div></div>
                const appt=dayAppts.find(a=>a.time===row.time),blk=isBlocked(selDate,row.time)
                const svc=appt?svcMap[appt.service]:null,s=appt?sb2(appt.status):null,isHr=row.time.endsWith(":00")
                return <div key={row.time} style={{display:"flex",alignItems:"stretch",borderBottom:`1px solid ${C.bdr}`,minHeight:isHr?"54px":"44px"}}>
                  <div style={{width:"64px",padding:"0 12px",fontSize:"12px",color:isHr?C.gold:C.text3,fontWeight:isHr?600:400,flexShrink:0,borderRight:`1px solid ${C.bdr}`,display:"flex",alignItems:"center"}}>{row.time}</div>
                  <div style={{flex:1,padding:"6px 12px",display:"flex",alignItems:"center"}}>
                    {appt?(
                      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",background:s.bg,borderRadius:"8px",padding:"10px 14px",border:`1px solid ${s.bdr}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                          <div style={{width:"32px",height:"32px",borderRadius:"50%",background:`${s.fg}18`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:s.fg,fontSize:"12px",flexShrink:0}}>{getCliName(appt).split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
                          <div><div style={{fontWeight:600,color:s.fg,fontSize:"13px"}}>{getCliName(appt)}</div><div style={{fontSize:"11px",color:s.fg,opacity:.7}}>{svc?.icon} {svc?.label} · R$ {svc?.price}</div></div>
                        </div>
                        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                          <span style={{fontSize:"11px",padding:"2px 8px",background:`${s.fg}18`,borderRadius:"20px",color:s.fg,fontWeight:600}}>{s.lbl}</span>
                          {appt.status==="pending"&&<button onClick={()=>confirmAppt(appt.id)} style={{padding:"5px 10px",background:C.greenBg,border:`1px solid ${C.greenBdr}`,borderRadius:"6px",cursor:"pointer",fontSize:"11px",color:C.green,fontWeight:600,display:"flex",alignItems:"center",gap:"4px"}}><Check size={11}/> Ok</button>}
                          <button onClick={()=>removeAppt(appt.id)} style={{width:"28px",height:"28px",background:"transparent",border:`1px solid ${C.bdr2}`,borderRadius:"6px",cursor:"pointer",color:C.red,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
                        </div>
                      </div>
                    ):blk?(
                      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.s2,borderRadius:"8px",padding:"8px 14px",border:`1px solid ${C.bdr2}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px"}}><Lock size={13} color={C.text3}/><span style={{fontSize:"12px",color:C.text3}}>Bloqueado</span></div>
                        <button onClick={()=>unblockSlot(selDate,row.time)} style={{...ghostBtn,display:"flex",alignItems:"center",gap:"4px",padding:"5px 10px",fontSize:"11px"}}><Unlock size={11}/> Desbloquear</button>
                      </div>
                    ):qAppt.time===row.time?(
                      <div style={{flex:1,padding:"6px 0"}}>
                        <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{display:"flex",gap:"2px",background:C.s3,padding:"2px",borderRadius:"7px",flexShrink:0}}>
                            {[{v:"cadastrado",l:"👤 Cadastrado"},{v:"rapido",l:"⚡ Rápido"}].map(m=><button key={m.v} onClick={()=>setQAppt(p=>({...p,mode:m.v,clientId:"",name:""}))} style={{padding:"5px 10px",borderRadius:"5px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:qAppt.mode===m.v?700:400,background:qAppt.mode===m.v?C.gold:"transparent",color:qAppt.mode===m.v?"#000":C.text2}}>{m.l}</button>)}
                          </div>
                          {qAppt.mode==="cadastrado"?(
                            <select value={qAppt.clientId} onChange={e=>setQAppt(p=>({...p,clientId:e.target.value}))} style={{flex:1,minWidth:"140px",padding:"7px 8px",background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:"7px",color:C.text1,fontSize:"12px",outline:"none"}}><option value="">Selecionar...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                          ):(
                            <input autoFocus type="text" value={qAppt.name} onChange={e=>setQAppt(p=>({...p,name:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")addQuickAppt(row.time)}} placeholder="Nome do cliente..." style={{flex:1,minWidth:"130px",padding:"7px 10px",background:C.s2,border:`1px solid ${C.gold}55`,borderRadius:"7px",color:C.text1,fontSize:"12px",outline:"none"}}/>
                          )}
                          <select value={qAppt.service} onChange={e=>setQAppt(p=>({...p,service:e.target.value}))} style={{padding:"7px 8px",background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:"7px",color:C.text1,fontSize:"12px",outline:"none"}}>{SERVICES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label} R${s.price}</option>)}</select>
                          <button onClick={()=>addQuickAppt(row.time)} style={{padding:"7px 14px",background:C.gold,color:"#000",border:"none",borderRadius:"7px",cursor:"pointer",fontWeight:700,fontSize:"12px",flexShrink:0}}>✓ Ok</button>
                          <button onClick={()=>setQAppt({time:null,mode:"cadastrado",clientId:"",name:"",service:"cabelo"})} style={{width:"28px",height:"28px",background:"transparent",border:`1px solid ${C.bdr2}`,borderRadius:"6px",cursor:"pointer",color:C.text3,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={13}/></button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",gap:"8px"}}>
                        <button onClick={()=>setQAppt({time:row.time,mode:"cadastrado",clientId:"",name:"",service:"cabelo"})} style={{fontSize:"12px",color:C.gold,background:`${C.gold}0A`,border:`1px solid ${C.gold}22`,cursor:"pointer",padding:"5px 12px",borderRadius:"6px",display:"flex",alignItems:"center",gap:"4px",fontWeight:500}}><Plus size={12}/> agendar</button>
                        <button onClick={()=>blockSlot(selDate,row.time)} style={{fontSize:"12px",color:C.text3,background:"transparent",border:"none",cursor:"pointer",padding:"5px 10px",borderRadius:"6px",display:"flex",alignItems:"center",gap:"4px"}}><Lock size={11}/> bloquear</button>
                      </div>
                    )}
                  </div>
                </div>
              })}
            </div>
          )}
        </div>}

        {/* CLIENTES */}
        {page==="clientes"&&<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h1 style={{margin:0,fontSize:"20px",fontWeight:700}}>Clientes <span style={{fontSize:"14px",color:C.text3,fontWeight:400}}>({clients.length})</span></h1><button onClick={()=>{setShowAddCli(true);setErr("")}} style={{...goldBtn,display:"flex",alignItems:"center",gap:"6px"}}><Plus size={15}/> Novo</button></div>
          <div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:C.text3}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." style={{...inp,paddingLeft:"36px"}}/></div>

          {returnAlerts.length>0&&!search&&<div style={{...card,padding:"14px 16px",border:"1px solid #4C1D95"}}>
            <p style={{margin:"0 0 10px",fontWeight:600,fontSize:"13px",color:"#A78BFA"}}>🔄 Para retorno ({returnAlerts.length})</p>
            {returnAlerts.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#0D0A1A",borderRadius:"8px",marginBottom:"4px"}}><div style={{display:"flex",alignItems:"center",gap:"10px"}}><div style={{width:"30px",height:"30px",borderRadius:"50%",background:"#2D1B69",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#A78BFA",fontSize:"11px",flexShrink:0}}>{c.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div><span style={{fontWeight:600,fontSize:"13px",color:"#A78BFA"}}>{c.name}</span><span style={{fontSize:"12px",color:"#7C3AED",marginLeft:"8px"}}>— {c.daysSince} dias</span></div></div><button onClick={()=>setPage("agenda")} style={{fontSize:"11px",background:"transparent",border:"1px solid #4C1D95",borderRadius:"6px",cursor:"pointer",color:"#A78BFA",padding:"4px 10px"}}>✂️ Agendar</button></div>)}
          </div>}

          {showAddCli&&<div style={{...card,padding:"18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}><span style={{fontWeight:600,fontSize:"15px"}}>Novo Cliente</span><button onClick={()=>setShowAddCli(false)} style={{border:"none",background:"transparent",cursor:"pointer",color:C.text3}}><X size={18}/></button></div>
            {err&&<div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.red}33`,borderRadius:"8px",marginBottom:"12px",fontSize:"13px",color:C.red}}>{err}</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
              {[{k:"name",l:"Nome *",t:"text"},{k:"phone",l:"Telefone *",t:"tel"},{k:"email",l:"Email",t:"email"},{k:"birthday",l:"Aniversário (opcional)",t:"date"}].map(f=><div key={f.k}><label style={{fontSize:"12px",color:C.text2,display:"block",marginBottom:"6px"}}>{f.l}</label><input type={f.t} value={cliF[f.k]} onChange={e=>setCliF(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}
              <div style={{gridColumn:"1/-1"}}><label style={{fontSize:"12px",color:C.text2,display:"block",marginBottom:"6px"}}>Observações</label><input type="text" value={cliF.notes} onChange={e=>setCliF(p=>({...p,notes:e.target.value}))} placeholder="Preferências, alergias..." style={inp}/></div>
            </div>
            <div style={{marginTop:"12px",display:"flex",alignItems:"center",gap:"8px"}}><input type="checkbox" id="hp2" checked={cliF.hasPlan} onChange={e=>setCliF(p=>({...p,hasPlan:e.target.checked}))}/><label htmlFor="hp2" style={{fontSize:"13px",color:C.text2}}>Ativar plano mensal</label></div>
            <div style={{marginTop:"14px",display:"flex",gap:"8px"}}><button onClick={addClient} style={goldBtn}>Salvar</button><button onClick={()=>setShowAddCli(false)} style={ghostBtn}>Cancelar</button></div>
          </div>}

          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {filteredClients.map(c=>{
              const st=clientStats[c.id]||{visits:0,total:0,lastDate:null}
              let bAlert=null
              if(c.birthday){const b=new Date(c.birthday+"T00:00:00"),now=new Date(todayStr+"T00:00:00"),ty=new Date(now.getFullYear(),b.getMonth(),b.getDate()),diff=Math.round((ty-now)/86400000);if(diff>=0&&diff<=7)bAlert=diff}
              return <div key={c.id} style={{...card,padding:"14px 16px",border:`1px solid ${bAlert!==null?C.amberBdr:C.bdr}`}}>
                <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                  <div style={{width:"44px",height:"44px",borderRadius:"50%",background:`${C.gold}18`,border:`1px solid ${C.gold}33`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:C.gold,fontSize:"14px",flexShrink:0}}>{c.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",marginBottom:"4px"}}>
                      <span style={{fontWeight:600}}>{c.name}</span>
                      {c.hasPlan&&<span style={{fontSize:"10px",padding:"2px 8px",background:`${C.green}18`,color:C.green,borderRadius:"20px",border:`1px solid ${C.greenBdr}`,fontWeight:600}}>PLANO ATIVO</span>}
                      {bAlert!==null&&<span style={{fontSize:"10px",padding:"2px 8px",background:C.amberBg,color:C.amber,borderRadius:"20px",border:`1px solid ${C.amberBdr}`,fontWeight:600}}><Cake size={10} style={{display:"inline",marginRight:"2px"}}/>{bAlert===0?"🎉 Hoje!":`${bAlert}d`}</span>}
                    </div>
                    <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}><span style={{fontSize:"12px",color:C.text3}}>{c.phone}</span><span style={{fontSize:"12px",color:C.text3}}>{st.visits} visitas</span><span style={{fontSize:"12px",color:C.gold}}>R$ {st.total} total</span>{st.lastDate&&<span style={{fontSize:"12px",color:C.text3}}>Último: {relDate(st.lastDate)}</span>}</div>
                    {c.notes&&c.notes!=="(via link)"&&c.notes!=="(avulso)"&&<div style={{marginTop:"4px",fontSize:"11px",color:C.text3}}>📝 {c.notes}</div>}
                  </div>
                  <button onClick={()=>{setPage("agenda");setApptF(p=>({...p,clientId:String(c.id)}));setShowAddAppt(true);setErr("")}} style={{...ghostBtn,display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap",flexShrink:0}}><Calendar size={13}/> Agendar</button>
                </div>
              </div>
            })}
            {filteredClients.length===0&&clients.length===0&&<div style={{...card,padding:"40px",textAlign:"center"}}><Users size={32} color={C.text3} style={{margin:"0 auto 12px"}}/><p style={{color:C.text2,margin:"0 0 8px",fontWeight:500}}>Nenhum cliente ainda</p><p style={{color:C.text3,fontSize:"13px",margin:0}}>Clique em "Novo" para cadastrar seu primeiro cliente</p></div>}
            {filteredClients.length===0&&clients.length>0&&<div style={{...card,padding:"32px",textAlign:"center"}}><p style={{color:C.text3,margin:0}}>Nenhum cliente encontrado</p></div>}
          </div>
        </div>}

        {/* PLANOS */}
        {page==="planos"&&<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h1 style={{margin:0,fontSize:"20px",fontWeight:700}}>Planos Mensais</h1><span style={{fontSize:"13px",color:C.text3}}>{clients.filter(c=>c.hasPlan).length} ativos</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px"}}>
            {[{l:"Planos ativos",v:clients.filter(c=>c.hasPlan).length,c:C.green},{l:"Completos",v:clients.filter(c=>c.hasPlan&&c.planCuts.every(Boolean)).length,c:C.gold},{l:"Cortes usados",v:clients.filter(c=>c.hasPlan).reduce((s,c)=>s+c.planCuts.filter(Boolean).length,0),c:C.blue}].map((s,i)=>(
              <div key={i} style={{...card,padding:"14px 16px"}}><div style={{fontSize:"11px",color:C.text3,marginBottom:"6px"}}>{s.l}</div><div style={{fontSize:"24px",fontWeight:700,color:s.c}}>{s.v}</div></div>
            ))}
          </div>
          <div style={{...card,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 52px 52px 52px 52px 80px",gap:"8px",alignItems:"center",padding:"12px 18px",borderBottom:`1px solid ${C.bdr}`,fontSize:"12px",color:C.text3,fontWeight:600}}>
              <span>Cliente</span>{["C1","C2","C3","C4"].map(c=><span key={c} style={{textAlign:"center"}}>{c}</span>)}<span style={{textAlign:"center"}}>Status</span>
            </div>
            {clients.filter(c=>c.hasPlan).map(c=>{
              const done=c.planCuts.filter(Boolean).length
              return <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 52px 52px 52px 52px 80px",gap:"8px",alignItems:"center",padding:"14px 18px",borderBottom:`1px solid ${C.bdr}`}}>
                <div><div style={{fontWeight:600,fontSize:"13px"}}>{c.name}</div><div style={{fontSize:"11px",color:C.text3,marginTop:"2px"}}>{done}/4 usados</div></div>
                {c.planCuts.map((used,idx)=><button key={idx} onClick={()=>toggleCut(c.id,idx)} style={{width:"42px",height:"36px",borderRadius:"8px",border:`1px solid ${used?C.greenBdr:C.bdr2}`,background:used?C.greenBg:C.s2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:used?C.green:C.text3,margin:"0 auto"}}>{used?<Check size={15}/>:<span style={{fontSize:"18px",lineHeight:1,color:C.bdr2}}>·</span>}</button>)}
                <div style={{textAlign:"center"}}><span style={{fontSize:"11px",padding:"3px 10px",borderRadius:"20px",fontWeight:600,whiteSpace:"nowrap",background:done===4?C.greenBg:done>=2?C.blueBg:C.amberBg,color:done===4?C.green:done>=2?C.blue:C.amber,border:`1px solid ${done===4?C.greenBdr:done>=2?`${C.blue}30`:C.amberBdr}`}}>{done===4?"✓ Completo":done>=2?"Em andamento":"Início"}</span></div>
              </div>
            })}
            {clients.filter(c=>c.hasPlan).length===0&&<div style={{padding:"32px",textAlign:"center",color:C.text3}}>Nenhum cliente com plano ativo</div>}
          </div>
          {clients.filter(c=>!c.hasPlan).length>0&&<>
            <p style={{fontWeight:600,margin:"4px 0 0",fontSize:"14px",color:C.text2}}>Sem plano</p>
            {clients.filter(c=>!c.hasPlan).map(c=><div key={c.id} style={{...card,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px"}}><span>{c.name}</span><button onClick={()=>togglePlan(c.id)} style={{...ghostBtn,display:"flex",alignItems:"center",gap:"4px",color:C.gold,borderColor:`${C.gold}44`}}><Plus size={13}/> Ativar plano</button></div>)}
          </>}
        </div>}

        {/* LINK CLIENTE */}
        {page==="link"&&<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <h1 style={{margin:0,fontSize:"20px",fontWeight:700}}>Link de agendamento</h1>
          {barberSlug&&<div style={{...card,padding:"18px",border:`1px solid ${C.gold}44`,background:`${C.gold}06`}}>
            <p style={{margin:"0 0 8px",fontWeight:600,color:C.gold,fontSize:"14px"}}>🔗 Seu link exclusivo</p>
            <p style={{margin:"0 0 12px",fontSize:"13px",color:C.text2}}>Compartilhe este link com seus clientes. Eles podem agendar sem precisar te chamar no WhatsApp:</p>
            <div style={{background:C.s2,border:`1px solid ${C.bdr2}`,borderRadius:"8px",padding:"12px 14px",fontFamily:"monospace",fontSize:"13px",color:C.gold,wordBreak:"break-all"}}>
              {process.env.NEXT_PUBLIC_APP_URL||"https://seuapp.vercel.app"}/agendar/{barberSlug}
            </div>
            <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
              <button onClick={()=>navigator.clipboard?.writeText(`${process.env.NEXT_PUBLIC_APP_URL||window.location.origin}/agendar/${barberSlug}`)} style={{...goldBtn,padding:"8px 16px",fontSize:"13px"}}>📋 Copiar link</button>
            </div>
          </div>}

          {/* Preview */}
          <div style={{...card,padding:"16px"}}>
            <p style={{margin:"0 0 12px",fontWeight:600,fontSize:"14px",color:C.text2}}>Preview — como o cliente vê</p>
            <div style={{background:C.s2,borderRadius:"10px",padding:"16px",border:`1px solid ${C.bdr2}`}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}><div style={{width:"36px",height:"36px",borderRadius:"8px",background:`${C.gold}18`,border:`1px solid ${C.gold}33`,display:"flex",alignItems:"center",justifyContent:"center"}}><Scissors size={16} color={C.gold}/></div><div><div style={{fontWeight:600,fontSize:"14px"}}>{cfg.name}</div><div style={{fontSize:"11px",color:C.gold}}>Agendamento Online</div></div></div>
              <p style={{fontSize:"12px",color:C.text3,margin:0}}>Fluxo: Nome → Serviço → Data e horário → Confirmação</p>
              <p style={{fontSize:"12px",color:C.text3,margin:"6px 0 0"}}>Apenas horários disponíveis são exibidos. Sem concorrentes, sem anúncios.</p>
            </div>
          </div>
        </div>}

        {/* NOTIFICAÇÕES */}
        {page==="notificacoes"&&<div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><h1 style={{margin:0,fontSize:"20px",fontWeight:700}}>Notificações WhatsApp</h1><p style={{margin:"4px 0 0",fontSize:"13px",color:C.text3}}>Templates de mensagens automáticas</p></div>
            {notifSaved&&<span style={{fontSize:"13px",color:C.green,display:"flex",alignItems:"center",gap:"6px",background:C.greenBg,padding:"6px 14px",borderRadius:"20px",border:`1px solid ${C.greenBdr}`}}><Check size={14}/>Salvo!</span>}
          </div>
          <div style={{...card,padding:"16px",border:`1px solid ${C.gold}44`,background:`${C.gold}06`}}>
            <p style={{margin:"0 0 6px",fontWeight:700,color:C.gold,fontSize:"14px"}}>⚡ Como ativar</p>
            <p style={{margin:0,fontSize:"13px",color:C.text2}}>Conecte <strong style={{color:C.gold}}>Z-API</strong> (z-api.io · R$89/mês) ou <strong style={{color:C.green}}>Evolution API</strong> (grátis). Configure as variáveis de ambiente e cada confirmação enviará a mensagem automaticamente.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            {notifs.map(n=>(
              <div key={n.id} style={{...card,padding:"16px",border:`1px solid ${editId===n.id?n.color+"55":C.bdr}`,opacity:n.enabled?1:.55}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                  <span style={{fontSize:"22px",flexShrink:0}}>{n.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"4px"}}>
                      <span style={{fontWeight:600,fontSize:"13px",color:n.enabled?C.text1:C.text3}}>{n.label}</span>
                      <button onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,enabled:!x.enabled}:x))} style={{width:"36px",height:"20px",borderRadius:"10px",border:"none",cursor:"pointer",background:n.enabled?n.color:C.s2,position:"relative",flexShrink:0}}>
                        <div style={{width:"14px",height:"14px",borderRadius:"50%",background:"#fff",position:"absolute",top:"3px",left:n.enabled?"19px":"3px",transition:"left .2s"}}/>
                      </button>
                    </div>
                    <p style={{margin:"0 0 8px",fontSize:"11px",color:C.text3}}>{n.desc}</p>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontSize:"11px",padding:"2px 8px",borderRadius:"4px",background:`${n.color}18`,color:n.color,fontWeight:600}}>{n.trigger}</span>
                      <button onClick={()=>setEditId(editId===n.id?null:n.id)} style={{fontSize:"11px",background:"transparent",border:`1px solid ${C.bdr2}`,borderRadius:"6px",cursor:"pointer",color:C.text2,padding:"3px 10px"}}>{editId===n.id?"Fechar":"Editar"}</button>
                    </div>
                  </div>
                </div>
                {editId===n.id&&<div style={{marginTop:"14px",paddingTop:"14px",borderTop:`1px solid ${C.bdr}`}}>
                  <textarea value={n.tmpl} rows={5} onChange={e=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,tmpl:e.target.value}:x))} style={{width:"100%",padding:"10px",background:C.bg,border:`1px solid ${C.bdr2}`,borderRadius:"8px",color:C.text1,fontSize:"12px",resize:"vertical",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box",outline:"none"}}/>
                  <div style={{display:"flex",gap:"4px",flexWrap:"wrap",margin:"8px 0"}}>
                    {["{nome}","{barbearia}","{data}","{horario}","{servico}","{link}"].map(v=><button key={v} onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,tmpl:x.tmpl+v}:x))} style={{padding:"3px 8px",background:C.s3,border:`1px solid ${C.bdr2}`,borderRadius:"4px",cursor:"pointer",fontSize:"11px",color:C.gold,fontFamily:"monospace"}}>{v}</button>)}
                  </div>
                  <div style={{background:"#0B141A",borderRadius:"10px",padding:"10px",border:`1px solid ${C.bdr}`,marginBottom:"10px"}}>
                    <div style={{background:"#005C4B",borderRadius:"8px 8px 8px 2px",padding:"8px 10px",maxWidth:"260px",marginLeft:"auto"}}><pre style={{margin:0,fontSize:"11px",color:"#E9EDF0",whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.5}}>{fillTmpl(n.tmpl,SAMPLE)}</pre></div>
                  </div>
                  <div style={{display:"flex",gap:"8px"}}><button onClick={()=>{setNotifSaved(true);setTimeout(()=>setNotifSaved(false),2000);setEditId(null)}} style={goldBtn}>Salvar</button><button onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,tmpl:NOTIF_DATA.find(d=>d.id===n.id).tmpl}:x))} style={ghostBtn}>Resetar</button></div>
                </div>}
              </div>
            ))}
          </div>
        </div>}

        {/* CONFIGURAÇÕES */}
        {page==="configuracoes"&&<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h1 style={{margin:0,fontSize:"20px",fontWeight:700}}>Configurações</h1>
            {cfgSaved&&<span style={{fontSize:"13px",color:C.green,display:"flex",alignItems:"center",gap:"6px",background:C.greenBg,padding:"6px 14px",borderRadius:"20px",border:`1px solid ${C.greenBdr}`}}><Check size={14}/> Salvo!</span>}
          </div>

          <div style={{...card,padding:"18px"}}><p style={{margin:"0 0 12px",fontWeight:600,fontSize:"14px",color:C.gold}}>Nome da barbearia</p><input value={cfgEdit.name} onChange={e=>setCfgEdit(p=>({...p,name:e.target.value}))} style={inp} placeholder="Ex: Barbearia do João"/></div>

          <div style={{...card,padding:"18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
              <p style={{margin:0,fontWeight:600,fontSize:"14px",color:C.gold}}>Horário por dia</p>
              <div><label style={{fontSize:"12px",color:C.text2,display:"block",marginBottom:"6px",textAlign:"right"}}>Duração do slot</label><select value={cfgEdit.slotDuration} onChange={e=>setCfgEdit(p=>({...p,slotDuration:+e.target.value}))} style={{...inp,width:"140px"}}>{SLOTS.map(d=><option key={d} value={d}>{d} minutos</option>)}</select></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"80px 52px 1fr 1fr 1fr",gap:"8px",alignItems:"center",marginBottom:"8px",padding:"0 4px"}}>
              {["DIA","ABERTO","ABRE","FECHA","SLOTS"].map(h=><span key={h} style={{fontSize:"11px",color:C.text3,fontWeight:600}}>{h}</span>)}
            </div>
            {[0,1,2,3,4,5,6].map(i=>{
              const day=cfgEdit.days[i],active=day.active
              const sd=(()=>{const d=new Date(todayStr+"T00:00:00"),curr=d.getDay();let diff=i-curr;if(diff<0)diff+=7;d.setDate(d.getDate()+diff);return d.toISOString().split("T")[0]})()
              const sc=active?bookable(sd,cfgEdit).length:0
              return <div key={i} style={{display:"grid",gridTemplateColumns:"80px 52px 1fr 1fr 1fr",gap:"8px",alignItems:"center",padding:"10px 4px",borderRadius:"8px",background:active?`${C.gold}06`:"transparent",borderBottom:`1px solid ${C.bdr}`,marginBottom:"2px"}}>
                <span style={{fontWeight:active?600:400,color:active?C.text1:C.text3,fontSize:"13px"}}>{WFULL[i]}</span>
                <div style={{display:"flex",justifyContent:"center"}}>
                  <button onClick={()=>setCfgEdit(p=>({...p,days:{...p.days,[i]:{...p.days[i],active:!p.days[i].active}}}))} style={{width:"40px",height:"22px",borderRadius:"11px",border:"none",cursor:"pointer",background:active?C.gold:C.s3,position:"relative"}}>
                    <div style={{width:"16px",height:"16px",borderRadius:"50%",background:"#fff",position:"absolute",top:"3px",left:active?"21px":"3px",transition:"left .2s",boxShadow:"0 1px 4px #0008"}}/>
                  </button>
                </div>
                <input type="time" value={day.start} disabled={!active} onChange={e=>setCfgEdit(p=>({...p,days:{...p.days,[i]:{...p.days[i],start:e.target.value}}}))} style={{...inp,opacity:active?1:.35,cursor:active?"text":"not-allowed",padding:"8px 10px"}}/>
                <input type="time" value={day.end} disabled={!active} onChange={e=>setCfgEdit(p=>({...p,days:{...p.days,[i]:{...p.days[i],end:e.target.value}}}))} style={{...inp,opacity:active?1:.35,cursor:active?"text":"not-allowed",padding:"8px 10px"}}/>
                <span style={{fontSize:"12px",color:active?C.gold:C.text3,fontWeight:active?600:400}}>{active?`${sc} slots`:"—"}</span>
              </div>
            })}
          </div>

          <div style={{...card,padding:"18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:cfgEdit.lunchEnabled?"14px":"0"}}>
              <p style={{margin:0,fontWeight:600,fontSize:"14px",color:C.gold}}>Intervalo de almoço</p>
              <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px",color:C.text2}}><input type="checkbox" checked={cfgEdit.lunchEnabled} onChange={e=>setCfgEdit(p=>({...p,lunchEnabled:e.target.checked}))}/>Ativar</label>
            </div>
            {cfgEdit.lunchEnabled&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
              {[{l:"Início",k:"lunchStart"},{l:"Fim",k:"lunchEnd"}].map(f=><div key={f.k}><label style={{fontSize:"12px",color:C.text2,display:"block",marginBottom:"6px"}}>{f.l}</label><input type="time" value={cfgEdit[f.k]} onChange={e=>setCfgEdit(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}
            </div>}
          </div>

          <button onClick={saveCfg} style={{...goldBtn,alignSelf:"flex-start",display:"flex",alignItems:"center",gap:"8px",padding:"12px 24px",fontSize:"15px"}}>
            <Check size={16}/> Salvar configurações
          </button>
        </div>}

      </div>
    </div>
  )
}
