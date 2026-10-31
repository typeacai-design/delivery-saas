import {useState} from 'react'
import {Modal,ScrollView,Text,TextInput,View} from 'react-native'
import {SafeAreaView} from 'react-native-safe-area-context'
import {Button,Notice,s} from './ui'
import {request} from './transport'
import type {Order} from './domain'
const fields=[['cliente_nome','Nome do cliente'],['cliente_whatsapp','WhatsApp'],['endereco_entrega','Endereço'],['numero_entrega','Número'],['complemento_entrega','Complemento'],['bairro_entrega','Bairro'],['observacoes','Observações']] as const
export default function OrderEditor({storeId,order,close,saved}:{storeId:string;order:Order;close():void;saved():void}){
 const [form,setForm]=useState<Record<string,string>>(Object.fromEntries(fields.map(([key])=>[key,String((order as any)[key]||'')]))),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function save(){if(busy)return;setBusy(true);setError('');try{await request(storeId,`/api/pedidos/${order.id}`,'PATCH',form);saved();close()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <Modal animationType="slide" onRequestClose={()=>{if(!busy)close()}}><SafeAreaView style={s.safe}><View style={s.topBar}><Button title="Voltar" secondary disabled={busy} onPress={close}/><Text style={s.cardTitle}>Editar pedido</Text></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{error?<Notice text={error}/>:null}{fields.map(([key,label])=><View key={key} style={{gap:6}}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={form[key]} editable={!busy} onChangeText={v=>setForm(f=>({...f,[key]:v}))} multiline={key==='observacoes'} keyboardType={key==='cliente_whatsapp'?'phone-pad':'default'}/></View>)}<Button title={busy?'Salvando…':'Salvar alterações'} disabled={busy} onPress={()=>void save()}/></ScrollView></SafeAreaView></Modal>
}
