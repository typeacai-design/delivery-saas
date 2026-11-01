import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Print from "expo-print";
import { Text, Button, Notice, s } from "./ui";
import { PageHeading, Segments } from "./merchant-layout";
import { request } from "./transport";
import { useRemote } from "./useRemote";
import { money } from "./domain";
import OrderComposer from "./OrderComposer";
import EntityScreen from "./EntityScreen";
export default function TablesScreen({ storeId }: { storeId: string }) {
  const [tab, setTab] = useState("abertas"),
    [form, setForm] = useState<any>(null),
    [checkout, setCheckout] = useState<any>(null),
    [adding, setAdding] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
      (signal: AbortSignal) =>
        request(
          storeId,
          "/api/sessoes-mesa" + (tab === "historico" ? "?fechadas=1" : ""),
          "GET",
          undefined,
          signal,
        ),
      [storeId, tab],
    ),
    state = useRemote(load);
  async function action(path: string, method: string, body?: any) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await request(storeId, path, method, body);
      state.retry();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key: string,
    label: string,
    obj: any,
    set: (v: any) => void,
  ) => (
    <View style={{ gap: 7 }}>
      <Text style={[s.label, { textAlign: "center" }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={String(obj[key] ?? "")}
        onChangeText={(v) => set({ ...obj, [key]: v })}
      />
    </View>
  );
  return (
    <View style={s.flex}>
      <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
        <Segments
          value={tab}
          onChange={setTab}
          items={[
            { id: "abertas", label: "Abertas" },
            { id: "historico", label: "Histórico" },
            { id: "cadastro", label: "Cadastro" },
          ]}
        />
      </View>
      {tab === "cadastro" ? (
        <EntityScreen storeId={storeId} entityId="tables" />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <Button
            title="Abrir mesa"
            onPress={() =>
              setForm({
                mesa_numero: "",
                cliente_nome: "",
                cliente_whatsapp: "",
                observacoes: "",
              })
            }
          />
          {error ? <Notice text={error} /> : null}
          {state.loading ? (
            <ActivityIndicator />
          ) : state.error ? (
            <Notice text={state.error} retry={state.retry} />
          ) : !state.data?.sessoes?.length ? (
            <Text style={s.subtitle}>Nenhuma sessão encontrada.</Text>
          ) : (
            state.data.sessoes.map((ss: any) => {
              const orders = (ss.pedidos || []).filter(
                  (o: any) => o.status !== "cancelado",
                ),
                total = orders.reduce(
                  (n: number, o: any) => n + Number(o.valor_total),
                  0,
                );
              return (
                <View key={ss.id} style={s.card}>
                  <Text style={s.cardTitle}>
                    Mesa {ss.mesa_numero} · {ss.status}
                  </Text>
                  <Text style={s.subtitle}>{ss.cliente_nome}</Text>
                  {orders.map((o: any) => (
                    <View key={o.id} style={s.item}>
                      <Text style={s.label}>
                        #{o.codigo} · {money(o.valor_total)}
                      </Text>
                      {o.pedido_itens?.map((i: any) => (
                        <Text key={i.id}>
                          {i.quantidade}× {i.nome}
                        </Text>
                      ))}
                    </View>
                  ))}
                  <Text style={[s.totalValue, { textAlign: "center" }]}>
                    {money(total)}
                  </Text>
                  {ss.observacoes ? <Text>{ss.observacoes}</Text> : null}
                  {ss.status === "aberta" ? (
                    <>
                      <Button
                        title="Adicionar pedido"
                        onPress={() => setAdding(ss.id)}
                      />
                      <Button
                        title="Editar cliente e observações"
                        secondary
                        onPress={() => setForm(ss)}
                      />
                      <Button
                        title="Fechar conta"
                        secondary
                        onPress={() =>
                          setCheckout({
                            ...ss,
                            total,
                            forma_pagamento: "dinheiro",
                            valor_pago: String(total),
                            troco_para: "",
                          })
                        }
                      />
                      <Button
                        title="Cancelar sessão"
                        secondary
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            "Cancelar sessão?",
                            "Os pedidos vinculados continuam nas suas etapas atuais.",
                            [
                              { text: "Voltar", style: "cancel" },
                              {
                                text: "Cancelar sessão",
                                style: "destructive",
                                onPress: () =>
                                  void action(
                                    "/api/sessoes-mesa?id=" + ss.id,
                                    "PATCH",
                                    { status: "cancelada" },
                                  ),
                              },
                            ],
                          )
                        }
                      />
                    </>
                  ) : (
                    <Button
                      title="Reabrir sessão"
                      secondary
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          "Reabrir mesa?",
                          "A sessão voltará para as mesas abertas.",
                          [
                            { text: "Voltar", style: "cancel" },
                            {
                              text: "Reabrir",
                              onPress: () =>
                                void action(
                                  "/api/sessoes-mesa?id=" + ss.id,
                                  "PATCH",
                                  { status: "aberta" },
                                ),
                            },
                          ],
                        )
                      }
                    />
                  )}
                  <Button
                    title="Imprimir resumo"
                    secondary
                    onPress={() =>
                      void Print.printAsync({
                        html: `<html><meta charset="utf-8"><body><h1>Mesa ${String(ss.mesa_numero).replace(/[<>&]/g, "")}</h1>${orders.map((o: any) => `<p>#${String(o.codigo).replace(/[<>&]/g, "")} · ${money(o.valor_total)}</p>`).join("")}<h2>Total ${money(total)}</h2></body></html>`,
                      }).catch(() => setError("Não foi possível imprimir."))
                    }
                  />
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      {form || checkout ? (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => {
            if (!busy) {
              setForm(null);
              setCheckout(null);
            }
          }}
        >
          <SafeAreaView style={s.safe}>
            <ScrollView
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              <Button
                title="Voltar"
                secondary
                disabled={busy}
                onPress={() => {
                  setForm(null);
                  setCheckout(null);
                }}
              />
              <PageHeading
                title={
                  checkout
                    ? "Fechar conta"
                    : form.id
                      ? "Editar sessão"
                      : "Abrir mesa"
                }
              />
              {error ? <Notice text={error} /> : null}
              {checkout ? (
                <>
                  <Text style={[s.totalValue, { textAlign: "center" }]}>
                    {money(checkout.total)}
                  </Text>
                  <Segments
                    value={checkout.forma_pagamento}
                    onChange={(v) =>
                      setCheckout({ ...checkout, forma_pagamento: v })
                    }
                    items={[
                      { id: "dinheiro", label: "Dinheiro" },
                      { id: "pix", label: "Pix" },
                      { id: "cartao", label: "Cartão" },
                    ]}
                  />
                  {field("valor_pago", "Valor recebido", checkout, setCheckout)}
                  {field("troco_para", "Troco para", checkout, setCheckout)}
                </>
              ) : (
                <>
                  {!form.id
                    ? field("mesa_numero", "Número da mesa", form, setForm)
                    : null}
                  {field("cliente_nome", "Nome do cliente", form, setForm)}
                  {field("cliente_whatsapp", "WhatsApp", form, setForm)}
                  {field("observacoes", "Observações", form, setForm)}
                </>
              )}
              <Button
                title={busy ? "Salvando…" : "Confirmar"}
                disabled={busy}
                onPress={() => {
                  if (checkout) {
                    const paid = Number(
                        String(checkout.valor_pago).replace(",", "."),
                      ),
                      change = Number(
                        String(checkout.troco_para || 0).replace(",", "."),
                      );
                    if (
                      !Number.isFinite(paid) ||
                      paid < checkout.total ||
                      !Number.isFinite(change) ||
                      change < 0
                    ) {
                      setError("Confira o valor recebido e o troco.");
                      return;
                    }
                    void action(
                      `/api/sessoes-mesa/${checkout.id}/fechar`,
                      "POST",
                      {
                        forma_pagamento: checkout.forma_pagamento,
                        valor_pago: paid,
                        troco_para: change || null,
                      },
                    ).then((ok) => {
                      if (ok) setCheckout(null);
                    });
                  } else {
                    if (
                      !form.cliente_nome?.trim() ||
                      !String(form.mesa_numero || "").trim()
                    ) {
                      setError("Preencha a mesa e o cliente.");
                      return;
                    }
                    void action(
                      "/api/sessoes-mesa" + (form.id ? "?id=" + form.id : ""),
                      form.id ? "PATCH" : "POST",
                      {
                        mesa_numero: form.mesa_numero,
                        cliente_nome: form.cliente_nome,
                        cliente_whatsapp: form.cliente_whatsapp,
                        observacoes: form.observacoes,
                      },
                    ).then((ok) => {
                      if (ok) setForm(null);
                    });
                  }
                }}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
      {adding ? (
        <OrderComposer
          storeId={storeId}
          sessionId={adding}
          close={() => setAdding(null)}
          saved={state.retry}
        />
      ) : null}
    </View>
  );
}
