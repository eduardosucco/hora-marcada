import { createClient } from "npm:@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const url = Deno.env.get("SUPABASE_URL") ?? "";
const rawSecrets = Deno.env.get("SUPABASE_SECRET_KEYS");
let secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (rawSecrets) try { secret = JSON.parse(rawSecrets).default ?? secret; } catch {}
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();

const respond = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
const fail = (error:string,status=400,code="bad_request")=>respond({error,code},status);
function b64(bytes:Uint8Array){let x="";for(const b of bytes)x+=String.fromCharCode(b);return btoa(x).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}
function unb64(value:string){const x=value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-value.length%4)%4);return Uint8Array.from(atob(x),c=>c.charCodeAt(0))}
async function sha(value:string){return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value))))}
async function pinHash(pin:string,salt:string,iterations:number){const material=await crypto.subtle.importKey("raw",enc.encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:unb64(salt),iterations},material,256);return b64(new Uint8Array(bits))}
function random(size=32){const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return b64(bytes)}
function phone(value:string){const digits=String(value??"").replace(/\D/g,"");return "+"+((digits.length===10||digits.length===11)?"55"+digits:digits)}
const validPhone=(value:string)=>/^\+55\d{10,11}$/.test(value);
const validPin=(value:string)=>/^\d{6}$/.test(value);

async function provider(slug:string){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return null;const r=await db.from("hm_providers").select("id,name,slug,brand").eq("slug",slug).maybeSingle();if(r.error)throw r.error;return r.data}
async function session(clientId:string,providerId:string){const token=random();const token_hash=await sha(token);const expires_at=new Date(Date.now()+30*86400000).toISOString();await db.from("hm_client_sessions").delete().eq("client_id",clientId).lt("expires_at",new Date().toISOString());const r=await db.from("hm_client_sessions").insert({client_id:clientId,provider_id:providerId,token_hash,expires_at});if(r.error)throw r.error;return {token,expires_at}}
async function auth(req:Request){const header=req.headers.get("authorization")??"";if(!header.startsWith("Bearer "))throw Object.assign(new Error("Sessão inválida ou expirada."),{status:401});const token_hash=await sha(header.slice(7).trim());const r=await db.from("hm_client_sessions").select("id,client_id,provider_id,expires_at").eq("token_hash",token_hash).gt("expires_at",new Date().toISOString()).maybeSingle();if(r.error)throw r.error;if(!r.data)throw Object.assign(new Error("Sessão inválida ou expirada."),{status:401});await db.from("hm_client_sessions").update({last_seen_at:new Date().toISOString()}).eq("id",r.data.id);return {...r.data,token_hash}}
function dateKey(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function local(d:Date){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(d);const n=(t:string)=>Number(parts.find(p=>p.type===t)?.value??0);return {year:n("year"),month:n("month"),day:n("day"),hour:n("hour"),minute:n("minute")}}
async function dashboard(clientId:string,providerId:string){const now=new Date().toISOString();const [c,p,s,b]=await Promise.all([db.from("hm_clients").select("id,name,phone").eq("id",clientId).eq("provider_id",providerId).single(),db.from("hm_providers").select("id,name,slug,brand").eq("id",providerId).single(),db.from("hm_services").select("id,name,duration,price,color,active").eq("provider_id",providerId).eq("active",true).order("name"),db.from("hm_bookings").select("id,service_id,starts_at,ends_at,status,price,notes").eq("provider_id",providerId).eq("client_id",clientId).gte("starts_at",now).neq("status","cancelado").order("starts_at")]);for(const r of [c,p,s,b])if(r.error)throw r.error;const services=s.data??[];const sm=new Map(services.map((x:any)=>[x.id,x]));return {client:c.data,provider:p.data,services,bookings:(b.data??[]).map((x:any)=>({...x,service:sm.get(x.service_id)??null}))}}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return fail("Método não permitido.",405,"method_not_allowed");
  if(!url||!secret)return fail("Configuração interna indisponível.",500,"server_config");
  try{
    const body=await req.json().catch(()=>({}));const action=String(body?.action??"");
    if(action==="public"){const p=await provider(String(body.slug??""));if(!p)return fail("Prestador não encontrado.",404,"provider_not_found");return respond({provider:{name:p.name,slug:p.slug,brand:p.brand}})}
    if(action==="register"){
      const p=await provider(String(body.slug??""));const name=String(body.name??"").trim();const ph=phone(String(body.phone??""));const pin=String(body.pin??"");
      if(!p)return fail("Prestador não encontrado.",404,"provider_not_found");if(name.length<2||name.length>100)return fail("Informe seu nome.");if(!validPhone(ph))return fail("Informe um telefone brasileiro com DDD.");if(!validPin(pin))return fail("Crie um PIN de 6 números.");
      let c=(await db.from("hm_clients").select("id,name,phone,provider_id").eq("provider_id",p.id).eq("phone",ph).maybeSingle()).data;
      if(c){const cred=await db.from("hm_client_credentials").select("client_id").eq("client_id",c.id).maybeSingle();if(cred.error)throw cred.error;if(cred.data)return fail("Este telefone já possui acesso. Entre com seu PIN.",409,"account_exists")}else{const r=await db.from("hm_clients").insert({provider_id:p.id,name,phone:ph,email:""}).select("id,name,phone,provider_id").single();if(r.error)throw r.error;c=r.data}
      const salt=random(16),iterations=180000,hash=await pinHash(pin,salt,iterations);const cr=await db.from("hm_client_credentials").insert({client_id:c.id,provider_id:p.id,pin_hash:hash,pin_salt:salt,iterations});if(cr.error)throw cr.error;return respond({session:await session(c.id,p.id),dashboard:await dashboard(c.id,p.id)},201)
    }
    if(action==="login"){
      const p=await provider(String(body.slug??""));const ph=phone(String(body.phone??""));const pin=String(body.pin??"");if(!p)return fail("Prestador não encontrado.",404,"provider_not_found");if(!validPhone(ph)||!validPin(pin))return fail("Telefone ou PIN inválido.",401,"invalid_credentials");
      const c=await db.from("hm_clients").select("id,name,phone,provider_id").eq("provider_id",p.id).eq("phone",ph).maybeSingle();if(c.error)throw c.error;if(!c.data)return fail("Telefone ou PIN inválido.",401,"invalid_credentials");const cr=await db.from("hm_client_credentials").select("client_id,pin_hash,pin_salt,iterations,failed_attempts,locked_until").eq("client_id",c.data.id).maybeSingle();if(cr.error)throw cr.error;if(!cr.data)return fail("Primeiro acesso: crie seu PIN.",401,"first_access");
      if(cr.data.locked_until&&new Date(cr.data.locked_until).getTime()>Date.now())return fail("Acesso temporariamente bloqueado. Tente novamente em alguns minutos.",429,"locked");const candidate=await pinHash(pin,cr.data.pin_salt,cr.data.iterations);if(candidate!==cr.data.pin_hash){const attempts=Number(cr.data.failed_attempts??0)+1,locked=attempts>=5;await db.from("hm_client_credentials").update({failed_attempts:locked?0:attempts,locked_until:locked?new Date(Date.now()+15*60000).toISOString():null,updated_at:new Date().toISOString()}).eq("client_id",c.data.id);return fail(locked?"Muitas tentativas. Aguarde 15 minutos.":"Telefone ou PIN inválido.",locked?429:401,locked?"locked":"invalid_credentials")}
      await db.from("hm_client_credentials").update({failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq("client_id",c.data.id);return respond({session:await session(c.data.id,p.id),dashboard:await dashboard(c.data.id,p.id)})
    }
    const s=await auth(req);
    if(action==="dashboard")return respond({dashboard:await dashboard(s.client_id,s.provider_id)});
    if(action==="availability"){
      const serviceId=String(body.service_id??""),day=String(body.date??"");if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return fail("Data inválida.");const max=new Date(Date.now()+90*86400000);if(day<dateKey(new Date())||day>dateKey(max))return fail("Escolha uma data entre hoje e os próximos 90 dias.");const sr=await db.from("hm_services").select("id,name,duration,price,color,active").eq("id",serviceId).eq("provider_id",s.provider_id).eq("active",true).maybeSingle();if(sr.error)throw sr.error;if(!sr.data)return fail("Serviço indisponível.",404,"service_not_found");const startDay=new Date(day+"T00:00:00-03:00"),next=new Date(startDay.getTime()+86400000);const br=await db.from("hm_busy_slots").select("starts_at,ends_at").eq("provider_id",s.provider_id).gte("starts_at",startDay.toISOString()).lt("starts_at",next.toISOString()).order("starts_at");if(br.error)throw br.error;const slots:string[]=[];for(let m=480;m+Number(sr.data.duration)<=1080;m+=15){const h=String(Math.floor(m/60)).padStart(2,"0"),mi=String(m%60).padStart(2,"0"),start=new Date(day+"T"+h+":"+mi+":00-03:00"),end=new Date(start.getTime()+Number(sr.data.duration)*60000);if(start.getTime()<=Date.now()+300000)continue;const conflict=(br.data??[]).some((b:any)=>start.getTime()<new Date(b.ends_at).getTime()&&end.getTime()>new Date(b.starts_at).getTime());if(!conflict)slots.push(h+":"+mi)}return respond({service:sr.data,date:day,slots})
    }
    if(action==="book"){
      const serviceId=String(body.service_id??""),start=new Date(String(body.starts_at??""));if(Number.isNaN(start.getTime())||start.getTime()<=Date.now()+300000)return fail("Escolha um horário futuro.");if(start.getTime()>Date.now()+90*86400000)return fail("O agendamento deve estar nos próximos 90 dias.");const sr=await db.from("hm_services").select("id,duration,price,active").eq("id",serviceId).eq("provider_id",s.provider_id).eq("active",true).maybeSingle();if(sr.error)throw sr.error;if(!sr.data)return fail("Serviço indisponível.",404,"service_not_found");const end=new Date(start.getTime()+Number(sr.data.duration)*60000),a=local(start),z=local(end),mins=a.hour*60+a.minute,endMins=z.hour*60+z.minute;if(a.year!==z.year||a.month!==z.month||a.day!==z.day||mins<480||endMins>1080||a.minute%15!==0)return fail("Escolha um horário válido entre 08h e 18h.");const cf=await db.from("hm_busy_slots").select("booking_id").eq("provider_id",s.provider_id).lt("starts_at",end.toISOString()).gt("ends_at",start.toISOString()).limit(1);if(cf.error)throw cf.error;if((cf.data??[]).length)return fail("Este horário acabou de ser reservado. Escolha outro.",409,"slot_taken");const ins=await db.from("hm_bookings").insert({provider_id:s.provider_id,client_id:s.client_id,service_id:sr.data.id,starts_at:start.toISOString(),ends_at:end.toISOString(),status:"confirmado",price:sr.data.price,notes:String(body.notes??"").trim().slice(0,500)}).select("id,service_id,starts_at,ends_at,status,price,notes").single();if(ins.error)return fail("Este horário não está mais disponível.",409,"slot_taken");return respond({booking:ins.data,dashboard:await dashboard(s.client_id,s.provider_id)},201)
    }
    if(action==="cancel"){
      const id=String(body.booking_id??"");const br=await db.from("hm_bookings").select("id,starts_at,status").eq("id",id).eq("provider_id",s.provider_id).eq("client_id",s.client_id).maybeSingle();if(br.error)throw br.error;if(!br.data)return fail("Agendamento não encontrado.",404,"booking_not_found");if(!["confirmado","pendente"].includes(br.data.status)||new Date(br.data.starts_at).getTime()<=Date.now())return fail("Este agendamento não pode mais ser cancelado.");const ur=await db.from("hm_bookings").update({status:"cancelado"}).eq("id",id).eq("client_id",s.client_id);if(ur.error)throw ur.error;return respond({dashboard:await dashboard(s.client_id,s.provider_id)})
    }
    if(action==="logout"){await db.from("hm_client_sessions").delete().eq("id",s.id);return respond({ok:true})}
    return fail("Ação inválida.",400,"invalid_action");
  }catch(error){const status=Number((error as any)?.status??500);console.error(error);return fail(status===500?"Não foi possível concluir a solicitação.":String((error as Error)?.message??"Erro."),status,status===401?"unauthorized":"server_error")}
});
