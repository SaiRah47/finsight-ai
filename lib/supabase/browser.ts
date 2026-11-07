'use client';
import {createBrowserClient} from '@supabase/ssr';
import type {SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|null=null;
export function browserDb():SupabaseClient|null {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 return client??(client=createBrowserClient(url,key));
}