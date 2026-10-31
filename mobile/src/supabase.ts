import 'react-native-url-polyfill/auto'
import { createClient, processLock } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { createSessionStorage } from './secure-storage'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export const configured = Boolean(url && key)
export const supabase = createClient(url || 'https://invalid.supabase.co', key || 'not-configured', {
  auth: { storage: createSessionStorage(SecureStore, Crypto.randomUUID), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', lock: processLock },
})
