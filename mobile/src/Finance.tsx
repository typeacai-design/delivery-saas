import {useCallback,useState} from 'react'
import {ActivityIndicator,ScrollView,Text,TextInput,View} from 'react-native'
import {Button,Notice,s} from './ui'
import {request} from './transport'
import {money} from './domain'
import {useRemote} from './useRemote'
export default function Finance({storeId}:{storeId:string}){
 const [editing,setEditing]=useState(false),[type,setType]=useState('entrada'),[description,setDescription]=useState(''),[value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=useCallback((signal:AbortSignal)=>request(storeId,'/api/financeiro','GET',undefined,signal),[storeId]),state=useRemote(load)
 async function save(){setBusy(true);setError('');try{const amount=Number(value.replace(',','.'));if(!description.trim()||!Number.isFinite(amount)||amount<=0)throw new Error('Preencha a descrição e um valor maior que zero.');await request(storeId,'/api/financeiro','POST',{tipo:type,categoria:'manual',descricao:description,valor:amount});setEditing(false);setDescription('');setValue('');state.retry()}catch(err:any){setError(err.message)}finally{setBusy(false)}}
 const transactions=state.data?.transactions||[]
 return <ScrollView contentContainerStyle={s.content}><Text style={s.title}>Financeiro</Text>{state.loading?<ActivityIndicator color="#239b56"/>:state.error?<Notice text={state.error} retry={state.retry}/>:null}{error?<Notice text={error}/>:null}<Button title={editing?'Fechar lançamento':'Nova movimentação'} onPress={()=>setEditing(x=>!x)}/>{editing?<View style={s.card}><View style={s.row}><Button title="Entrada" secondary={type!=='entrada'} onPress={()=>setType('entrada')}/><Button title="Saída" secondary={type!=='saida'} onPress={()=>setType('saida')}/></View><Text style={s.label}>Descrição</Text><TextInput style={s.input} value={description} onChangeText={setDescription}/><Text style={s.label}>Valor</Text><TextInput keyboardType="decimal-pad" style={s.input} value={value} onChangeText={setValue}/><Button title={busy?'Salvando…':'Salvar movimentação'} disabled={busy} onPress={()=>void save()}/></View>:null}
 <View style={s.card}><Text style={s.cardTitle}>Movimentações</Text>{transactions.length?transactions.map((t:any)=><View key={t.id} style={[s.between,{borderTopWidth:1,borderColor:'#e1e9e3',paddingVertical:12}]}><View style={s.flex}><Text style={s.itemTitle}>{t.descricao}</Text><Text style={s.details}>{t.data} · {t.tipo}</Text></View><Text style={s.green}>{t.tipo==='saida'?'- ':''}{money(t.valor)}</Text></View>):<Text style={s.subtitle}>Nenhuma movimentação.</Text>}</View>
 <View style={s.card}><Text style={s.cardTitle}>Despesas cadastradas</Text>{state.data?.expenses?.map((e:any)=><View key={e.id} style={s.between}><Text style={s.details}>{e.nome}</Text><Text style={s.green}>{money(e.valor)}</Text></View>)}</View></ScrollView>
}
