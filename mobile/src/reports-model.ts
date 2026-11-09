export function reportRows(orders: any[], tab: string) {
  const groups = new Map<
      string,
      { nome: string; qtd: number; total: number }
    >(),
    add = (nome: string, qtd: number, total: number) => {
      const row = groups.get(nome) || { nome, qtd: 0, total: 0 };
      row.qtd += qtd;
      row.total += total;
      groups.set(nome, row);
    };
  for (const o of orders) {
    if (o.status === "cancelado" || o.deleted_at) continue;
    if (tab === "item" || tab === "complemento")
      for (const i of o.pedido_itens || []) {
        if (tab === "item")
          add(
            i.nome,
            Number(i.quantidade),
            Number(i.quantidade) * Number(i.valor_unitario),
          );
        else {
          let extras = i.pedido_complementos?.length
            ? i.pedido_complementos
            : i.complementos;
          if (typeof extras === "string") {
            try {
              extras = JSON.parse(extras);
            } catch {
              extras = [];
            }
          }
          for (const c of Array.isArray(extras) ? extras : [])
            add(
              c.nome,
              Number(c.quantidade || 1) * Number(i.quantidade),
              Number(c.valor ?? c.preco ?? 0) *
                Number(c.quantidade || 1) *
                Number(i.quantidade),
            );
        }
      }
    else if (
      o.pago === true ||
      (o.status === "entregue" &&
        (Array.isArray(o.forma_pagamento)
          ? o.forma_pagamento
          : [o.forma_pagamento]
        ).includes("dinheiro"))
    ) {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(o.data_criacao));
      add(
        tab === "pagamento"
          ? (Array.isArray(o.forma_pagamento)
              ? o.forma_pagamento.join(" + ")
              : o.forma_pagamento) || "Não informado"
          : day,
        1,
        Number(o.valor_total),
      );
    }
  }
  return [...groups.values()]
    .map((r) => ({ ...r, total: Math.round(r.total * 100) / 100 }))
    .sort((a, b) =>
      tab === "periodo" ? a.nome.localeCompare(b.nome) : b.total - a.total,
    );
}
export function csv(rows: { nome: string; qtd: number; total: number }[]) {
  const safe = (value: unknown) => {
    let v = String(value);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replaceAll('"', '""') + '"';
  };
  return (
    "Descrição;Quantidade;Valor\n" +
    rows
      .map((r) =>
        [
          safe(r.nome),
          safe(r.qtd),
          safe(r.total.toFixed(2).replace(".", ",")),
        ].join(";"),
      )
      .join("\n")
  );
}
