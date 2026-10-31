import {useState} from 'react'
import {Pressable,ScrollView,View} from 'react-native'
import {BarChart3,ChevronLeft,CircleHelp,LogOut,Megaphone,Package,Settings,UserRound,Users,Utensils,Tags,Palette,Store,Boxes,Receipt} from 'lucide-react-native'
import {Text,Button,s} from './ui'
import {PageHeading,MenuRow,m} from './merchant-layout'
import EntityScreen from './EntityScreen'
import SettingsForms from './SettingsForms'
import Finance from './Finance'
import {supabase} from './supabase'
export default function MoreScreen({storeId}:{storeId:string}){
 const [page,setPage]=useState(''),[group,setGroup]=useState('')
 const go=(value:string)=>{setGroup(page);setPage(value)}
 const back=()=>{setPage(group);setGroup('')}
 const groups:Record<string,{title:string;items:{id:string;title:string;icon:any}[]}>= {
 stock:{title:'Estoque',items:[{id:'stock-items',title:'Matéria-prima',icon:Boxes}]},
 marketing:{title:'Marketing',items:[{id:'coupons',title:'Cupons',icon:Tags}]},
 settings:{title:'Configurações',items:[{id:'profile',title:'Perfil da loja',icon:Store},{id:'design',title:'Design do cardápio',icon:Palette},{id:'sections',title:'Seções dos produtos',icon:Utensils},{id:'lists',title:'Listas de complementos',icon:Tags},{id:'addons',title:'Complementos',icon:PlusIcon},{id:'expenses',title:'Despesas',icon:Receipt}]}
 }
 const main=[{id:'stock',title:'Estoque',icon:Package},{id:'team',title:'Equipe',icon:Users},{id:'marketing',title:'Marketing',icon:Megaphone},{id:'reports',title:'Relatórios',icon:BarChart3},{id:'settings',title:'Configurações',icon:Settings},{id:'clients',title:'Clientes',icon:UserRound},{id:'tables',title:'Mesas',icon:Utensils},{id:'support',title:'Suporte',icon:CircleHelp}]
 return <View style={s.flex}>{page?<View style={{paddingHorizontal:24,paddingTop:12}}><Pressable accessibilityRole="button" onPress={back} style={m.footerLink}><ChevronLeft size={18} color="#087c36"/><Text style={m.footerText}>Voltar</Text></Pressable></View>:null}
 {!page||groups[page]?<ScrollView contentContainerStyle={s.content}><PageHeading title={groups[page]?.title||'Tudo da sua loja'} subtitle={!page?'Organizado em um só lugar':undefined}/><View style={{gap:13,marginTop:9}}>{(groups[page]?.items||main).map(({id,title,icon})=><MenuRow key={id} title={title} icon={icon} onPress={()=>go(id)}/>)}</View>{!page?<Pressable accessibilityRole="button" style={[m.footerLink,{marginTop:12}]} onPress={()=>void supabase.auth.signOut({scope:'local'})}><LogOut size={17} color="#087c36"/><Text style={m.footerText}>Sair da conta</Text></Pressable>:null}</ScrollView>:page==='profile'||page==='design'?<SettingsForms key={page} storeId={storeId} mode={page}/>:page==='reports'?<Finance storeId={storeId} summaryOnly/>:<EntityScreen key={page} storeId={storeId} entityId={page==='stock-items'?'stock':page}/>}</View>
}
const PlusIcon=Tags
