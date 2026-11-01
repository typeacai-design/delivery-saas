export default {
  expo: {
    name: 'We Delivery', slug: 'we-delivery-lojista', version: '0.3.3', orientation: 'portrait',
    icon: './assets/app-icon-rounded.png',
    scheme: 'wedelivery', userInterfaceStyle: 'light',
    android: { package: 'site.wedelivery.lojista', versionCode: 8, predictiveBackGestureEnabled: true },
    plugins: [ ['expo-font',{android:{fonts:[{fontFamily:'Inter',fontDefinitions:[{path:'./node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',weight:400},{path:'./node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf',weight:600},{path:'./node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',weight:700},{path:'./node_modules/@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf',weight:800}]}]}}],'expo-secure-store', 'expo-web-browser', ['expo-image-picker',{photosPermission:'Permita escolher fotos dos produtos.',cameraPermission:false,microphonePermission:false}], ['expo-audio',{microphonePermission:false,enableBackgroundPlayback:false}]],
    ...(process.env.EAS_PROJECT_ID ? { extra: { eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  },
}

