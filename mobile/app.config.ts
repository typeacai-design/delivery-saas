export default {
  expo: {
    name: 'We Delivery', slug: 'we-delivery-lojista', version: '0.2.1', orientation: 'portrait',
    scheme: 'wedelivery', userInterfaceStyle: 'light',
    android: { package: 'site.wedelivery.lojista', versionCode: 3, predictiveBackGestureEnabled: true },
    plugins: ['expo-secure-store', 'expo-web-browser', ['expo-image-picker',{photosPermission:'Permita escolher fotos dos produtos.',cameraPermission:false,microphonePermission:false}], ['expo-audio',{microphonePermission:false,enableBackgroundPlayback:false}]],
    ...(process.env.EAS_PROJECT_ID ? { extra: { eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  },
}
