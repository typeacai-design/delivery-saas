import ComplementGroups from "./ComplementGroups";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  EllipsisVertical,
  Image as ImageIcon,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Wallet,
  Tags,
} from "lucide-react-native";
import { Text, Button, Notice, s } from "./ui";
import {
  PageHeading,
  Segments,
  Disclosure,
  m,
  palette,
} from "./merchant-layout";
import { useRemote } from "./useRemote";
import * as api from "./api";
import { productAction, productOptions, saveProduct } from "./catalog-api";
import { money, type Store } from "./domain";
import ProductEditor from "./ProductEditor";
import EntityScreen from "./EntityScreen";
import SettingsForms from "./SettingsForms";
import { TextInput } from "react-native";
export default function CatalogScreen({
  store,
  pulse,
}: {
  store: Store;
  pulse: number;
}) {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState("products"),
    [page, setPage] = useState<string | null>(null),
    [expanded, setExpanded] = useState<Record<string, boolean>>({}),
    [editor, setEditor] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const load = useCallback(
      (signal: AbortSignal) => api.catalog(store.id, signal),
      [store.id, pulse],
    ),
    state = useRemote(load);
  async function action(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      state.retry();
      setBusy(false);
    }
  }
  const products = state.data?.products || [],
    categories = state.data
      ? [
          ...state.data.categories,
          ...(products.some(
            (p) => !state.data!.categories.some((c) => c.id === p.categoria_id),
          )
            ? [{ id: "other", nome: "Sem seção", ordem: 9999 }]
            : []),
        ]
      : [];
  async function clone(p: any) {
    const options = await productOptions(store.id, p.id);
    await saveProduct(
      store.id,
      {
        ...p,
        nome: `${p.nome} (cópia)`,
        codigo_externo: "",
        ordem: products.length + 1,
      },
      products,
      options,
      options.selected,
      options.recipes,
    );
  }
  async function reorder(p: any, other: any) {
    if (!other) return;
    await productAction(store.id, p.id, { ordem: other.ordem });
    await productAction(store.id, other.id, { ordem: p.ordem });
  }
  if (page)
    return (
      <View style={s.flex}>
        <View style={{ padding: 18 }}>
          <Button
            title="Voltar ao cardápio"
            secondary
            onPress={() => {
              setPage(null);
              state.retry();
            }}
          />
        </View>
        <EntityScreen storeId={store.id} entityId={page} />
      </View>
    );
  return (
    <View style={s.flex}>
      <ScrollView
        style={tab === "design" ? { flexGrow: 0, flexShrink: 0 } : undefined}
        contentContainerStyle={s.content}
      >
        <PageHeading title="Cardápio" subtitle="Gerencie seus produtos" />
        <Segments
          items={[
            { id: "products", label: "Produtos" },
            { id: "design", label: "Design" },
            { id: "addons", label: "Complementos" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "products" ? (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Produtos</Text>
              <View style={[s.row, { gap: 8 }]}>
                <View style={s.flex}>
                  <Button
                    title="Nova seção"
                    icon={Plus}
                    onPress={() => setPage("sections")}
                  />
                </View>
                <View style={s.flex}>
                  <Button
                    title="Novo produto"
                    icon={Plus}
                    onPress={() => setEditor({})}
                  />
                </View>
              </View>
            </View>
            {searchOpen ? (
              <TextInput
                accessibilityLabel="Pesquisar produtos"
                placeholder="Pesquisar produtos"
                style={s.input}
                value={search}
                onChangeText={setSearch}
              />
            ) : null}
            {error ? <Notice text={error} /> : null}
            {state.loading && !state.data ? (
              <ActivityIndicator color={palette.green} />
            ) : state.error ? (
              <Notice text={state.error} retry={state.retry} />
            ) : null}
            {categories.map((category) => {
              const list = products.filter(
                (p) =>
                  (category.id === "other"
                    ? !state.data!.categories.some(
                        (c) => c.id === p.categoria_id,
                      )
                    : p.categoria_id === category.id) &&
                  p.nome.toLowerCase().includes(search.toLowerCase()),
              );
              if (search && !list.length) return null;
              return (
                <Disclosure
                  key={category.id}
                  title={category.nome}
                  bodyStyle={{ paddingHorizontal: 0, paddingVertical: 12 }}
                  subtitle={`${list.length} produto${list.length !== 1 ? "s" : ""} cadastrado${list.length !== 1 ? "s" : ""}`}
                  open={!!expanded[category.id] || !!search}
                  onPress={() =>
                    setExpanded((x) => ({
                      ...x,
                      [category.id]: !x[category.id],
                    }))
                  }
                >
                  <View style={{ alignItems: "center" }}>
                    <Button
                      title="Editar seção"
                      icon={Pencil}
                      secondary
                      onPress={() => setPage("sections")}
                    />
                  </View>
                  {list.map((p: any, i) => (
                    <View
                      key={p.id}
                      style={{
                        padding: 11,
                        borderWidth: 1,
                        borderColor: "#e6ece8",
                        borderRadius: 20,
                        backgroundColor: "#fff",
                        gap: 13,
                        boxShadow: "0px 8px 22px #12301d0a",
                      }}
                    >
                      <View style={[s.row, { gap: 9, alignItems: "center" }]}>
                        {p.imagem_url ? (
                          <Image
                            source={{ uri: p.imagem_url }}
                            style={{
                              width: 76,
                              height: 76,
                              borderRadius: 14,
                              backgroundColor: "#edf3ef",
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 76,
                              height: 76,
                              borderRadius: 14,
                              backgroundColor: "#edf3ef",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ImageIcon size={22} color={palette.muted} />
                          </View>
                        )}
                        <View style={s.flex}>
                          <View style={[s.between, { gap: 3 }]}>
                            <Text
                              style={{
                                fontSize: 15,
                                lineHeight: 20,
                                fontWeight: "700",
                                letterSpacing: -0.3,
                                flex: 1,
                              }}
                            >
                              {p.nome}
                            </Text>
                            <Pressable
                              accessibilityLabel={`Opções de ${p.nome}`}
                              style={{
                                width: 32,
                                minHeight: 36,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onPress={() =>
                                Alert.alert(p.nome, "Escolha uma ação", [
                                  {
                                    text: "Editar",
                                    onPress: () => setEditor(p),
                                  },
                                  {
                                    text: "Duplicar",
                                    onPress: () => void action(() => clone(p)),
                                  },
                                  { text: "Voltar", style: "cancel" },
                                ])
                              }
                            >
                              <EllipsisVertical size={18} />
                            </Pressable>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 4,
                              flexWrap: "wrap",
                              marginTop: 5,
                            }}
                          >
                            {[
                              ["Mesa", p.disponivel_mesa, "#fff5d7", "#966013"],
                              [
                                "Delivery",
                                p.disponivel_delivery,
                                "#e7efff",
                                "#2c58a8",
                              ],
                              [
                                "Retirada",
                                p.disponivel_retirada,
                                "#f2e7fc",
                                "#7c32a8",
                              ],
                            ]
                              .filter((x) => x[1])
                              .map(([name, , bg, color]) => (
                                <Text
                                  key={String(name)}
                                  style={{
                                    fontSize: 10,
                                    paddingVertical: 3,
                                    paddingHorizontal: 5,
                                    borderRadius: 5,
                                    backgroundColor: String(bg),
                                    color: String(color),
                                  }}
                                >
                                  {String(name)}
                                </Text>
                              ))}
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 5,
                              marginTop: 8,
                            }}
                          >
                            {[
                              {
                                title: "Preço",
                                value: money(p.preco),
                                icon: Wallet,
                              },
                              {
                                title: "Ordem",
                                value: String(p.ordem),
                                icon: ListOrdered,
                              },
                              {
                                title: "Pontos",
                                value: String(p.pontos || 0),
                                icon: Star,
                              },
                            ].map(({ title, value, icon: Icon }) => (
                              <View
                                key={title}
                                style={{
                                  flex: title === "Preço" ? 1.5 : 1,
                                  minWidth: 0,
                                  backgroundColor: "#f5f7f6",
                                  borderRadius: 10,
                                  paddingVertical: 8,
                                  paddingHorizontal: 3,
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    gap: 3,
                                    alignItems: "center",
                                  }}
                                >
                                  {width >= 359 ? (
                                    <Icon
                                      size={11}
                                      color={
                                        title === "Pontos"
                                          ? "#e7a912"
                                          : palette.muted
                                      }
                                    />
                                  ) : null}
                                  <Text
                                    style={{
                                      fontSize: 9,
                                      color: palette.muted,
                                    }}
                                  >
                                    {title}
                                  </Text>
                                </View>
                                <Text
                                  adjustsFontSizeToFit
                                  numberOfLines={1}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "700",
                                    color:
                                      title === "Pontos"
                                        ? palette.active
                                        : palette.ink,
                                  }}
                                >
                                  {value}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                      {!p.ativo ? (
                        <Text
                          style={{
                            alignSelf: "flex-start",
                            backgroundColor: "#ffe5e6",
                            color: "#b22d3b",
                            fontSize: 11,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 20,
                          }}
                        >
                          Inativo
                        </Text>
                      ) : null}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "center",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 2,
                          borderTopWidth: 1,
                          borderTopColor: "#edf1ee",
                          paddingTop: 9,
                        }}
                      >
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityState={{
                            checked: p.ativo,
                            disabled: busy,
                          }}
                          accessibilityLabel={`${p.ativo ? "Desativar" : "Ativar"} ${p.nome}`}
                          disabled={busy}
                          onPress={() =>
                            void action(() =>
                              productAction(store.id, p.id, {
                                ativo: !p.ativo,
                              }),
                            )
                          }
                          style={{
                            minHeight: 44,
                            flexDirection: "row",
                            gap: 5,
                            alignItems: "center",
                            marginRight: 4,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 23,
                              padding: 3,
                              borderRadius: 30,
                              backgroundColor: p.ativo
                                ? palette.green
                                : "#d9dfdb",
                            }}
                          >
                            <View
                              style={{
                                width: 17,
                                height: 17,
                                backgroundColor: "#fff",
                                borderRadius: 20,
                                transform: [{ translateX: p.ativo ? 13 : 0 }],
                              }}
                            />
                          </View>
                          <Text style={{ fontSize: 10, color: palette.muted }}>
                            {p.ativo ? "Ativo" : "Inativo"}
                          </Text>
                        </Pressable>
                        <View
                          style={{
                            flexDirection: "row",
                            borderLeftWidth: 1,
                            borderRightWidth: 1,
                            borderColor: "#edf1ee",
                          }}
                        >
                          {[
                            {
                              title: "Editar",
                              icon: Pencil,
                              fn: () => setEditor(p),
                            },
                            {
                              title: "Duplicar",
                              icon: Copy,
                              fn: () => void action(() => clone(p)),
                            },
                            {
                              title: "Excluir",
                              icon: Trash2,
                              fn: () =>
                                Alert.alert("Excluir produto?", p.nome, [
                                  { text: "Voltar", style: "cancel" },
                                  {
                                    text: "Excluir",
                                    style: "destructive",
                                    onPress: () =>
                                      void action(() =>
                                        productAction(store.id, p.id, {
                                          deleted_at: new Date().toISOString(),
                                        }),
                                      ),
                                  },
                                ]),
                            },
                          ].map(({ title, icon: Icon, fn }) => (
                            <Pressable
                              key={title}
                              accessibilityLabel={`${title} ${p.nome}`}
                              disabled={busy}
                              onPress={fn}
                              style={m.iconButton}
                            >
                              <Icon size={18} strokeWidth={1.8} />
                            </Pressable>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 3 }}>
                          {[-1, 1].map((direction) => (
                            <Pressable
                              key={direction}
                              accessibilityLabel={`${direction < 0 ? "Subir" : "Descer"} ${p.nome}`}
                              accessibilityState={{
                                disabled: busy || !list[i + direction],
                              }}
                              disabled={busy || !list[i + direction]}
                              onPress={() =>
                                void action(() =>
                                  reorder(p, list[i + direction]),
                                )
                              }
                              style={[
                                m.iconButton,
                                {
                                  borderRadius: 24,
                                  backgroundColor: "#f5f7f6",
                                  opacity: !list[i + direction] ? 0.35 : 1,
                                },
                              ]}
                            >
                              {direction < 0 ? (
                                <ArrowUp size={18} />
                              ) : (
                                <ArrowDown size={18} />
                              )}
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                </Disclosure>
              );
            })}
          </>
        ) : null}
        {tab === "addons" ? (
          <ComplementGroups storeId={store.id} go={setPage} />
        ) : null}
      </ScrollView>
      {tab === "design" ? (
        <SettingsForms storeId={store.id} mode="design" />
      ) : null}
      {editor && state.data ? (
        <ProductEditor
          storeId={store.id}
          product={editor.id ? editor : undefined}
          categories={state.data.categories}
          products={products}
          close={() => setEditor(null)}
          saved={state.retry}
        />
      ) : null}
    </View>
  );
}
