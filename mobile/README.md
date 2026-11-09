# We Delivery Android

Aplicativo nativo em React Native + Expo; não utiliza WebView para implementar telas. O navegador do sistema é usado somente para OAuth Google e links externos.

**Versão 0.2.1 de testes, ainda sem paridade completa com o site.** Consulte [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) antes de testar ou publicar.

## Desenvolvimento

```sh
cd mobile
npm ci
cp .env.example .env.local
npm run typecheck
npm test
npm run export:android
```

Use apenas URL e chave publicável do Supabase. Senhas, service role, tokens de gerenciamento e chaves privadas não pertencem ao app. Sessões são armazenadas em fragmentos criptografados no SecureStore. Cada mutação valida o vínculo com a loja e preserva as políticas RLS existentes. Não há chave privilegiada, nova API HTTP nem dependência de publicar o site para executar esta versão.

## APK

Com SDK Android, NDK, CMake e JDK compatíveis instalados, `npx expo prebuild --platform android` e `cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a` geram um APK de testes com bundle embutido. A configuração gerada usa assinatura de desenvolvimento; configure uma chave definitiva antes de distribuição pública. O app exige Android 7+ e esta compilação contém ARM de 32 e 64 bits.

O perfil `preview` de `eas.json` também gera APK; exige conta Expo, projeto EAS e variáveis públicas configuradas no ambiente de build. O app não depende do computador/Metro para executar o APK release.

## Google

Adicione exatamente `wedelivery://auth/callback` nas Redirect URLs de Authentication > URL Configuration do projeto Supabase ativo. O login usa PKCE, troca o código uma vez e não aceita tokens enviados na URL.

## Testes e operação

Os testes mobile incluem banco Postgres isolado (PGlite) com a migração real de pagamento: pagamento + caixa são atômicos, repetição não duplica entrada, falha no caixa desfaz a transição e outro tenant/conta bloqueada/anon não podem agir.

A conexão configurada usa os dados reais do sistema. Testes manuais de alteração devem ser feitos em uma loja de teste. Som contínuo funciona em primeiro plano; push e execução em segundo plano ainda não foram implementados.
