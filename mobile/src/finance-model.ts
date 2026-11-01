type Row = Record<string, any>;
export function financeSummary(
  orders: Row[],
  expenses: Row[],
  transactions: Row[],
) {
  const paid = orders.filter(
      (o) => o.pago === true && o.status !== "cancelado",
    ),
    unpaid = orders.filter((o) => o.pago !== true && o.status !== "cancelado");
  const represented = new Set(
    transactions
      .filter((t) => ["pedido", "venda"].includes(t.categoria))
      .flatMap((t) => [t.referencia_id, t.descricao]),
  );
  const extra = paid.filter(
    (o) =>
      !represented.has(o.id) &&
      !represented.has(`Pedido #${o.codigo || o.id.slice(0, 8)}`) &&
      !represented.has(`Pedido ${o.codigo || o.id.slice(0, 8)}`),
  );
  return {
    received: paid.reduce((sum, o) => sum + Number(o.valor_total || 0), 0),
    receivable: unpaid.reduce((sum, o) => sum + Number(o.valor_total || 0), 0),
    balance:
      transactions.reduce(
        (sum, t) =>
          sum + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor || 0),
        0,
      ) +
      extra.reduce((sum, o) => sum + Number(o.valor_total || 0), 0) -
      expenses.reduce((sum, e) => sum + Number(e.valor || 0), 0),
    rows: [
      ...transactions.map(
        (t): Row => ({
          ...t,
          amount: (t.tipo === "entrada" ? 1 : -1) * Number(t.valor || 0),
        }),
      ),
      ...extra.map((o) => ({
        id: o.id,
        descricao: `Pedido #${o.codigo || o.id.slice(0, 8)}`,
        data: o.created_at,
        tipo: "entrada",
        amount: Number(o.valor_total || 0),
      })),
      ...expenses.map((e) => ({
        id: e.id,
        descricao: e.nome,
        data: e.created_at,
        tipo: "saida",
        amount: -Number(e.valor || 0),
      })),
    ].sort((a, b) => String(b.data).localeCompare(String(a.data))),
  };
}
