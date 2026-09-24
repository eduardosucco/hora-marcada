'use client';

import {useEffect,useMemo,useState} from 'react';
import {useParams} from 'next/navigation';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  LogOut,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  clientPortalCall,
  PortalError,
  type ClientPortalDashboard,
  type ClientPortalProvider,
  type ClientPortalService,
} from '@/lib/client-portal';
import styles from './client-portal.module.css';

function money(value:number){
  return Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function dateKey(date:Date){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

function formatDate(value:string){
  return new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'short',day:'2-digit',month:'short'}).replace('.','');
}

function formatTime(value:string){
  return new Date(value).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
}

function defaultDate(){
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(now));
  if(hour >= 17) now.setDate(now.getDate()+1);
  return dateKey(now);
}

function cleanPhone(value:string){
  return value.replace(/\D/g,'').slice(0,13);
}

function displayPhone(value:string){
  const digits=value.replace(/\D/g,'').replace(/^55/,'');
  if(digits.length<=2)return digits;
  if(digits.length<=7)return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if(digits.length<=10)return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7,11)}`;
}

export default function ClientPortalPage(){
  const params=useParams<{slug:string}>();
  const slug=String(params?.slug||'');
  const storageKey=`hm-client-session:${slug}`;

  const [provider,setProvider]=useState<ClientPortalProvider|null>(null);
  const [dashboard,setDashboard]=useState<ClientPortalDashboard|null>(null);
  const [token,setToken]=useState('');
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [phone,setPhone]=useState('');
  const [pin,setPin]=useState('');
  const [name,setName]=useState('');
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [selectedService,setSelectedService]=useState('');
  const [date,setDate]=useState(defaultDate());
  const [slots,setSlots]=useState<string[]>([]);
  const [selectedSlot,setSelectedSlot]=useState('');
  const [loadingSlots,setLoadingSlots]=useState(false);
  const [bookingBusy,setBookingBusy]=useState(false);

  const brand=provider?.brand||dashboard?.provider?.brand||{};
  const brandName=brand.name||provider?.name||dashboard?.provider?.name||'Hora Marcada';
  const primary=brand.primary||'#176f56';
  const secondary=brand.secondary||'#647caa';

  useEffect(()=>{
    if(!slug)return;
    let active=true;
    (async()=>{
      setBusy(true);
      setError('');
      try{
        const pub=await clientPortalCall('public',{slug});
        if(!active)return;
        setProvider(pub.provider||null);
        const saved=localStorage.getItem(storageKey)||'';
        if(saved){
          try{
            const result=await clientPortalCall('dashboard',{},saved);
            if(!active)return;
            if(result.dashboard){
              setToken(saved);
              setDashboard(result.dashboard);
              setProvider(result.dashboard.provider);
              setSelectedService(result.dashboard.services[0]?.id||'');
            }
          }catch(e){
            if(e instanceof PortalError && e.status===401)localStorage.removeItem(storageKey);
          }
        }
      }catch(e:any){
        if(active)setError(e?.message||'Não foi possível abrir a área do cliente.');
      }finally{
        if(active)setBusy(false);
      }
    })();
    return()=>{active=false};
  },[slug,storageKey]);

  useEffect(()=>{
    if(!dashboard?.services?.length)return;
    if(!selectedService||!dashboard.services.some(s=>s.id===selectedService))setSelectedService(dashboard.services[0].id);
  },[dashboard,selectedService]);

  useEffect(()=>{
    if(!token||!selectedService||!date){setSlots([]);return;}
    let active=true;
    setLoadingSlots(true);
    setSelectedSlot('');
    clientPortalCall('availability',{service_id:selectedService,date},token)
      .then(result=>{if(active)setSlots(result.slots||[])})
      .catch((e:any)=>{if(active){setSlots([]);setError(e?.message||'Não foi possível carregar os horários.')}})
      .finally(()=>{if(active)setLoadingSlots(false)});
    return()=>{active=false};
  },[token,selectedService,date]);

  const selectedServiceData=useMemo(()=>dashboard?.services.find(s=>s.id===selectedService)||null,[dashboard,selectedService]);

  async function authenticate(event:React.FormEvent){
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try{
      const action=mode==='register'?'register':'login';
      const result=await clientPortalCall(action,{slug,phone,name,pin});
      if(!result.session?.token||!result.dashboard)throw new Error('Não foi possível iniciar sua sessão.');
      localStorage.setItem(storageKey,result.session.token);
      setToken(result.session.token);
      setDashboard(result.dashboard);
      setProvider(result.dashboard.provider);
      setSelectedService(result.dashboard.services[0]?.id||'');
      setPin('');
      setSuccess(mode==='register'?'Acesso criado. Escolha seu serviço e horário.':'Acesso confirmado.');
    }catch(e:any){
      if(e?.code==='first_access')setMode('register');
      setError(e?.message||'Não foi possível entrar.');
    }finally{setBusy(false)}
  }

  async function book(){
    if(!token||!selectedService||!selectedSlot)return;
    setBookingBusy(true);
    setError('');
    setSuccess('');
    try{
      const startsAt=new Date(`${date}T${selectedSlot}:00-03:00`).toISOString();
      const result=await clientPortalCall('book',{service_id:selectedService,starts_at:startsAt},token);
      if(result.dashboard)setDashboard(result.dashboard);
      setSuccess('Horário marcado com sucesso.');
      setSelectedSlot('');
      const refreshed=await clientPortalCall('availability',{service_id:selectedService,date},token);
      setSlots(refreshed.slots||[]);
    }catch(e:any){setError(e?.message||'Não foi possível marcar este horário.')}finally{setBookingBusy(false)}
  }

  async function cancelBooking(id:string){
    if(!token||!confirm('Cancelar este agendamento?'))return;
    setError('');
    try{
      const result=await clientPortalCall('cancel',{booking_id:id},token);
      if(result.dashboard)setDashboard(result.dashboard);
      setSuccess('Agendamento cancelado.');
      if(selectedService){
        const refreshed=await clientPortalCall('availability',{service_id:selectedService,date},token);
        setSlots(refreshed.slots||[]);
      }
    }catch(e:any){setError(e?.message||'Não foi possível cancelar.');}
  }

  async function logout(){
    try{if(token)await clientPortalCall('logout',{},token)}catch{}
    localStorage.removeItem(storageKey);
    setToken('');
    setDashboard(null);
    setSlots([]);
    setSelectedSlot('');
    setSuccess('');
    setError('');
  }

  const themeStyle={
    '--cp-primary':primary,
    '--cp-secondary':secondary,
  } as React.CSSProperties;

  if(busy&&!provider&&!dashboard){
    return <main className={styles.shell} style={themeStyle}><section className={styles.authCard}><div className={styles.loading}><RefreshCw className={styles.spin}/><strong>Preparando sua agenda...</strong></div></section></main>;
  }

  if(!dashboard){
    return <main className={styles.shell} style={themeStyle}>
      <section className={styles.authCard}>
        <div className={styles.brandHeader}>
          <span className={styles.logo}><CalendarCheck size={26}/></span>
          <div><strong>{brandName}</strong><small>Agendamento online</small></div>
        </div>
        <div className={styles.authIntro}>
          <span>ÁREA DO CLIENTE</span>
          <h1>{mode==='register'?'Crie seu acesso':'Marque seu horário'}</h1>
          <p>{mode==='register'?'Informe seu telefone e crie um PIN de 6 números. Você usará esse PIN nos próximos acessos.':'Entre com seu telefone e PIN para visualizar serviços, horários disponíveis e seus agendamentos.'}</p>
        </div>
        <form className={styles.form} onSubmit={authenticate}>
          {mode==='register'&&<label><span><UserRound size={16}/>Seu nome</span><input autoFocus required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Como podemos te chamar?"/></label>}
          <label><span><Phone size={16}/>Telefone com DDD</span><input autoFocus={mode==='login'} required inputMode="tel" autoComplete="tel" value={displayPhone(phone)} onChange={e=>setPhone(cleanPhone(e.target.value))} placeholder="(21) 99999-9999"/></label>
          <label><span><LockKeyhole size={16}/>{mode==='register'?'Crie um PIN':'Seu PIN'}</span><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6 números"/></label>
          {error&&<div className={styles.error}>{error}</div>}
          <button className={styles.primaryButton} disabled={busy||pin.length!==6}>{busy?'Aguarde...':mode==='register'?'Criar acesso e continuar':'Entrar e ver horários'}<ArrowRight size={17}/></button>
          <button type="button" className={styles.linkButton} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setPin('')}}>{mode==='login'?'Primeiro acesso? Criar meu PIN':'Já tenho PIN'}</button>
        </form>
        <div className={styles.security}><ShieldCheck size={16}/><span>Seu PIN protege o acesso aos seus agendamentos. Nenhum SMS é necessário.</span></div>
      </section>
    </main>;
  }

  return <main className={styles.appShell} style={themeStyle}>
    <header className={styles.topbar}>
      <div className={styles.brandHeaderCompact}><span className={styles.logo}><CalendarCheck size={23}/></span><div><strong>{brandName}</strong><small>Agendamento online</small></div></div>
      <button className={styles.logout} onClick={logout}><LogOut size={17}/><span>Sair</span></button>
    </header>

    <div className={styles.content}>
      <section className={styles.hero}>
        <div><span className={styles.kicker}>OLÁ, {dashboard.client.name.split(' ')[0].toUpperCase()}</span><h1>Escolha seu próximo horário</h1><p>Selecione o serviço, a data e um horário livre. A confirmação é imediata.</p></div>
        <div className={styles.phoneBadge}><Phone size={15}/>{displayPhone(dashboard.client.phone)}</div>
      </section>

      {error&&<div className={styles.alertError}>{error}</div>}
      {success&&<div className={styles.alertSuccess}><CheckCircle2 size={17}/>{success}</div>}

      <section className={styles.scheduler}>
        <div className={styles.sectionTitle}><span>1</span><div><h2>Escolha o serviço</h2><p>Veja duração e valor antes de marcar.</p></div></div>
        {dashboard.services.length?<div className={styles.serviceGrid}>{dashboard.services.map((service:ClientPortalService)=><button key={service.id} className={`${styles.serviceCard} ${selectedService===service.id?styles.selected:''}`} onClick={()=>setSelectedService(service.id)}><span className={styles.serviceCheck}>{selectedService===service.id?<CheckCircle2 size={18}/>:<span/>}</span><strong>{service.name}</strong><small><Clock3 size={14}/>{service.duration} min</small><b>{money(service.price)}</b></button>)}</div>:<div className={styles.emptyBox}>Nenhum serviço disponível no momento.</div>}

        <div className={styles.divider}/>
        <div className={styles.sectionTitle}><span>2</span><div><h2>Escolha a data</h2><p>Mostraremos somente horários realmente disponíveis.</p></div></div>
        <label className={styles.dateField}><CalendarDays size={18}/><input type="date" value={date} min={dateKey(new Date())} onChange={e=>setDate(e.target.value)}/></label>

        <div className={styles.divider}/>
        <div className={styles.sectionTitle}><span>3</span><div><h2>Escolha o horário</h2><p>{selectedServiceData?`${selectedServiceData.name} · ${selectedServiceData.duration} min`:'Selecione um serviço primeiro.'}</p></div></div>
        {loadingSlots?<div className={styles.loadingSlots}><RefreshCw className={styles.spin}/>Buscando horários...</div>:slots.length?<div className={styles.slotGrid}>{slots.map(slot=><button key={slot} className={selectedSlot===slot?styles.slotSelected:''} onClick={()=>setSelectedSlot(slot)}>{slot}</button>)}</div>:<div className={styles.emptyBox}>Não há horários livres nesta data. Escolha outro dia.</div>}

        <div className={styles.confirmBar}>
          <div><small>Seu agendamento</small><strong>{selectedServiceData?.name||'Escolha um serviço'}</strong><span>{selectedSlot?`${date.split('-').reverse().join('/')} às ${selectedSlot}`:'Selecione um horário disponível'}</span></div>
          <button className={styles.primaryButton} disabled={!selectedSlot||bookingBusy} onClick={book}>{bookingBusy?'Confirmando...':'Confirmar horário'}<ArrowRight size={17}/></button>
        </div>
      </section>

      <section className={styles.myBookings}>
        <div className={styles.sectionTitle}><span><CalendarCheck size={17}/></span><div><h2>Meus próximos horários</h2><p>Consulte ou cancele seus agendamentos.</p></div></div>
        {dashboard.bookings.length?<div className={styles.bookingList}>{dashboard.bookings.map(booking=><article key={booking.id} className={styles.bookingCard}><div className={styles.bookingDate}><strong>{formatTime(booking.starts_at)}</strong><span>{formatDate(booking.starts_at)}</span></div><div className={styles.bookingInfo}><strong>{booking.service?.name||'Serviço'}</strong><small>{booking.service?.duration||''}{booking.service?.duration?' min · ':''}{money(booking.price)}</small></div><span className={styles.status}>{booking.status==='pendente'?'Pendente':'Confirmado'}</span><button onClick={()=>cancelBooking(booking.id)}>Cancelar</button></article>)}</div>:<div className={styles.emptyBox}>Você ainda não tem horários futuros.</div>}
      </section>

      <footer className={styles.footer}><ShieldCheck size={15}/>Acesso protegido por telefone + PIN. Horários sincronizados com a agenda do prestador.</footer>
    </div>
  </main>;
}
