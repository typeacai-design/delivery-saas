import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Pencil, Plus } from "lucide-react-native";
import { Text, Button, Notice, s } from "./ui";
import { Disclosure, palette } from "./merchant-layout";
import { useRemote } from "./useRemote";
import { entities, rows } from "./entities";
import { money } from "./domain";
export default function ComplementGroups({
  storeId,
  go,
}: {
  storeId: string;
  go: (page: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const load = useCallback(
      async (signal: AbortSignal) => {
        const [lists, addons] = await Promise.all([
          rows(storeId, entities.lists, signal),
          rows(storeId, entities.addons, signal),
        ]);
        return { lists, addons };
      },
      [storeId],
    ),
    state = useRemote(load);
  return (
    <View style={{ gap: 14 }}>
      <View style={s.row}>
        <View style={s.flex}>
          <Button title="Nova lista" icon={Plus} onPress={() => go("lists")} />
        </View>
        <View style={s.flex}>
          <Button
            title="Novo complemento"
            icon={Plus}
            secondary
            onPress={() => go("addons")}
          />
        </View>
      </View>
      {state.loading ? (
        <ActivityIndicator color={palette.green} />
      ) : state.error ? (
        <Notice text={state.error} retry={state.retry} />
      ) : (
        state.data?.lists
          .filter((list) => list.ativo !== false)
          .map((list) => {
            const addons = state.data!.addons.filter(
              (item) => item.categoria_id === list.id,
            );
            return (
              <Disclosure
                key={list.id}
                title={list.nome}
                subtitle={`${addons.length} complemento${addons.length !== 1 ? "s" : ""}`}
                open={!!expanded[list.id]}
                onPress={() =>
                  setExpanded((x) => ({ ...x, [list.id]: !x[list.id] }))
                }
              >
                <Button
                  title="Editar lista"
                  icon={Pencil}
                  secondary
                  onPress={() => go("lists")}
                />
                {addons.map((item) => (
                  <View key={item.id} style={[s.card, { padding: 14 }]}>
                    <Text style={s.cardTitle}>{item.nome}</Text>
                    <Text style={[s.green, { textAlign: "center" }]}>
                      {money(item.preco)}
                    </Text>
                    <Button
                      title="Editar complemento"
                      icon={Pencil}
                      secondary
                      onPress={() => go("addons")}
                    />
                  </View>
                ))}
              </Disclosure>
            );
          })
      )}
    </View>
  );
}
