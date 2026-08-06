export type AvailabilityStatus = "active" | "out_of_stock" | "hidden";

export type ProductOption = {
  id: string;
  name: string;
  price: number;
  status?: AvailabilityStatus;
  active?: boolean;
  internal_code?: string;
};

export type ProductOptionGroup = {
  id: string;
  kind?: "quantity" | "flavor" | "addon" | "custom";
  name: string;
  required: boolean;
  min: number;
  max: number;
  allow_repeated?: boolean;
  price_calculation?: "sum" | "highest";
  options: ProductOption[];
};

export type ProductImagePosition = { x: number; y: number; zoom: number };

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  badge?: string;
  image: string;
  images?: string[];
  image_positions?: Record<string, ProductImagePosition>;
  sort_order?: number;
  preparation_time?: number;
  option_groups?: ProductOptionGroup[];
  variation_ids?: string[];
  internal_code?: string;
  status?: AvailabilityStatus;
  active?: boolean;
  notes_enabled?: boolean;
  quick_add_enabled?: boolean;
  quick_add_defaults?: Record<string, string>;
};

export type SelectedOption = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
  quantity: number;
};

export const DELIVERY_FEE = 8;
export const products: Product[] = [];

export const isProductVisible = (product: Product) => (product.status || (product.active === false ? "hidden" : "active")) !== "hidden";
export const isProductPurchasable = (product: Product) => (product.status || (product.active === false ? "hidden" : "active")) === "active";
export const isOptionAvailable = (option: ProductOption) => (option.status || (option.active === false ? "hidden" : "active")) === "active";

export const getProductStartingPrice = (product: Product) => {
  const requiredGroups = (product.option_groups || []).filter((group) => group.required && group.min > 0);
  const requiredMinimum = requiredGroups.reduce((sum, group) => {
    const prices = group.options.filter(isOptionAvailable).map((option) => Number(option.price || 0)).sort((a,b)=>a-b);
    return sum + prices.slice(0, Math.max(1, group.min)).reduce((subtotal, value) => subtotal + value, 0);
  }, 0);
  return Number(product.price || 0) + requiredMinimum;
};

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
