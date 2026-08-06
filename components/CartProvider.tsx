"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, SelectedOption } from "@/lib/products";

export type ConfiguredProduct = Product & {
  cartId: string;
  unitPrice: number;
  selectedOptions: SelectedOption[];
  itemNotes?: string;
};

export type CartItem = ConfiguredProduct & { quantity: number };
type CartContextType = {
  items: CartItem[];
  addItem: (product: ConfiguredProduct, quantity?: number) => void;
  removeItem: (cartId: string) => void;
  changeQuantity: (cartId: string, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType | null>(null);

function getItemIdentity(product: Pick<ConfiguredProduct, "id" | "selectedOptions" | "itemNotes">) {
  const optionsSegment = (product.selectedOptions || [])
    .map((option) => `${option.groupId}:${option.optionId}:${option.quantity}`)
    .sort()
    .join("|");
  const notesSegment = (product.itemNotes || "").trim().toLowerCase();
  return `${product.id}::${optionsSegment}::${notesSegment}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pipoka-cart-v2");
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch { localStorage.removeItem("pipoka-cart-v2"); }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("pipoka-cart-v2", JSON.stringify(items));
  }, [items, loaded]);

  const value = useMemo(() => ({
    items,
    addItem: (product: ConfiguredProduct, quantity = 1) => setItems((current) => {
      const safeQuantity = Math.max(1, Number(quantity || 1));
      const identity = getItemIdentity(product);
      const foundIndex = current.findIndex((item) => getItemIdentity(item) === identity);
      if (foundIndex >= 0) {
        return current.map((item, index) => index === foundIndex ? { ...item, quantity: item.quantity + safeQuantity } : item);
      }
      return [...current, { ...product, quantity: safeQuantity, selectedOptions: product.selectedOptions || [], itemNotes: product.itemNotes || "" }];
    }),
    removeItem: (cartId: string) => setItems((current) => current.filter((item) => item.cartId !== cartId)),
    changeQuantity: (cartId: string, quantity: number) => setItems((current) => {
      const numericQuantity = Number(quantity);
      if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        return current.filter((item) => item.cartId !== cartId);
      }
      const safeQuantity = Math.floor(numericQuantity);
      if (safeQuantity <= 0) return current.filter((item) => item.cartId !== cartId);
      return current.map((item) => item.cartId === cartId ? { ...item, quantity: safeQuantity } : item);
    }),
    clear: () => setItems([]),
    total: items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0),
    count: items.reduce((sum, item) => sum + item.quantity, 0),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de CartProvider");
  return context;
}
