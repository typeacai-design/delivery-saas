import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { Text, Button, Notice, s } from "./ui";
import { PageHeading, Disclosure } from "./merchant-layout";
import { request } from "./transport";
import { readConfig, saveConfig } from "./scoped-data";
import { useRemote } from "./useRemote";
import { checkStore } from "./catalog-api";
import { supabase } from "./supabase";
import { money } from "./domain";
const days = [
  ["seg", "Segunda"],
  ["ter", "Terça"],
  ["qua", "Quarta"],
  ["qui", "Quinta"],
  ["sex", "Sexta"],
  ["sab", "Sábado"],
  ["dom", "Domingo"],
];
const week = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
export const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const number = (v: unknown, label: string, integer = false) => {
  const n = Number(String(v ?? 0).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n)))
    throw new Error("Confira " + label + ".");
  return n;
};
export default function OperationalSettings({
  storeId,
  mode,
}: {
  storeId: string;
  mode: "hours" | "delivery" | "capacity" | "peak";
}) {
  const [draft, setDraft] = useState<any>(null),
    [form, setForm] = useState<any>({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState<Record<string, boolean>>({});
  const path =
    mode === "delivery"
      ? "/api/configuracoes/entregas"
      : mode === "capacity"
        ? "/api/turnos-capacidade"
        : "/api/configuracoes/tempo-pico";
  const load = useCallback(
      (signal: AbortSignal) =>
        mode === "hours"
          ? readConfig(storeId, signal)
          : request(storeId, path, "GET", undefined, signal),
      [storeId, mode, path],
    ),
    state = useRemote(load);
  useEffect(() => {
    if (state.data)
      setDraft(
        mode === "hours"
          ? {
              ...state.data,
              horarios_dias: Object.fromEntries(
                days.map(([key]) => [
                  key,
                  state.data.horarios_dias?.[key] || {
                    ativo: false,
                    abre: "08:00",
                    fecha: "22:00",
                  },
                ]),
              ),
              excecoes_horario: state.data.excecoes_horario || [],
            }
          : JSON.parse(JSON.stringify(state.data)),
      );
  }, [state.data, mode]);
  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await checkStore(storeId);
      await work();
      setMessage("Alterações salvas.");
      setForm({});
      state.retry();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const input = (
    obj: any,
    set: (x: any) => void,
    key: string,
    label: string,
    numeric = false,
  ) => (
    <View key={key} style={{ gap: 6 }}>
      <Text style={[s.label, { textAlign: "center" }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        editable={!busy}
        keyboardType={numeric ? "decimal-pad" : "default"}
        value={String(obj?.[key] ?? "")}
        onChangeText={(v) => set({ ...obj, [key]: v })}
      />
    </View>
  );
  const toggle = (
    obj: any,
    set: (x: any) => void,
    key: string,
    label: string,
  ) => (
    <View style={s.between}>
      <Text style={[s.label, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={busy}
        value={obj?.[key] === true}
        onValueChange={(v) => set({ ...obj, [key]: v })}
      />
    </View>
  );
  const remove = (id: string) =>
    Alert.alert("Remover configuração?", "Confira antes de confirmar.", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () =>
          void run(() =>
            request(storeId, path + "?id=" + encodeURIComponent(id), "DELETE"),
          ),
      },
    ]);
  const updateException = (i: number, value: any) =>
    setDraft({
      ...draft,
      excecoes_horario: draft.excecoes_horario.map((x: any, j: number) =>
        j === i ? value : x,
      ),
    });
  return (
    <ScrollView
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeading
        title={
          mode === "hours"
            ? "Horários da loja"
            : mode === "delivery"
              ? "Entrega e taxas"
              : mode === "capacity"
                ? "Capacidade por turno"
                : "Tempos de pico"
        }
      />
      {error ? <Notice text={error} /> : null}
      {message ? (
        <Text style={[s.green, { textAlign: "center" }]}>{message}</Text>
      ) : null}
      {state.loading && !draft ? (
        <ActivityIndicator />
      ) : state.error ? (
        <Notice text={state.error} retry={state.retry} />
      ) : null}
      {draft && mode === "hours" ? (
        <>
          {days.map(([key, label]) => {
            const h = draft.horarios_dias[key],
              set = (value: any) =>
                setDraft({
                  ...draft,
                  horarios_dias: { ...draft.horarios_dias, [key]: value },
                });
            return (
              <Disclosure
                key={key}
                title={
                  label +
                  (h.ativo ? " · " + h.abre + " às " + h.fecha : " · Fechado")
                }
                open={!!open[key]}
                onPress={() => setOpen((x) => ({ ...x, [key]: !x[key] }))}
              >
                {toggle(h, set, "ativo", "Aberto neste dia")}
                {input(h, set, "abre", "Abre (HH:MM)")}
                {input(h, set, "fecha", "Fecha (HH:MM)")}
                <Button
                  title="Repetir nos outros dias abertos"
                  secondary
                  onPress={() => {
                    if (!h.ativo) {
                      setError("Abra este dia antes de copiar o horário.");
                      return;
                    }
                    setDraft({
                      ...draft,
                      horarios_dias: Object.fromEntries(
                        days.map(([k]) => [
                          k,
                          draft.horarios_dias[k].ativo
                            ? {
                                ...draft.horarios_dias[k],
                                abre: h.abre,
                                fecha: h.fecha,
                              }
                            : draft.horarios_dias[k],
                        ]),
                      ),
                    });
                  }}
                />
              </Disclosure>
            );
          })}
          <View style={s.card}>
            <Text style={s.cardTitle}>Exceções por data</Text>
            {draft.excecoes_horario.map((ex: any, i: number) => (
              <View key={i} style={s.card}>
                {input(
                  ex,
                  (v) => updateException(i, v),
                  "data",
                  "Data (AAAA-MM-DD)",
                )}
                {input(
                  ex,
                  (v) => updateException(i, v),
                  "abre",
                  "Abre (HH:MM)",
                )}
                {input(
                  ex,
                  (v) => updateException(i, v),
                  "fecha",
                  "Fecha (HH:MM)",
                )}
                {input(ex, (v) => updateException(i, v), "motivo", "Motivo")}
                <Button
                  title="Remover exceção"
                  secondary
                  onPress={() =>
                    setDraft({
                      ...draft,
                      excecoes_horario: draft.excecoes_horario.filter(
                        (_: any, j: number) => j !== i,
                      ),
                    })
                  }
                />
              </View>
            ))}
            <Button
              title="Adicionar exceção"
              secondary
              onPress={() =>
                setDraft({
                  ...draft,
                  excecoes_horario: [
                    ...draft.excecoes_horario,
                    { data: "", abre: "08:00", fecha: "22:00", motivo: "" },
                  ],
                })
              }
            />
          </View>
          <Button
            title="Salvar horários"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                for (const h of Object.values(draft.horarios_dias) as any[])
                  if (h.ativo && (!validTime(h.abre) || !validTime(h.fecha)))
                    throw new Error("Confira os horários no formato HH:MM.");
                for (const e of draft.excecoes_horario)
                  if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(e.data) ||
                    !validTime(e.abre) ||
                    !validTime(e.fecha)
                  )
                    throw new Error(
                      "Confira as datas e horários das exceções.",
                    );
                await saveConfig(storeId, {
                  horarios_dias: draft.horarios_dias,
                  excecoes_horario: draft.excecoes_horario,
                });
              })
            }
          />
        </>
      ) : null}
      {draft && mode === "delivery" ? (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>Método de entrega</Text>
            <View style={s.wrap}>
              {[
                ["bairro", "Por bairro"],
                ["km", "Por quilômetro"],
              ].map(([id, label]) => (
                <Button
                  key={id}
                  title={label}
                  secondary={draft.config?.metodo !== id}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      config: { ...draft.config, metodo: id },
                    })
                  }
                />
              ))}
            </View>
            {input(
              draft.origem,
              (v) => setDraft({ ...draft, origem: v }),
              "endereco",
              "Endereço de origem",
            )}
            {input(
              draft.origem,
              (v) => setDraft({ ...draft, origem: v }),
              "latitude",
              "Latitude",
              true,
            )}
            {input(
              draft.origem,
              (v) => setDraft({ ...draft, origem: v }),
              "longitude",
              "Longitude",
              true,
            )}
            {[
              ["valor_km", "Preço por quilômetro"],
              ["minimo", "Taxa mínima"],
              ["max_km", "Distância máxima (km)"],
            ].map(([key, label]) =>
              input(
                draft.config,
                (v) => setDraft({ ...draft, config: v }),
                key,
                label,
                true,
              ),
            )}
            <View style={s.wrap}>
              {[
                ["ceil", "Arredondar para cima"],
                ["round", "Arredondar"],
                ["none", "Sem arredondar"],
              ].map(([id, label]) => (
                <Button
                  key={id}
                  title={label}
                  secondary={draft.config?.arredondamento !== id}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      config: { ...draft.config, arredondamento: id },
                    })
                  }
                />
              ))}
            </View>
            {toggle(
              draft.config,
              (v) => setDraft({ ...draft, config: v }),
              "vender_sem_estoque",
              "Permitir vendas sem estoque",
            )}
            <Button
              title="Salvar método e taxas"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  if (draft.config.metodo === "bairro") {
                    await saveConfig(storeId, { entrega_metodo: "bairro" });
                    await request(storeId, path, "POST", {
                      kind: "config",
                      config: {
                        vender_sem_estoque:
                          draft.config.vender_sem_estoque === true,
                      },
                    });
                    return;
                  }
                  const config = {
                    ...draft.config,
                    valor_km: number(
                      draft.config.valor_km ?? 0,
                      "o valor por km",
                    ),
                    minimo: number(draft.config.minimo ?? 0, "a taxa mínima"),
                    max_km: number(
                      draft.config.max_km ?? 10,
                      "a distância máxima",
                    ),
                    arredondamento: draft.config.arredondamento || "ceil",
                  };
                  const latitude = Number(
                      String(draft.origem.latitude).replace(",", "."),
                    ),
                    longitude = Number(
                      String(draft.origem.longitude).replace(",", "."),
                    );
                  if (
                    !Number.isFinite(latitude) ||
                    latitude < -90 ||
                    latitude > 90 ||
                    !Number.isFinite(longitude) ||
                    longitude < -180 ||
                    longitude > 180
                  )
                    throw new Error("Informe coordenadas válidas da origem.");
                  await request(storeId, path, "POST", {
                    kind: "km",
                    metodo: "km",
                    config,
                    origem: { ...draft.origem, latitude, longitude },
                  });
                })
              }
            />
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {form.id ? "Editar bairro" : "Adicionar bairro"}
            </Text>
            {input(form, setForm, "bairro", "Bairro")}
            {input(form, setForm, "taxa", "Taxa de entrega", true)}
            {input(form, setForm, "prazo_min", "Prazo em minutos", true)}
            {toggle(
              { ...form, ativo: form.ativo !== false },
              setForm,
              "ativo",
              "Bairro ativo",
            )}
            <Button
              title="Salvar bairro"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  if (!form.bairro?.trim())
                    throw new Error("Preencha o bairro.");
                  await request(storeId, path, "POST", {
                    ...form,
                    taxa: number(form.taxa, "a taxa"),
                    prazo_min: form.prazo_min
                      ? number(form.prazo_min, "o prazo", true)
                      : null,
                  });
                })
              }
            />
          </View>
          {draft.bairros.map((b: any) => (
            <View key={b.id} style={s.card}>
              <Text style={s.cardTitle}>
                {b.bairro} · {money(b.taxa)}
              </Text>
              <Text style={s.subtitle}>
                {b.prazo_min ? b.prazo_min + " minutos" : ""} ·{" "}
                {b.ativo ? "Ativo" : "Inativo"}
              </Text>
              <Button
                title="Editar"
                secondary
                onPress={() => setForm({ ...b })}
              />
              <Button
                title="Excluir"
                secondary
                disabled={busy}
                onPress={() => remove(b.id)}
              />
            </View>
          ))}
        </>
      ) : null}
      {draft && mode === "capacity" ? (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {form.id ? "Editar turno" : "Adicionar turno"}
            </Text>
            {input(form, setForm, "nome", "Nome")}
            {input(form, setForm, "hora_inicio", "Início (HH:MM)")}
            {input(form, setForm, "hora_fim", "Fim (HH:MM)")}
            {input(
              form,
              setForm,
              "capacidade_maxima",
              "Máximo de pedidos",
              true,
            )}
            <View style={s.wrap}>
              {days.map(([id, label]) => (
                <Button
                  key={id}
                  title={label}
                  secondary={
                    !(form.dias_semana || []).includes(week.indexOf(id))
                  }
                  onPress={() => {
                    const day = week.indexOf(id);
                    setForm({
                      ...form,
                      dias_semana: (form.dias_semana || []).includes(day)
                        ? form.dias_semana.filter((d: number) => d !== day)
                        : [...(form.dias_semana || []), day],
                    });
                  }}
                />
              ))}
            </View>
            <Button
              title="Salvar turno"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  if (
                    !form.nome?.trim() ||
                    !validTime(form.hora_inicio || "") ||
                    !validTime(form.hora_fim || "") ||
                    !form.dias_semana?.length
                  )
                    throw new Error("Preencha nome, horários e dias do turno.");
                  const payload = {
                    nome: form.nome.trim(),
                    hora_inicio: form.hora_inicio,
                    hora_fim: form.hora_fim,
                    dias_semana: form.dias_semana,
                    capacidade_maxima: number(
                      form.capacidade_maxima,
                      "a capacidade",
                      true,
                    ),
                  };
                  if (payload.capacidade_maxima < 1)
                    throw new Error("A capacidade deve ser maior que zero.");
                  if (form.id) {
                    const r = await supabase
                      .from("turnos_capacidade")
                      .update(payload)
                      .eq("tenant_id", storeId)
                      .eq("id", form.id)
                      .select("id")
                      .single();
                    if (r.error)
                      throw new Error("Não foi possível editar o turno.");
                  } else await request(storeId, path, "POST", payload);
                })
              }
            />
          </View>
          {(draft.turnos || []).map((t: any) => (
            <View key={t.id} style={s.card}>
              <Text style={s.cardTitle}>{t.nome}</Text>
              <Text style={s.subtitle}>
                {t.hora_inicio} às {t.hora_fim} · {t.capacidade_maxima} pedidos
              </Text>
              <Text style={s.subtitle}>
                {(t.dias_semana || []).map((d: number) => week[d]).join(", ")}
              </Text>
              <Button
                title="Editar"
                secondary
                onPress={() =>
                  setForm({
                    ...t,
                    hora_inicio: String(t.hora_inicio).slice(0, 5),
                    hora_fim: String(t.hora_fim).slice(0, 5),
                  })
                }
              />
              <Button
                title="Desativar"
                secondary
                disabled={busy}
                onPress={() => remove(t.id)}
              />
            </View>
          ))}
        </>
      ) : null}
      {draft && mode === "peak" ? (
        <>
          <View style={s.card}>
            {input(
              draft,
              setDraft,
              "tempo_extra_global",
              "Tempo extra global (minutos)",
              true,
            )}
            <Button
              title="Salvar tempo global"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const n = number(
                    draft.tempo_extra_global,
                    "o tempo extra",
                    true,
                  );
                  if (n > 240)
                    throw new Error("O tempo extra máximo é de 240 minutos.");
                  await request(storeId, path, "POST", {
                    tipo: "global",
                    tempo_preparo_extra_minutos: n,
                  });
                })
              }
            />
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Adicionar ou atualizar dia de pico</Text>
            <View style={s.wrap}>
              {days.map(([id, label]) => (
                <Button
                  key={id}
                  title={label}
                  secondary={form.dia_semana !== id}
                  onPress={() => setForm({ ...form, dia_semana: id, data: "" })}
                />
              ))}
            </View>
            {input(
              form,
              (v) => setForm({ ...v, dia_semana: v.data ? "" : v.dia_semana }),
              "data",
              "Ou data específica (AAAA-MM-DD)",
            )}
            {input(form, setForm, "motivo", "Motivo")}
            {input(
              form,
              setForm,
              "tempo_extra_minutos",
              "Minutos extras",
              true,
            )}
            <Button
              title="Salvar dia de pico"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  if (
                    !form.dia_semana &&
                    !/^\d{4}-\d{2}-\d{2}$/.test(form.data || "")
                  )
                    throw new Error("Selecione um dia ou uma data.");
                  const n = number(
                    form.tempo_extra_minutos,
                    "os minutos extras",
                    true,
                  );
                  if (n > 240)
                    throw new Error("O tempo máximo é de 240 minutos.");
                  await request(storeId, path, "POST", {
                    ...form,
                    tipo: form.data ? "especifica" : "recorrente",
                    tempo_extra_minutos: n,
                  });
                })
              }
            />
          </View>
          {[
            ...(draft.dias_pico_recorrentes || []),
            ...(draft.datas_especificas || []),
          ].map((p: any) => (
            <View key={p.id} style={s.card}>
              <Text style={s.cardTitle}>
                {p.dia_semana || p.data} · +{p.tempo_extra_minutos} min
              </Text>
              {p.motivo ? <Text style={s.subtitle}>{p.motivo}</Text> : null}
              <Button
                title="Editar"
                secondary
                onPress={() => setForm({ ...p })}
              />
              <Button
                title="Remover"
                secondary
                disabled={busy}
                onPress={() => remove(p.id)}
              />
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
