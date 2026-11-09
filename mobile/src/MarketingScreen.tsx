import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  Switch,
  TextInput,
  View,
} from "react-native";
import { Text, Button, Notice, s } from "./ui";
import { PageHeading } from "./merchant-layout";
import { supabase } from "./supabase";
import { checkStore, productAction } from "./catalog-api";
import { readAll, readConfig, saveConfig } from "./scoped-data";
import { useRemote } from "./useRemote";
import { money } from "./domain";
import EntityScreen from "./EntityScreen";
export default function MarketingScreen({ storeId }: { storeId: string }) {
  const [tab, setTab] = useState("clients"),
    [filter, setFilter] = useState("todos"),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [config, setConfig] = useState<any>(null),
    [points, setPoints] = useState<Record<string, string>>({}),
    [replies, setReplies] = useState<Record<string, string>>({}),
    [history, setHistory] = useState<Record<string, any[]>>({}),
    [revision, setRevision] = useState(0),
    [rating, setRating] = useState(0);
  const load = useCallback(
      async (signal: AbortSignal) => {
        if (tab === "loyalty") {
          const [config, rows] = await Promise.all([
            readConfig(storeId, signal),
            readAll(
              () =>
                supabase
                  .from("produtos")
                  .select("id,nome,pontos,preco,ativo")
                  .eq("tenant_id", storeId)
                  .is("deleted_at", null)
                  .order("nome")
                  .order("id"),
              signal,
            ),
          ]);
          return { config, rows, slug: "" };
        }
        if (tab === "coupons") return { rows: [], slug: "" };
        const table =
            tab === "carts"
              ? "carrinho_abandonado"
              : tab === "reviews"
                ? "avaliacoes"
                : "clientes",
          fields =
            tab === "carts"
              ? "id,cliente_nome,cliente_whatsapp,itens,valor_total,ultimo_acesso,recuperado"
              : tab === "reviews"
                ? "id,cliente_nome,cliente_whatsapp,nota,comentario,aprovado,resposta_admin,created_at"
                : "id,nome,telefone,email,data_nascimento,total_pedidos,saldo_cashback,ltv,tags";
        const rows = await readAll(() => {
          let q = supabase
            .from(table)
            .select(fields)
            .eq("tenant_id", storeId)
            .order(
              tab === "carts"
                ? "ultimo_acesso"
                : tab === "reviews"
                  ? "created_at"
                  : "nome",
              { ascending: tab === "clients" },
            )
            .order("id");
          if (tab === "carts")
            q = q.or("recuperado.is.null,recuperado.eq.false");
          return q;
        }, signal);
        let slug = "";
        if (tab === "reviews") {
          const r = await supabase
            .from("tenants")
            .select("slug")
            .eq("id", storeId)
            .single();
          if (r.error)
            throw new Error("Não foi possível obter o link de avaliações.");
          slug = r.data.slug;
        }
        return { rows, slug };
      },
      [storeId, tab, revision],
    ),
    state = useRemote(load);
  useEffect(() => {
    setConfig(null);
    setFilter("todos");
    setSearch("");
    setError("");
    setMessage("");
    setRating(0);
  }, [tab]);
  useEffect(() => {
    if (tab !== "carts") return;
    const c = supabase
      .channel("mobile-carts-" + storeId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carrinho_abandonado",
          filter: "tenant_id=eq." + storeId,
        },
        () => setRevision((n) => n + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(c);
    };
  }, [storeId, tab]);
  async function perform(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await checkStore(storeId);
      await work();
      setMessage("Alteração salva.");
      state.retry();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(table: string, id: string, values?: any) {
    const q = values
      ? supabase.from(table).update(values)
      : supabase.from(table).delete();
    const r = await q
      .eq("tenant_id", storeId)
      .eq("id", id)
      .select("id")
      .single();
    if (r.error) throw new Error("Não foi possível salvar a alteração.");
  }
  async function whatsapp(phone: string, name: string, text: string) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) {
      setError("Cliente sem WhatsApp cadastrado.");
      return;
    }
    try {
      await Linking.openURL(
        `https://wa.me/${digits.length <= 11 ? "55" : ""}${digits}?text=${encodeURIComponent(`Olá ${name || "cliente"}! ${text}`)}`,
      );
    } catch {
      setError("Não foi possível abrir o WhatsApp.");
    }
  }
  async function clientHistory(client: any) {
    setError("");
    try {
      const orders = await readAll(() =>
        supabase
          .from("pedidos")
          .select("id,codigo,status,valor_total,data_criacao")
          .eq("tenant_id", storeId)
          .eq("cliente_id", client.id)
          .is("deleted_at", null)
          .order("data_criacao", { ascending: false })
          .order("id"),
      );
      setHistory((x) => ({ ...x, [client.id]: orders }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  const cfg = {
    fidelidade_ativo: false,
    pontos_por_real: 1,
    cashback_ativo: false,
    cashback_percent: 1,
    ...(state.data as any)?.config,
    ...config,
  };
  let visible = (state.data?.rows || []).filter((r) =>
    String(r.nome || r.cliente_nome || "")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (tab === "clients" && filter === "top")
    visible = [...visible]
      .sort((a, b) => Number(b.ltv) - Number(a.ltv))
      .slice(0, 10);
  if (tab === "clients" && filter === "birthdays")
    visible = visible.filter(
      (c) =>
        Number(String(c.data_nascimento || "").slice(5, 7)) ===
        new Date().getMonth() + 1,
    );
  if (tab === "reviews") {
    if (filter !== "todos")
      visible = visible.filter((r) =>
        filter === "aprovadas" ? r.aprovado : !r.aprovado,
      );
    if (rating) visible = visible.filter((r) => r.nota === rating);
  }
  return (
    <View style={s.flex}>
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ padding: 18, gap: 8 }}
      >
        {[
          ["clients", "Clientes"],
          ["loyalty", "Fidelidade"],
          ["carts", "Carrinhos"],
          ["coupons", "Cupons"],
          ["reviews", "Avaliações"],
        ].map(([id, title]) => (
          <Button
            key={id}
            title={title}
            secondary={tab !== id}
            onPress={() => setTab(id)}
          />
        ))}
      </ScrollView>
      {tab === "coupons" ? (
        <EntityScreen storeId={storeId} entityId="coupons" />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <PageHeading
            title={
              tab === "loyalty"
                ? "Fidelidade e cashback"
                : tab === "carts"
                  ? "Carrinhos"
                  : tab === "reviews"
                    ? "Avaliações"
                    : "Meus clientes"
            }
          />
          {error ? <Notice text={error} /> : null}
          {message ? (
            <Text style={[s.green, { textAlign: "center" }]}>{message}</Text>
          ) : null}
          {state.loading ? (
            <ActivityIndicator />
          ) : state.error ? (
            <Notice text={state.error} retry={state.retry} />
          ) : tab === "loyalty" ? (
            <>
              <View style={s.card}>
                {[
                  ["fidelidade_ativo", "Pontos por produto"],
                  ["cashback_ativo", "Cashback"],
                ].map(([key, label]) => (
                  <View key={key} style={s.between}>
                    <Text>{label}</Text>
                    <Switch
                      accessibilityLabel={label}
                      disabled={busy}
                      value={cfg[key] === true}
                      onValueChange={(v) => setConfig({ ...cfg, [key]: v })}
                    />
                  </View>
                ))}
                {[
                  ["pontos_por_real", "Pontos por real (regra padrão)"],
                  ["cashback_percent", "Cashback (%)"],
                ].map(([key, label]) => (
                  <View key={key} style={{ gap: 7 }}>
                    <Text style={[s.label, { textAlign: "center" }]}>
                      {label}
                    </Text>
                    <TextInput
                      accessibilityLabel={label}
                      style={s.input}
                      keyboardType="decimal-pad"
                      value={String(cfg[key])}
                      onChangeText={(v) => setConfig({ ...cfg, [key]: v })}
                    />
                  </View>
                ))}
                <Button
                  title="Salvar regras"
                  disabled={busy}
                  onPress={() =>
                    void perform(async () => {
                      const points = Number(
                          String(cfg.pontos_por_real).replace(",", "."),
                        ),
                        cashback = Number(
                          String(cfg.cashback_percent).replace(",", "."),
                        );
                      if (
                        !Number.isFinite(points) ||
                        points < 0 ||
                        !Number.isFinite(cashback) ||
                        cashback < 0 ||
                        cashback > 100
                      )
                        throw new Error(
                          "Confira os pontos e o percentual de cashback.",
                        );
                      await saveConfig(storeId, {
                        fidelidade_ativo: cfg.fidelidade_ativo === true,
                        fidelidade_tipo: cfg.fidelidade_ativo
                          ? "por_produto"
                          : "por_valor",
                        pontos_por_real: points,
                        cashback_ativo: cfg.cashback_ativo === true,
                        cashback_percent: cashback,
                      });
                    })
                  }
                />
              </View>
              {visible.map((p) => (
                <View key={p.id} style={s.card}>
                  <Text style={s.cardTitle}>{p.nome}</Text>
                  <TextInput
                    accessibilityLabel={`Pontos de ${p.nome}`}
                    style={s.input}
                    keyboardType="number-pad"
                    value={points[p.id] ?? String(p.pontos || 0)}
                    onChangeText={(v) =>
                      setPoints((x) => ({ ...x, [p.id]: v }))
                    }
                  />
                  <Button
                    title="Salvar pontos"
                    secondary
                    disabled={busy}
                    onPress={() =>
                      void perform(async () => {
                        const n = Number(points[p.id] ?? p.pontos ?? 0);
                        if (!Number.isInteger(n) || n < 0)
                          throw new Error("Informe pontos inteiros positivos.");
                        await productAction(storeId, p.id, { pontos: n });
                      })
                    }
                  />
                </View>
              ))}
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Pesquisar cliente"
                style={s.input}
                placeholder="Pesquisar cliente"
                value={search}
                onChangeText={setSearch}
              />
              {tab === "clients" ? (
                <View style={s.wrap}>
                  {[
                    ["todos", "Todos"],
                    ["top", "Top 10"],
                    ["birthdays", "Aniversariantes do mês"],
                  ].map(([id, title]) => (
                    <Button
                      key={id}
                      title={title}
                      secondary={filter !== id}
                      onPress={() => setFilter(id)}
                    />
                  ))}
                </View>
              ) : tab === "reviews" ? (
                <>
                  <View style={s.wrap}>
                    {[
                      ["todos", "Todas"],
                      ["aprovadas", "Aprovadas"],
                      ["pendentes", "Pendentes"],
                    ].map(([id, title]) => (
                      <Button
                        key={id}
                        title={title}
                        secondary={filter !== id}
                        onPress={() => setFilter(id)}
                      />
                    ))}
                  </View>
                  <View style={s.wrap}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        title={n ? n + " estrelas" : "Todas as notas"}
                        secondary={rating !== n}
                        onPress={() => setRating(n)}
                      />
                    ))}
                  </View>
                  <Button
                    title="Compartilhar link de avaliação"
                    secondary
                    onPress={() =>
                      void Share.share({
                        message:
                          "https://wedelivery.site/avaliar-loja/" +
                          state.data?.slug,
                      }).catch(() => setError("Não foi possível compartilhar."))
                    }
                  />
                  <Text style={s.subtitle}>
                    {visible.length} avaliações · Média{" "}
                    {visible.length
                      ? (
                          visible.reduce((n, r) => n + Number(r.nota), 0) /
                          visible.length
                        ).toFixed(1)
                      : "—"}
                  </Text>
                </>
              ) : null}
              {!visible.length ? (
                <Text style={s.subtitle}>Nenhum registro encontrado.</Text>
              ) : (
                visible.map((r) => (
                  <View key={r.id} style={s.card}>
                    <Text style={s.cardTitle}>
                      {r.nome || r.cliente_nome || "Cliente"}
                    </Text>
                    {tab === "clients" ? (
                      <>
                        <Text style={s.subtitle}>
                          {r.total_pedidos || 0} pedidos · Total{" "}
                          {money(r.ltv || 0)}
                        </Text>
                        <Text style={s.subtitle}>
                          Cashback {money(r.saldo_cashback || 0)}
                        </Text>
                        <Button
                          title="Histórico de pedidos"
                          secondary
                          onPress={() => void clientHistory(r)}
                        />
                        {history[r.id]?.map((o) => (
                          <Text key={o.id}>
                            #{o.codigo} · {o.status} · {money(o.valor_total)}
                          </Text>
                        ))}
                        <Button
                          title="Abrir WhatsApp"
                          secondary
                          onPress={() =>
                            void whatsapp(
                              r.telefone,
                              r.nome,
                              "Como podemos ajudar?",
                            )
                          }
                        />
                      </>
                    ) : tab === "carts" ? (
                      <>
                        <Text style={s.subtitle}>
                          {money(r.valor_total || 0)} ·{" "}
                          {new Date(r.ultimo_acesso).toLocaleString("pt-BR")}
                        </Text>
                        {(Array.isArray(r.itens) ? r.itens : []).map(
                          (i: any, n: number) => (
                            <Text key={n}>
                              {i.quantidade || 1}× {i.nome}
                            </Text>
                          ),
                        )}
                        <Button
                          title="Recuperar pelo WhatsApp"
                          disabled={!r.cliente_whatsapp}
                          onPress={() =>
                            void whatsapp(
                              r.cliente_whatsapp,
                              r.cliente_nome,
                              "Você deixou itens no carrinho. Quer ajuda para finalizar seu pedido?",
                            )
                          }
                        />
                        <Button
                          title="Marcar como recuperado"
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void perform(() =>
                              mutate("carrinho_abandonado", r.id, {
                                recuperado: true,
                              }),
                            )
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Text style={s.subtitle}>
                          {r.nota} estrelas ·{" "}
                          {r.aprovado ? "Aprovada" : "Pendente"}
                        </Text>
                        <Text style={s.details}>
                          {r.comentario || "Sem comentário"}
                        </Text>
                        {r.resposta_admin ? (
                          <Text style={s.details}>
                            Resposta: {r.resposta_admin}
                          </Text>
                        ) : null}
                        <TextInput
                          accessibilityLabel="Resposta à avaliação"
                          style={s.input}
                          placeholder="Escreva uma resposta"
                          value={replies[r.id] ?? r.resposta_admin ?? ""}
                          onChangeText={(v) =>
                            setReplies((x) => ({ ...x, [r.id]: v }))
                          }
                        />
                        <Button
                          title="Salvar resposta"
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void perform(async () => {
                              if (!replies[r.id]?.trim())
                                throw new Error("Escreva sua resposta.");
                              await mutate("avaliacoes", r.id, {
                                resposta_admin: replies[r.id].trim(),
                              });
                            })
                          }
                        />
                        <Button
                          title={r.aprovado ? "Retirar aprovação" : "Aprovar"}
                          disabled={busy}
                          onPress={() =>
                            void perform(() =>
                              mutate("avaliacoes", r.id, {
                                aprovado: !r.aprovado,
                              }),
                            )
                          }
                        />
                        <Button
                          title="Abrir WhatsApp"
                          secondary
                          onPress={() =>
                            void whatsapp(
                              r.cliente_whatsapp,
                              r.cliente_nome,
                              "Agradecemos pela sua avaliação!",
                            )
                          }
                        />
                        <Button
                          title="Excluir avaliação"
                          secondary
                          disabled={busy}
                          onPress={() =>
                            Alert.alert(
                              "Excluir avaliação?",
                              "Essa ação não poderá ser desfeita.",
                              [
                                { text: "Voltar", style: "cancel" },
                                {
                                  text: "Excluir",
                                  style: "destructive",
                                  onPress: () =>
                                    void perform(() =>
                                      mutate("avaliacoes", r.id),
                                    ),
                                },
                              ],
                            )
                          }
                        />
                      </>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
