import DateRangeFilter, { type DayRange } from "./DateRangeFilter";
import MoreScreen from "./MoreScreen";
import HomeScreen from "./HomeScreen";
import CatalogScreen from "./CatalogScreen";
import {
  BottomNav,
  PageHeading,
  Segments,
  m,
  palette,
} from "./merchant-layout";
import {
  Utensils,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Activity,
  History,
  Plus,
  Box,
  CreditCard,
  MapPin,
  MessageSquare,
  Truck,
  Clock,
  Check,
  Pencil,
  Printer,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { Text, Button, Notice, s } from "./ui";
import { useRemote, RemoteProvider, useRemoteCache } from "./useRemote";
import { confirmOrder, confirmMutation } from "./order-cache";
import Finance from "./Finance";
import { useOrderAlerts } from "./useOrderAlerts";
import EntityScreen from "./EntityScreen";
import OrderComposer from "./OrderComposer";
import TablesScreen from "./TablesScreen";
import { request } from "./transport";
import * as Print from "expo-print";
import { configured, supabase } from "./supabase";
import * as api from "./api";
import {
  addons,
  canUseStore,
  money,
  oauthCode,
  stageLabels,
  stages,
  type Order,
  type Period,
  type Stage,
  type Store,
} from "./domain";

const callback = "wedelivery://auth/callback";
const exchanges = new Map<string, Promise<void>>();
async function finishGoogle(url: string) {
  const code = oauthCode(url, callback);
  if (!exchanges.has(code)) {
    exchanges.set(
      code,
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error)
          throw new Error(
            "Não foi possível concluir o login. Tente novamente.",
          );
      }),
    );
    if (exchanges.size > 10) exchanges.delete(exchanges.keys().next().value!);
  }
  return exchanges.get(code);
}
function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={s.heading}>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      <Text style={s.subtitle}>{subtitle}</Text>
    </View>
  );
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function signIn(google: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (google) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callback,
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        });
        if (error || !data.url)
          throw new Error("Não foi possível iniciar o login Google.");
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          callback,
        );
        if (result.type === "success") await finishGoogle(result.url);
      } else {
        if (!email.trim() || !password)
          throw new Error("Preencha seu e-mail e senha.");
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error)
          throw new Error(
            "Não foi possível entrar. Confira seu e-mail e senha.",
          );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha de conexão. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.login}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.brand}>
          <Text style={s.brandText}>W</Text>
        </View>
        <Heading title="We Delivery" subtitle="Sua loja, sempre com você" />
        <View style={s.card}>
          <Text style={s.cardTitle}>Bem-vindo de volta</Text>
          {error ? <Notice text={error} /> : null}
          <Text style={s.label}>E-mail</Text>
          <TextInput
            accessibilityLabel="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            style={s.input}
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            placeholder="seu@email.com"
            placeholderTextColor="#77857d"
          />
          <Text style={s.label}>Senha</Text>
          <TextInput
            accessibilityLabel="Senha"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            style={s.input}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            onSubmitEditing={() => void signIn(false)}
            placeholder="Sua senha"
            placeholderTextColor="#77857d"
          />
          <Button
            title={busy ? "Entrando…" : "Entrar"}
            disabled={busy}
            onPress={() => void signIn(false)}
          />
          <Text style={s.or}>ou</Text>
          <Button
            title="Continuar com Google"
            secondary
            disabled={busy}
            onPress={() => void signIn(true)}
          />
        </View>
        <Text style={s.footnote}>Prévia Android · Acesso do lojista</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function OrderCard({
  order,
  storeId,
  refresh,
}: {
  order: Order;
  storeId: string;
  refresh(): void;
}) {
  const cache = useRemoteCache(), lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false);
  async function change(status: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await request(storeId, `/api/pedidos/${order.id}/status`, "PATCH", {
        pedido_id: order.id,
        status,
      });
      confirmMutation(cache, storeId, order, { status: status as Stage });
    } catch (e: any) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function paid() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api.markPaid(storeId, order.id, !order.pago);
      confirmMutation(cache, storeId, order, { pago: !order.pago });
    } catch (e: any) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function print() {
    try {
      const esc = (v: unknown) =>
        String(v ?? "").replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c]!,
        );
      await Print.printAsync({
        html: `<html><meta charset="utf-8"><body><h1>Pedido #${esc(order.codigo)}</h1><p>${esc(order.cliente_nome)}</p>${order.pedido_itens
          .map(
            (i) =>
              `<h2>${i.quantidade}× ${esc(i.nome)}</h2>${addons(i)
                .map((a) => `<p>+ ${a.quantidade}× ${esc(a.nome)}</p>`)
                .join("")}`,
          )
          .join(
            "",
          )}<p>${esc(order.endereco_entrega)}</p><p>${esc(order.observacoes)}</p><h2>${esc(money(order.valor_total))}</h2></body></html>`,
      });
    } catch (e: any) {
      setError(e.message);
    }
  }
  const next =
    order.status === "novo"
      ? "preparando"
      : order.status === "preparando"
        ? "pronto"
        : order.status === "pronto"
          ? order.tipo_entrega === "delivery"
            ? "saiu"
            : "entregue"
          : order.status === "saiu"
            ? "entregue"
            : null;

  const info = (title: string, text: string, Icon: any) => (
    <View style={[s.infoBox, s.row, { gap: 11, alignItems: "flex-start" }]}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: "#dcefe2",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color="#1b7437" strokeWidth={1.8} />
      </View>
      <View style={s.flex}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.8,
            color: "#5c7263",
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <Text style={s.details}>{text}</Text>
      </View>
    </View>
  );
  const phone = String(order.cliente_whatsapp || "").replace(/\D/g, "");
  return (
    <View style={[s.card, { padding: 17, borderRadius: 20, gap: 10 }]}>
      <View style={s.between}>
        <Text style={s.orderCode}>#{order.codigo || order.id.slice(0, 8)}</Text>
        <Text
          style={{
            backgroundColor:
              order.status === "entregue"
                ? "#dcefe2"
                : order.status === "cancelado"
                  ? "#fff1ef"
                  : "#fff2d8",
            color:
              order.status === "entregue"
                ? "#1b7437"
                : order.status === "cancelado"
                  ? "#ae4c45"
                  : "#946020",
            paddingVertical: 5,
            paddingHorizontal: 9,
            fontSize: 11,
            borderRadius: 8,
            fontWeight: "600",
          }}
        >
          {stageLabels[order.status]}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 9,
            borderRadius: 8,
            backgroundColor: "#dbeafe",
          }}
        >
          <Truck size={14} color="#1d4ed8" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#1d4ed8" }}>
            {order.tipo_entrega === "retirada"
              ? "Retirada"
              : order.tipo_entrega === "mesa"
                ? "Mesa"
                : "Delivery"}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 9,
            borderRadius: 8,
            backgroundColor: "#edf0f4",
          }}
        >
          <Clock size={14} color="#465368" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#465368" }}>
            {new Date(order.data_criacao).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          letterSpacing: -0.2,
          marginBottom: 4,
        }}
      >
        {order.cliente_nome || "Cliente"}
      </Text>
      <View style={{ gap: 9, marginBottom: 9 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.4,
            color: "#64766a",
          }}
        >
          PRODUTOS
        </Text>
        {order.pedido_itens.map((item) => (
          <View key={item.id} style={s.item}>
            <View style={[s.row, { gap: 11, alignItems: "center" }]}>
              <View
                style={{
                  minWidth: 34,
                  height: 34,
                  paddingHorizontal: 7,
                  borderRadius: 10,
                  backgroundColor: "#dcefe2",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "800", color: "#1b7437" }}
                >
                  {item.quantidade}×
                </Text>
              </View>
              <View style={s.flex}>
                <Text style={[s.itemTitle, { color: "#1b3525" }]}>
                  {item.nome}
                </Text>
                {item.variante_nome ? (
                  <Text style={{ fontSize: 13, color: "#31523b" }}>
                    {item.variante_nome}
                  </Text>
                ) : null}
              </View>
            </View>
            {addons(item).length ? (
              <View
                style={{
                  marginLeft: 45,
                  paddingTop: 10,
                  marginTop: 5,
                  borderTopWidth: 1,
                  borderTopColor: "#dde8e0",
                  gap: 6,
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "600", color: "#5c7263" }}
                >
                  Complementos escolhidos
                </Text>
                {addons(item).map((extra, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 7 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#21783d",
                      }}
                    >
                      {extra.quantidade}×
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        lineHeight: 18,
                        color: "#31523b",
                      }}
                    >
                      {extra.nome}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {item.observacao ? (
              <Text style={{ fontSize: 13, color: "#31523b", lineHeight: 20 }}>
                {item.observacao}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {info(
        "PAGAMENTO",
        order.forma_pagamento?.join(" + ") || "Não informado",
        CreditCard,
      )}
      <Text
        style={{
          alignSelf: "flex-start",
          marginTop: -3,
          marginLeft: 57,
          fontSize: 11,
          fontWeight: "600",
          paddingVertical: 4,
          paddingHorizontal: 7,
          borderRadius: 6,
          backgroundColor: order.pago ? "#dcefe2" : "#fff0d3",
          color: order.pago ? "#1b7437" : "#89530b",
        }}
      >
        {order.pago ? "Pago" : "A receber"}
      </Text>
      {order.tipo_entrega !== "retirada" && order.endereco_entrega
        ? info(
            "ENDEREÇO",
            [
              order.endereco_entrega,
              order.numero_entrega,
              order.complemento_entrega,
              order.bairro_entrega,
            ]
              .filter(Boolean)
              .join(", "),
            MapPin,
          )
        : null}
      {order.observacoes
        ? info("OBSERVAÇÕES", order.observacoes, MessageSquare)
        : null}
      <View style={[s.between, s.total, { marginVertical: 5 }]}>
        <Text style={{ fontSize: 13, color: "#6b7970" }}>Total</Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            letterSpacing: -0.5,
            color: "#1a3825",
          }}
        >
          {money(order.valor_total)}
        </Text>
      </View>
      {error ? <Notice text={error} /> : null}
      {busy ? <View accessibilityLiveRegion="polite" style={[s.row, { justifyContent: 'center', gap: 8 }]}><ActivityIndicator color={palette.green} /><Text style={s.subtitle}>Salvando…</Text></View> : null}
      {next ? (
        <Button
          title={
            busy ? "Salvando…" : order.status === "novo"
              ? "Aceitar pedido"
              : `Marcar como ${stageLabels[next as Stage].toLowerCase()}`
          }
          icon={Check}
          disabled={busy}
          onPress={() => void change(next)}
        />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {order.status !== "cancelado" ? (
          <View style={{ width: "48%" }}>
            <Button
              title={order.pago ? "Marcar não pago" : "Marcar como pago"}
              icon={CreditCard}
              secondary
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  order.pago ? "Desmarcar pagamento?" : "Confirmar pagamento?",
                  `Pedido #${order.codigo || order.id.slice(0, 8)} · ${money(order.valor_total)}`,
                  [
                    { text: "Voltar", style: "cancel" },
                    { text: "Confirmar", onPress: () => void paid() },
                  ],
                )
              }
            />
          </View>
        ) : null}
        <View style={{ width: "48%" }}>
          <Button
            title="WhatsApp"
            icon={MessageSquare}
            secondary
            disabled={!phone}
            onPress={() =>
              void Linking.openURL(
                `https://wa.me/${phone.length <= 11 ? "55" : ""}${phone}`,
              ).catch(() => setError("Não foi possível abrir o WhatsApp."))
            }
          />
        </View>
        <View style={{ width: "48%" }}>
          <Button
            title="Editar pedido"
            icon={Pencil}
            secondary
            disabled={busy}
            onPress={() => setEditing(true)}
          />
        </View>
        <View style={{ width: "48%" }}>
          <Button
            title="Imprimir"
            icon={Printer}
            secondary
            onPress={() => void print()}
          />
        </View>
        {order.status !== "cancelado" && order.status !== "entregue" ? (
          <View style={{ width: "48%" }}>
            <Button
              title={order.status === "novo" ? "Rejeitar" : "Cancelar pedido"}
              icon={XCircle}
              secondary
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Cancelar pedido?",
                  "O pedido será movido para Cancelados.",
                  [
                    { text: "Voltar", style: "cancel" },
                    {
                      text: "Confirmar cancelamento",
                      style: "destructive",
                      onPress: () => void change("cancelado"),
                    },
                  ],
                )
              }
            />
          </View>
        ) : null}
      </View>
      {editing ? (
        <OrderComposer
          storeId={storeId}
          order={order}
          close={() => setEditing(false)}
          saved={refresh}
        />
      ) : null}
    </View>
  );
}
function Orders({ store, active = true }: { store: Store; active?: boolean }) {
  const cache = useRemoteCache();
  const [creating, setCreating] = useState(false),
    [period, setPeriod] = useState<Period>("hoje"),
    [stage, setStage] = useState<Stage | "todos">("novo"),
    [page, setPage] = useState(0),
    [tab, setTab] = useState("fluxo"),
    [showStages, setShowStages] = useState(false),
    [range, setRange] = useState<DayRange>(() => {
      const now = new Date(),
        parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);
      return { from: parts, to: parts };
    });
  const load = useCallback(
      (signal: AbortSignal) =>
        api.orders(
          store.id,
          period,
          stage,
          page,
          signal,
          tab === "historico" ? range : undefined,
        ),
      [store.id, period, stage, page, tab, range.from, range.to],
    ),
    state = useRemote(load, { key: `orders:${store.id}:${tab}:${period}:${stage}:${page}:${range.from}:${range.to}:${api.todayKey()}`, enabled: active && tab !== 'mesas' });
  const refresh = () => { cache.invalidate(`orders:${store.id}:`); cache.invalidate(`home:${store.id}`); cache.invalidate(`finance:${store.id}:`); };
  const options: (Stage | "todos")[] =
      tab === "historico" ? ["todos", ...stages] : [...stages],
    index = options.indexOf(stage);
  function selectStage(value: Stage | "todos") {
    setStage(value);
    setPage(0);
    setShowStages(false);
  }
  function move(n: number) {
    selectStage(options[(index + n + options.length) % options.length]);
  }
  function changeTab(value: string) {
    setTab(value);
    setStage(value === "historico" ? "todos" : "novo");
    setPage(0);
  }
  const heading = (
    <>
      <PageHeading
        title="Pedidos"
        subtitle="Gerencie os pedidos do seu delivery"
      />
      <Button
        title="Novo Pedido"
        icon={Plus}
        onPress={() => setCreating(true)}
      />
      <Segments
        items={[
          { id: "fluxo", label: "Fluxo", icon: Activity },
          { id: "historico", label: "Histórico", icon: History },
          { id: "mesas", label: "Mesas", icon: Utensils },
        ]}
        value={tab}
        onChange={changeTab}
      />
    </>
  );
  if (tab === "mesas")
    return (
      <View style={s.flex}>
        <View style={[s.content, { paddingBottom: 0 }]}>{heading}</View>
        <TablesScreen storeId={store.id} />
        {creating ? (
          <OrderComposer
            storeId={store.id}
            close={() => setCreating(false)}
            saved={refresh}
          />
        ) : null}
      </View>
    );
  return (
    <View style={s.flex}>
      <ScrollView contentContainerStyle={s.content}>
        {heading}
        {tab === "historico" ? (
          <DateRangeFilter
            value={range}
            onChange={(value) => {
              setRange(value);
              setPage(0);
            }}
          />
        ) : (
          <View style={[s.card, { padding: 12, alignItems: "center" }]}>
            <View style={s.period}>
              {(["hoje", "ontem"] as const).map((p) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === p }}
                  key={p}
                  onPress={() => {
                    setPeriod(p);
                    setPage(0);
                  }}
                  style={[
                    s.periodButton,
                    {
                      borderRadius: 6,
                      backgroundColor: "#f3f4f6",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    },
                    period === p && { backgroundColor: "#4aa347" },
                  ]}
                >
                  <Text style={{ fontSize: 14, color: "#17251c" }}>
                    {p === "hoje" ? "Hoje" : "Ontem"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <View style={[s.row, { gap: 10, marginTop: 4 }]}>
          <Pressable
            accessibilityLabel="Etapa anterior"
            onPress={() => move(-1)}
            style={[
              m.iconButton,
              {
                minHeight: 54,
                borderWidth: 1,
                borderColor: "#dfe7e1",
                backgroundColor: "#fff",
                borderRadius: 14,
              },
            ]}
          >
            <ChevronLeft size={20} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher etapa do pedido"
            accessibilityState={{ expanded: showStages }}
            onPress={() => setShowStages(true)}
            style={m.stage}
          >
            <Text style={m.stageTitle}>
              {stage === "todos" ? "Todos" : stageLabels[stage]} ·{" "}
              {state.data?.count ?? '…'}
            </Text>
            <ChevronDown size={18} color="#326f40" />
          </Pressable>
          <Pressable
            accessibilityLabel="Próxima etapa"
            onPress={() => move(1)}
            style={[
              m.iconButton,
              {
                minHeight: 54,
                borderWidth: 1,
                borderColor: "#dfe7e1",
                backgroundColor: "#fff",
                borderRadius: 14,
              },
            ]}
          >
            <ChevronRight size={20} />
          </Pressable>
        </View>
        {state.loading && !state.data ? (
          <ActivityIndicator color={palette.green} />
        ) : state.error ? (
          <Notice text={state.error} retry={state.retry} />
        ) : !state.data?.orders.length ? (
          <View style={[m.empty, { minHeight: 180 }]}>
            <Box size={28} color="#a4adab" strokeWidth={1.4} />
            <Text style={m.emptyTitle}>Nenhum pedido encontrado</Text>
            <Text style={[s.subtitle, { color: "#98a1ad" }]}>
              Tente outro filtro ou período.
            </Text>
          </View>
        ) : (
          state.data.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              storeId={store.id}
              refresh={refresh}
            />
          ))
        )}
        {state.data && state.data.count > 25 ? (
          <View style={s.between}>
            <Button
              title="Anterior"
              secondary
              disabled={page === 0}
              onPress={() => setPage((x) => x - 1)}
            />
            <Text>
              {page + 1} / {Math.ceil(state.data.count / 25)}
            </Text>
            <Button
              title="Próxima"
              secondary
              disabled={(page + 1) * 25 >= state.data.count}
              onPress={() => setPage((x) => x + 1)}
            />
          </View>
        ) : null}
      </ScrollView>
      {creating ? (
        <OrderComposer
          storeId={store.id}
          close={() => setCreating(false)}
          saved={refresh}
        />
      ) : null}
      <Modal
        transparent
        animationType="slide"
        visible={showStages}
        onRequestClose={() => setShowStages(false)}
      >
        <View style={m.sheetOverlay}>
          <View style={m.sheet}>
            <Text style={s.cardTitle}>Escolher etapa</Text>
            {options.map((value) => (
              <Button
                key={value}
                title={value === "todos" ? "Todos" : stageLabels[value]}
                secondary={value !== stage}
                onPress={() => selectStage(value)}
              />
            ))}
            <Button
              title="Fechar"
              secondary
              onPress={() => setShowStages(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
function Merchant({ store, changeStore }: { store: Store; changeStore?: () => void }) {
  type Tab = 'home' | 'orders' | 'catalog' | 'finance' | 'more';
  const [tab, setTab] = useState<Tab>('home'), [visited, setVisited] = useState<Partial<Record<Tab, boolean>>>({ home: true }),
    [alertError, setAlertError] = useState(''), [creating, setCreating] = useState(false);
  const cache = useRemoteCache();
  useOrderAlerts(store.id, setAlertError);
  const selectTab = (value: Tab) => { if (tab === 'more') { if (value === 'catalog') cache.invalidate(`catalog:${store.id}`); if (value === 'home') cache.invalidate(`home:${store.id}`); if (value === 'finance') cache.invalidate(`finance:${store.id}:`); } setVisited(v => ({ ...v, [value]: true })); setTab(value); };
  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Map<string, string>();
    const reconcile = async () => {
      const changed = [...pending]; pending.clear();
      await Promise.all(changed.map(async ([id,event]) => {
        try {
          const generation = cache.generation(`order-event:${store.id}:${id}`);
          const row = event === 'DELETE' ? null : await api.order(store.id, id);
          if (!alive || generation !== cache.generation(`order-event:${store.id}:${id}`)) return;
          if (row) confirmOrder(cache, store.id, row);
          else { cache.invalidate(`orders:${store.id}:`); cache.invalidate(`home:${store.id}`); cache.invalidate(`finance:${store.id}:`); }
        } catch { if (alive) cache.invalidate(`orders:${store.id}:`); }
      }));
    };
    const channel = supabase.channel(`android-orders-${store.id}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${store.id}`,
    }, payload => {
      const id = (payload.new as any)?.id || (payload.old as any)?.id;
      if (!id) return;
      pending.set(id, payload.eventType); clearTimeout(timer); timer = setTimeout(() => void reconcile(), 300);
    }).subscribe();
    return () => { alive = false; clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [store.id, cache]);
  useEffect(() => {
    // Reconcile only the visible data. Realtime handles order changes immediately;
    // this low-frequency fallback also covers a temporarily disconnected channel.
    const refresh = () => {
      if (AppState.currentState !== 'active') return;
      if (tab === 'home') cache.invalidate(`home:${store.id}`);
      if (tab === 'orders') cache.invalidate(`orders:${store.id}:`);
      if (tab === 'finance') cache.invalidate(`finance:${store.id}:`);
    };
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { refresh(); if (tab === 'catalog') cache.invalidate(`catalog:${store.id}`); } });
    return () => { clearInterval(timer); listener.remove(); };
  }, [tab, store.id, cache]);
  const saved = () => { cache.invalidate(`orders:${store.id}:`); cache.invalidate(`home:${store.id}`); cache.invalidate(`finance:${store.id}:`); };
  return <View style={s.flex}>
    {changeStore ? <View style={{ paddingHorizontal: 24, paddingTop: 8 }}><Pressable accessibilityRole="button" onPress={changeStore} style={m.footerLink}><Text style={m.footerText}>Trocar loja</Text></Pressable></View> : null}
    {alertError ? <Notice text={alertError} /> : null}
    <View style={s.flex}>
      {visited.home ? <View style={[s.flex, tab !== 'home' && { display: 'none' }]}><HomeScreen store={store} active={tab === 'home'} openOrders={() => selectTab('orders')} newOrder={() => setCreating(true)} /></View> : null}
      {visited.orders ? <View style={[s.flex, tab !== 'orders' && { display: 'none' }]}><Orders store={store} active={tab === 'orders'} /></View> : null}
      {visited.catalog ? <View style={[s.flex, tab !== 'catalog' && { display: 'none' }]}><CatalogScreen store={store} active={tab === 'catalog'} /></View> : null}
      {visited.finance ? <View style={[s.flex, tab !== 'finance' && { display: 'none' }]}><Finance storeId={store.id} active={tab === 'finance'} /></View> : null}
      {tab === 'more' ? <MoreScreen storeId={store.id} /> : null}
    </View>
    <BottomNav tab={tab} onChange={selectTab} />
    {creating ? <OrderComposer storeId={store.id} close={() => setCreating(false)} saved={saved} /> : null}
  </View>;
}
function Account({ session }: { session: Session }) {
  const [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(
      (signal: AbortSignal) => api.stores(signal),
      [session.user.id, attempt],
    ),
    state = useRemote(load);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (x) => {
      if (x === "active") setAttempt((x) => x + 1);
    });
    return () => sub.remove();
  }, []);
  const store =
    state.data?.find((x) => x.id === selected) ||
    (state.data?.length === 1 ? state.data[0] : null);
  if (state.loading && !state.data)
    return (
      <View style={s.empty}>
        <ActivityIndicator color="#19894e" />
      </View>
    );
  if (state.error)
    return (
      <View style={s.content}>
        <Notice text={state.error} retry={state.retry} />
        <Button
          title="Voltar ao login"
          secondary
          onPress={() => void supabase.auth.signOut({ scope: "local" })}
        />
      </View>
    );
  if (store && canUseStore(store))
    return (
      <Merchant
        key={store.id}
        store={store}
        changeStore={
          state.data!.length > 1 ? () => setSelected(null) : undefined
        }
      />
    );
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Heading
        title="Suas lojas"
        subtitle="Selecione uma loja para continuar"
      />
      {state.data?.length === 0 ? (
        <Notice text="Nenhuma loja de proprietário ou gerente está vinculada a esta conta. Novos cadastros continuam disponíveis no site." />
      ) : null}
      {state.data?.map((x) => (
        <View key={x.id} style={s.card}>
          <Text style={s.cardTitle}>{x.nome}</Text>
          {canUseStore(x) ? (
            <Button title="Acessar loja" onPress={() => setSelected(x.id)} />
          ) : (
            <Text style={s.subtitle}>
              {x.status === "pending_approval"
                ? "Aguardando aprovação"
                : "Acesso indisponível. Contate o suporte."}
            </Text>
          )}
        </View>
      ))}
      <Button
        title="Sair da conta"
        secondary
        onPress={() => void supabase.auth.signOut({ scope: "local" })}
      />
    </ScrollView>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next);
        setReady(true);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          if (error) setError("Não foi possível recuperar a sessão.");
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível ler a sessão do aparelho.");
          setReady(true);
        }
      });
    const refresh = (state: string | null | undefined) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener("change", refresh);
    void Linking.getInitialURL()
      .then((url) => {
        if (url && url.startsWith(callback)) return finishGoogle(url);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível retomar o login Google. Tente novamente.");
      });
    return () => {
      active = false;
      subscription.unsubscribe();
      listener.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />
        {!configured ? (
          <View style={s.content}>
            <Notice text="A conexão deste APK ainda precisa ser configurada antes da instalação." />
          </View>
        ) : !ready ? (
          <View style={s.empty}>
            <ActivityIndicator color="#19894e" />
          </View>
        ) : (
          <>
            {error ? <Notice text={error} /> : null}
            {session ? (
              <RemoteProvider key={session.user.id}><Account session={session} /></RemoteProvider>
            ) : (
              <Login />
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

