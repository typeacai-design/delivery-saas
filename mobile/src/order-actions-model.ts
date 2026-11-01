export function discountAmount(value: string, type: 'valor' | 'percentual', order: { valor_total: number | string; valor_desconto?: number | string; valor_subtotal?: number | string }) {
  const n = Number(value.trim().replace(',', '.'));
  const full = Number(order.valor_total) + Number(order.valor_desconto || 0);
  if (!value.trim() || !Number.isFinite(n) || n < 0 || (type === 'percentual' && n > 100)) throw new Error('Informe um desconto válido.');
  const discount = Math.round((type === 'percentual' ? Number(order.valor_subtotal || full) * n / 100 : n) * 100) / 100;
  if (discount > full) throw new Error('O desconto não pode ser maior que o valor do pedido.');
  return discount;
}
export function reviewUrl(token: unknown) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new Error('Não foi possível gerar o link de avaliação.');
  return `https://wedelivery.site/avaliar/${token}`;
}
