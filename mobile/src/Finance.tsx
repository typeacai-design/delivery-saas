import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreditCard, Plus, Receipt, WalletCards, X } from "lucide-react-native";
import { Text, Button, Notice, s } from "./ui";
import { PageHeading, Disclosure, m, palette } from "./merchant-layout";
import { request } from "./transport";
import { money } from "./domain";
import { useRemote, useRemoteCache } from "./useRemote";
import { financeRead, type FinanceTotals, type FinancePage } from "./finance-api";
import DateRangeFilter from "./DateRangeFilter";
import { supabase } from "./supabase";
import { currentMonthRange, financePeriodKey } from "./finance-period";

function FinanceList({ storeId, view, active, range }: { storeId: string; view: string; active: boolean; range?: { from: string; to: string } }) {
  const [page, setPage] = useState(0);
  const load = useCallback((signal: AbortSignal) => financeRead<FinancePage>(storeId, view, signal, page * 50, range), [storeId, view, page, range?.from, range?.to]);
  const state = useRemote(load, { key: `finance:${storeId}:${view}:${page}:${range?.from || ''}:${range?.to || ''}`, enabled: active });
  return <View style={{ gap: 12 }}>
    {state.error ? <Notice text={state.error} retry={state.retry} /> : null}
    {state.loading ? <Text style={s.subtitle}>{state.data ? 'Atualizando…' : 'Carregando…'}</Text> : null}
    {state.data?.rows.map(t => <View key={t.id} style={[s.between, { borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 12 }]}>
      <View style={s.flex}><Text style={{ fontSize: 13, fontWeight: '600' }}>{view === 'fluxo' ? t.descricao : view === 'receber' ? `Pedido #${t.codigo || String(t.id).slice(0,8)}` : t.nome}</Text>
      {t.data ? <Text style={[s.subtitle, { fontSize: 11, textAlign: 'left' }]}>{new Date(t.data.length === 10 ? t.data + 'T12:00:00' : t.data).toLocaleDateString('pt-BR')} · {t.tipo}</Text> : null}</View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: Number(t.amount ?? t.valor ?? t.valor_total) < 0 ? '#b74949' : palette.active }}>{money(t.amount ?? t.valor ?? t.valor_total)}</Text>
    </View>)}
    {state.data && !state.loading && !state.data.rows.length ? <Text style={s.subtitle}>{view === 'fluxo' ? 'Nenhuma movimentação neste período.' : view === 'receber' ? 'Nenhuma conta a receber.' : 'Nenhuma despesa cadastrada.'}</Text> : null}
    {page > 0 || state.data?.hasMore ? <View style={s.between}>
      <Button title="Anterior" secondary disabled={page === 0 || state.loading} onPress={() => setPage(x => x - 1)} />
      <Text>{page + 1}</Text><Button title="Próxima" secondary disabled={!state.data?.hasMore || state.loading} onPress={() => setPage(x => x + 1)} />
    </View> : null}
  </View>;
}
export default function Finance({
  storeId,
  summaryOnly = false,
  active = true,
}: {
  storeId: string;
  summaryOnly?: boolean;
  active?: boolean;
}) {
  const [tab, setTab] = useState("cashflow"),
    [expanded, setExpanded] = useState(true),
    [editing, setEditing] = useState(false),
    [type, setType] = useState("entrada"),
    [description, setDescription] = useState(""),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [forms, setForms] = useState<Record<string, boolean> | null>(null);
  const cache = useRemoteCache();
  const [customRange, setCustomRange] = useState<null | { from: string; to: string }>(null);
  const range = customRange || currentMonthRange();
  const setRange = (value: { from: string; to: string }) => setCustomRange(value.from || value.to ? value : null);
  const load = useCallback((signal: AbortSignal) => financeRead<FinanceTotals>(storeId, 'resumo', signal, 0, range), [storeId, range.from, range.to]);
  const state = useRemote(load, { key: financePeriodKey(storeId, range), enabled: active });
  const loadForms = useCallback(async (signal: AbortSignal) => {
    const r = await supabase.from('tenants').select('config').eq('id',storeId).abortSignal(signal).single();
    if (r.error) throw new Error('Não foi possível carregar as formas de pagamento.');
    return r.data.config?.formas_pagamento_aceitas || {};
  }, [storeId]);
  const formsState = useRemote(loadForms, { key: `finance:${storeId}:forms`, enabled: active && tab === 'payments' });
  async function save() {
    setBusy(true);
    setError("");
    try {
      const amount = Number(value.replace(",", "."));
      if (!description.trim() || !Number.isFinite(amount) || amount <= 0)
        throw new Error("Preencha a descrição e um valor maior que zero.");
      await request(storeId, "/api/financeiro", "POST", {
        tipo: type,
        categoria: "manual",
        descricao: description,
        valor: amount,
      });
      setEditing(false);
      setDescription("");
      setValue("");
      cache.invalidate(`finance:${storeId}:`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveForms() {
    setBusy(true);
    setError("");
    try {
      await request(storeId, "/api/financeiro", "PUT", { formas: forms });
      setForms(null);
      cache.invalidate(`finance:${storeId}:`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const summary = state.data;
  const paymentForms = forms || formsState.data || {};
  return (
    <ScrollView contentContainerStyle={s.content}>
      <PageHeading
        title={summaryOnly ? "Relatórios" : "Financeiro"}
        subtitle={
          summaryOnly
            ? "Resumo financeiro da sua loja"
            : "Seu dinheiro, sem complicação"
        }
      />
      <DateRangeFilter value={range} onChange={setRange} clearLabel="Mês atual" />
      {state.loading && !state.data ? (
        <ActivityIndicator color={palette.green} />
      ) : state.error ? (
        <Notice text={state.error} retry={state.retry} />
      ) : null}
      {error ? <Notice text={error} /> : null}
      {summary ? (
        <>
          <View style={m.sales}>
            <Text style={m.salesLabel}>
              Recebido no período
            </Text>
            <Text style={m.salesTotal}>{money(summary.received)}</Text>
            <Text style={m.salesLabel}>
              Pedidos do período marcados como pagos
            </Text>
          </View>
          <View style={[s.card, { paddingVertical: 4 }]}>
            <View style={m.metricRow}>
              <Text style={m.metricLabel}>A receber em pedidos</Text>
              <Text style={m.metricValue}>{money(summary.receivable)}</Text>
            </View>
            <View style={[m.metricRow, { borderBottomWidth: 0 }]}>
              <Text style={m.metricLabel}>Saldo do período</Text>
              <Text style={m.metricValue}>{money(summary.balance)}</Text>
            </View>
          </View>
        </>
      ) : null}
      {state.loading && state.data ? <Text style={s.subtitle}>Atualizando…</Text> : null}
      {!summaryOnly ? (
        <>
          <Button
            title="Lançar movimentação"
            icon={Plus}
            onPress={() => setEditing(true)}
          />
          <View style={m.segments}>
            {[
              { id: "cashflow", label: "Fluxo de caixa", icon: WalletCards },
              {
                id: "accounts",
                label: "Contas a pagar/receber",
                icon: Receipt,
              },
              {
                id: "payments",
                label: "Formas de pagamento",
                icon: CreditCard,
              },
            ].map(({ id, label, icon: Icon }) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === id }}
                onPress={() => setTab(id)}
                style={[
                  m.segment,
                  {
                    flexDirection: "column",
                    minHeight: 72,
                    paddingVertical: 9,
                  },
                  tab === id && m.segmentActive,
                ]}
              >
                <Icon
                  size={18}
                  color={tab === id ? palette.active : palette.muted}
                />
                <Text
                  style={[
                    m.segmentText,
                    { fontSize: 11, textAlign: "center" },
                    tab === id && { color: palette.active },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === "cashflow" ? (
            <>
              <Disclosure title="Movimentações" open={expanded} onPress={() => setExpanded(x => !x)}>
                {expanded ? <FinanceList key={`${range.from}:${range.to}`} storeId={storeId} view="fluxo" active={active} range={range} /> : null}
              </Disclosure>
            </>
          ) : tab === "accounts" ? (
            <>
              <View style={s.card}><Text style={s.cardTitle}>Contas a receber</Text><FinanceList key={`receber:${range.from}:${range.to}`} storeId={storeId} view="receber" active={active} range={range} /></View>
              <View style={s.card}><Text style={s.cardTitle}>Contas a pagar</Text><FinanceList key={`despesas:${range.from}:${range.to}`} storeId={storeId} view="despesas" active={active} range={range} /></View>
            </>
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>Formas de pagamento</Text>
              {formsState.loading ? <Text style={s.subtitle}>Carregando…</Text> : null}
              {formsState.error ? <Notice text={formsState.error} retry={formsState.retry} /> : null}
              {[
                ["dinheiro", "Dinheiro"],
                ["pix", "Pix"],
                ["cartao_credito", "Cartão de crédito"],
                ["cartao_debito", "Cartão de débito"],
              ].map(([key, title]) => (
                <View key={key} style={s.between}>
                  <Text style={s.label}>{title}</Text>
                  <Switch
                    accessibilityLabel={title}
                    disabled={!formsState.data || busy}
                    value={paymentForms[key] === true}
                    onValueChange={(value) =>
                      setForms({ ...paymentForms, [key]: value })
                    }
                    trackColor={{ false: "#d9dfdb", true: palette.green }}
                  />
                </View>
              ))}
              <Button
                title={busy ? "Salvando…" : "Salvar alterações"}
                disabled={busy || !forms}
                onPress={() => void saveForms()}
              />
            </View>
          )}
        </>
      ) : null}
      <Modal
        visible={editing}
        presentationStyle="fullScreen"
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setEditing(false);
        }}
      >
        <SafeAreaView style={s.safe}>
          <View style={[s.between, { padding: 18, backgroundColor: "#fff" }]}>
            <View style={{ width: 44 }} />
            <Text style={s.cardTitle}>Lançar movimentação</Text>
            <Pressable
              accessibilityLabel="Fechar"
              disabled={busy}
              style={m.iconButton}
              onPress={() => setEditing(false)}
            >
              <X size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {error ? <Notice text={error} /> : null}
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.flex}>
                  <Button
                    title="Entrada"
                    secondary={type !== "entrada"}
                    onPress={() => setType("entrada")}
                  />
                </View>
                <View style={s.flex}>
                  <Button
                    title="Saída"
                    secondary={type !== "saida"}
                    onPress={() => setType("saida")}
                  />
                </View>
              </View>
              <Text style={[s.label, { textAlign: "center" }]}>Descrição</Text>
              <TextInput
                accessibilityLabel="Descrição"
                style={s.input}
                value={description}
                onChangeText={setDescription}
              />
              <Text style={[s.label, { textAlign: "center" }]}>Valor</Text>
              <TextInput
                accessibilityLabel="Valor"
                keyboardType="decimal-pad"
                style={s.input}
                value={value}
                onChangeText={setValue}
              />
            </View>
            <Button
              title={busy ? "Salvando…" : "Salvar movimentação"}
              disabled={busy}
              onPress={() => void save()}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

