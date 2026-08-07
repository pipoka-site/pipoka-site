"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  ExternalLink,
  Images,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
  LogOut,
  Package,
  PackagePlus,
  Plus,
  Save,
  Settings,
  Store,
  Truck,
  Clock3,
  Heart,
  Gift,
  Trash2,
  Copy,
  Search,
  Eye,
  CheckCircle2,
  Pencil,
  Link2,
  Bell,
  Volume2,
  VolumeX,
  Printer,
  MessageCircle,
  MapPinned,
  Tv,
  Phone,
  History,
  CreditCard,
  GripVertical,
  ShieldCheck,
  UserPlus,
  UserX,
  RotateCcw,
  Activity,
  ScrollText,
  Users,
  BarChart3,
} from "lucide-react";
import {
  deleteProduct,
  getProducts,
  getSettings,
  getOrders,
  hasSession,
  signOut,
  uploadProductImage,
  upsertProduct,
  upsertSettings,
  updateOrder,
  listAdminUsers,
  addAdminByEmail,
  setAdminActive,
  getAuditLogs,
  type AdminUserRecord,
  type AuditLogRecord,
  getCustomerFlags,
  upsertCustomerFlag,
  type CustomerFlagRecord,
  listCustomerAccounts,
  type CustomerAccountRecord,
  adminUpdateCustomerProfile,
  adminSetCustomerActive,
  adminUpsertCustomerAddress,
} from "@/lib/supabase";
import { defaultSettings, type StoreSettings, type OpeningHours } from "@/lib/store";
import { isStoreCurrentlyOpen, openingDayLabels } from "@/lib/schedule";
import { getProductStartingPrice, type Product, type ProductOption, type ProductOptionGroup } from "@/lib/products";
import { orderStatusLabel, type Order, type OrderStatus } from "@/lib/orders";
import { calculateDashboardMetrics } from "@/lib/adminMetrics";
import { createClientUuid } from "@/lib/clientUuid";
import BusinessIntelligence from "@/components/admin/BusinessIntelligence";
import AdminNotifications from "@/components/admin/AdminNotifications";
import AuditPanel from "@/components/admin/AuditPanel";
import SystemDiagnostics from "@/components/admin/SystemDiagnostics";
import CustomerReviewsPanel from "@/components/admin/CustomerReviewsPanel";

const blankProduct: Product & { active: boolean } = {
  id: "",
  name: "",
  description: "",
  price: 0,
  category: "",
  badge: "",
  image: "",
  images: [],
  active: true,
  status: "active",
  internal_code: "",
  variation_ids: [],
  notes_enabled: true,
  preparation_time: 30,
  option_groups: [],
  quick_add_enabled: false,
  quick_add_defaults: {},
  sort_order: 0,
  image_positions: {},
};

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState<(Product & { active: boolean })[]>([]);
  const [product, setProduct] = useState(blankProduct);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const productFormRef = useRef<HTMLFormElement>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState<"all" | "active" | "hidden">("all");
  const [draftStatus, setDraftStatus] = useState("Rascunho pronto");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  type ActiveSection = "dashboard" | "intelligence" | "products" | "quick-purchase" | "categories" | "reviews" | "orders" | "customers" | "coupons" | "reports" | "promotions" | "contact" | "payments" | "store-texts" | "store-hours" | "store-delivery" | "store-settings" | "administrators" | "audit" | "system";
  const [activeSection, setActiveSection] = useState<ActiveSection>("products");
  const [variationOpen, setVariationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [variationTab, setVariationTab] = useState<"general" | "products">("general");
  const [variationSourceIndex, setVariationSourceIndex] = useState<number | null>(null);
  const [variationDraft, setVariationDraft] = useState<ProductOptionGroup | null>(null);
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [editorTab, setEditorTab] = useState<"info" | "options" | "images">("info");
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [orderToast, setOrderToast] = useState<Order | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all"|"Entrega"|"Retirada">("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [ordersTab, setOrdersTab] = useState<"active"|"deleted">("active");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const ordersInitialized = useRef(false);
  const [expandedCustomerPhone, setExpandedCustomerPhone] = useState<string | null>(null);
  const [customersTab, setCustomersTab] = useState<"active" | "deleted">("active");
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [customerFlags, setCustomerFlags] = useState<CustomerFlagRecord[]>([]);
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccountRecord[]>([]);

  useEffect(() => {
    document.body.classList.add("admin-page-dark");
    return () => document.body.classList.remove("admin-page-dark");
  }, []);

  const activeCount = useMemo(() => products.filter((item) => (item.status || (item.active === false ? "hidden" : "active")) === "active").length, [products]);
  const openNow = isStoreCurrentlyOpen(settings);
  const dashboardMetrics = useMemo(() => calculateDashboardMetrics(orders), [orders]);
  const activeOrders = dashboardMetrics.activeOrders;
  const customerSummaries = useMemo(() => {
    const ordersByCustomer = new Map<string, Order[]>();
    activeOrders.forEach(order => {
      const phoneKey = order.customer_phone.replace(/\D/g, "");
      const key = order.customer_id ? `user:${order.customer_id}` : phoneKey ? `phone:${phoneKey}` : "";
      if (!key) return;
      ordersByCustomer.set(key, [...(ordersByCustomer.get(key) || []), order]);
    });

    const profileKeys = new Set<string>();
    const summaries = customerAccounts.map(account => {
      const phoneDigits = (account.phone || "").replace(/\D/g, "");
      const userKey = `user:${account.user_id}`;
      const phoneKey = phoneDigits ? `phone:${phoneDigits}` : "";
      profileKeys.add(userKey);
      if (phoneKey) profileKeys.add(phoneKey);
      const customerOrders = [...(ordersByCustomer.get(userKey) || []), ...(phoneKey ? ordersByCustomer.get(phoneKey) || [] : [])]
        .filter((order, index, all) => all.findIndex(candidate => candidate.id === order.id) === index);
      return buildCustomerSummary(account.user_id, account.full_name || account.email || "Cliente", account.email, account.phone || "", customerOrders, account.addresses.map(address => `${address.label}: ${address.street}, ${address.number} — ${address.neighborhood}, ${address.city}`), account.created_at || "", account.last_sign_in_at || null);
    });

    for (const [key, customerOrders] of ordersByCustomer.entries()) {
      if (profileKeys.has(key)) continue;
      const sorted = [...customerOrders].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      summaries.push(buildCustomerSummary(null, sorted[0]?.customer_name || "Cliente", "", sorted[0]?.customer_phone || "", customerOrders, [], sorted.at(-1)?.created_at || "", null));
    }
    return summaries.sort((a,b) => new Date(b.lastAt || b.registeredAt || 0).getTime() - new Date(a.lastAt || a.registeredAt || 0).getTime());
  }, [activeOrders, customerAccounts]);

  function buildCustomerSummary(userId: string | null, name: string, email: string, phone: string, customerOrders: Order[], registeredAddresses: string[], registeredAt: string, lastSignInAt: string | null) {
    const sorted = [...customerOrders].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const valid = customerOrders.filter(order => order.status !== "cancelled");
    const total = valid.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const addresses = Array.from(new Set([...registeredAddresses, ...customerOrders.map(order => [order.address, order.neighborhood].filter(Boolean).join(", ")).filter(Boolean)]));
    const payments = Array.from(new Set(customerOrders.map(order => order.payment_method).filter(Boolean)));
    const productCounts = new Map<string, number>();
    const flavorCounts = new Map<string, number>();
    valid.forEach(order => order.items.forEach(item => {
      productCounts.set(item.name, (productCounts.get(item.name) || 0) + Number(item.quantity || 0));
      (item.selected_options || []).forEach(option => { const label = option.optionName?.trim(); if (label) flavorCounts.set(label, (flavorCounts.get(label) || 0) + Number(item.quantity || 0)); });
    }));
    const topProducts = [...productCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
    const topFlavors = [...flavorCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
    const vipLevel = total >= 500 || valid.length >= 15 ? "Ouro" : total >= 250 || valid.length >= 8 ? "Prata" : total >= 100 || valid.length >= 4 ? "Bronze" : null;
    return { userId, phone: phone.replace(/\D/g, ""), displayPhone: phone, email, name, orders: sorted, total, ticket: valid.length ? total / valid.length : 0, addresses, payments, firstAt: sorted.at(-1)?.created_at, lastAt: sorted[0]?.created_at, registeredAt, lastSignInAt, topProducts, topFlavors, vipLevel };
  }
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesDeleted = ordersTab === "deleted" ? Boolean(order.deleted_at) : !order.deleted_at;
    const query = orderSearch.trim().toLowerCase();
    const matchesQuery = !query || order.order_code.toLowerCase().includes(query) || order.customer_name.toLowerCase().includes(query) || order.customer_phone.toLowerCase().includes(query);
    return matchesDeleted && matchesQuery && (orderFilter === "all" || order.status === orderFilter) && (orderTypeFilter === "all" || order.fulfillment === orderTypeFilter) && (paymentFilter === "all" || order.payment_method === paymentFilter);
  }), [orders, orderSearch, orderFilter, orderTypeFilter, paymentFilter, ordersTab]);

  const filteredProducts = useMemo(() => products.filter((item) => {
    const query = productSearch.trim().toLowerCase();
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
    const currentStatus = item.status || (item.active === false ? "hidden" : "active");
    const matchesFilter = productFilter === "all" || (productFilter === "active" ? currentStatus === "active" : currentStatus !== "active");
    return matchesSearch && matchesFilter;
  }).sort((a,b) => Number(a.sort_order ?? 9999) - Number(b.sort_order ?? 9999)), [products, productSearch, productFilter]);

  function scrollToSection(sectionId: string) {
    const editorTabs: Record<string, "info" | "options" | "images"> = {
      "produto-informacoes": "info",
      "produto-opcoes": "options",
      "produto-adicionais": "options",
      "produto-imagens": "images",
    };
    if (editorTabs[sectionId]) {
      setEditorTab(editorTabs[sectionId]);
      setActiveSection(sectionId as ActiveSection);
      setMobileMenuOpen(false);
      window.setTimeout(() => productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setActiveSection(sectionId as ActiveSection);
    setMobileMenuOpen(false);
    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      if (!target) return setMessage("Não encontrei essa área. Atualize a página e tente novamente.");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 20);
  }

  function openNewProduct() {
    setProduct(blankProduct);
    setMessage("");
    setFormErrors([]);
    setEditorTab("info");
    setActiveSection("products");
    setMobileMenuOpen(false);
    window.setTimeout(() => productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openPreview() {
    setPreviewOpen(true);
    setMobileMenuOpen(false);
  }

  function playOrderSound() {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const now = context.currentTime;
      [0, 0.28, 0.56].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = index === 1 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.45, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + 0.24);
      });
      window.setTimeout(() => void context.close(), 1200);
    } catch {}
  }

  async function enableNotifications() {
    setSoundEnabled(true);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setMessage("Aviso sonoro ativado. Mantenha o painel aberto para receber novos pedidos.");
  }

  async function loadOrders(notify = false) {
    try {
      const data = (await getOrders(500)) as Order[];
      const normalized = data.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal || 0),
        delivery_fee: Number(order.delivery_fee || 0),
        discount: Number(order.discount || 0),
        total: Number(order.total || 0),
        items: Array.isArray(order.items) ? order.items : [],
      }));
      if (notify && ordersInitialized.current && settings.notifications_enabled !== false) {
        const incoming = normalized.filter((order) => order.status === "new" && !knownOrderIds.current.has(order.id));
        if (incoming.length) {
          const newest = incoming[0];
          setOrderToast(newest);
          playOrderSound();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`Novo pedido #${newest.order_code}`, {
              body: `${newest.customer_name} · R$ ${newest.total.toFixed(2).replace(".", ",")}`,
              icon: "/logo.jpeg",
            });
          }
          if (settings.auto_print_enabled) window.setTimeout(() => window.print(), 400);
        }
      }
      knownOrderIds.current = new Set(normalized.map((order) => order.id));
      ordersInitialized.current = true;
      setOrders(normalized);
    } catch (error) {
      if (notify) setMessage(`Não foi possível atualizar os pedidos: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  async function changeOrderStatus(order: Order, status: OrderStatus) {
    try {
      await updateOrder(order.id, { status, viewed_at: order.viewed_at || new Date().toISOString() });
      await loadOrders(false);
      setOrderToast((current) => current?.id === order.id ? null : current);
      setMessage(`Pedido #${order.order_code}: ${orderStatusLabel[status]}.`);
    } catch (error) {
      setMessage(`Erro ao atualizar pedido: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  async function loadAdminData() {
    try {
      const [adminData, logData, flagData, accountData] = await Promise.all([listAdminUsers(), getAuditLogs(200), getCustomerFlags(), listCustomerAccounts()]);
      setAdmins(adminData);
      setAuditLogs(logData);
      setCustomerFlags(flagData);
      setCustomerAccounts(accountData);
    } catch (error) {
      setMessage(`Não foi possível carregar a área administrativa: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  async function handleAddAdmin() {
    if (!adminEmail.trim()) return setMessage("Informe o e-mail do novo administrador.");
    setBusy(true);
    try {
      await addAdminByEmail(adminEmail);
      setAdminEmail("");
      await loadAdminData();
      setMessage("Administrador adicionado com sucesso.");
    } catch (error) {
      setMessage(`Não foi possível adicionar: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally { setBusy(false); }
  }

  async function handleAdminStatus(admin: AdminUserRecord, active: boolean) {
    if (!window.confirm(`${active ? "Reativar" : "Desativar"} o acesso de ${admin.email}?`)) return;
    setBusy(true);
    try {
      await setAdminActive(admin.user_id, active);
      await loadAdminData();
      setMessage(active ? "Administrador reativado." : "Administrador desativado.");
    } catch (error) {
      setMessage(`Não foi possível atualizar: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally { setBusy(false); }
  }

  async function editRegisteredCustomer(customer: CustomerAccountRecord) {
    const fullName = window.prompt("Nome completo do cliente:", customer.full_name || "");
    if (fullName === null) return;
    const phone = window.prompt("Celular do cliente:", customer.phone || "");
    if (phone === null) return;
    setBusy(true);
    try {
      await adminUpdateCustomerProfile(customer.user_id, { full_name: fullName, phone });
      await loadAdminData();
      setMessage("Cadastro do cliente atualizado e registrado na auditoria.");
    } catch (error) {
      setMessage(`Não foi possível editar o cliente: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally { setBusy(false); }
  }

  async function toggleRegisteredCustomer(customer: CustomerAccountRecord) {
    const next = !customer.active;
    if (!window.confirm(`${next ? "Reativar" : "Desativar"} a conta de ${customer.full_name || customer.email}?`)) return;
    setBusy(true);
    try {
      await adminSetCustomerActive(customer.user_id, next);
      await loadAdminData();
      setMessage(next ? "Conta reativada." : "Conta desativada. O histórico foi preservado.");
    } catch (error) {
      setMessage(`Não foi possível alterar a conta: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally { setBusy(false); }
  }

  async function editRegisteredAddress(customer: CustomerAccountRecord, address: CustomerAccountRecord["addresses"][number]) {
    const street = window.prompt("Rua ou avenida:", address.street || ""); if (street === null) return;
    const number = window.prompt("Número:", address.number || ""); if (number === null) return;
    const neighborhood = window.prompt("Bairro:", address.neighborhood || ""); if (neighborhood === null) return;
    const city = window.prompt("Cidade:", address.city || ""); if (city === null) return;
    setBusy(true);
    try {
      await adminUpsertCustomerAddress(customer.user_id, { ...address, street, number, neighborhood, city });
      await loadAdminData();
      setMessage("Endereço do cliente atualizado.");
    } catch (error) {
      setMessage(`Não foi possível editar o endereço: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    } finally { setBusy(false); }
  }

  async function updateCustomerFlag(phone: string, field: "deleted" | "favorite" | "blocked", value: boolean) {
    const current = customerFlags.find(item => item.phone === phone) || { phone, deleted: false, favorite: false, blocked: false, updated_at: new Date().toISOString() };
    const next = { ...current, [field]: value };
    try {
      await upsertCustomerFlag({ phone, deleted: next.deleted, favorite: next.favorite, blocked: next.blocked });
      setCustomerFlags(items => [...items.filter(item => item.phone !== phone), next]);
      setMessage(value ? "Cliente atualizado." : "Cliente restaurado.");
    } catch (error) {
      setMessage(`Não foi possível salvar: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  async function load() {
    if (!(await hasSession())) return router.replace("/admin/login");
    const [productData, settingsData] = await Promise.all([getProducts(true), getSettings()]);
    await loadOrders(false);
    await loadAdminData();
    setProducts((productData || []).map((item: Product & { active: boolean }) => ({
      ...item,
      price: Number(item.price),
      images: item.images?.length ? item.images : [item.image].filter(Boolean),
      preparation_time: Number(item.preparation_time || 30),
      option_groups: Array.isArray(item.option_groups) ? item.option_groups : [],
      quick_add_enabled: item.quick_add_enabled !== false,
      quick_add_defaults: item.quick_add_defaults || {},
      image_positions: item.image_positions || {},
      sort_order: Number(item.sort_order || 0),
      status: item.status || (item.active === false ? "hidden" : "active"),
      internal_code: item.internal_code || "",
      variation_ids: item.variation_ids || [],
      notes_enabled: item.notes_enabled !== false,
      active: (item.status || (item.active === false ? "hidden" : "active")) !== "hidden",
    })));
    if (settingsData) setSettings({ ...defaultSettings, ...settingsData, category_options: Array.from(new Set([...(Array.isArray(settingsData.category_options) ? settingsData.category_options : []), ...(productData || []).map((item: Product) => item.category).filter(Boolean)])), payment_options: Array.isArray(settingsData.payment_options) && settingsData.payment_options.length ? settingsData.payment_options : defaultSettings.payment_options, delivery_fee: Number(settingsData.delivery_fee), opening_hours: { ...defaultSettings.opening_hours, ...(settingsData.opening_hours || {}) } });
    setReady(true);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => void loadOrders(true), 4000);
    return () => window.clearInterval(timer);
  }, [ready, soundEnabled, settings.notifications_enabled, settings.auto_print_enabled]);

  useEffect(() => {
    if (!ready || activeSection !== "intelligence") return;
    void loadOrders(false);
    const timer = window.setInterval(() => void loadOrders(false), 4000);
    return () => window.clearInterval(timer);
  }, [ready, activeSection]);

  useEffect(() => {
    if (!ready) return;
    const saved = window.localStorage.getItem("pipoka-admin-product-draft");
    if (saved && !product.id && !product.name) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.name || parsed?.description || parsed?.option_groups?.length) {
          setProduct({ ...blankProduct, ...parsed });
          setDraftStatus("Rascunho recuperado");
        }
      } catch {}
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem("pipoka-admin-product-draft", JSON.stringify(product));
      setDraftStatus(`Salvo automaticamente às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [product, ready]);

  function validateProduct() {
    const errors: string[] = [];
    if (!product.name.trim()) errors.push("Informe o nome do produto.");
        if (!(product.image || product.images?.length)) errors.push("Adicione ao menos uma foto.");
    (product.option_groups || []).forEach((group) => {
      if (!group.name.trim()) errors.push("Todos os grupos precisam de um nome.");
      if (Number(group.max) < Number(group.min)) errors.push(`No grupo ${group.name || "sem nome"}, o máximo não pode ser menor que o mínimo.`);
      const available = group.options.filter((option) => option.active !== false);
      if (group.required && available.length < Math.max(1, Number(group.min))) errors.push(`O grupo ${group.name} precisa ter opções disponíveis suficientes.`);
    });
    setFormErrors(errors);
    return errors.length === 0;
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!validateProduct()) {
      setMessage("Revise os campos indicados antes de salvar.");
      return;
    }
    setBusy(true);
    setMessage("");
    const gallery = (product.images?.length ? product.images : [product.image]).filter(Boolean).slice(0, 10);
    const payload = {
      ...product,
      id: product.id || createClientUuid(),
      price: Number(product.price),
      preparation_time: Math.max(1, Number(product.preparation_time || 30)),
      images: gallery,
      image: gallery[0] || product.image,
      option_groups: (product.option_groups || []).map((group) => ({ ...group, min: Math.max(0, Number(group.min || 0)), max: Math.max(1, Number(group.max || 1)), options: group.options.map((option) => ({ ...option, price: Number(option.price || 0) })) })),
      quick_add_enabled: false,
      quick_add_defaults: {},
      status: product.status || "active",
      active: (product.status || "active") !== "hidden",
      internal_code: product.internal_code || "",
      variation_ids: product.variation_ids || [],
      notes_enabled: product.notes_enabled !== false,
    };
    try {
      await upsertProduct(payload);
      setMessage("Produto salvo com sucesso.");
      window.localStorage.removeItem("pipoka-admin-product-draft");
      setDraftStatus("Produto salvo");
      setFormErrors([]);
      setProduct(blankProduct);
      await load();
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível salvar"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImages(files?: FileList | null) {
    if (!files?.length) return;
    const currentImages = product.images?.length ? product.images : [product.image].filter(Boolean);
    const available = Math.max(0, 10 - currentImages.length);
    if (!available) return setMessage("Você já adicionou o limite de 10 fotos.");

    const selected = Array.from(files).slice(0, available);
    const invalid = selected.find((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024);
    if (invalid) return setMessage("Use somente JPG, PNG ou WebP com até 5 MB por foto.");

    setBusy(true);
    setMessage(`Enviando ${selected.length} foto(s)...`);
    try {
      const uploaded: string[] = [];
      for (const file of selected) uploaded.push(await uploadProductImage(file));
      setProduct((current) => {
        const existing = current.images?.length ? current.images : [current.image].filter(Boolean);
        const images = [...existing, ...uploaded].slice(0, 10);
        return { ...current, images, image: images[0] || current.image };
      });
      setMessage("Fotos enviadas. Escolha a capa, organize e salve o produto.");
    } catch (error) {
      setMessage(`Erro no envio: ${error instanceof Error ? error.message : "não foi possível enviar"}`);
    } finally {
      setBusy(false);
    }
  }

  function removeImage(index: number) {
    setProduct((current) => {
      const images = (current.images?.length ? current.images : [current.image].filter(Boolean)).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, images, image: images[0] || "" };
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setProduct((current) => {
      const images = [...(current.images?.length ? current.images : [current.image].filter(Boolean))];
      const target = index + direction;
      if (target < 0 || target >= images.length) return current;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...current, images, image: images[0] || current.image };
    });
  }

  function makeCover(index: number) {
    setProduct((current) => {
      const images = [...(current.images?.length ? current.images : [current.image].filter(Boolean))];
      const [selected] = images.splice(index, 1);
      images.unshift(selected);
      return { ...current, images, image: selected };
    });
  }

  function updateImagePosition(image: string, changes: Partial<{x:number;y:number;zoom:number}>) {
    setProduct((current) => ({ ...current, image_positions: { ...(current.image_positions || {}), [image]: { x: 50, y: 50, zoom: 1, ...(current.image_positions?.[image] || {}), ...changes } } }));
  }

  async function reorderProduct(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const ordered = [...products].sort((a,b) => Number(a.sort_order ?? 9999) - Number(b.sort_order ?? 9999));
    const from = ordered.findIndex((item) => item.id === draggedId);
    const to = ordered.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from,1); ordered.splice(to,0,moved);
    const next = ordered.map((item,index) => ({...item, sort_order:index + 1}));
    setProducts(next);
    setMessage("Salvando nova ordem...");
    try { await Promise.all(next.map((item) => upsertProduct({...item, sort_order:item.sort_order}))); setMessage("Ordem dos produtos salva."); }
    catch (error) { setMessage(`Erro ao salvar ordem: ${error instanceof Error ? error.message : "tente novamente"}`); await load(); }
  }

  function editProduct(item: Product & { active: boolean }) {
    setProduct({
      ...item,
      price: Number(item.price),
      preparation_time: Number(item.preparation_time || 30),
      images: item.images?.length ? item.images : [item.image].filter(Boolean),
      option_groups: Array.isArray(item.option_groups) ? item.option_groups : [],
      quick_add_enabled: item.quick_add_enabled !== false,
      quick_add_defaults: item.quick_add_defaults || {},
      image_positions: item.image_positions || {},
      sort_order: Number(item.sort_order || 0),
    });
    setMessage(`Editando: ${item.name}`);
    setEditorTab("info");
    window.setTimeout(() => productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function addOptionGroup() {
    addPresetGroup("custom");
  }

  function addPresetGroup(kind: "quantity" | "flavor" | "addon" | "custom") {
    const presets: Record<typeof kind, Omit<ProductOptionGroup, "id">> = {
      quantity: {
        kind: "quantity",
        name: "Escolha a quantidade / tamanho",
        required: true,
        min: 1,
        max: 1,
        allow_repeated: false,
        options: [
          { id: createClientUuid(), name: "500 ml (M)", price: 25, active: true },
          { id: createClientUuid(), name: "1 L (G)", price: 35, active: true },
        ],
      },
      flavor: {
        kind: "flavor",
        name: "Escolha os sabores",
        required: true,
        min: 1,
        max: 1,
        allow_repeated: false,
        options: [
          { id: createClientUuid(), name: "Chocolate branco", price: 0, active: true },
          { id: createClientUuid(), name: "Chocolate ao leite", price: 0, active: true },
          { id: createClientUuid(), name: "Leite Ninho", price: 0, active: true },
          { id: createClientUuid(), name: "Caramelo", price: 0, active: true },
        ],
      },
      addon: {
        kind: "addon",
        name: "Adicionais",
        required: false,
        min: 0,
        max: 2,
        allow_repeated: false,
        options: [],
      },
      custom: {
        kind: "custom",
        name: "Novo grupo",
        required: false,
        min: 0,
        max: 1,
        allow_repeated: false,
        options: [],
      },
    };
    const group: ProductOptionGroup = { id: createClientUuid(), ...presets[kind] };
    const nextIndex = (product.option_groups || []).length;
    setProduct((current) => ({ ...current, option_groups: [...(current.option_groups || []), group] }));
    setEditorTab("options");
    setVariationDraft(JSON.parse(JSON.stringify({ price_calculation: "sum", ...group })));
    setVariationSourceIndex(nextIndex);
    setLinkedProductIds(product.id ? [product.id] : []);
    setVariationTab("general");
    setVariationOpen(true);
  }

  function updateOptionGroup(index: number, changes: Partial<ProductOptionGroup>) {
    setProduct((current) => ({ ...current, option_groups: (current.option_groups || []).map((group, groupIndex) => groupIndex === index ? { ...group, ...changes } : group) }));
  }

  function removeOptionGroup(index: number) {
    setProduct((current) => ({ ...current, option_groups: (current.option_groups || []).filter((_, groupIndex) => groupIndex !== index) }));
  }

  function addGroupOption(groupIndex: number) {
    setProduct((current) => ({ ...current, option_groups: (current.option_groups || []).map((group, index) => index === groupIndex ? { ...group, options: [...group.options, { id: createClientUuid(), name: "Nova opção", price: 0, active: true }] } : group) }));
  }

  function updateGroupOption(groupIndex: number, optionIndex: number, changes: Partial<ProductOption>) {
    setProduct((current) => ({ ...current, option_groups: (current.option_groups || []).map((group, index) => index === groupIndex ? { ...group, options: group.options.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...option, ...changes } : option) } : group) }));
  }

  function removeGroupOption(groupIndex: number, optionIndex: number) {
    setProduct((current) => ({ ...current, option_groups: (current.option_groups || []).map((group, index) => index === groupIndex ? { ...group, options: group.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex) } : group) }));
  }

  function openVariationEditor(group: ProductOptionGroup, groupIndex: number) {
    setVariationDraft(JSON.parse(JSON.stringify({ price_calculation: "sum", ...group })));
    setVariationSourceIndex(groupIndex);
    setLinkedProductIds(products.filter((item) => (item.option_groups || []).some((candidate) => candidate.id === group.id)).map((item) => item.id));
    setVariationTab("general");
    setVariationOpen(true);
  }

  function updateVariationOption(optionIndex: number, changes: Partial<ProductOption>) {
    setVariationDraft((current) => current ? { ...current, options: current.options.map((option, index) => index === optionIndex ? { ...option, ...changes } : option) } : current);
  }

  function addVariationOption() {
    setVariationDraft((current) => current ? { ...current, options: [...current.options, { id: createClientUuid(), name: "Nova opção", price: 0, active: true, internal_code: "" }] } : current);
  }

  function removeVariationOption(optionIndex: number) {
    setVariationDraft((current) => current ? { ...current, options: current.options.filter((_, index) => index !== optionIndex) } : current);
  }

  function toggleLinkedProduct(productId: string) {
    setLinkedProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }

  async function saveVariation() {
    if (!variationDraft || variationSourceIndex === null) return;
    if (!variationDraft.name.trim()) return setMessage("Informe o nome da variação.");
    if (variationDraft.max < variationDraft.min) return setMessage("A quantidade máxima não pode ser menor que a mínima.");
    if (!variationDraft.options.length) return setMessage("Adicione pelo menos uma opção.");
    setBusy(true);
    try {
      setProduct((current) => ({ ...current, option_groups: (current.option_groups || []).map((group, index) => index === variationSourceIndex ? variationDraft : group) }));
      const updates = products.map((item) => {
        const alreadyLinked = (item.option_groups || []).some((group) => group.id === variationDraft.id);
        const shouldLink = linkedProductIds.includes(item.id);
        if (!alreadyLinked && !shouldLink) return null;
        const optionGroups = shouldLink
          ? (alreadyLinked ? (item.option_groups || []).map((group) => group.id === variationDraft.id ? variationDraft : group) : [...(item.option_groups || []), variationDraft])
          : (item.option_groups || []).filter((group) => group.id !== variationDraft.id);
        return { ...item, option_groups: optionGroups };
      }).filter(Boolean) as (Product & { active: boolean })[];
      await Promise.all(updates.map((item) => upsertProduct(item)));
      setProducts((current) => current.map((item) => updates.find((updated) => updated.id === item.id) || item));
      setVariationOpen(false);
      setMessage("Variação salva e sincronizada com os produtos vinculados.");
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível salvar a variação"}`);
    } finally {
      setBusy(false);
    }
  }

  function duplicateProduct(item: Product & { active: boolean }) {
    setProduct({
      ...item,
      id: "",
      name: `${item.name} — cópia`,
      active: false,
      option_groups: (item.option_groups || []).map((group) => ({
        ...group,
        id: createClientUuid(),
        options: group.options.map((option) => ({ ...option, id: createClientUuid() })),
      })),
      quick_add_defaults: {},
    });
    setMessage("Cópia criada como rascunho. Revise e salve para cadastrar.");
    window.setTimeout(() => productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function removeProduct(id: string) {
    if (!confirm("Excluir este produto?")) return;
    setBusy(true);
    try {
      await deleteProduct(id);
      setMessage("Produto excluído.");
      await load();
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível excluir"}`);
    } finally {
      setBusy(false);
    }
  }


  async function saveCategory() {
    const name = categoryDraft.trim();
    if (!name) return setMessage("Informe o nome da categoria.");
    const current = settings.category_options || [];
    const duplicate = current.some(category => category.toLowerCase() === name.toLowerCase() && category !== editingCategory);
    if (duplicate) return setMessage("Já existe uma categoria com esse nome.");
    try {
      let next = editingCategory ? current.map(category => category === editingCategory ? name : category) : [...current, name];
      next = Array.from(new Set(next));
      if (editingCategory && editingCategory !== name) {
        const affected = products.filter(item => item.category === editingCategory);
        await Promise.all(affected.map(item => upsertProduct({...item, category:name})));
      }
      await upsertSettings({id:1, ...settings, category_options:next});
      setSettings(currentSettings => ({...currentSettings, category_options:next}));
      setCategoryDraft(""); setEditingCategory(null);
      await load();
      setMessage(editingCategory ? "Categoria atualizada em todos os produtos." : "Categoria criada.");
    } catch (error) { setMessage(`Erro ao salvar categoria: ${error instanceof Error ? error.message : "tente novamente"}`); }
  }

  async function removeCategory(category: string) {
    const count = products.filter(item => item.category === category).length;
    if (count) return setMessage(`Essa categoria possui ${count} produto(s). Mova-os antes de excluir.`);
    if (!confirm(`Excluir a categoria ${category}?`)) return;
    const next = (settings.category_options || []).filter(item => item !== category);
    await upsertSettings({id:1, ...settings, category_options:next});
    setSettings(current => ({...current, category_options:next}));
    setMessage("Categoria excluída.");
  }

  async function softDeleteOrder(order: Order) {
    if (!confirm(`Mover o pedido #${order.order_code} para Pedidos excluídos?`)) return;
    try { await updateOrder(order.id,{deleted_at:new Date().toISOString(),deleted_by:"Administrador"}); setSelectedOrder(null); await loadOrders(false); setMessage("Pedido movido para excluídos."); }
    catch(error){ setMessage(`Erro ao excluir pedido: ${error instanceof Error ? error.message : "tente novamente"}`); }
  }

  async function restoreOrder(order: Order) {
    try { await updateOrder(order.id,{deleted_at:null,deleted_by:null}); await loadOrders(false); setMessage("Pedido restaurado."); }
    catch(error){ setMessage(`Erro ao restaurar pedido: ${error instanceof Error ? error.message : "tente novamente"}`); }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await upsertSettings({ id: 1, ...settings });
      setMessage("Configurações salvas. As alterações já estão disponíveis no site.");
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível salvar"}`);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    signOut();
    router.replace("/admin/login");
  }

  if (!ready) return <div className="container-pipoka py-20">Carregando painel...</div>;

  function elapsedLabel(createdAt: string) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes/60)}h ${minutes%60}min`;
  }

  async function moveOrder(order: Order, status: OrderStatus) {
    if (order.status === status) return;
    const history = [...(order.status_history || []), { status, at: new Date().toISOString() }];
    await changeOrderStatus(order, status);
    try { await updateOrder(order.id, { status_history: history }); } catch {}
    setSelectedOrder(current => current?.id === order.id ? {...order,status,status_history:history} : current);
  }

  function openCustomerWhatsApp(order: Order) {
    const number = order.customer_phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${order.customer_name}! Sobre o pedido #${order.order_code}:`);
    window.open(`https://wa.me/${number}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  function customerMapUrl(order: Order, provider: "google"|"waze"|"apple") {
    const address = [order.address, order.neighborhood, order.complement].filter(Boolean).join(", ");
    if (provider === "waze") return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
    if (provider === "apple") return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  return (
    <div className="admin-shell admin-shell-v4">
      <aside className={`admin-sidebar admin-sidebar-v4 ${mobileMenuOpen ? "is-mobile-open" : ""}`}>
        <div className="admin-brand-v4">
          <div className="admin-brand-logo"><Image src="/logo.jpeg" alt="PIPOKÁ" fill className="object-cover" /></div>
          <div><strong>PIPOKÁ</strong><span>ADMIN</span></div>
        </div>
        <nav className="admin-menu-v4">
          <button className={activeSection === "dashboard" ? "active" : ""} onClick={() => setActiveSection("dashboard")}><Store size={18}/> Dashboard</button>
          <div className="admin-menu-group open">
            <button className={activeSection === "products" ? "active" : ""} onClick={() => setActiveSection("products")}><Package size={18}/> Produtos <ChevronRight size={15}/></button>
            <div className="admin-submenu-v4">
              <button onClick={() => setActiveSection("products")}>Todos os produtos</button>
              <button onClick={() => { openNewProduct(); setActiveSection("products"); }}>Novo produto</button>
              <button onClick={() => { setActiveSection("products"); setEditorTab("options"); }}>Variações vinculadas</button>
              <button onClick={() => setActiveSection("quick-purchase")}>Compra rápida</button>
            </div>
          </div>
          <button onClick={() => { setActiveSection("products"); setEditorTab("options"); }}><Star size={18}/> Variações</button>
          <button className={activeSection === "categories" ? "active" : ""} onClick={() => setActiveSection("categories")}><PackagePlus size={18}/> Categorias</button>
          <Link href="/admin/banners"><Images size={18}/> Banners</Link>
          <button onClick={() => { setActiveSection("products"); setEditorTab("images"); }}><Images size={18}/> Galeria de imagens</button>
          <button className={activeSection === "reviews" ? "active" : ""} onClick={() => setActiveSection("reviews")}><Star size={18}/> Avaliações</button>
          <button className={activeSection === "orders" ? "active" : ""} onClick={() => setActiveSection("orders")}><BadgeDollarSign size={18}/> Pedidos {activeOrders.filter(order => order.status === "new").length > 0 && <span className="admin-order-badge">{activeOrders.filter(order => order.status === "new").length}</span>}</button>
          <button className={activeSection === "customers" ? "active" : ""} onClick={() => setActiveSection("customers")}><Heart size={18}/> Clientes</button>
          <button className={activeSection === "administrators" ? "active" : ""} onClick={() => setActiveSection("administrators")}><ShieldCheck size={18}/> Administradores</button>
          <button className={activeSection === "audit" ? "active" : ""} onClick={() => setActiveSection("audit")}><ScrollText size={18}/> Auditoria</button>
          <button className={activeSection === "system" ? "active" : ""} onClick={() => setActiveSection("system")}><Activity size={18}/> Sistema</button>
          <button className={activeSection === "coupons" ? "active" : ""} onClick={() => setActiveSection("coupons")}><BadgeDollarSign size={18}/> Cupons</button>
          <button className={activeSection === "reports" ? "active" : ""} onClick={() => setActiveSection("reports")}><BadgeDollarSign size={18}/> Relatórios</button>
          <button className={activeSection === "intelligence" ? "active" : ""} onClick={() => setActiveSection("intelligence")}><BarChart3 size={18}/> Inteligência do Negócio</button>
          <button className={activeSection === "promotions" ? "active" : ""} onClick={() => setActiveSection("promotions")}><Gift size={18}/> Promoções</button>
          <button className={activeSection === "contact" ? "active" : ""} onClick={() => setActiveSection("contact")}><Link2 size={18}/> Contato</button>
          <button className={activeSection === "payments" ? "active" : ""} onClick={() => setActiveSection("payments")}><CreditCard size={18}/> Pagamentos</button>
          <button className={activeSection === "store-texts" ? "active" : ""} onClick={() => setActiveSection("store-texts")}><Pencil size={18}/> Aparência e textos</button>
          <button className={activeSection === "store-hours" ? "active" : ""} onClick={() => setActiveSection("store-hours")}><Clock3 size={18}/> Dias e horários</button>
          <button className={activeSection === "store-delivery" ? "active" : ""} onClick={() => setActiveSection("store-delivery")}><Truck size={18}/> Delivery e retirada</button>
          <button className={activeSection === "store-settings" ? "active" : ""} onClick={() => setActiveSection("store-settings")}><Settings size={18}/> Configurações</button>
        </nav>
        <button className="admin-exit-v4" onClick={logout}><LogOut size={18}/> Sair</button>
      </aside>

      <main className="admin-main-v4">
        <header className="admin-topbar-v4">
          <button className="admin-menu-toggle-v4" onClick={() => setMobileMenuOpen(v => !v)}><Package size={19}/></button>
          <div className="admin-topbar-spacer" />
          <AdminNotifications orders={orders} enabled={settings.notifications_enabled !== false} onOpenOrders={() => setActiveSection("orders")}/>
          <button type="button" className="admin-sound-button" onClick={enableNotifications} title="Ativar avisos sonoros">{soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}<span>{soundEnabled ? "Som ligado" : "Ativar som"}</span></button>
          <Link href="/" target="_blank" className="admin-site-link-v4"><Eye size={17}/> Site</Link>
          <div className="admin-profile-v4"><span>P</span><div><strong>Pipoká Gourmet</strong><small>Administrador</small></div></div>
        </header>

        {message && <div className="admin-message-v4">{message}</div>}

        {activeSection === "dashboard" && <section className="admin-dashboard-v4">
          <div className="admin-kpi-grid-v4">
            <article><small>Total de vendas</small><strong>R$ {activeOrders.filter(order => order.status !== "cancelled").reduce((sum, order) => sum + order.total, 0).toFixed(2).replace(".", ",")}</strong><span>Pedidos registrados no site</span></article>
            <article><small>Pedidos</small><strong>{activeOrders.length}</strong><span>{activeOrders.filter(order => order.status === "new").length} novo(s)</span></article>
            <article><small>Produtos</small><strong>{products.length}</strong><span>{activeCount} ativos</span></article>
            <article><small>Status da loja</small><strong>{openNow ? "Aberta" : "Fechada"}</strong><span>Atualização automática</span></article>
          </div>
          <div className="admin-dashboard-panels-v4">
            <article><h2>Produtos mais vendidos</h2>{(()=>{const counts=new Map<string,{name:string,qty:number,revenue:number}>();activeOrders.filter(o=>o.status!=="cancelled").forEach(o=>o.items.forEach(item=>{const current=counts.get(item.product_id)||{name:item.name,qty:0,revenue:0};current.qty+=item.quantity;current.revenue+=item.unit_price*item.quantity;counts.set(item.product_id,current)}));const top=[...counts.values()].sort((a,b)=>b.qty-a.qty).slice(0,5);return top.length?<div className="dashboard-ranking-v14">{top.map((item,index)=><div key={item.name}><b>{index+1}º</b><span>{item.name}</span><strong>{item.qty} un. · R$ {item.revenue.toFixed(2).replace(".",",")}</strong></div>)}</div>:<p>Os dados aparecerão conforme os pedidos forem registrados.</p>})()}</article>
            <article><h2>Avaliações recentes</h2><p>As avaliações aprovadas aparecerão aqui.</p></article>
          </div>
          <article className="admin-quick-v4 central-store-v3"><h2>Central da Loja</h2><p>Acesse as áreas mais importantes da operação.</p><div><button onClick={() => setActiveSection("orders")}><BadgeDollarSign/>Pedidos</button><button onClick={() => setActiveSection("customers")}><Users/>Clientes</button><button onClick={() => setActiveSection("intelligence")}><BarChart3/>Inteligência</button><button onClick={() => setActiveSection("administrators")}><ShieldCheck/>Administradores</button><button onClick={() => setActiveSection("audit")}><ScrollText/>Auditoria</button><button onClick={() => setActiveSection("system")}><Activity/>Diagnóstico</button><button onClick={() => { openNewProduct(); setActiveSection("products"); }}><Plus/>Novo produto</button><Link href="/admin/banners"><Images/>Banners</Link></div></article>
        </section>}

        {activeSection === "categories" && <section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h1>Categorias</h1><p>Crie, edite e veja quais produtos pertencem a cada categoria.</p></div></div><div className="category-manager-v1"><input className="input-pipoka" placeholder="Nome da categoria" value={categoryDraft} onChange={e=>setCategoryDraft(e.target.value)}/><button className="admin-gold-button" onClick={()=>void saveCategory()}>{editingCategory ? "Salvar alteração" : "+ Nova categoria"}</button>{editingCategory&&<button onClick={()=>{setEditingCategory(null);setCategoryDraft("")}}>Cancelar</button>}</div><div className="admin-module-grid-v5">{(settings.category_options || []).map(category => {const items=products.filter(item=>item.category===category);return <article key={category}><PackagePlus/><div><strong>{category}</strong><span>{items.length} produto(s){items.length ? ` · ${items.map(item=>item.name).join(", ")}` : ""}</span></div><button onClick={()=>{setEditingCategory(category);setCategoryDraft(category)}}><Pencil size={15}/> Editar</button><button onClick={()=>{setProductSearch(category);setActiveSection("products")}}>Ver produtos</button><button onClick={()=>void removeCategory(category)}><Trash2 size={15}/></button></article>})}{!(settings.category_options || []).length&&<div className="admin-empty-v4">Crie a primeira categoria.</div>}</div></section>}

        {activeSection === "reviews" && <><CustomerReviewsPanel/><section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h1>Depoimentos em destaque</h1><p>Edite os depoimentos exibidos na página inicial.</p></div></div><form onSubmit={saveSettings} className="admin-store-form-v4"><label className="admin-check-v4"><input type="checkbox" checked={settings.reviews_enabled} onChange={event => setSettings({...settings,reviews_enabled:event.target.checked})}/> Mostrar avaliações no site</label><label>Nome da avaliação 1<input className="input-pipoka" value={settings.review_1_name} onChange={event => setSettings({...settings,review_1_name:event.target.value})}/></label><label>Mensagem da avaliação 1<textarea className="input-pipoka" rows={3} value={settings.review_1_text} onChange={event => setSettings({...settings,review_1_text:event.target.value})}/></label><label>Nome da avaliação 2<input className="input-pipoka" value={settings.review_2_name} onChange={event => setSettings({...settings,review_2_name:event.target.value})}/></label><label>Mensagem da avaliação 2<textarea className="input-pipoka" rows={3} value={settings.review_2_text} onChange={event => setSettings({...settings,review_2_text:event.target.value})}/></label><button className="admin-gold-button"><Save size={17}/> Salvar avaliações</button></form></section></>}

        {activeSection === "customers" && <section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h1>Clientes</h1><p>Clientes cadastrados aparecem mesmo antes do primeiro pedido. Clique para visualizar dados, histórico e ações.</p></div><div className="orders-tabs-v1"><button className={customersTab==="active"?"active":""} onClick={()=>setCustomersTab("active")}>Ativos</button><button className={customersTab==="deleted"?"active":""} onClick={()=>setCustomersTab("deleted")}>Excluídos ({customerFlags.filter(flag=>flag.deleted).length})</button></div></div><div className="admin-customers-table-v5 customer-cards-v14">{customerSummaries.filter(customer => customersTab === "deleted" ? Boolean(customer.phone && customerFlags.find(flag=>flag.phone===customer.phone)?.deleted) : !customer.phone || !customerFlags.find(flag=>flag.phone===customer.phone)?.deleted).map(customer => {const customerKey=customer.userId||customer.phone||customer.email;const expanded=expandedCustomerPhone===customerKey;const flag=customer.phone?customerFlags.find(item=>item.phone===customer.phone):undefined;const favorite=Boolean(flag?.favorite);const blocked=Boolean(flag?.blocked);return <article key={customerKey} className={expanded?"expanded":""}><button className="customer-card-head-v14" onClick={()=>setExpandedCustomerPhone(expanded?null:customerKey)}><Heart fill={favorite?"currentColor":"none"}/><div><strong>{customer.name}</strong><span>{customer.displayPhone||customer.email||"Cadastro incompleto"}</span></div><em>{customer.orders.length} pedido(s)</em></button>{expanded&&<div className="customer-card-body-v14"><div className="customer-stats-v14"><span><small>Total gasto</small><b>R$ {customer.total.toFixed(2).replace(".",",")}</b></span><span><small>Ticket médio</small><b>R$ {customer.ticket.toFixed(2).replace(".",",")}</b></span><span><small>Cadastro</small><b>{customer.registeredAt?new Date(customer.registeredAt).toLocaleDateString("pt-BR"):"—"}</b></span><span><small>Último acesso</small><b>{customer.lastSignInAt?new Date(customer.lastSignInAt).toLocaleDateString("pt-BR"):"—"}</b></span><span><small>Último pedido</small><b>{customer.lastAt?new Date(customer.lastAt).toLocaleDateString("pt-BR"):"—"}</b></span>{customer.vipLevel&&<span className="customer-vip-v3"><small>Cliente VIP</small><b>{customer.vipLevel}</b></span>}</div><p><b>Status da conta:</b> {customer.userId ? (customerAccounts.find(a=>a.user_id===customer.userId)?.active === false ? "Desativada" : "Ativa") : "Visitante"}</p><p><b>E-mail:</b> {customer.email||"Não informado"}</p><p><b>Telefone:</b> {customer.displayPhone||"Cliente precisa completar o perfil"}</p><p><b>Endereços:</b> {customer.addresses.join(" · ")||"Nenhum endereço cadastrado"}</p>{customer.userId && customerAccounts.find(a=>a.user_id===customer.userId)?.addresses.map(address=><button key={address.id} type="button" className="customer-address-edit-v1" onClick={()=>void editRegisteredAddress(customerAccounts.find(a=>a.user_id===customer.userId)!,address)}>Editar {address.label}: {address.street}, {address.number}</button>)}<p><b>Pagamentos:</b> {customer.payments.join(" · ")||"Ainda sem pedidos"}</p><p><b>Produtos favoritos:</b> {customer.topProducts.length?customer.topProducts.map(([name,qty])=>`${name} (${qty})`).join(" · "):"Ainda sem dados"}</p><p><b>Sabores favoritos:</b> {customer.topFlavors.length?customer.topFlavors.map(([name,qty])=>`${name} (${qty})`).join(" · "):"Ainda sem dados"}</p><div className="customer-history-v14">{customer.orders.slice(0,5).map(order=><button key={order.id} onClick={()=>{setSelectedOrder(order);setActiveSection("orders")}}>#{order.order_code} · {orderStatusLabel[order.status]} · R$ {order.total.toFixed(2).replace(".",",")}</button>)}</div><div className="customer-actions-v14">{customer.userId&&<><button onClick={()=>void editRegisteredCustomer(customerAccounts.find(a=>a.user_id===customer.userId)!)}><Pencil/> Editar cadastro</button><button onClick={()=>void toggleRegisteredCustomer(customerAccounts.find(a=>a.user_id===customer.userId)!)}><UserX/> {customerAccounts.find(a=>a.user_id===customer.userId)?.active===false?"Reativar conta":"Desativar conta"}</button></>}{customer.phone&&<><a href={`https://wa.me/${customer.phone}`} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a><a href={`tel:${customer.phone}`}><Phone/> Ligar</a><button onClick={()=>void updateCustomerFlag(customer.phone,"favorite",!favorite)}><Star/> {favorite?"Remover favorito":"Favoritar"}</button><button onClick={()=>void updateCustomerFlag(customer.phone,"blocked",!blocked)}><UserX/> {blocked?"Desbloquear":"Bloquear"}</button>{customersTab==="active"?<button className="delete-order-v1" onClick={()=>window.confirm("Mover este cliente para excluídos? Os pedidos serão preservados.")&&void updateCustomerFlag(customer.phone,"deleted",true)}><Trash2/> Excluir cliente</button>:<button className="restore-order-v1" onClick={()=>void updateCustomerFlag(customer.phone,"deleted",false)}><RotateCcw/> Restaurar</button>}</>}</div></div>}</article>})}{!customerSummaries.length&&<div className="admin-empty-v4">Nenhum cliente registrado ainda.</div>}</div></section>}

        {activeSection === "administrators" && <section className="admin-simple-module-v5">
          <div className="admin-section-title-v4"><div><h1>Administradores</h1><p>Gerencie quem pode acessar o painel administrativo.</p></div></div>
          <div className="admin-store-form-v4">
            <div className="admin-two-cols-v4"><label>E-mail do novo administrador<input className="input-pipoka" type="email" value={adminEmail} onChange={event=>setAdminEmail(event.target.value)} placeholder="nome@exemplo.com"/></label><button type="button" className="admin-gold-button" disabled={busy} onClick={()=>void handleAddAdmin()}><Plus size={17}/> Adicionar administrador</button></div>
          </div>
          <div className="admin-module-grid-v5">{admins.map(admin=><article key={admin.user_id}><ShieldCheck/><div><strong>{admin.email}</strong><span>{admin.active?"Acesso ativo":"Acesso desativado"} · desde {new Date(admin.created_at).toLocaleDateString("pt-BR")}</span></div><button type="button" disabled={busy} onClick={()=>void handleAdminStatus(admin,!admin.active)}>{admin.active?"Desativar":"Reativar"}</button></article>)}{!admins.length&&<div className="admin-empty-v4">Nenhum administrador foi retornado. Atualize a página ou confira o SQL de segurança.</div>}</div>
        </section>}

        {activeSection === "audit" && <AuditPanel logs={auditLogs} onRefresh={()=>void loadAdminData()}/>}

        {activeSection === "system" && <section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h1>Sistema</h1><p>Diagnóstico rápido das integrações essenciais.</p></div><button type="button" className="admin-secondary-button-v9" onClick={()=>void loadAdminData()}>Atualizar</button></div><SystemDiagnostics ready={ready} settings={settings} orders={orders} products={products}/></section>}

        {activeSection === "coupons" && <section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h1>Cupons</h1><p>Configure um cupom de desconto para o checkout.</p></div></div><form onSubmit={saveSettings} className="admin-store-form-v4"><label className="admin-check-v4"><input type="checkbox" checked={settings.coupon_enabled} onChange={event => setSettings({...settings,coupon_enabled:event.target.checked})}/> Cupom ativo</label><label>Código do cupom<input className="input-pipoka" value={settings.coupon_code} onChange={event => setSettings({...settings,coupon_code:event.target.value.toUpperCase().replace(/\s/g, "")})}/></label><label>Desconto em porcentagem<input className="input-pipoka" type="number" min="0" max="100" value={settings.coupon_discount_percent} onChange={event => setSettings({...settings,coupon_discount_percent:Number(event.target.value)})}/></label><label>Valor mínimo do pedido<input className="input-pipoka" type="number" min="0" step="0.01" value={settings.coupon_minimum_value} onChange={event => setSettings({...settings,coupon_minimum_value:Number(event.target.value)})}/></label><label className="admin-check-v4"><input type="checkbox" checked={settings.coupon_free_delivery} onChange={event=>setSettings({...settings,coupon_free_delivery:event.target.checked})}/> Cupom também oferece entrega grátis</label><button className="admin-gold-button"><Save size={17}/> Salvar cupom</button></form></section>}

        {activeSection === "intelligence" && <BusinessIntelligence orders={orders} settings={settings} busy={busy} onSettingsChange={setSettings} onRefresh={async()=>{await loadOrders(false);}} onSave={async()=>{setBusy(true);try{await upsertSettings({id:1,...settings});setMessage("Configurações do Business Intelligence salvas.");}catch(error){setMessage(`Erro: ${error instanceof Error ? error.message : "não foi possível salvar"}`);}finally{setBusy(false);}}}/>}

        {activeSection === "reports" && (() => {
          const reportOrders = orders.filter(order => !order.deleted_at);
          const revenueOrders = reportOrders.filter(order => order.status !== "cancelled");
          const revenue = revenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
          const averageTicket = revenueOrders.length ? revenue / revenueOrders.length : 0;
          return <section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h1>Relatórios</h1><p>Resumo dos pedidos ativos registrados pelo site.</p></div></div><div className="admin-orders-summary-v5"><article><small>Faturamento</small><strong>R$ {revenue.toFixed(2).replace(".", ",")}</strong></article><article><small>Ticket médio</small><strong>R$ {averageTicket.toFixed(2).replace(".", ",")}</strong></article><article><small>Pedidos</small><strong>{reportOrders.length}</strong></article><article><small>Cancelados</small><strong>{reportOrders.filter(order => order.status === "cancelled").length}</strong></article></div></section>;
        })()}

        {activeSection === "orders" && <section className={`admin-orders-kanban-v10 ${tvMode ? "tv-mode" : ""}`}>
          <div className="orders-v10-header"><div><h1>Gestor de pedidos</h1><p>Acompanhe e gerencie todos os pedidos em tempo real.</p></div><div className="orders-tabs-v1"><button className={ordersTab==="active"?"active":""} onClick={()=>{setOrdersTab("active");setSelectedOrder(null)}}>Pedidos ativos</button><button className={ordersTab==="deleted"?"active":""} onClick={()=>{setOrdersTab("deleted");setSelectedOrder(null)}}>Pedidos excluídos ({orders.filter(order=>order.deleted_at).length})</button></div><div className="orders-v10-header-actions"><button type="button" onClick={()=>setSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2/> : <VolumeX/>} {soundEnabled ? "Som ativado" : "Ativar som"}</button><button type="button" onClick={() => void loadOrders(false)}><Bell/> Atualizar</button><button type="button" onClick={()=>setTvMode(!tvMode)}><Tv/> {tvMode ? "Sair do Modo TV" : "Modo TV"}</button></div></div>
          <div className="orders-v10-metrics"><button onClick={()=>setOrderFilter("all")}><small>Pedidos hoje</small><strong>{dashboardMetrics.todayOrders.length}</strong></button><button onClick={()=>setActiveSection("reports")}><small>Faturamento hoje</small><strong>R$ {dashboardMetrics.revenueToday.toFixed(2).replace(".",",")}</strong></button><button onClick={()=>setActiveSection("reports")}><small>Ticket médio hoje</small><strong>R$ {dashboardMetrics.ticketAverageToday.toFixed(2).replace(".",",")}</strong></button><button onClick={()=>setActiveSection("reports")}><small>Tempo médio real</small><strong>{dashboardMetrics.realAverageMinutes !== null ? `${dashboardMetrics.realAverageMinutes} min` : `${settings.estimated_time_min}–${settings.estimated_time_max} min`}</strong></button><button onClick={()=>setOrderFilter("new")}><small>Pedidos em atraso</small><strong>{dashboardMetrics.delayedToday}</strong></button><button onClick={()=>setOrderTypeFilter("Entrega")}><small>Entregas hoje</small><strong>{dashboardMetrics.deliveriesToday}</strong></button><button onClick={()=>setOrderTypeFilter("Retirada")}><small>Retiradas hoje</small><strong>{dashboardMetrics.pickupsToday}</strong></button></div>
          <div className="orders-v10-toolbar"><label><Search/><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Buscar pedido, cliente ou telefone..."/></label><select value={orderTypeFilter} onChange={e=>setOrderTypeFilter(e.target.value as typeof orderTypeFilter)}><option value="all">Todos os tipos</option><option>Entrega</option><option>Retirada</option></select><select value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}><option value="all">Todos os pagamentos</option>{Array.from(new Set(orders.map(o=>o.payment_method))).map(method=><option key={method}>{method}</option>)}</select><select value={orderFilter} onChange={e=>setOrderFilter(e.target.value as "all"|OrderStatus)}><option value="all">Todos os status</option><option value="new">Pendente</option><option value="approved">Aprovado</option><option value="preparing">Preparando</option><option value="ready">Pronto</option><option value="delivery">Saiu para entrega</option><option value="completed">Finalizado</option><option value="cancelled">Cancelado</option></select></div>
          <div className="orders-v10-workspace"><div className="orders-v10-board">{(["new","approved","preparing","ready","delivery","completed"] as OrderStatus[]).map(status => { const list=filteredOrders.filter(o=>o.status===status); return <section key={status} className={`orders-v10-column col-${status}`} onDragOver={e=>e.preventDefault()} onDrop={()=>{const order=orders.find(o=>o.id===draggedOrderId);if(order)void moveOrder(order,status);setDraggedOrderId(null);}}><header><strong>{orderStatusLabel[status]}</strong><span>{list.length}</span></header><div>{list.map(order=><article key={order.id} draggable onDragStart={()=>setDraggedOrderId(order.id)} onClick={()=>setSelectedOrder(order)} className="orders-v10-card"><div className="orders-v10-card-top"><b>#{order.order_code}</b><time>{new Date(order.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time></div><h3>{order.customer_name}</h3><p>{order.customer_phone}</p><small>{order.fulfillment} • {order.payment_method}</small><footer><span>◷ {elapsedLabel(order.created_at)}</span><strong>R$ {order.total.toFixed(2).replace(".",",")}</strong></footer></article>)}{!list.length&&<p className="orders-v10-empty">Nenhum pedido</p>}</div></section>})}</div>{selectedOrder && <aside className="orders-v10-detail"><button className="detail-close" onClick={()=>setSelectedOrder(null)}><X/></button><h2>Pedido #{selectedOrder.order_code}</h2><div className={`detail-status status-${selectedOrder.status}`}>{orderStatusLabel[selectedOrder.status]} • {elapsedLabel(selectedOrder.created_at)}</div><section><small>Cliente</small><strong>{selectedOrder.customer_name}</strong><p>{selectedOrder.customer_phone}</p></section><section><div className="detail-pills"><span>{selectedOrder.fulfillment}</span><span>{selectedOrder.payment_method}</span></div>{selectedOrder.address&&<><small>Endereço</small><p>{selectedOrder.address}<br/>{selectedOrder.neighborhood}{selectedOrder.complement?` • ${selectedOrder.complement}`:""}</p><div className="detail-map-links"><a href={customerMapUrl(selectedOrder,"google")} target="_blank" rel="noreferrer">Google Maps</a><a href={customerMapUrl(selectedOrder,"waze")} target="_blank" rel="noreferrer">Waze</a><a href={customerMapUrl(selectedOrder,"apple")} target="_blank" rel="noreferrer">Apple Maps</a></div></>}</section><section><small>Itens do pedido</small>{selectedOrder.items.map((item,index)=><div className="detail-item" key={index}><span>{item.quantity}× {item.name}</span><strong>R$ {(item.unit_price*item.quantity).toFixed(2).replace(".",",")}</strong>{item.selected_options?.map(option=><small key={`${option.groupId}-${option.optionId}`}>{option.groupName}: {option.optionName}</small>)}</div>)}</section>{selectedOrder.notes&&<section><small>Observação</small><p>{selectedOrder.notes}</p></section>}<section className="detail-total"><span>Total</span><strong>R$ {selectedOrder.total.toFixed(2).replace(".",",")}</strong></section><div className="detail-actions"><button onClick={()=>void moveOrder(selectedOrder, selectedOrder.status==="new"?"approved":selectedOrder.status==="approved"?"preparing":selectedOrder.status==="preparing"?"ready":selectedOrder.status==="ready"?(selectedOrder.fulfillment==="Entrega"?"delivery":"completed"):"completed")}>Avançar pedido</button><button onClick={()=>openCustomerWhatsApp(selectedOrder)}><MessageCircle/> WhatsApp</button><a href={`tel:${selectedOrder.customer_phone.replace(/\D/g,"")}`}><Phone/> Ligar</a><button onClick={()=>window.print()}><Printer/> Imprimir</button><button onClick={()=>setMessage((selectedOrder.status_history||[]).map(h=>`${new Date(h.at).toLocaleString("pt-BR")} — ${orderStatusLabel[h.status]}`).join("\n")||"Sem histórico registrado.")}><History/> Histórico</button>{!selectedOrder.deleted_at?<button className="delete-order-v1" onClick={()=>void softDeleteOrder(selectedOrder)}><Trash2/> Excluir pedido</button>:<button className="restore-order-v1" onClick={()=>void restoreOrder(selectedOrder)}>Restaurar pedido</button>}</div></aside>}</div><p className="orders-v10-tip"><GripVertical/> Arraste os pedidos entre as colunas para atualizar o status.</p>
        </section>}

        {activeSection === "promotions" && <section className="admin-store-v4"><div className="admin-section-title-v4"><div><h1>Promoções</h1><p>Edite a faixa de promoção e confira o enquadramento antes de salvar.</p></div></div><form onSubmit={saveSettings} className="admin-store-form-v4"><label>Título da seção<input className="input-pipoka" value={settings.promotion_section_title} onChange={event=>setSettings({...settings,promotion_section_title:event.target.value})}/></label><label className="admin-check-v4"><input type="checkbox" checked={settings.promotion_enabled} onChange={event=>setSettings({...settings,promotion_enabled:event.target.checked})}/> Mostrar promoção no site</label><div className="admin-two-cols-v4"><label>Selo<input className="input-pipoka" value={settings.promotion_badge} onChange={event=>setSettings({...settings,promotion_badge:event.target.value})}/></label><label>Título<input className="input-pipoka" value={settings.promotion_title} onChange={event=>setSettings({...settings,promotion_title:event.target.value})}/></label></div><label>Descrição<textarea className="input-pipoka" rows={3} value={settings.promotion_text} onChange={event=>setSettings({...settings,promotion_text:event.target.value})}/></label><div className="admin-two-cols-v4"><label>Texto do botão<input className="input-pipoka" value={settings.promotion_button} onChange={event=>setSettings({...settings,promotion_button:event.target.value})}/></label><label>Link<input className="input-pipoka" value={settings.promotion_link} onChange={event=>setSettings({...settings,promotion_link:event.target.value})}/></label></div><label>Imagem da promoção<input className="input-pipoka" value={settings.promotion_image} onChange={event=>setSettings({...settings,promotion_image:event.target.value})}/></label><div className="admin-promotion-preview-v9"><div className="admin-promotion-copy-v9"><small>{settings.promotion_badge}</small><strong>{settings.promotion_title}</strong><p>{settings.promotion_text}</p><span>{settings.promotion_button}</span></div><div className="admin-promotion-image-v9">{settings.promotion_image && <Image src={settings.promotion_image} alt="Prévia da promoção" fill className="object-cover" style={{objectPosition:`${settings.promotion_image_position?.x ?? 50}% ${settings.promotion_image_position?.y ?? 50}%`,transform:`scale(${settings.promotion_image_position?.zoom ?? 1})`,transformOrigin:`${settings.promotion_image_position?.x ?? 50}% ${settings.promotion_image_position?.y ?? 50}%`}} unoptimized={settings.promotion_image.startsWith("http")}/>}</div></div><div className="admin-image-controls"><label>Horizontal<input type="range" min="0" max="100" value={settings.promotion_image_position?.x ?? 50} onChange={event=>setSettings({...settings,promotion_image_position:{...(settings.promotion_image_position || {x:50,y:50,zoom:1}),x:Number(event.target.value)}})}/></label><label>Vertical<input type="range" min="0" max="100" value={settings.promotion_image_position?.y ?? 50} onChange={event=>setSettings({...settings,promotion_image_position:{...(settings.promotion_image_position || {x:50,y:50,zoom:1}),y:Number(event.target.value)}})}/></label><label>Zoom<input type="range" min="1" max="2" step="0.05" value={settings.promotion_image_position?.zoom ?? 1} onChange={event=>setSettings({...settings,promotion_image_position:{...(settings.promotion_image_position || {x:50,y:50,zoom:1}),zoom:Number(event.target.value)}})}/></label></div><button type="button" className="admin-secondary-button-v9" onClick={()=>setSettings({...settings,promotion_image_position:{x:50,y:50,zoom:1}})}>Restaurar enquadramento</button><button className="admin-gold-button"><Save size={17}/> Salvar promoção</button></form></section>}

        {activeSection === "contact" && <section className="admin-store-v4"><div className="admin-section-title-v4"><div><h1>Contato</h1><p>Edite os cartões e os links que abrem WhatsApp, Instagram e mapa.</p></div></div><form onSubmit={saveSettings} className="admin-store-form-v4"><div className="admin-two-cols-v4"><label>Título<input className="input-pipoka" value={settings.contact_title} onChange={event=>setSettings({...settings,contact_title:event.target.value})}/></label><label>Subtítulo<input className="input-pipoka" value={settings.contact_subtitle} onChange={event=>setSettings({...settings,contact_subtitle:event.target.value})}/></label></div><div className="admin-two-cols-v4"><label>Instagram (nome exibido)<input className="input-pipoka" value={settings.instagram_handle} onChange={event=>setSettings({...settings,instagram_handle:event.target.value})}/></label><label>Link do Instagram<input className="input-pipoka" value={settings.instagram_url} onChange={event=>setSettings({...settings,instagram_url:event.target.value})} placeholder="https://instagram.com/seuperfil"/></label></div><label>Texto do WhatsApp<input className="input-pipoka" value={settings.contact_whatsapp_text} onChange={event=>setSettings({...settings,contact_whatsapp_text:event.target.value})}/></label><label>Mensagem automática do WhatsApp<input className="input-pipoka" value={settings.whatsapp_message} onChange={event=>setSettings({...settings,whatsapp_message:event.target.value})}/></label><label>Texto do horário<input className="input-pipoka" value={settings.contact_hours_text} onChange={event=>setSettings({...settings,contact_hours_text:event.target.value})}/></label><label>Texto da retirada<input className="input-pipoka" value={settings.contact_pickup_text} onChange={event=>setSettings({...settings,contact_pickup_text:event.target.value})}/></label><button className="admin-gold-button"><Save size={17}/> Salvar contato</button></form></section>}


        {activeSection === "payments" && <section className="admin-store-v4"><div className="admin-section-title-v4"><div><h1>Pagamentos</h1><p>Defina as formas disponíveis para entrega e retirada.</p></div><button type="button" className="admin-gold-button" onClick={()=>setSettings({...settings,payment_options:[...(settings.payment_options||[]),{id:createClientUuid(),name:"Nova forma",active:true,delivery:true,pickup:true,sort_order:(settings.payment_options?.length||0)+1}]})}><Plus/> Nova forma</button></div><form onSubmit={saveSettings} className="admin-store-form-v4"><div className="payments-v10-list">{(settings.payment_options||[]).sort((a,b)=>a.sort_order-b.sort_order).map((option,index)=><article key={option.id}><GripVertical/><label>Nome<input className="input-pipoka" value={option.name} onChange={e=>{const list=[...settings.payment_options];list[index]={...option,name:e.target.value};setSettings({...settings,payment_options:list,payment_methods:list.filter(x=>x.active).map(x=>x.name)});}}/></label><label><input type="checkbox" checked={option.active} onChange={e=>{const list=[...settings.payment_options];list[index]={...option,active:e.target.checked};setSettings({...settings,payment_options:list,payment_methods:list.filter(x=>x.active).map(x=>x.name)});}}/> Ativo</label><label><input type="checkbox" checked={option.delivery} onChange={e=>{const list=[...settings.payment_options];list[index]={...option,delivery:e.target.checked};setSettings({...settings,payment_options:list});}}/> Entrega</label><label><input type="checkbox" checked={option.pickup} onChange={e=>{const list=[...settings.payment_options];list[index]={...option,pickup:e.target.checked};setSettings({...settings,payment_options:list});}}/> Retirada</label><label><input type="checkbox" checked={option.allow_change||false} onChange={e=>{const list=[...settings.payment_options];list[index]={...option,allow_change:e.target.checked};setSettings({...settings,payment_options:list});}}/> Permitir troco</label><button type="button" onClick={()=>setSettings({...settings,payment_options:settings.payment_options.filter(item=>item.id!==option.id)})}><Trash2/></button></article>)}</div><button className="admin-gold-button"><Save/> Salvar pagamentos</button></form></section>}
        {activeSection === "store-texts" && <section className="admin-store-v4">
          <div className="admin-section-title-v4"><div><h1>Aparência e textos</h1><p>Edite os textos principais exibidos no site.</p></div></div>
          <form onSubmit={saveSettings} className="admin-store-form-v4">
            <label>Frase de destaque<input className="input-pipoka" value={settings.hero_badge} onChange={event => setSettings({...settings, hero_badge:event.target.value})}/></label>
            <label>Título principal<input className="input-pipoka" value={settings.hero_title} onChange={event => setSettings({...settings, hero_title:event.target.value})}/></label>
            <label>Texto principal<textarea className="input-pipoka" rows={3} value={settings.hero_subtitle} onChange={event => setSettings({...settings, hero_subtitle:event.target.value})}/></label>
            <div className="admin-two-cols-v4"><label>Texto do botão do cardápio<input className="input-pipoka" value={settings.catalog_button} onChange={event => setSettings({...settings, catalog_button:event.target.value})}/></label><label>Texto do botão da história<input className="input-pipoka" value={settings.about_button} onChange={event => setSettings({...settings, about_button:event.target.value})}/></label></div>
            <label>Aviso no topo do site<input className="input-pipoka" value={settings.announcement_text} onChange={event => setSettings({...settings, announcement_text:event.target.value})}/></label>
            <label>Texto do rodapé<textarea className="input-pipoka" rows={3} value={settings.footer_description} onChange={event => setSettings({...settings, footer_description:event.target.value})}/></label>
            <button className="admin-gold-button" disabled={busy}><Save size={17}/> Salvar textos</button>
          </form>
        </section>}

        {activeSection === "store-hours" && <section className="admin-store-v4">
          <div className="admin-section-title-v4"><div><h1>Dias e horários</h1><p>Defina os horários de funcionamento de cada dia.</p></div></div>
          <form onSubmit={saveSettings} className="admin-store-form-v4 admin-hours-form-v5">
            {(Object.keys(openingDayLabels) as (keyof OpeningHours)[]).map(day => <div className="admin-hours-row-v5" key={day}><label className="admin-check-v4"><input type="checkbox" checked={settings.opening_hours[day].enabled} onChange={event => setSettings({...settings, opening_hours:{...settings.opening_hours,[day]:{...settings.opening_hours[day],enabled:event.target.checked}}})}/>{openingDayLabels[day]}</label><input className="input-pipoka" type="time" value={settings.opening_hours[day].open} onChange={event => setSettings({...settings, opening_hours:{...settings.opening_hours,[day]:{...settings.opening_hours[day],open:event.target.value}}})}/><span>às</span><input className="input-pipoka" type="time" value={settings.opening_hours[day].close} onChange={event => setSettings({...settings, opening_hours:{...settings.opening_hours,[day]:{...settings.opening_hours[day],close:event.target.value}}})}/></div>)}
            <label>Mensagem quando a loja estiver fechada<textarea className="input-pipoka" rows={3} value={settings.closed_message} onChange={event => setSettings({...settings,closed_message:event.target.value})}/></label>
            <button className="admin-gold-button" disabled={busy}><Save size={17}/> Salvar horários</button>
          </form>
        </section>}

        {activeSection === "store-delivery" && <section className="admin-store-v4">
          <div className="admin-section-title-v4"><div><h1>Delivery e retirada</h1><p>Configure entrega, retirada e contato.</p></div></div>
          <form onSubmit={saveSettings} className="admin-store-form-v4">
            <div className="admin-two-cols-v4"><label>WhatsApp<input className="input-pipoka" value={settings.whatsapp_number} onChange={event => setSettings({...settings, whatsapp_number:event.target.value.replace(/\D/g, "")})}/></label><label>Taxa de entrega<input className="input-pipoka" type="number" min="0" step="0.01" value={settings.delivery_fee} onChange={event => setSettings({...settings, delivery_fee:Number(event.target.value)})}/></label></div>
            <label>Endereço para retirada<input className="input-pipoka" value={settings.pickup_address} onChange={event => setSettings({...settings, pickup_address:event.target.value})}/></label>
            <label>Orientações da retirada<textarea className="input-pipoka" rows={3} value={settings.pickup_instructions} onChange={event => setSettings({...settings, pickup_instructions:event.target.value})}/></label>
            <label className="admin-check-v4"><input type="checkbox" checked={settings.pickup_map_enabled} onChange={event=>setSettings({...settings,pickup_map_enabled:event.target.checked})}/> Mostrar mapa na retirada</label>
            <label>Link de incorporação do mapa<input className="input-pipoka" value={settings.pickup_map_embed_url} onChange={event=>setSettings({...settings,pickup_map_embed_url:event.target.value})} placeholder="https://www.google.com/maps/embed?..."/></label>
            <div className="admin-two-cols-v4"><label>Link Google Maps<input className="input-pipoka" value={settings.pickup_google_maps_url} onChange={event=>setSettings({...settings,pickup_google_maps_url:event.target.value})}/></label><label>Link Waze<input className="input-pipoka" value={settings.pickup_waze_url} onChange={event=>setSettings({...settings,pickup_waze_url:event.target.value})}/></label></div><label>Link Apple Maps<input className="input-pipoka" value={settings.pickup_apple_maps_url} onChange={event=>setSettings({...settings,pickup_apple_maps_url:event.target.value})} placeholder="https://maps.apple.com/?q=..."/></label>
            <label>Foto da fachada (opcional)<input className="input-pipoka" value={settings.pickup_facade_image} onChange={event=>setSettings({...settings,pickup_facade_image:event.target.value})}/></label>
            {settings.pickup_map_enabled && settings.pickup_map_embed_url && <div className="admin-map-preview-v9"><iframe src={settings.pickup_map_embed_url} title="Prévia do mapa de retirada" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div>}
            <div className="admin-settings-checks-v5"><label><input type="checkbox" checked={settings.delivery_enabled} onChange={event => setSettings({...settings, delivery_enabled:event.target.checked})}/> Entrega ativa</label><label><input type="checkbox" checked={settings.pickup_enabled} onChange={event => setSettings({...settings, pickup_enabled:event.target.checked})}/> Retirada ativa</label></div>
            <button className="admin-gold-button" disabled={busy}><Save size={17}/> Salvar delivery e retirada</button>
          </form>
        </section>}

        {activeSection === "store-settings" && <section className="admin-store-v4">
          <div className="admin-section-title-v4"><div><h1>Configurações</h1><p>Controle geral de funcionamento da loja.</p></div></div>
          <form onSubmit={saveSettings} className="admin-store-form-v4">
            <div className="admin-settings-checks-v5"><label><input type="checkbox" checked={settings.store_open} onChange={event => setSettings({...settings, store_open:event.target.checked})}/> Loja aberta para pedidos</label><label><input type="checkbox" checked={settings.show_intro} onChange={event => setSettings({...settings, show_intro:event.target.checked})}/> Mostrar apresentação inicial</label></div>
            <label>Métodos de pagamento<input className="input-pipoka" value={settings.payment_methods.join(", ")} onChange={event => setSettings({...settings,payment_methods:event.target.value.split(",").map(item=>item.trim()).filter(Boolean)})} placeholder="Pix, Dinheiro, Cartão"/></label><div className="admin-two-cols-v4"><label>Tempo estimado mínimo (min)<input className="input-pipoka" type="number" min="1" max="240" value={settings.estimated_time_min} onChange={event=>setSettings({...settings,estimated_time_min:Math.max(1,Number(event.target.value)||1)})}/></label><label>Tempo estimado máximo (min)<input className="input-pipoka" type="number" min="1" max="240" value={settings.estimated_time_max} onChange={event=>setSettings({...settings,estimated_time_max:Math.max(settings.estimated_time_min,Number(event.target.value)||settings.estimated_time_min)})}/></label></div><p className="admin-help-v12">Esse intervalo aparece para o cliente. O tempo médio real usa somente pedidos concluídos com histórico válido.</p>
            <button className="admin-gold-button" disabled={busy}><Save size={17}/> Salvar configurações</button>
          </form>
        </section>}

        {activeSection === "quick-purchase" && <section className="admin-store-v4"><header><div><h1>Compra rápida</h1><p>Selecione produtos já cadastrados e ajuste somente a apresentação dessa seção.</p></div></header><form onSubmit={saveSettings}><div className="admin-quick-selector-v7"><label>Adicionar produto existente<select className="input-pipoka" defaultValue="" onChange={event=>{const selected=products.find(item=>item.id===event.target.value);if(!selected)return;const existing=(settings.quick_purchase_items||[]).some(item=>item.product_id===selected.id);if(!existing)setSettings({...settings,quick_purchase_items:[...(settings.quick_purchase_items||[]),{id:createClientUuid(),product_id:selected.id,image:selected.image,image_position:{x:50,y:50,zoom:1},status:"active",sort_order:(settings.quick_purchase_items?.length||0)+1}]});event.target.value="";}}><option value="">Escolha um produto...</option>{products.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="admin-quick-items-v7">{(settings.quick_purchase_items||[]).sort((a,b)=>a.sort_order-b.sort_order).map((item,index)=>{const linked=products.find(product=>product.id===item.product_id);if(!linked)return null;const pos=item.image_position||{x:50,y:50,zoom:1};return <article key={item.id}><div className="admin-quick-preview-v7">{(item.image||linked.image)&&<Image src={item.image||linked.image} alt={linked.name} fill className="object-cover" style={{objectPosition:`${pos.x}% ${pos.y}%`,transform:`scale(${pos.zoom})`,transformOrigin:`${pos.x}% ${pos.y}%`}} unoptimized={(item.image||linked.image).startsWith("http")}/>}</div><div><strong>{linked.name}</strong><span>R$ {Number(linked.price).toFixed(2).replace(".",",")}</span><select className="input-pipoka" value={item.status} onChange={event=>{const items=[...(settings.quick_purchase_items||[])];items[index]={...item,status:event.target.value as "active"|"out_of_stock"|"hidden"};setSettings({...settings,quick_purchase_items:items});}}><option value="active">Ativo</option><option value="out_of_stock">Indisponível</option><option value="hidden">Oculto</option></select></div><div className="admin-image-controls"><label>Horizontal<input type="range" min="0" max="100" value={pos.x} onChange={event=>{const items=[...(settings.quick_purchase_items||[])];items[index]={...item,image_position:{...pos,x:Number(event.target.value)}};setSettings({...settings,quick_purchase_items:items});}}/></label><label>Vertical<input type="range" min="0" max="100" value={pos.y} onChange={event=>{const items=[...(settings.quick_purchase_items||[])];items[index]={...item,image_position:{...pos,y:Number(event.target.value)}};setSettings({...settings,quick_purchase_items:items});}}/></label><label>Zoom<input type="range" min="1" max="2" step="0.05" value={pos.zoom} onChange={event=>{const items=[...(settings.quick_purchase_items||[])];items[index]={...item,image_position:{...pos,zoom:Number(event.target.value)}};setSettings({...settings,quick_purchase_items:items});}}/></label></div><button type="button" onClick={()=>setSettings({...settings,quick_purchase_items:(settings.quick_purchase_items||[]).filter(candidate=>candidate.id!==item.id)})}><Trash2/></button></article>})}</div><button className="admin-gold-button" disabled={busy}><Save/> Salvar compra rápida</button></form></section>}

        {activeSection === "products" && <section className="admin-products-layout-v4">
          <div className="admin-products-column-v4">
            <div className="admin-section-title-v4"><div><h1>Produtos</h1><p>Gerencie todos os produtos da sua loja</p></div><button className="admin-gold-button" onClick={openNewProduct}><Plus size={18}/> Novo produto</button></div>
            <div className="admin-products-toolbar-v4">
              <label><Search size={17}/><input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Buscar produtos..."/></label>
              <select value={productFilter} onChange={e => setProductFilter(e.target.value as "all"|"active"|"hidden")}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="hidden">Em falta e ocultos</option></select>
            </div>
            <div className="admin-products-tabs-v4"><button className={productFilter === "all" ? "active" : ""} onClick={() => setProductFilter("all")}>Todos <span>{products.length}</span></button><button className={productFilter === "active" ? "active" : ""} onClick={() => setProductFilter("active")}>Ativos <span>{activeCount}</span></button><button className={productFilter === "hidden" ? "active" : ""} onClick={() => setProductFilter("hidden")}>Em falta / Ocultos</button></div>
            <div className="admin-product-table-v4">
              <div className="admin-product-row-v4 header"><span>Produto</span><span>Categoria</span><span>Preço</span><span>Status</span><span>Ações</span></div>
              {filteredProducts.map(item => { const status = item.status || (item.active === false ? "hidden" : "active"); return <div key={item.id} className="admin-product-row-v4" draggable onDragStart={() => setDraggedProductId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedProductId) void reorderProduct(draggedProductId,item.id); setDraggedProductId(null); }}>
                <div className="admin-product-identity-v4"><span className="admin-drag-handle" title="Arraste para ordenar">⋮⋮</span><div className="admin-product-thumb-v4">{item.image ? <Image src={item.image} alt={item.name} fill className="object-cover" unoptimized={item.image.startsWith("http")}/> : <Package/>}</div><div><strong>{item.name}</strong><small>Código: {item.internal_code || "—"}</small></div></div>
                <span>{item.category}</span><strong>R$ {Number(item.price).toFixed(2).replace(".",",")}</strong><select className={`admin-status-select-v7 ${status}`} value={status} onChange={async (event) => { const nextStatus = event.target.value as "active"|"out_of_stock"|"hidden"; const updated = {...item,status:nextStatus,active:nextStatus !== "hidden"}; setProducts(current => current.map(candidate => candidate.id === item.id ? updated : candidate)); try { await upsertProduct(updated); setMessage(`${item.name}: status atualizado.`); } catch (error) { setMessage(`Erro ao atualizar status: ${error instanceof Error ? error.message : "tente novamente"}`); await load(); } }}><option value="active">Ativo</option><option value="out_of_stock">Indisponível</option><option value="hidden">Oculto</option></select>
                <div className="admin-row-actions-v4"><button onClick={() => editProduct(item)} title="Editar"><Pencil size={16}/></button><button onClick={() => duplicateProduct(item)} title="Duplicar"><Copy size={16}/></button><button onClick={() => removeProduct(item.id)} title="Excluir"><Trash2 size={16}/></button></div>
              </div>})}
              {!filteredProducts.length && <div className="admin-empty-v4">Nenhum produto encontrado.</div>}
            </div>
          </div>

          <form ref={productFormRef} onSubmit={saveProduct} className="admin-product-editor-v4">
            <div className="admin-editor-head-v4"><div><small>Produtos › {product.id ? "Editar produto" : "Novo produto"}</small><h2>{product.id ? "Editar produto" : "Novo produto"}</h2></div><button type="button" onClick={openPreview}><Eye size={17}/></button></div>
            <div className="admin-editor-tabs-v4"><button type="button" className={editorTab === "info" ? "active" : ""} onClick={() => setEditorTab("info")}>Dados do produto</button><button type="button" className={editorTab === "options" ? "active" : ""} onClick={() => setEditorTab("options")}>Variações vinculadas</button><button type="button" className={editorTab === "images" ? "active" : ""} onClick={() => setEditorTab("images")}>Galeria</button></div>

            {formErrors.length > 0 && <div className="admin-errors-v4">{formErrors.map(error => <p key={error}>{error}</p>)}</div>}

            {editorTab === "info" && <div className="admin-editor-section-v4">
              <label>Nome do produto *<input className="input-pipoka" value={product.name} onChange={e => setProduct({...product,name:e.target.value})}/></label>
              <label>Código interno (opcional)<input className="input-pipoka" value={product.internal_code || ""} onChange={e => setProduct({...product,internal_code:e.target.value})} placeholder="PGG-001"/></label>
              <div className="admin-two-cols-v4"><label>Categoria *<select className="input-pipoka" value={product.category} onChange={e=>setProduct({...product,category:e.target.value})}><option value="">Escolha uma categoria...</option>{(settings.category_options || []).map(category=><option key={category} value={category}>{category}</option>)}</select><button type="button" className="category-edit-shortcut" onClick={()=>setActiveSection("categories")}>Gerenciar categorias</button></label><label>Preço *<input className="input-pipoka" type="number" min="0" step="0.01" value={product.price} onChange={e => setProduct({...product,price:Number(e.target.value)})}/></label></div>
              <div className="admin-two-cols-v4"><label>Preparo (min)<input className="input-pipoka" type="number" min="1" value={product.preparation_time || 30} onChange={e => setProduct({...product,preparation_time:Number(e.target.value)})}/></label><label>Status *<select className="input-pipoka" value={product.status || "active"} onChange={e => { const status = e.target.value as "active"|"out_of_stock"|"hidden"; setProduct({...product,status,active:status !== "hidden"}); }}><option value="active">Ativo</option><option value="out_of_stock">Em falta</option><option value="hidden">Oculto</option></select></label></div>
              <label>Descrição (opcional)<textarea className="input-pipoka" rows={4} value={product.description} onChange={e => setProduct({...product,description:e.target.value})}/></label>
              <label className="admin-check-v4"><input type="checkbox" checked={product.notes_enabled !== false} onChange={e => setProduct({...product,notes_enabled:e.target.checked})}/> Permitir observações opcionais</label>
              <div className="admin-cover-v4"><div className="admin-cover-preview-v4">{product.image ? <Image src={product.image} alt="" fill className="object-cover" unoptimized={product.image.startsWith("http")}/> : <Images/>}</div><label className="admin-upload-v4">Alterar foto<input hidden type="file" accept="image/*" onChange={e => handleImages(e.target.files)}/><small>PNG, JPG ou WEBP · Máx. 5MB</small></label></div>
            </div>}

            {editorTab === "options" && <div className="admin-editor-section-v4">
              <div className="admin-linked-title-v4"><div><h3>Variações vinculadas</h3><p>Selecione as variações disponíveis para este produto.</p></div></div>
              <div className="admin-linked-list-v4">{(product.option_groups || []).map((group,index) => <div key={group.id}><button type="button" onClick={() => openVariationEditor(group,index)}><Link2 size={16}/><strong>{group.name}</strong><em>{group.required ? "obrigatória" : "opcional"}</em><span>Mín: {group.min} · Máx: {group.max}</span><Pencil size={15}/></button><button type="button" className="remove" onClick={() => removeOptionGroup(index)}><Trash2 size={15}/></button></div>)}</div>
              <div className="admin-variation-library-v7"><strong>Variações prontas</strong><p>Clique para vincular rapidamente ao produto.</p><div>{(settings.variation_templates || []).map((template) => <button key={template.id} type="button" disabled={(product.option_groups || []).some(group => group.id === template.id)} onClick={() => setProduct(current => ({...current,option_groups:[...(current.option_groups || []),JSON.parse(JSON.stringify(template))]}))}><Plus size={15}/>{template.name}</button>)}</div></div><div className="admin-add-variation-v4"><button type="button" onClick={() => addPresetGroup("flavor")}><Plus size={16}/> Sabores</button><button type="button" onClick={() => addPresetGroup("addon")}><Plus size={16}/> Adicionais</button><button type="button" onClick={() => addPresetGroup("custom")}><Plus size={16}/> Nova variação</button></div>
            </div>}

            {editorTab === "images" && <div className="admin-editor-section-v4">
              <label className="admin-gallery-upload-v4"><Images size={28}/><strong>Adicionar imagens</strong><small>Até 10 fotos por produto</small><input hidden multiple type="file" accept="image/*" onChange={e => handleImages(e.target.files)}/></label>
              <p className="admin-gallery-help">Escolha a capa, ajuste o enquadramento e ordene as fotos. A primeira foto será exibida primeiro no carrossel.</p>
              <div className="admin-gallery-grid-v4 admin-gallery-editor">{(product.images?.length ? product.images : [product.image].filter(Boolean)).map((image,index) => { const pos=product.image_positions?.[image] || {x:50,y:50,zoom:1}; return <div key={`${image}-${index}`} className={index===0?"is-cover":""}><div className="admin-crop-preview">{image && <Image src={image} alt="" fill className="object-cover" style={{objectPosition:`${pos.x}% ${pos.y}%`,transform:`scale(${pos.zoom})`,transformOrigin:`${pos.x}% ${pos.y}%`}} unoptimized={image.startsWith("http")}/>} {index===0 && <span>CAPA</span>}</div><div className="admin-image-controls"><label>Horizontal<input type="range" min="0" max="100" value={pos.x} onChange={e=>updateImagePosition(image,{x:Number(e.target.value)})}/></label><label>Vertical<input type="range" min="0" max="100" value={pos.y} onChange={e=>updateImagePosition(image,{y:Number(e.target.value)})}/></label><label>Zoom<input type="range" min="1" max="2" step="0.05" value={pos.zoom} onChange={e=>updateImagePosition(image,{zoom:Number(e.target.value)})}/></label></div><div className="admin-image-actions"><button type="button" onClick={() => makeCover(index)}>Definir capa</button><button type="button" disabled={index===0} onClick={() => moveImage(index,-1)}>←</button><button type="button" disabled={index===((product.images?.length||1)-1)} onClick={() => moveImage(index,1)}>→</button><button type="button" onClick={() => removeImage(index)}><Trash2 size={14}/></button></div></div>})}</div>
            </div>}

            <label className="admin-internal-notes-v4">Observações internas (opcional)<textarea className="input-pipoka" rows={3} placeholder="Informações internas sobre o produto..."/></label>
            <footer className="admin-editor-footer-v4"><button type="button" onClick={() => setProduct(blankProduct)}>Cancelar</button><button className="admin-gold-button" disabled={busy}><Save size={17}/> Salvar produto</button></footer>
          </form>
        </section>}
      </main>

      {orderToast && <div className="admin-order-toast-v5"><button type="button" className="close" onClick={() => setOrderToast(null)}><X size={18}/></button><div className="icon"><Bell size={24}/></div><div><span>Novo pedido</span><h3>{orderToast.customer_name} · #{orderToast.order_code}</h3><p>{orderToast.items.map(item => `${item.quantity}× ${item.name}`).join(" · ")}</p><strong>R$ {orderToast.total.toFixed(2).replace(".", ",")}</strong><button type="button" onClick={() => { setActiveSection("orders"); setOrderToast(null); }}>Ver pedido</button></div></div>}

      {previewOpen && <div className="admin-preview-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><div className="admin-preview-modal"><header><div><span>Pré-visualização</span><h2>{product.name || "Produto"}</h2></div><button onClick={() => setPreviewOpen(false)}><X/></button></header><div className="admin-preview-card-live"><div className="admin-preview-card-image">{product.image ? <Image src={product.image} alt="" fill className="object-cover" unoptimized={product.image.startsWith("http")}/> : <Package/>}</div><div className="admin-preview-card-body"><small>{product.category}</small><h3>{product.name || "Nome do produto"}</h3><p>{product.description}</p><strong>R$ {getProductStartingPrice(product).toFixed(2).replace(".",",")}</strong></div></div></div></div>}

      {variationOpen && variationDraft && <div className="variation-modal-backdrop"><div className="variation-modal"><header className="variation-modal-header"><div><span>Editar variação</span><h2>{variationDraft.name}</h2></div><button type="button" onClick={() => setVariationOpen(false)}><X/></button></header><nav className="variation-modal-tabs"><button type="button" className={variationTab === "general" ? "active" : ""} onClick={() => setVariationTab("general")}>Geral</button><button type="button" className={variationTab === "products" ? "active" : ""} onClick={() => setVariationTab("products")}>Produtos</button></nav><div className="variation-modal-body">{variationTab === "general" ? <><div className="variation-general-grid"><label>Nome<input value={variationDraft.name} onChange={e => setVariationDraft({...variationDraft,name:e.target.value})}/></label><label>Mínimo<input type="number" min="0" value={variationDraft.min} onChange={e => setVariationDraft({...variationDraft,min:Number(e.target.value)})}/></label><label>Máximo<input type="number" min="1" value={variationDraft.max} onChange={e => setVariationDraft({...variationDraft,max:Number(e.target.value)})}/></label></div><div className="variation-options-list">{variationDraft.options.map((option,index) => <div className="variation-option-row" key={option.id}><label>Opção<input value={option.name} onChange={e => updateVariationOption(index,{name:e.target.value})}/></label><label>Preço<input type="number" step="0.01" value={option.price} onChange={e => updateVariationOption(index,{price:Number(e.target.value)})}/></label><label>Código<input value={option.internal_code || ""} onChange={e => updateVariationOption(index,{internal_code:e.target.value})}/></label><button type="button" className={`variation-switch ${option.active !== false ? "on" : ""}`} onClick={() => updateVariationOption(index,{active:option.active === false})}><span/></button><button type="button" onClick={() => removeVariationOption(index)}><Trash2/></button></div>)}</div><button type="button" className="variation-add-option" onClick={addVariationOption}><Plus/> Nova opção</button></> : <div className="variation-products-list">{products.map(item => <button type="button" key={item.id} className={linkedProductIds.includes(item.id) ? "linked" : ""} onClick={() => toggleLinkedProduct(item.id)}><span>{item.name}</span><strong>{linkedProductIds.includes(item.id) ? "Desvincular" : "Vincular"}</strong></button>)}</div>}</div><footer className="variation-modal-footer"><button type="button" onClick={() => setVariationOpen(false)}>Cancelar</button><button type="button" className="admin-gold-button" onClick={saveVariation}><Save/> Salvar variação</button></footer></div></div>}
    </div>
  );
}



