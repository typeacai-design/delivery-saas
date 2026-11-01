import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Share, View } from "react-native";
import { Text, Button, Notice, s } from "./ui";
import { PageHeading } from "./merchant-layout";
import DateRangeFilter from "./DateRangeFilter";
import { supabase } from "./supabase";
import { useRemote } from "./useRemote";
import { readAll } from "./scoped-data";
import { request } from "./transport";
import { reportRows, csv } from "./reports-model";
import { money, stages, stageLabels } from "./domain";
export default function ReportsScreen({ storeId }: { storeId: string }) {
  const [tab, setTab] = useState("periodo"),
    [status, setStatus] = useState("todos"),
    [payment, setPayment] = useState("todos"),
    [range, setRange] = useState(() => {
      const d = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      });
      return { from: d.slice(0, 8) + "01", to: d };
    }),
    [error, setError] = useState("");
  const load = useCallback(
      (signal: AbortSignal) =>
        readAll(() => {
          let q = supabase
            .from("pedidos")
            .select(
              "id,status,pago,forma_pagamento,valor_total,data_criacao,pedido_itens(id,nome,quantidade,valor_unitario,complementos,pedido_complementos(nome,quantidade,valor))",
            )
            .eq("tenant_id", storeId)
            .is("deleted_at", null)
            .neq("status", "cancelado")
            .order("data_criacao")
            .order("id");
          if (range.from)
            q = q.gte("data_criacao", range.from + "T00:00:00-03:00");
          if (range.to)
            q = q.lt(
              "data_criacao",
              new Date(
                new Date(range.to + "T00:00:00-03:00").getTime() + 86400000,
              ).toISOString(),
            );
          return q;
        }, signal),
      [storeId, range.from, range.to],
    ),
    state = useRemote(load);
  const visitsLoad = useCallback(
      (signal: AbortSignal) =>
        request(
          storeId,
          "/api/analytics?periodo=30d",
          "GET",
          undefined,
          signal,
        ),
      [storeId],
    ),
    visits = useRemote(visitsLoad);
  const orders = (state.data || []).filter(
      (o) =>
        (status === "todos" || o.status === status) &&
        (payment === "todos" ||
          (Array.isArray(o.forma_pagamento)
            ? o.forma_pagamento
            : [o.forma_pagamento]
          ).includes(payment)),
    ),
    rows = reportRows(orders, tab),
    paid = reportRows(orders, "periodo"),
    total = paid.reduce((n, r) => n + r.total, 0),
    count = paid.reduce((n, r) => n + r.qtd, 0);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <PageHeading title="Relatórios" />
      <DateRangeFilter value={range} onChange={setRange} />
      <View style={s.wrap}>
        {[
          ["periodo", "Período"],
          ["pagamento", "Pagamento"],
          ["item", "Produtos"],
          ["complemento", "Complementos"],
          ["dias", "Melhores dias"],
        ].map(([id, label]) => (
          <Button
            key={id}
            title={label}
            secondary={tab !== id}
            onPress={() => setTab(id)}
          />
        ))}
      </View>
      <Text style={[s.label, { textAlign: "center" }]}>Situação</Text>
      <View style={s.wrap}>
        {["todos", ...stages.filter((s) => s !== "cancelado")].map((v) => (
          <Button
            key={v}
            title={
              v === "todos"
                ? "Todos"
                : stageLabels[v as keyof typeof stageLabels]
            }
            secondary={status !== v}
            onPress={() => setStatus(v)}
          />
        ))}
      </View>
      <Text style={[s.label, { textAlign: "center" }]}>Forma de pagamento</Text>
      <View style={s.wrap}>
        {["todos", "dinheiro", "pix", "cartao_credito", "cartao_debito"].map(
          (v) => (
            <Button
              key={v}
              title={v === "todos" ? "Todas" : v.replaceAll("_", " ")}
              secondary={payment !== v}
              onPress={() => setPayment(v)}
            />
          ),
        )}
      </View>
      {state.loading ? (
        <ActivityIndicator />
      ) : state.error ? (
        <Notice text={state.error} retry={state.retry} />
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.subtitle}>Recebido no período</Text>
            <Text style={[s.totalValue, { textAlign: "center" }]}>
              {money(total)}
            </Text>
            <Text style={s.subtitle}>
              {count} pedidos · Ticket médio {money(count ? total / count : 0)}
            </Text>
          </View>
          {rows.length ? (
            rows.map((r) => (
              <View key={r.nome} style={s.card}>
                <Text style={s.cardTitle}>{r.nome}</Text>
                <View style={s.between}>
                  <Text>
                    {r.qtd}{" "}
                    {tab === "item" || tab === "complemento"
                      ? "unidades"
                      : "pedidos"}
                  </Text>
                  <Text style={s.green}>{money(r.total)}</Text>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#e5eee7",
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#239b56",
                      width: `${Math.max(1, (r.total / Math.max(1, ...rows.map((x) => x.total))) * 100)}%`,
                    }}
                  />
                </View>
              </View>
            ))
          ) : (
            <Text style={s.subtitle}>Nenhuma informação no período.</Text>
          )}
          <Button
            title="Compartilhar relatório CSV"
            secondary
            onPress={() =>
              void Share.share({
                message: csv(rows),
                title: "Relatório We Delivery",
              }).catch(() => setError("Não foi possível compartilhar."))
            }
          />
        </>
      )}
      <View style={s.card}>
        <Text style={s.cardTitle}>Visitas ao cardápio · 30 dias</Text>
        {visits.loading ? (
          <ActivityIndicator />
        ) : visits.error ? (
          <Notice text={visits.error} retry={visits.retry} />
        ) : (
          <Text style={[s.totalValue, { textAlign: "center" }]}>
            {visits.data?.total ?? 0}
          </Text>
        )}
      </View>
      {error ? <Notice text={error} /> : null}
    </ScrollView>
  );
}
