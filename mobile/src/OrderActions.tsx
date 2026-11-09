import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MessageCircle, Pencil, Percent, Printer, Star, Trash2, X, type LucideIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Text, Button, Notice, s } from './ui';
import { money, addons, stageLabels, type Order } from './domain';
import { useRemote, useRemoteCache } from './useRemote';
import { confirmOrder, confirmMutation } from './order-cache';
import { request } from './transport';
import * as api from './api';
import { couriers, assignCourier } from './order-tools-api';
import { discountAmount, reviewUrl } from './order-actions-model';
import { palette } from './merchant-layout';
export function OrderActionButton({title, Icon, onPress, disabled=false, kind='normal'}: {title:string; Icon?:LucideIcon; onPress():void; disabled?:boolean; kind?:'normal'|'edit'|'danger'|'wide'}) {
  const color=kind==='danger'?'#ae4c45':kind==='edit'?'#23763a':kind==='wide'?'#2d7840':'#35513e';
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>({minHeight:44,paddingVertical:10,paddingHorizontal:4,borderRadius:12,borderWidth:kind==='wide'?0:1,borderColor:kind==='edit'?'#cfe7d6':'#e1e8e2',backgroundColor:kind==='danger'?'#fff6f5':kind==='edit'?'#eaf5ed':kind==='wide'?'#edf6ef':'#fff',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,opacity:disabled?0.5:pressed?0.75:1})}>
    {Icon?<Icon size={kind==='wide'?18:16} color={color} strokeWidth={1.8}/>:null}
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{fontSize:kind==='wide'?13:12,fontWeight:kind==='edit'||kind==='wide'?'600':'400',color,textAlign:'center',flexShrink:1}}>{title}</Text>
  </Pressable>;
}
function ToolModal({kind,order,storeId,close,refresh}: {kind:'discount'|'details'; order:Order; storeId:string; close():void; refresh():void}) {
  const cache=useRemoteCache(), lock=useRef(false);
  const [value,setValue]=useState(String(order.valor_desconto||0)),[type,setType]=useState<'valor'|'percentual'>('valor'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
  const load=useCallback(async(signal:AbortSignal)=>{
    const [current,list]=await Promise.all([api.order(storeId,order.id,signal),kind==='details'?couriers(storeId,signal):Promise.resolve([])]);
    if(!current)throw new Error('Pedido indisponível nesta loja.');
    return {order:current,couriers:list};
  },[storeId,order.id,kind]);
  const state=useRemote(load),current=state.data?.order;
  async function save(courierId?:string|null) {
    if(lock.current||!current||uncertain)return;
    lock.current=true;setBusy(true);setError('');
    try {
      if(kind==='discount') {
        const amount=discountAmount(value,type,current);
        await request(storeId,`/api/pedidos/${order.id}`,'PATCH',{valor_desconto:amount});
        try {
          const fresh=await api.order(storeId,order.id);
          if(fresh)confirmOrder(cache,storeId,fresh,current);else refresh();
        } catch { refresh(); }
        close();
      } else {
        const saved=await assignCourier(storeId,order.id,courierId||null);
        confirmMutation(cache,storeId,current,{motoboy_id:saved.motoboy_id,motoboy_comissao:saved.motoboy_comissao});state.retry();
      }
    }catch(e:any){setError(e.message);if(e.uncertain){setUncertain(true);refresh();}}
    finally{lock.current=false;setBusy(false);}
  }
  return <Modal visible presentationStyle="fullScreen" animationType="slide" onRequestClose={()=>{if(!busy)close()}}><SafeAreaView style={s.safe}>
    <View style={[s.between,{padding:18,backgroundColor:'#fff'}]}><View style={{width:36}}/><Text style={s.cardTitle}>{kind==='discount'?'Desconto do pedido':'Detalhes e entregador'}</Text><Pressable accessibilityLabel="Fechar" disabled={busy} onPress={close} style={{padding:10}}><X size={20}/></Pressable></View>
    <ScrollView contentContainerStyle={s.content}>
      {state.loading?<ActivityIndicator color={palette.green}/>:null}
      {state.error?<Notice text={state.error} retry={state.retry}/>:null}
      {error?<Notice text={error}/>:null}
      {uncertain?<Text style={s.subtitle}>A confirmação não chegou. Feche e confira o pedido antes de tentar novamente.</Text>:null}
      {current?<>
        <View style={s.card}><Text style={s.cardTitle}>Pedido #{current.codigo||current.id.slice(0,8)}</Text><Text style={s.subtitle}>{current.cliente_nome||'Cliente'} · {stageLabels[current.status]}</Text><Text style={s.cardTitle}>{money(current.valor_total)}</Text></View>
        {kind==='discount'?<View style={s.card}>
          <View style={s.row}><View style={s.flex}><Button title="Valor em R$" secondary={type!=='valor'} disabled={busy} onPress={()=>{setType('valor');setValue('0')}}/></View><View style={s.flex}><Button title="Percentual" secondary={type!=='percentual'} disabled={busy} onPress={()=>{setType('percentual');setValue('0')}}/></View></View>
          <Text style={s.label}>{type==='valor'?'Desconto em reais':'Desconto em %'}</Text><TextInput accessibilityLabel="Valor do desconto" keyboardType="decimal-pad" style={s.input} value={value} onChangeText={setValue} editable={!busy&&!uncertain}/>
          <Button title={busy?'Salvando…':'Aplicar desconto'} disabled={busy||uncertain||state.loading} onPress={()=>void save()}/>
        </View>:<>
          <View style={s.card}><Text style={s.cardTitle}>Itens do pedido</Text>{current.pedido_itens.map(item=><View key={item.id} style={{gap:5}}><Text style={s.label}>{item.quantidade}× {item.nome}{item.variante_nome?` · ${item.variante_nome}`:''}</Text>{addons(item).map((a,i)=><Text key={i} style={s.details}>+ {a.quantidade}× {a.nome}</Text>)}</View>)}</View>
          <View style={s.card}><Text style={s.cardTitle}>Pagamento e entrega</Text><Text style={s.details}>{current.forma_pagamento?.join(' + ')||'Não informado'} · {current.pago?'Pago':'Pagamento pendente'}</Text><Text style={s.details}>{current.tipo_entrega==='retirada'?'Retirada no balcão':[current.endereco_entrega,current.numero_entrega,current.bairro_entrega,current.complemento_entrega].filter(Boolean).join(', ')||'Endereço não informado'}</Text><Text style={s.details}>{current.observacoes||'Sem observações.'}</Text></View>
          <View style={s.card}><Text style={s.cardTitle}>Entregador</Text>
            <OrderActionButton title="Sem entregador" kind={!current.motoboy_id?'edit':'normal'} disabled={busy} onPress={()=>void save(null)}/>
            {state.data?.couriers.filter(m=>m.ativo||m.id===current.motoboy_id).map(m=><OrderActionButton key={m.id} title={`${m.nome}${!m.ativo?' · Inativo':''}${m.id===current.motoboy_id?' ✓':''}`} kind={m.id===current.motoboy_id?'edit':'normal'} disabled={busy||!m.ativo} onPress={()=>void save(m.id)}/>)}
            {Number(current.motoboy_comissao)>0?<Text style={s.subtitle}>Comissão registrada: {money(current.motoboy_comissao||0)}</Text>:null}
            {busy?<Text style={s.subtitle}>Salvando…</Text>:null}
          </View>
        </>}
      </>:null}
    </ScrollView>
  </SafeAreaView></Modal>;
}
export default function OrderActions({order,storeId,busy,onEdit,onPaid,onWhatsApp,onPrint,onCancel,refresh}: {order:Order;storeId:string;busy:boolean;onEdit():void;onPaid():void;onWhatsApp():void;onPrint():void;onCancel():void;refresh():void}) {
  const [tool,setTool]=useState<null|'discount'|'details'>(null),[working,setWorking]=useState(false),[message,setMessage]=useState('');const lock=useRef(false);
  const disabled=busy||working;
  async function perform(action:'review'|'delete') {
    if(lock.current)return;lock.current=true;setWorking(true);setMessage('');
    try{if(action==='review'){const r=await request(storeId,`/api/pedidos/${order.id}/avaliacao-convite`,'POST');await Clipboard.setStringAsync(reviewUrl(r.token));setMessage('Link de avaliação copiado.');}
    else{await request(storeId,`/api/pedidos/${order.id}/apagar`,'DELETE');refresh();}}
    catch(e:any){setMessage(e.message);}finally{lock.current=false;setWorking(false);}
  }
  const row=(left:React.ReactNode,right:React.ReactNode)=><View style={{flexDirection:'row',gap:8}}><View style={s.flex}>{left}</View><View style={s.flex}>{right}</View></View>;
  return <View style={{gap:8,marginTop:9}}>
    {row(<OrderActionButton title="Editar pedido" Icon={Pencil} kind="edit" disabled={disabled} onPress={onEdit}/>,<OrderActionButton title={order.pago?'Pago':'Marcar pago'} Icon={Check} disabled={disabled||order.status==='cancelado'} onPress={onPaid}/>)}
    {row(<OrderActionButton title="WhatsApp" Icon={MessageCircle} disabled={disabled||!order.cliente_whatsapp} onPress={onWhatsApp}/>,<OrderActionButton title="Imprimir" Icon={Printer} disabled={disabled} onPress={onPrint}/>)}
    {row(<OrderActionButton title="Desconto" Icon={Percent} disabled={disabled||order.status==='cancelado'} onPress={()=>setTool('discount')}/>,<OrderActionButton title={order.status==='cancelado'?'Apagar':order.status==='novo'?'Rejeitar':'Cancelar'} Icon={order.status==='cancelado'?Trash2:X} kind="danger" disabled={disabled} onPress={()=>order.status==='cancelado'?Alert.alert('Apagar pedido cancelado?','O pedido será removido da lista e mantido para auditoria.',[{text:'Voltar',style:'cancel'},{text:'Apagar',style:'destructive',onPress:()=>void perform('delete')}]):onCancel()}/>)}
    <View style={{marginTop:2}}><OrderActionButton title="Ver detalhes e entregador" kind="wide" disabled={disabled} onPress={()=>setTool('details')}/></View>
    {order.status==='entregue'?<View style={{marginTop:2}}><OrderActionButton title="Copiar link de avaliação" kind="wide" Icon={Star} disabled={disabled} onPress={()=>void perform('review')}/></View>:null}
    {working?<ActivityIndicator color={palette.green}/>:null}{message?<Text accessibilityLiveRegion="polite" style={s.subtitle}>{message}</Text>:null}
    {tool?<ToolModal kind={tool} order={order} storeId={storeId} close={()=>setTool(null)} refresh={refresh}/>:null}
  </View>;
}
