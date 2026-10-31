import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './supabase'
import * as api from './api'
import { addons, canUseStore, money, oauthCode, stageLabels, stages, type Order, type Period, type Stage, type Store } from './domain'

const callback = 'wedelivery://auth/callback'
const exchanges = new Map<string, Promise<void>>()
async function finishGoogle(url: string) {
  const code = oauthCode(url, callback)
  if (!exchanges.has(code)) {
    exchanges.set(code, supabase.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) throw new Error('Não foi possível concluir o login. Tente novamente.') }))
    if (exchanges.size > 10) exchanges.delete(exchanges.keys().next().value!)
  }
  return exchanges.get(code)
}
function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress(): void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && s.pressed]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>
}
function Notice({ text, retry }: { text: string; retry?: () => void }) {
  return <View style={s.notice}><Text accessibilityRole="alert" style={s.noticeText}>{text}</Text>{retry && <Button title="Tentar novamente" secondary onPress={retry} />}</View>
}
function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={s.heading}><Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>
}
function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function signIn(google: boolean) {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (google) {
        const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } })
        if (error || !data.url) throw new Error('Não foi possível iniciar o login Google.')
        const result = await WebBrowser.openAuthSessionAsync(data.url, callback)
        if (result.type === 'success') await finishGoogle(result.url)
      } else {
        if (!email.trim() || !password) throw new Error('Preencha seu e-mail e senha.')
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error('Não foi possível entrar. Confira seu e-mail e senha.')
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha de conexão. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.login} keyboardShouldPersistTaps="handled">
    <View style={s.brand}><Text style={s.brandText}>W</Text></View><Heading title="We Delivery" subtitle="Sua loja, sempre com você" />
    <View style={s.card}><Text style={s.cardTitle}>Bem-vindo de volta</Text>{error ? <Notice text={error} /> : null}
      <Text style={s.label}>E-mail</Text><TextInput accessibilityLabel="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" style={s.input} value={email} onChangeText={setEmail} editable={!busy} placeholder="seu@email.com" placeholderTextColor="#77857d" />
      <Text style={s.label}>Senha</Text><TextInput accessibilityLabel="Senha" secureTextEntry autoComplete="current-password" textContentType="password" style={s.input} value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={() => void signIn(false)} placeholder="Sua senha" placeholderTextColor="#77857d" />
      <Button title={busy ? 'Entrando…' : 'Entrar'} disabled={busy} onPress={() => void signIn(false)} /><Text style={s.or}>ou</Text><Button title="Continuar com Google" secondary disabled={busy} onPress={() => void signIn(true)} />
    </View><Text style={s.footnote}>Prévia Android · Acesso do lojista</Text>
  </ScrollView></KeyboardAvoidingView>
}
function useRemote<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true }), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setResult(previous => ({ data: previous.data, error: '', loading: true }))
    void load(controller.signal).then(data => { if (!controller.signal.aborted) setResult({ data, error: '', loading: false }) }).catch(err => {
      if (!controller.signal.aborted) setResult({ data: null, error: err instanceof Error ? err.message : 'Não foi possível atualizar.', loading: false })
    })
    return () => controller.abort()
  }, [load, attempt])
  return { ...result, retry: () => setAttempt(x => x + 1) }
}
function Home({ store, pulse, openOrders }: { store: Store; pulse: number; openOrders: () => void }) {
  const load = useCallback((signal: AbortSignal) => api.counts(store.id, signal), [store.id, pulse]), state = useRemote(load)
  return <ScrollView contentContainerStyle={s.content}>
    <View style={[s.card, s.storeHeader]}>{store.logo_url ? <Image source={{ uri: store.logo_url }} style={s.storeLogo} /> : null}<Text style={s.cardTitle}>{store.nome}</Text><Text style={s.subtitle}>{store.loja_aberta_manual === null ? 'Horário automático' : store.loja_aberta_manual ? 'Aberta manualmente' : 'Fechada manualmente'}</Text></View>
    <Heading title="Seu dia" subtitle="Acompanhe os pedidos de hoje" />
    {state.loading ? <ActivityIndicator color="#19894e" /> : state.error ? <Notice text={state.error} retry={state.retry} /> : <View style={s.row}><View style={[s.card, s.metric]}><Text style={s.metricValue}>{state.data?.today}</Text><Text style={s.subtitle}>Pedidos hoje</Text></View><View style={[s.card, s.metric]}><Text style={s.metricValue}>{state.data?.fresh}</Text><Text style={s.subtitle}>Novos</Text></View></View>}
    <Button title="Ver pedidos" onPress={openOrders} />
  </ScrollView>
}
function OrderCard({ order }: { order: Order }) {
  return <View style={s.card}>
    <View style={s.between}><Text style={s.orderCode}>#{order.codigo || order.id.slice(0, 8)}</Text><Text style={s.tag}>{order.tipo_entrega === 'retirada' ? 'Retirada' : order.tipo_entrega === 'mesa' ? 'Mesa' : 'Delivery'} · {new Date(order.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text></View>
    <Text style={s.customer}>{order.cliente_nome || 'Cliente'}</Text>
    {order.pedido_itens.map(item => <View key={item.id} style={s.item}><Text style={s.itemTitle}>{item.quantidade}× {item.nome}{item.variante_nome ? ` · ${item.variante_nome}` : ''}</Text>{addons(item).map((extra, i) => <Text key={i} style={s.addon}>+ {extra.quantidade}× {extra.nome}</Text>)}{item.observacao ? <Text style={s.details}>{item.observacao}</Text> : null}</View>)}
    <View style={s.infoBox}><Text style={s.label}>Pagamento</Text><Text style={s.details}>{order.forma_pagamento?.join(' + ') || 'Não informado'} · {order.pago ? 'Pago' : 'A receber'}</Text></View>
    {order.tipo_entrega !== 'retirada' && order.endereco_entrega ? <View style={s.infoBox}><Text style={s.label}>Endereço</Text><Text style={s.details}>{[order.endereco_entrega, order.numero_entrega, order.complemento_entrega, order.bairro_entrega].filter(Boolean).join(', ')}</Text></View> : null}
    {order.observacoes ? <View style={s.infoBox}><Text style={s.label}>Observações</Text><Text style={s.details}>{order.observacoes}</Text></View> : null}
    <View style={[s.between, s.total]}><Text style={s.label}>Total</Text><Text style={s.totalValue}>{money(order.valor_total)}</Text></View>
  </View>
}
function Orders({ store, pulse }: { store: Store; pulse: number }) {
  const [period, setPeriod] = useState<Period>('hoje'), [stage, setStage] = useState<Stage>('novo'), [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => api.orders(store.id, period, stage, page, signal), [store.id, period, stage, page, pulse]), state = useRemote(load), index = stages.indexOf(stage)
  function move(n: number) { setStage(stages[(index + n + stages.length) % stages.length]); setPage(0) }
  return <View style={s.flex}><Heading title="Pedidos" subtitle="Acompanhe seu atendimento" />
    <View style={s.period}>{(['hoje', 'ontem'] as const).map(p => <Pressable accessibilityRole="button" accessibilityState={{ selected: period === p }} key={p} onPress={() => { setPeriod(p); setPage(0) }} style={[s.periodButton, period === p && s.periodActive]}><Text style={period === p ? s.selectedText : s.subtitle}>{p === 'hoje' ? 'Hoje' : 'Ontem'}</Text></Pressable>)}</View>
    <View style={s.stages}><Button title="‹" secondary onPress={() => move(-1)} /><Text accessibilityRole="header" style={s.stageTitle}>{stageLabels[stage]}{state.data ? ` · ${state.data.count}` : ''}</Text><Button title="›" secondary onPress={() => move(1)} /></View>
    <ScrollView contentContainerStyle={s.content}><Text style={s.footnote}>Prévia de consulta · As ações de atendimento ainda não estão disponíveis neste APK.</Text>
      {state.loading ? <ActivityIndicator color="#19894e" /> : state.error ? <Notice text={state.error} retry={state.retry} /> : !state.data?.orders.length ? <View style={s.empty}><Text style={s.cardTitle}>Nenhum pedido nesta etapa</Text></View> : state.data.orders.map(order => <OrderCard key={order.id} order={order} />)}
      {state.data && state.data.count > 25 ? <View style={s.between}><Button title="Anterior" secondary disabled={page === 0} onPress={() => setPage(x => x - 1)} /><Text>{page + 1} / {Math.ceil(state.data.count / 25)}</Text><Button title="Próxima" secondary disabled={(page + 1) * 25 >= state.data.count} onPress={() => setPage(x => x + 1)} /></View> : null}
    </ScrollView>
  </View>
}
function Catalog({ store, pulse }: { store: Store; pulse: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const load = useCallback((signal: AbortSignal) => api.catalog(store.id, signal), [store.id, pulse]), state = useRemote(load)
  const categories = state.data ? [...state.data.categories, ...(state.data.products.some(p => !state.data!.categories.some(c => c.id === p.categoria_id)) ? [{ id: 'other', nome: 'Sem seção', ordem: 9999 }] : [])] : []
  return <View style={s.flex}><Heading title="Cardápio" subtitle="Seus produtos organizados por seção" /><ScrollView contentContainerStyle={s.content}><Text style={s.footnote}>Prévia de consulta · A edição ainda não está disponível neste APK.</Text>
    {state.loading ? <ActivityIndicator color="#19894e" /> : state.error ? <Notice text={state.error} retry={state.retry} /> : categories.length === 0 ? <Text style={s.subtitle}>Nenhuma seção cadastrada.</Text> : categories.map(category => {
      const products = state.data!.products.filter(p => category.id === 'other' ? !state.data!.categories.some(c => c.id === p.categoria_id) : p.categoria_id === category.id)
      return <View key={category.id} style={s.group}><Pressable accessibilityRole="button" accessibilityState={{ expanded: !!expanded[category.id] }} onPress={() => setExpanded(x => ({ ...x, [category.id]: !x[category.id] }))} style={s.groupHeading}><Text style={s.cardTitle}>{category.nome}</Text><Text style={s.subtitle}>{products.length} produtos · {expanded[category.id] ? 'Recolher' : 'Ver produtos'}</Text></Pressable>
        {expanded[category.id] && products.map(p => <View style={s.product} key={p.id}><View style={s.row}>{p.imagem_url ? <Image source={{ uri: p.imagem_url }} style={s.productImage} /> : null}<View style={s.flex}><Text style={s.itemTitle}>{p.nome}</Text><Text style={s.green}>{p.exibir_preco_a_partir_de ? 'A partir de ' : ''}{money(p.preco)}</Text><Text style={s.subtitle}>{p.pontos || 0} pontos</Text></View></View><Text style={[s.productStatus, !p.ativo && s.inactive]}>{p.ativo ? 'Ativo' : 'Inativo'}</Text></View>)}
      </View>
    })}
  </ScrollView></View>
}
function Merchant({ store, changeStore }: { store: Store; changeStore?: () => void }) {
  const [tab, setTab] = useState<'home' | 'orders' | 'catalog'>('home'), [pulse, setPulse] = useState(0)
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    const refresh = () => { clearTimeout(debounce); debounce = setTimeout(() => setPulse(x => x + 1), 300) }
    const channel = supabase.channel(`android-orders-${store.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${store.id}` }, refresh).subscribe()
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh() }, 30000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh() })
    return () => { clearTimeout(debounce); clearInterval(timer); listener.remove(); void supabase.removeChannel(channel) }
  }, [store.id])
  return <View style={s.flex}><View style={s.topBar}>{changeStore ? <Pressable accessibilityRole="button" onPress={changeStore}><Text style={s.green}>Trocar loja</Text></Pressable> : <View />}<Pressable accessibilityRole="button" onPress={() => void supabase.auth.signOut({ scope: 'local' })}><Text style={s.subtitle}>Sair</Text></Pressable></View>
    <View style={s.flex}>{tab === 'home' ? <Home store={store} pulse={pulse} openOrders={() => setTab('orders')} /> : tab === 'orders' ? <Orders store={store} pulse={pulse} /> : <Catalog store={store} pulse={pulse} />}</View>
    <View style={s.nav}>{([{ id: 'home', icon: '⌂', text: 'Início' }, { id: 'orders', icon: '▣', text: 'Pedidos' }, { id: 'catalog', icon: '☷', text: 'Cardápio' }] as const).map(item => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} key={item.id} onPress={() => setTab(item.id)} style={[s.navItem, tab === item.id && s.navActive]}><Text style={[s.navIcon, tab === item.id && s.green]}>{item.icon}</Text><Text style={tab === item.id ? s.green : s.subtitle}>{item.text}</Text></Pressable>)}</View>
  </View>
}
function Account({ session }: { session: Session }) {
  const [attempt, setAttempt] = useState(0), [selected, setSelected] = useState<string | null>(null)
  const load = useCallback((signal: AbortSignal) => api.stores(signal), [session.user.id, attempt]), state = useRemote(load)
  useEffect(() => { const sub = AppState.addEventListener('change', x => { if (x === 'active') setAttempt(x => x + 1) }); return () => sub.remove() }, [])
  const store = state.data?.find(x => x.id === selected) || (state.data?.length === 1 ? state.data[0] : null)
  if (state.loading && !state.data) return <View style={s.empty}><ActivityIndicator color="#19894e" /></View>
  if (state.error) return <View style={s.content}><Notice text={state.error} retry={state.retry} /><Button title="Voltar ao login" secondary onPress={() => void supabase.auth.signOut({ scope: 'local' })} /></View>
  if (store && canUseStore(store)) return <Merchant key={store.id} store={store} changeStore={state.data!.length > 1 ? () => setSelected(null) : undefined} />
  return <ScrollView contentContainerStyle={s.content}><Heading title="Suas lojas" subtitle="Selecione uma loja para continuar" />
    {state.data?.length === 0 ? <Notice text="Nenhuma loja de proprietário ou gerente está vinculada a esta conta. Novos cadastros continuam disponíveis no site." /> : null}
    {state.data?.map(x => <View key={x.id} style={s.card}><Text style={s.cardTitle}>{x.nome}</Text>{canUseStore(x) ? <Button title="Acessar loja" onPress={() => setSelected(x.id)} /> : <Text style={s.subtitle}>{x.status === 'pending_approval' ? 'Aguardando aprovação' : 'Acesso indisponível. Contate o suporte.'}</Text>}</View>)}
    <Button title="Sair da conta" secondary onPress={() => void supabase.auth.signOut({ scope: 'local' })} />
  </ScrollView>
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null), [ready, setReady] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setReady(true) } })
    void supabase.auth.getSession().then(({ data, error }) => { if (active) { if (error) setError('Não foi possível recuperar a sessão.'); setSession(data.session); setReady(true) } }).catch(() => { if (active) { setError('Não foi possível ler a sessão do aparelho.'); setReady(true) } })
    const refresh = (state: string | null | undefined) => { if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh() }; refresh(AppState.currentState)
    const listener = AppState.addEventListener('change', refresh)
    void Linking.getInitialURL().then(url => { if (url && url.startsWith(callback)) return finishGoogle(url) }).catch(() => { if (active) setError('Não foi possível retomar o login Google. Tente novamente.') })
    return () => { active = false; subscription.unsubscribe(); listener.remove(); supabase.auth.stopAutoRefresh() }
  }, [])
  return <SafeAreaProvider><SafeAreaView style={s.safe}><StatusBar style="dark" />{!configured ? <View style={s.content}><Notice text="A conexão deste APK ainda precisa ser configurada antes da instalação." /></View> : !ready ? <View style={s.empty}><ActivityIndicator color="#19894e" /></View> : <>{error ? <Notice text={error} /> : null}{session ? <Account key={session.user.id} session={session} /> : <Login />}</>}</SafeAreaView></SafeAreaProvider>
}
const s = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#f3f7f4' }, content: { padding: 20, gap: 16, paddingBottom: 28 }, login: { padding: 24, flexGrow: 1, justifyContent: 'center', gap: 18 },
  heading: { alignItems: 'center', paddingHorizontal: 20, marginVertical: 16, gap: 7 }, title: { fontSize: 30, fontWeight: '800', color: '#19271f', textAlign: 'center' }, subtitle: { fontSize: 14, color: '#66756c', textAlign: 'center', lineHeight: 21 },
  brand: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#209653', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, brandText: { color: 'white', fontWeight: '900', fontSize: 36 }, card: { backgroundColor: '#fff', borderRadius: 22, padding: 20, gap: 12, borderWidth: 1, borderColor: '#e1e9e3', boxShadow: '0px 5px 15px rgba(25,65,41,0.05)' }, cardTitle: { fontSize: 19, fontWeight: '700', color: '#19271f', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#334b3d' }, input: { minHeight: 52, borderRadius: 13, paddingHorizontal: 16, backgroundColor: '#f7f9f7', borderWidth: 1, borderColor: '#dce5df', fontSize: 16, color: '#19271f' }, button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#239b56', borderBottomWidth: 4, borderBottomColor: '#19733e' }, buttonText: { fontWeight: '700', fontSize: 16, color: '#fff' }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5df', borderBottomColor: '#dce5df', borderBottomWidth: 2 }, secondaryText: { color: '#334b3d' }, disabled: { opacity: 0.5 }, pressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
  or: { color: '#77857d', textAlign: 'center' }, footnote: { color: '#77857d', fontSize: 12, textAlign: 'center', lineHeight: 18 }, notice: { padding: 16, borderRadius: 15, backgroundColor: '#fff4e6', gap: 12 }, noticeText: { color: '#734f21', lineHeight: 22, textAlign: 'center' }, storeHeader: { alignItems: 'center' }, storeLogo: { width: 52, height: 52, borderRadius: 16 }, green: { color: '#258346', fontWeight: '700' }, row: { flexDirection: 'row', gap: 14, alignItems: 'center' }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, metric: { flex: 1, alignItems: 'center' }, metricValue: { fontSize: 32, fontWeight: '800', color: '#258346' },
  period: { flexDirection: 'row', justifyContent: 'center', gap: 8 }, periodButton: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12, backgroundColor: '#e8eee9' }, periodActive: { backgroundColor: '#258346' }, selectedText: { color: '#fff', fontWeight: '700', fontSize: 14, lineHeight: 21 }, stages: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: 16 }, stageTitle: { flex: 1, textAlign: 'center', fontSize: 20, color: '#258346', fontWeight: '700' }, orderCode: { fontSize: 16, fontWeight: '800', color: '#19271f', flexShrink: 1 }, tag: { color: '#547060', fontSize: 11, backgroundColor: '#edf4ee', borderRadius: 8, padding: 7, flexShrink: 1 }, customer: { color: '#66756c', fontSize: 14 }, item: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#edf1ed', gap: 7 }, itemTitle: { fontSize: 17, fontWeight: '700', color: '#19271f' }, addon: { fontSize: 15, color: '#258346', backgroundColor: '#eff7ef', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 }, details: { fontSize: 15, color: '#334b3d', lineHeight: 23 }, infoBox: { borderRadius: 13, padding: 12, backgroundColor: '#f6f8f5', gap: 5 }, total: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf1ed' }, totalValue: { fontWeight: '800', color: '#258346', fontSize: 23 },
  group: { gap: 12 }, groupHeading: { padding: 20, backgroundColor: '#e5f0e7', borderRadius: 18, gap: 7 }, product: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: '#dce5df', boxShadow: '0px 4px 12px rgba(25,65,41,0.05)' }, productImage: { width: 76, height: 76, borderRadius: 16, backgroundColor: '#e8eee9' }, productStatus: { color: '#258346', backgroundColor: '#e8f5e9', alignSelf: 'center', paddingVertical: 5, paddingHorizontal: 14, borderRadius: 9, fontSize: 12 }, inactive: { color: '#b74949', backgroundColor: '#fceeee' }, topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 }, nav: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#dce5df', backgroundColor: '#fff' }, navItem: { flex: 1, minHeight: 63, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 18 }, navActive: { backgroundColor: '#e7f4e9' }, navIcon: { fontSize: 26, color: '#66756c' }, empty: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
})
