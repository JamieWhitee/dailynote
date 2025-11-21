/**
 * Supabase Client - Browser Side
 * 
 * Purpose:
 * - Create Supabase client for use in Client Components
 * - Handle browser-side authentication
 * - Manage real-time subscriptions
 * 
 * Used in:
 * - Client Components (use client)
 * - Real-time data subscriptions
 * - User authentication flows
 */

import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
 return createBrowserClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL!,
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 )
}