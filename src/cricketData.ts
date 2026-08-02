// src/cricketData.ts

export type CricketPlanId = "10gb" | "unlimited_core" | "unlimited_more";

export interface CricketPlan {
  id: CricketPlanId;
  name: string;
  price: number;
  description: string;
  bestFor: string;
  hotspotGb?: number;
  mexicoCanada?: boolean;
  priority: "standard" | "premium";
}

export const PLANS: CricketPlan[] = [
  {
    id: "10gb",
    name: "10GB Plan",
    price: 40,
    description: "10GB high-speed data, unlimited talk & text.",
    bestFor: "Light users and budget shoppers.",
    priority: "standard"
  },
  {
    id: "unlimited_core",
    name: "Unlimited Core",
    price: 55,
    description: "Unlimited data with 5GB hotspot.",
    bestFor: "Everyday streaming and social media.",
    hotspotGb: 5,
    priority: "standard"
  },
  {
    id: "unlimited_more",
    name: "Unlimited More",
    price: 60,
    description: "Premium unlimited data with 15GB hotspot.",
    bestFor: "Heavy users, travelers, and work-from-phone.",
    hotspotGb: 15,
    mexicoCanada: true,
    priority: "premium"
  }
];

// TODO: Replace these stubs with real coverage and device APIs.
export function checkCoverage(zip: string) {
  return {
    zip,
    quality: "excellent" as const,
    message: "Excellent 5G and LTE coverage in your area."
  };
}

export function checkDeviceCompatibility(imei: string) {
  const lastDigit = Number(imei.slice(-1));
  const compatible = !Number.isNaN(lastDigit) && lastDigit % 2 === 0;

  return {
    imei,
    compatible,
    message: compatible
      ? "Your phone is compatible with Cricket Wireless."
      : "We couldn't confirm compatibility. Please check again or visit a store."
  };
}

export function getPromotions() {
  return [
    {
      id: "switcher-credit",
      title: "$100 Switcher Credit",
      description: "Switch from an eligible carrier and get a $100 bill credit."
    },
    {
      id: "free-phone-port-in",
      title: "Free Phone with Port-In",
      description: "Select devices are free when you bring your number."
    },
    {
      id: "multiline-discount",
      title: "Multi-Line Discount",
      description: "Save more when you add 2+ lines on eligible unlimited plans."
    }
  ];
}
