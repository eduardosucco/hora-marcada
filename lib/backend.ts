import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {Data} from './model';

let client: SupabaseClient | null = null;

export async function backend(){
  if(client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if(!url || !key) return null;
  client = createClient(url, key);
  return client;
}

export async function readData(): Promise<Data>{
  const sb = await backend();
  if(!sb) throw Error('Conexão ainda não configurada.');
  const names=['services','clients','bookings','payments','providers'] as const;
  const result=await Promise.all(names.map(n=>sb.from('hm_'+n).select('*')));
  const data={} as Data;
  result.forEach((r,i)=>{if(r.error)throw r.error;(data as any)[names[i]]=r.data});
  return data;
}

export async function saveRow(table:string,row:any){
  const sb=await backend();
  if(!sb) throw Error('Conexão ainda não configurada.');
  const {error}=await (table==='payments'?sb.from('hm_'+table).insert(row):sb.from('hm_'+table).upsert(row));
  if(error) throw error;
}
