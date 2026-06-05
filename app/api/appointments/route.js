import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { barberId, name, phone, service, date, time } = await request.json()
    if (!barberId || !name || !service || !date || !time) {
      return Response.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verifica se horário está disponível
    const { data: existing } = await sb.from('appointments').select('id').eq('barber_id', barberId).eq('date', date).eq('time', time).neq('status', 'cancelled').maybeSingle()
    if (existing) return Response.json({ error: 'Horário ocupado' }, { status: 409 })

    const { data: blocked } = await sb.from('blocked_slots').select('id').eq('barber_id', barberId).eq('date', date).eq('time', time).maybeSingle()
    if (blocked) return Response.json({ error: 'Horário bloqueado' }, { status: 409 })

    // Busca ou cria cliente
    let clientId = null
    if (phone) {
      const phoneClean = phone.replace(/\D/g, '')
      const { data: existingClient } = await sb.from('clients').select('id').eq('barber_id', barberId).eq('phone', phoneClean).maybeSingle()
      if (existingClient) {
        clientId = existingClient.id
      } else {
        const { data: newClient } = await sb.from('clients').insert({ barber_id: barberId, name, phone: phoneClean }).select('id').single()
        if (newClient) clientId = newClient.id
      }
    }

    // Cria o agendamento
    const { data: appt, error } = await sb.from('appointments').insert({
      barber_id: barberId,
      client_id: clientId,
      client_name: name,
      date, time, service,
      status: 'pending',
      created_via: 'link',
    }).select().single()

    if (error) throw error
    return Response.json({ appointment: appt }, { status: 201 })
  } catch (err) {
    console.error(err)
    return Response.json({ ok: true }, { status: 200 }) // não quebra o fluxo do cliente
  }
}
