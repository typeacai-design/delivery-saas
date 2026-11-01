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
import { useRemote } from "./useRemote";
import { financeSummary } from "./finance-model";
export default function Finance({
  storeId,
  summaryOnly = false,
}: {
  storeId: string;
  summaryOnly?: boolean;
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
  const load = useCallback(
      (signal: AbortSignal) =>
        request(storeId, "/api/financeiro", "GET", undefined, signal),
      [storeId],
    ),
    state = useRemote(load);
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
      state.retry();
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
      state.retry();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const orders = state.data?.orders || [],
    expenses = state.data?.expenses || [],
    transactions = state.data?.transactions || [],
    summary = financeSummary(orders, expenses, transactions),
    paymentForms =
      forms || state.data?.tenant?.config?.formas_pagamento_aceitas || {};
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
      {state.loading && !state.data ? (
        <ActivityIndicator color={palette.green} />
      ) : state.error ? (
        <Notice text={state.error} retry={state.retry} />
      ) : null}
      {error ? <Notice text={error} /> : null}
      {state.data ? (
        <>
          <View style={m.sales}>
            <Text style={m.salesLabel}>
              Recebido · todo o período disponível
            </Text>
            <Text style={m.salesTotal}>{money(summary.received)}</Text>
            <Text style={m.salesLabel}>
              Somente pedidos marcados como pagos
            </Text>
          </View>
          <View style={[s.card, { paddingVertical: 4 }]}>
            <View style={m.metricRow}>
              <Text style={m.metricLabel}>A receber em pedidos</Text>
              <Text style={m.metricValue}>{money(summary.receivable)}</Text>
            </View>
            <View style={[m.metricRow, { borderBottomWidth: 0 }]}>
              <Text style={m.metricLabel}>Saldo do fluxo de caixa</Text>
              <Text style={m.metricValue}>{money(summary.balance)}</Text>
            </View>
          </View>
        </>
      ) : null}
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
            <Disclosure
              title="Movimentações"
              open={expanded}
              onPress={() => setExpanded((x) => !x)}
            >
              {summary.rows.length ? (
                summary.rows.map((t) => (
                  <View
                    key={t.id}
                    style={[
                      s.between,
                      {
                        borderBottomWidth: 1,
                        borderColor: palette.line,
                        paddingVertical: 12,
                      },
                    ]}
                  >
                    <View style={s.flex}>
                      <Text style={{ fontSize: 13, fontWeight: "600" }}>
                        {t.descricao}
                      </Text>
                      <Text
                        style={[
                          s.subtitle,
                          { fontSize: 11, textAlign: "left" },
                        ]}
                      >
                        {t.data
                          ? new Date(
                              t.data.length === 10
                                ? t.data + "T12:00:00"
                                : t.data,
                            ).toLocaleDateString("pt-BR")
                          : ""}{" "}
                        · {t.tipo}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: t.amount < 0 ? "#b74949" : palette.active,
                      }}
                    >
                      {money(t.amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={s.subtitle}>Nenhuma movimentação.</Text>
              )}
            </Disclosure>
          ) : tab === "accounts" ? (
            <>
              <View style={s.card}>
                <Text style={s.cardTitle}>Contas a receber</Text>
                {orders
                  .filter((o: any) => !o.pago && o.status !== "cancelado")
                  .map((o: any) => (
                    <View key={o.id} style={m.metricRow}>
                      <Text style={m.metricLabel}>Pedido #{o.codigo}</Text>
                      <Text style={s.green}>{money(o.valor_total)}</Text>
                    </View>
                  ))}
              </View>
              <View style={s.card}>
                <Text style={s.cardTitle}>Contas a pagar</Text>
                {expenses.length ? (
                  expenses.map((e: any) => (
                    <View key={e.id} style={m.metricRow}>
                      <Text style={m.metricLabel}>{e.nome}</Text>
                      <Text style={s.green}>{money(e.valor)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.subtitle}>Nenhuma despesa cadastrada.</Text>
                )}
              </View>
            </>
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>Formas de pagamento</Text>
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
