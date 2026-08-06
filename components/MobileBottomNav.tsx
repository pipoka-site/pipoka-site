"use client";
import Link from "next/link";
import { Home, Search, ShoppingBag, UserRound } from "lucide-react";
import { useCart } from "./CartProvider";
export default function MobileBottomNav(){const{count}=useCart();return <nav className="mobile-bottom-nav" aria-label="Navegação principal"><Link href="/"><Home/><span>Início</span></Link><Link href="/cardapio"><Search/><span>Buscar</span></Link><Link href="/checkout" className="mobile-cart-nav"><ShoppingBag/><span>Pedidos</span>{count>0&&<b>{count}</b>}</Link><Link href="/conta"><UserRound/><span>Conta</span></Link></nav>}
