# Checkpoint de retomada — ajustes de design

Data: 2026-08-12

- Login do lojista restaurado para compartilhar `wedelivery-auth` entre login e dashboard. O redirecionamento indevido para `/login` foi resolvido.
- Último deploy: `dpl_4uaWG9ye65ggaXu6Qdk18q3sxTFW`, alias `https://wedelivery.site`, build 88/88 aprovado.
- Cardápio com três cores HEX editáveis: principal, secundária e destaque. Fundo, textos e botões são calculados automaticamente para manter contraste.
- Faixa de avisos com seletor visual, campo HEX validado e pré-visualização em tempo real.
- WhatsApp como botão circular flutuante, acima do menu inferior, respeitando área segura, com animação discreta e número/mensagem do lojista.
- Etiquetas Aberto/Fechado e Avaliação nas laterais, com centro livre.
- Bordas das imagens/atalhos de categorias, cards de produtos e menu inferior removidas.
- Pop-ups de produto, complementos, observações, carrinho e checkout continuam flutuantes, mas usam fundo branco e superfícies neutras.
- TypeScript e build completos aprovados; cardápio TYPE ACAI validado com HTTP 200.

Próximo ponto: validação visual em celular e desktop do editor HEX, cardápio, modal de produto, checkout, menu inferior e WhatsApp flutuante.
