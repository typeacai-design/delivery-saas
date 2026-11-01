import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import { Text, Button, s } from "./ui";
import { m, palette } from "./merchant-layout";
import { chooseRange, formatRange, type DayRange } from "./date-range-model";
export type { DayRange } from "./date-range-model";
export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: DayRange;
  onChange: (value: DayRange) => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(value),
    [month, setMonth] = useState(() => new Date().getMonth()),
    [year, setYear] = useState(() => new Date().getFullYear());
  function move(n: number) {
    const d = new Date(year, month + n, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  }
  const offset = new Date(year, month, 1).getDay(),
    days = new Date(year, month + 1, 0).getDate();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Selecionar período"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          if (!open) setDraft(value);
          setOpen((x) => !x);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: "#dfe7e1",
          backgroundColor: "#fff",
          borderRadius: 13,
          paddingVertical: 9,
          paddingHorizontal: 13,
          minHeight: 56,
        }}
      >
        <CalendarDays size={21} color="#368b49" />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: "600" }}>
          {formatRange(value)}
        </Text>
        <ChevronDown size={15} color={palette.muted} />
      </Pressable>
      {open ? (
        <View
          style={{
            marginTop: 10,
            padding: 13,
            borderWidth: 1,
            borderColor: "#e5ece7",
            borderRadius: 15,
            backgroundColor: "#fff",
            gap: 10,
          }}
        >
          <View style={s.between}>
            <Pressable
              accessibilityLabel="Mês anterior"
              onPress={() => move(-1)}
              style={[m.iconButton, { backgroundColor: "#f7f9f7" }]}
            >
              <ChevronLeft size={18} color="#397346" />
            </Pressable>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                textTransform: "capitalize",
              }}
            >
              {new Date(year, month, 1).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Pressable
              accessibilityLabel="Próximo mês"
              onPress={() => move(1)}
              style={[m.iconButton, { backgroundColor: "#f7f9f7" }]}
            >
              <ChevronRight size={18} color="#397346" />
            </Pressable>
          </View>
          <Text style={[s.subtitle, { fontSize: 12 }]}>
            {!draft.from || draft.to
              ? "Selecione a data inicial"
              : "Agora selecione a data final"}
          </Text>
          <View style={{ flexDirection: "row" }}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((v, i) => (
              <Text
                key={i}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 11,
                  color: "#748178",
                  paddingVertical: 7,
                }}
              >
                {v}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: offset + days }, (_, i) => {
              if (i < offset)
                return <View key={i} style={{ width: "14.2857%" }} />;
              const d = i - offset + 1,
                date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
                selected = date === draft.from || date === draft.to,
                between =
                  !!draft.from &&
                  !!draft.to &&
                  date > draft.from &&
                  date < draft.to;
              return (
                <View key={i} style={{ width: "14.2857%", padding: 1.5 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={new Date(
                      date + "T12:00:00",
                    ).toLocaleDateString("pt-BR")}
                    accessibilityState={{ selected }}
                    onPress={() => setDraft((x) => chooseRange(x, date))}
                    style={{
                      minHeight: 42,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 9,
                      backgroundColor: selected
                        ? palette.green
                        : between
                          ? "#e4f2e8"
                          : "#fff",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: selected ? "#fff" : "#243d2d",
                        fontWeight: selected ? "700" : "400",
                      }}
                    >
                      {d}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Button
                title="Limpar"
                secondary
                onPress={() => {
                  setDraft({ from: "", to: "" });
                  onChange({ from: "", to: "" });
                  setOpen(false);
                }}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Button
                title="Aplicar período"
                disabled={!draft.from}
                onPress={() => {
                  onChange({ from: draft.from, to: draft.to || draft.from });
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
