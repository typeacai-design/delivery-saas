import {useEffect} from 'react'
import {AppState} from 'react-native'
import {createAudioPlayer,setAudioModeAsync} from 'expo-audio'
import {supabase} from './supabase'
import {OrderAlertTracker,type AlertOrder} from './order-alert-tracker'
export function useOrderAlerts(storeId:string,onError:(message:string)=>void){
 useEffect(()=>{
  const tracker=new OrderAlertTracker(),player=createAudioPlayer(require('../assets/order-alert.wav'));player.loop=true
  let alive=true,loading=false
  function reconcile(){if(AppState.currentState==='active'&&tracker.pending.size){player.play()}else player.pause()}
  void setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:false}).catch(()=>{if(alive)onError('Não foi possível preparar o som de novos pedidos.')})
  async function sync(){if(loading)return;loading=true;try{
   const list:AlertOrder[]=[]
   for(let from=0;;from+=100){const {data,error}=await supabase.from('pedidos').select('id,status,deleted_at,data_criacao').eq('tenant_id',storeId).eq('status','novo').is('deleted_at',null).order('id').range(from,from+99);if(error)throw error;list.push(...(data||[]));if(!data||data.length<100)break}
   if(!alive)return;tracker.snapshot(list)
   // Pending orders absent from the new-stage query require an explicit status read.
   const absent=[...tracker.pending].filter(id=>!list.some(o=>o.id===id))
   if(absent.length){const {data,error}=await supabase.from('pedidos').select('id,status,deleted_at,data_criacao').eq('tenant_id',storeId).in('id',absent);if(error)throw error;for(const o of data||[])tracker.receive(o,false)}
   if(alive)reconcile()
  }catch{if(alive)onError('A conexão dos alertas está instável. Confira os pedidos.')}finally{loading=false}}
  const channel=supabase.channel(`android-alerts-${storeId}`).on('postgres_changes',{event:'*',schema:'public',table:'pedidos',filter:`tenant_id=eq.${storeId}`},payload=>{if(!alive)return;if(payload.eventType==='DELETE'){const old=payload.old as {id?:string};if(old.id)tracker.remove(old.id);reconcile();return}const row=payload.new as AlertOrder;if(row?.id){tracker.receive(row,!!row.data_criacao&&new Date(row.data_criacao).getTime()>=tracker.startedAt);reconcile()}else void sync()}).subscribe()
  void sync();const timer=setInterval(()=>{if(AppState.currentState==='active')void sync()},15000)
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void sync();else player.pause()})
  return()=>{alive=false;clearInterval(timer);listener.remove();void supabase.removeChannel(channel);player.remove()}
 },[storeId,onError])
}
