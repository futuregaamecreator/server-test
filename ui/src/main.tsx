import "./main.css"; // MUST be first (per Apps SDK UI docs) 

if (!(window as any).openai) {
  (window as any).openai = {
    maxHeight: 260,
    toolOutput: {
      structuredContent: {
        view: "home",
        recommendedPlanId: "unlimited_more",
        plans: [
          {
            id: "10gb",
            name: "10GB Plan",
            price: 40,
            description: "10GB high-speed data + unlimited talk & text.",
            bestFor: "Light users and budget shoppers."
          },
          {
            id: "unlimited_core",
            name: "Unlimited Core",
            price: 55,
            description: "Unlimited data + hotspot included.",
            bestFor: "Most customers and everyday streaming."
          },
          {
            id: "unlimited_more",
            name: "Unlimited More",
            price: 60,
            description: "Premium unlimited + more hotspot for power users.",
            bestFor: "Travel, hotspot, and heavy data use."
          }
        ]
      }
    },
    globals: { toolOutput: null },
   callTool: async (name: string, args: any) => {
  console.log("[LOCAL callTool]", name, args);

  // Helper: emit the event your React widget listens to
  const notify = () => window.dispatchEvent(new Event("openai:set_globals"));

  if (name === "cricket_view_plans") {
    const current = (window as any).openai.toolOutput ?? {};
    const sc = current.structuredContent ?? {};

    // IMPORTANT: switch the widget to the plans view
    (window as any).openai.toolOutput = {
      ...current,
      structuredContent: {
        ...sc,
        view: "plans",
        // update recommended plan if user clicked compare
        recommendedPlanId: args?.recommendedPlanId ?? sc.recommendedPlanId ?? "unlimited_more",
        // ensure plans exist
        plans: sc.plans ?? [
          {
            id: "10gb",
            name: "10GB Plan",
            price: 40,
            description: "10GB high-speed data + unlimited talk & text.",
            bestFor: "Light users and budget shoppers."
          },
          {
            id: "unlimited_core",
            name: "Unlimited Core",
            price: 55,
            description: "Unlimited data + hotspot included.",
            bestFor: "Most customers and everyday streaming."
          },
          {
            id: "unlimited_more",
            name: "Unlimited More",
            price: 60,
            description: "Premium unlimited + more hotspot for power users.",
            bestFor: "Travel, hotspot, and heavy data use."
          }
        ]
      }
    };

    notify();
    return;
  }

  if (name === "cricket_promotions") {
    (window as any).openai.toolOutput = {
      structuredContent: {
        view: "promotions",
        promotions: [
          { title: "$100 Switcher Credit", description: "Switch and get a $100 account credit." },
          { title: "Free SIM Activation", description: "Online activation promo (demo data)." }
        ]
      }
    };
    notify();
    return;
  }

  if (name === "cricket_check_coverage") {
    const zip = args?.zip ?? "";
    (window as any).openai.toolOutput = {
      structuredContent: {
        view: "coverage",
        coverage: { message: zip ? `Coverage looks good in ${zip}.` : "Enter a ZIP to check coverage." }
      }
    };
    notify();
    return;
  }

  if (name === "cricket_check_device") {
    const imei = args?.imei ?? "";
    (window as any).openai.toolOutput = {
      structuredContent: {
        view: "device",
        device: { message: imei ? `Device ${imei} appears compatible (demo).` : "Enter an IMEI to check." }
      }
    };
    notify();
    return;
  }
},
    requestDisplayMode: async (args: any) => (console.log("[LOCAL requestDisplayMode]", args), { mode: args?.mode ?? "inline" })
  };
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
