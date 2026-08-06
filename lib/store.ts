import { products as fallbackProducts, type Product } from "@/lib/products";

export type DayHours = { enabled: boolean; open: string; close: string };
export type OpeningHours = Record<"monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday", DayHours>;

export type PaymentOption = { id: string; name: string; active: boolean; delivery: boolean; pickup: boolean; allow_change?: boolean; pix_key?: string; icon?: string; sort_order: number };

export type StoreSettings = {
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  about_button: string;
  catalog_button: string;
  delivery_fee: number;
  whatsapp_number: string;
  payment_methods: string[];
  payment_options: PaymentOption[];
  store_open: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  pickup_address: string;
  pickup_instructions: string;
  opening_hours: OpeningHours;
  closed_message: string;
  feature_1_title: string;
  feature_1_text: string;
  feature_2_title: string;
  feature_2_text: string;
  feature_3_title: string;
  feature_3_text: string;
  offer_badge: string;
  offer_title: string;
  offer_text: string;
  offer_button: string;
  footer_description: string;
  announcement_text: string;
  featured_product_id: string;
  featured_label: string;
  story_title: string;
  story_text: string;
  reviews_enabled: boolean;
  review_1_name: string;
  review_1_text: string;
  review_2_name: string;
  review_2_text: string;
  combo_enabled: boolean;
  combo_title: string;
  combo_text: string;
  combo_price: number;
  combo_product_ids: string[];
  coupon_enabled: boolean;
  coupon_code: string;
  coupon_discount_percent: number;
  show_intro: boolean;
  banner_images?: string[];
  variation_templates?: import("@/lib/products").ProductOptionGroup[];
  quick_purchase_items?: Array<{ id: string; product_id: string; image?: string; image_position?: { x: number; y: number; zoom: number }; status: "active" | "out_of_stock" | "hidden"; sort_order: number }>;
  contact_title: string;
  contact_subtitle: string;
  instagram_handle: string;
  instagram_url: string;
  whatsapp_message: string;
  contact_hours_text: string;
  contact_whatsapp_text: string;
  contact_pickup_text: string;
  pickup_map_enabled: boolean;
  pickup_map_embed_url: string;
  pickup_google_maps_url: string;
  pickup_waze_url: string;
  pickup_apple_maps_url: string;
  pickup_facade_image: string;
  promotion_enabled: boolean;
  promotion_section_title: string;
  promotion_badge: string;
  promotion_title: string;
  promotion_text: string;
  promotion_button: string;
  promotion_link: string;
  promotion_image: string;
  promotion_image_position: { x: number; y: number; zoom: number };
  highlights_enabled: boolean;
  closed_banner_enabled: boolean;
  closed_banner_title: string;
  closed_banner_text: string;
  coupon_minimum_value: number;
  coupon_free_delivery: boolean;
  estimated_time_min: number;
  estimated_time_max: number;
  category_options: string[];
  notifications_enabled: boolean;
  auto_print_enabled: boolean;
  print_format: "58mm" | "80mm" | "a4";
  bi_revenue_goal: number;
  bi_orders_goal: number;
  bi_show_insights: boolean;
  bi_show_revenue_chart: boolean;
  bi_show_orders_chart: boolean;
  bi_show_payments_chart: boolean;
  bi_show_fulfillment_chart: boolean;
  bi_show_peak_chart: boolean;
  bi_show_weekdays_chart: boolean;
  bi_show_products_ranking: boolean;
  bi_show_flavors_ranking: boolean;
  bi_show_customers_ranking: boolean;
};

export const defaultOpeningHours: OpeningHours = {
  monday: { enabled: true, open: "09:00", close: "19:00" },
  tuesday: { enabled: true, open: "09:00", close: "19:00" },
  wednesday: { enabled: true, open: "09:00", close: "19:00" },
  thursday: { enabled: true, open: "09:00", close: "19:00" },
  friday: { enabled: true, open: "09:00", close: "19:00" },
  saturday: { enabled: true, open: "09:00", close: "19:00" },
  sunday: { enabled: false, open: "09:00", close: "19:00" },
};

export const defaultSettings: StoreSettings = {
  hero_badge: "Feita com amor para você",
  hero_title: "Uma explosão de sabor feita para você!",
  hero_subtitle: "Pipocas gourmet artesanais, crocantes e preparadas com ingredientes selecionados para transformar qualquer momento.",
  about_button: "Conheça nossa história",
  catalog_button: "Pedir agora",
  delivery_fee: 8,
  whatsapp_number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5575999906963",
  payment_methods: ["Pix", "Dinheiro", "Cartão", "Cartão de débito", "Cartão de crédito"],
  payment_options: [
    { id: "pix", name: "Pix", active: true, delivery: true, pickup: true, pix_key: "", icon: "pix", sort_order: 1 },
    { id: "dinheiro", name: "Dinheiro", active: true, delivery: true, pickup: true, allow_change: true, icon: "cash", sort_order: 2 },
    { id: "cartao", name: "Cartão", active: true, delivery: true, pickup: true, icon: "card", sort_order: 3 },
    { id: "debito", name: "Cartão de débito", active: true, delivery: true, pickup: true, icon: "card", sort_order: 4 },
    { id: "credito", name: "Cartão de crédito", active: true, delivery: true, pickup: true, icon: "card", sort_order: 5 },
  ],
  store_open: true,
  delivery_enabled: true,
  pickup_enabled: true,
  pickup_address: "",
  pickup_instructions: "Após a confirmação, avisaremos o horário em que seu pedido estará pronto para retirada.",
  opening_hours: defaultOpeningHours,
  closed_message: "Estamos fechados agora, mas você pode voltar no próximo horário de atendimento. ❤️",
  feature_1_title: "Feita com amor",
  feature_1_text: "Produção cuidadosa em cada etapa.",
  feature_2_title: "Embalagem caprichada",
  feature_2_text: "Bonita para presentear e segura para transportar.",
  feature_3_title: "Pedido fácil",
  feature_3_text: "Escolha, adicione ao carrinho e finalize pelo WhatsApp.",
  offer_badge: "Oferta especial",
  offer_title: "Escolha o tamanho ideal para o seu momento.",
  offer_text: "Temos opções preparadas com todo o cuidado da PIPOKÁ.",
  offer_button: "Fazer meu pedido",
  footer_description: "Pipocas gourmet feitas com carinho, ingredientes selecionados e uma verdadeira explosão de sabor.",
  announcement_text: "Delivery e retirada disponíveis · Pedidos pelo WhatsApp",
  featured_product_id: "pipoca-gourmet-1l",
  featured_label: "Destaque PIPOKÁ",
  story_title: "Carinho que dá para sentir em cada detalhe",
  story_text: "Da escolha dos ingredientes ao fechamento da embalagem, cada pedido é preparado com atenção, capricho e muito amor.",
  reviews_enabled: false,
  review_1_name: "Cliente PIPOKÁ",
  review_1_text: "A pipoca é maravilhosa, crocante e muito bem embalada!",
  review_2_name: "Cliente PIPOKÁ",
  review_2_text: "Chegou linda e deliciosa. Dá vontade de pedir de novo!",
  combo_enabled: true,
  combo_title: "Combo Irresistível",
  combo_text: "1 Pipoca Gourmet 1 L + 1 Pipoca Gourmet 500 ml",
  combo_price: 55,
  combo_product_ids: ["pipoca-gourmet-1l", "pipoca-gourmet-500ml"],
  coupon_enabled: false,
  coupon_code: "PIPOKA10",
  coupon_discount_percent: 10,
  show_intro: true,
  variation_templates: [],
  quick_purchase_items: [],
  contact_title: "Contato",
  contact_subtitle: "Fale com a gente",
  instagram_handle: "@pipokagourmet",
  instagram_url: "https://instagram.com/pipokagourmet",
  whatsapp_message: "Olá! Vim pelo site da PIPOKÁ Gourmet.",
  contact_hours_text: "Confira os horários atualizados no site.",
  contact_whatsapp_text: "Fale conosco pelo WhatsApp.",
  contact_pickup_text: "Retirada no endereço informado pela loja.",
  pickup_map_enabled: false,
  pickup_map_embed_url: "",
  pickup_google_maps_url: "",
  pickup_waze_url: "",
  pickup_apple_maps_url: "",
  pickup_facade_image: "",
  promotion_enabled: true,
  promotion_section_title: "Promoções",
  promotion_badge: "COMBO DA SEMANA",
  promotion_title: "Sabores para compartilhar",
  promotion_text: "Escolha sua combinação preferida e aproveite.",
  promotion_button: "Ver oferta",
  promotion_link: "/cardapio",
  promotion_image: "/banners/banner-03.jpeg",
  promotion_image_position: { x: 50, y: 50, zoom: 1 },
  highlights_enabled: true,
  closed_banner_enabled: true,
  closed_banner_title: "Voltaremos em breve",
  closed_banner_text: "Estamos fechados agora. Confira o próximo horário de atendimento.",
  coupon_minimum_value: 0,
  coupon_free_delivery: false,
  estimated_time_min: 30,
  estimated_time_max: 40,
  category_options: ["Pipocas Gourmet"],
  notifications_enabled: true,
  auto_print_enabled: false,
  print_format: "80mm",
  bi_revenue_goal: 0,
  bi_orders_goal: 0,
  bi_show_insights: true,
  bi_show_revenue_chart: true,
  bi_show_orders_chart: true,
  bi_show_payments_chart: true,
  bi_show_fulfillment_chart: true,
  bi_show_peak_chart: true,
  bi_show_weekdays_chart: true,
  bi_show_products_ranking: true,
  bi_show_flavors_ranking: true,
  bi_show_customers_ranking: true,
  banner_images: [
    "/banners/banner-01.jpeg", "/banners/banner-02.jpeg", "/banners/banner-03.jpeg",
    "/banners/banner-04.jpeg", "/banners/banner-05.jpeg", "/banners/banner-06.jpeg"
  ],
};

export const defaultProducts: Product[] = fallbackProducts;
