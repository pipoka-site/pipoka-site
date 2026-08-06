"use client";
import { useCallback,useEffect,useState } from "react";
import { getProducts,getSettings,isSupabaseConfigured } from "@/lib/supabase";
import { defaultProducts,defaultSettings,type StoreSettings } from "@/lib/store";
import type { Product } from "@/lib/products";
export function useStoreData(){const[products,setProducts]=useState<Product[]>(defaultProducts);const[settings,setSettings]=useState<StoreSettings>(defaultSettings);const[loading,setLoading]=useState(isSupabaseConfigured);const refresh=useCallback(async()=>{if(!isSupabaseConfigured)return setLoading(false);setLoading(true);try{const[p,s]=await Promise.all([getProducts(),getSettings()]);if(p?.length)setProducts(p.map(({active:_active,...item}:any)=>({...item,price:Number(item.price)})));if(s)setSettings({...defaultSettings,...s,delivery_fee:Number(s.delivery_fee),opening_hours:{...defaultSettings.opening_hours,...(s.opening_hours||{})}});}finally{setLoading(false)}},[]);useEffect(()=>{refresh()},[refresh]);return{products,settings,loading,refresh}}
