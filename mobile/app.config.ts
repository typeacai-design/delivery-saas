export default {
  expo: {
    name: 'We Delivery', slug: 'we-delivery-lojista', version: '0.1.0', orientation: 'portrait',
    scheme: 'wedelivery', userInterfaceStyle: 'light',
    android: { package: 'site.wedelivery.lojista', versionCode: 1, predictiveBackGestureEnabled: true },
    plugins: ['expo-secure-store', 'expo-web-browser'],
    ...(process.env.EAS_PROJECT_ID ? { extra: { eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  },
}
