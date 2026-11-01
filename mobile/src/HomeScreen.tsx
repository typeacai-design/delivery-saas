import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  View,
  Linking,
  Alert,
} from "react-native";
import {
  BellRing,
  ChevronRight,
  ExternalLink,
  Plus,
  Store as StoreIcon,
  TrendingUp,
  X,
  Copy,
} from "lucide-react-native";
import { Text, Button, Notice, s } from "./ui";
import { m, PageHeading, Disclosure, palette } from "./merchant-layout";
import { useRemote } from "./useRemote";
import { supabase } from "./supabase";
import { checkStore } from "./catalog-api";
import { money, type Store } from "./domain";
import { storeHours, overrideExpiry } from "./store-hours";
import * as Clipboard from "expo-clipboard";

export default function HomeScreen({
  store,
  active = true,
  openOrders,
  newOrder,
}: {
  store: Store;
  active?: boolean;
  openOrders: () => void;
  newOrder: () => void;
}) {
  const [monthOpen, setMonthOpen] = useState(false),
    [sharing, setSharing] = useState(false),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(
      async (signal: AbortSignal) => {
        const r = await supabase.rpc('mobile_inicio', { p_tenant_id: store.id }).abortSignal(signal);
        if (r.error) throw new Error("Não foi possível carregar o resumo.");
        return r.data as { totalToday: number; paidToday: number; totalMonth: number; paidMonth: number; fresh: number; ongoing: number; profile: { config: any; slug: string } };
      },
      [store.id],
    ),
    state = useRemote(load, { key: `home:${store.id}`, enabled: active });
  const config = state.data?.profile.config || {},
    hours = storeHours(config),
    validOverride =
      typeof config.loja_aberta === "boolean" &&
      (!config.loja_aberta_override_until ||
        new Date(config.loja_aberta_override_until).getTime() > Date.now()),
    open = validOverride ? config.loja_aberta : hours.aberto;
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await checkStore(store.id);
      const current = await supabase
        .from("tenants")
        .select("config")
        .eq("id", store.id)
        .single();
      if (current.error)
        throw new Error("Não foi possível consultar o horário.");
      const c = { ...(current.data.config || {}), loja_aberta: !open },
        expiry = overrideExpiry(c.horarios_dias, !open ? "abrir" : "fechar");
      if (expiry) c.loja_aberta_override_until = expiry.toISOString();
      else delete c.loja_aberta_override_until;
      const r = await supabase
        .from("tenants")
        .update({ config: c })
        .eq("id", store.id)
        .select("id")
        .single();
      if (r.error)
        throw new Error("Não foi possível alterar a abertura da loja.");
      state.retry();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const link = state.data?.profile.slug
    ? `https://wedelivery.site/${state.data.profile.slug}`
    : "";
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 18,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
          gap: 22,
        }}
      >
        <View style={[s.row, { justifyContent: "center", gap: 12 }]}>
          {store.logo_url ? (
            <Image
              resizeMode="contain"
              source={{ uri: store.logo_url }}
              style={{ width: 42, height: 42, borderRadius: 14 }}
            />
          ) : (
            <View
              style={[s.brand, { width: 42, height: 42, borderRadius: 14 }]}
            >
              <StoreIcon size={22} color="#fff" />
            </View>
          )}
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                textAlign: "center",
                letterSpacing: -0.3,
              }}
            >
              {store.nome}
            </Text>
            <Text style={[s.subtitle, { fontSize: 12 }]}>
              We Delivery · Painel da loja
            </Text>
          </View>
        </View>
        <View style={[s.row, { justifyContent: "center", gap: 20 }]}>
          <View style={[s.row, { gap: 6 }]}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: open ? palette.active : "#8f4b00",
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: open ? palette.active : "#8f4b00",
              }}
            >
              {!state.data
                ? "Carregando…"
                : `Loja ${open ? "aberta" : "fechada"}`}
            </Text>
          </View>
          <Pressable
            disabled={busy || !state.data}
            accessibilityRole="button"
            onPress={() => void toggle()}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.bg,
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 12 }}>
              {busy ? "Aguarde…" : open ? "Fechar loja" : "Abrir loja"}
            </Text>
          </Pressable>
        </View>
        {hours.horarioMsg ? (
          <Text style={[s.subtitle, { fontSize: 11 }]}>
            {hours.horarioMsg}
            {validOverride
              ? " · Alterada manualmente até o próximo horário programado"
              : ""}
          </Text>
        ) : null}
      </View>
      <View style={s.content}>
        <PageHeading
          title="Sua loja, em dia."
          subtitle={new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "America/Sao_Paulo",
          })}
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
              <View style={m.salesTop}>
                <Text style={m.salesLabel}>Vendas de hoje</Text>
                <TrendingUp size={20} color="#c6dfce" strokeWidth={1.8} />
              </View>
              <Text style={m.salesTotal}>{money(state.data.totalToday)}</Text>
              <Text style={m.salesLabel}>Pedidos pagos não cancelados</Text>
              <View style={m.salesBottom}>
                <View style={m.salesMetric}>
                  <Text style={m.salesMetricValue}>{state.data.paidToday}</Text>
                  <Text style={m.salesLabel}>pedidos</Text>
                </View>
                <View
                  style={[
                    m.salesMetric,
                    { borderLeftWidth: 1, borderColor: "#ffffff25" },
                  ]}
                >
                  <Text style={m.salesMetricValue}>
                    {money(
                      state.data.paidToday
                        ? state.data.totalToday / state.data.paidToday
                        : 0,
                    )}
                  </Text>
                  <Text style={m.salesLabel}>ticket médio</Text>
                </View>
              </View>
            </View>
            <View style={[s.row, { gap: 12, marginTop: 9 }]}>
              <View style={s.flex}>
                <Button title="Novo pedido" icon={Plus} onPress={newOrder} />
              </View>
              <View style={s.flex}>
                <Button
                  title="Meu cardápio"
                  icon={ExternalLink}
                  secondary
                  onPress={() => setSharing(true)}
                />
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={s.cardTitle}>Agora na cozinha</Text>
              <Pressable
                accessibilityRole="button"
                onPress={openOrders}
                style={m.footerLink}
              >
                <Text
                  style={[m.footerText, { fontSize: 12, fontWeight: "600" }]}
                >
                  Ver pedidos
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={openOrders}
                style={m.queue}
              >
                <View style={m.queueIcon}>
                  <BellRing size={20} color="#9b5306" strokeWidth={1.8} />
                </View>
                <View style={s.flex}>
                  <Text style={m.queueTitle}>
                    {state.data.fresh} pedido{state.data.fresh !== 1 ? "s" : ""}{" "}
                    novo{state.data.fresh !== 1 ? "s" : ""}
                  </Text>
                  <Text style={[s.subtitle, { fontSize: 12, marginTop: 4 }]}>
                    {state.data.ongoing} pedido
                    {state.data.ongoing !== 1 ? "s" : ""} em andamento hoje
                  </Text>
                </View>
                <ChevronRight size={18} color={palette.muted} />
              </Pressable>
            </View>
            <View style={{ marginTop: 12 }}>
              <Disclosure
                title="Resumo do mês"
                open={monthOpen}
                onPress={() => setMonthOpen((x) => !x)}
              >
                <View style={m.metricRow}>
                  <Text style={m.metricLabel}>Faturamento do mês</Text>
                  <Text style={m.metricValue}>
                    {money(state.data.totalMonth)}
                  </Text>
                </View>
                <View style={[m.metricRow, { borderBottomWidth: 0 }]}>
                  <Text style={m.metricLabel}>Pedidos no mês</Text>
                  <Text style={m.metricValue}>{state.data.paidMonth}</Text>
                </View>
              </Disclosure>
            </View>
          </>
        ) : null}
      </View>
      <Modal
        transparent
        visible={sharing}
        animationType="slide"
        onRequestClose={() => setSharing(false)}
      >
        <View style={m.sheetOverlay}>
          <View style={m.sheet}>
            <View style={s.between}>
              <View style={{ width: 44 }} />
              <Text style={s.cardTitle}>Meu cardápio</Text>
              <Pressable
                accessibilityLabel="Fechar"
                onPress={() => setSharing(false)}
                style={m.iconButton}
              >
                <X size={20} />
              </Pressable>
            </View>
            <Text selectable style={s.subtitle}>
              {link.replace("https://", "")}
            </Text>
            <Button
              title={copied ? "Link copiado!" : "Copiar link"}
              icon={Copy}
              disabled={!link}
              onPress={() => {
                void Clipboard.setStringAsync(link)
                  .then(() => setCopied(true))
                  .catch(() => Alert.alert("Não foi possível copiar o link."));
              }}
            />
            <Button
              title="Abrir cardápio"
              secondary
              disabled={!link}
              onPress={() => void Linking.openURL(link)}
            />
            <Button
              title="Compartilhar"
              secondary
              disabled={!link}
              onPress={() => void Share.share({ message: link })}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

