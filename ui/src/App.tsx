import { useEffect, useMemo, useState } from "react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string;
  bestFor: string;
};

function readToolOutput(): any {
  return (window as any).openai?.toolOutput ?? (window as any).openai?.globals?.toolOutput ?? {};
}

export default function App() {
  const [toolOutput, setToolOutput] = useState<any>(() => readToolOutput());

  // Local UI routing for the “starter” flow (home/coverage/phones)
  const [localView, setLocalView] = useState<"home" | "coverage" | "phones">("home");
  const [zip, setZip] = useState("");
  const [imei, setImei] = useState("");

  useEffect(() => {
    const handler = () => setToolOutput(readToolOutput());
    window.addEventListener("openai:set_globals", handler);
    return () => window.removeEventListener("openai:set_globals", handler);
  }, []);

  const { viewFromTool, plans, recommendedPlanId, maxHeight } = useMemo(() => {
    const sc = toolOutput?.structuredContent ?? {};
    return {
      viewFromTool: (sc.view ?? "home") as string,
      plans: (sc.plans ?? []) as Plan[],
      recommendedPlanId: sc.recommendedPlanId as string | undefined,
      maxHeight: ((window as any).openai?.maxHeight ?? 260) as number
    };
  }, [toolOutput]);

  async function callTool(name: string, args: any) {
    await (window as any).openai?.callTool?.(name, args);
  }

  // Decide what to render:
  // - If tool output says "plans/promotions/device/coverage", show those
  // - Otherwise show our local starter views (home/coverage/phones)
  const toolView = viewFromTool;

  return (
    <div className="w-full px-3 py-2" style={{ maxHeight, overflowY: "auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 nav-header">
        <div>
          <div className="text-xs font-medium text-secondary"><img src="https://www.cricketwireless.com/uiassets/logo_cricket-green.png" height="32" width="144" alt="Cricket Wireless Home Page"/></div>
        </div>

        <Button
          variant="soft"
          color="secondary"
          onClick={() => (window as any).openai?.requestDisplayMode?.({ mode: "fullscreen" })}
        >
          Expand
        </Button>
      </div>

      {/* TOOL-DRIVEN VIEWS */}
      {toolView === "plans" && (
        <div className="mt-3 grid gap-3">
          {plans.length === 0 ? (
            <div className="text-sm text-secondary">
              No plans found yet. Try “Plans” from the home screen.
            </div>
          ) : (
            plans.map((p) => {
              const isRecommended = p.id === recommendedPlanId;

              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-3 ${
                    isRecommended ? "border-[#00a651] bg-white" : "border-default bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-[#0b0b0f]">
                        {p.name} · ${p.price}/mo
                      </div>
                      <div className="mt-1 text-sm text-secondary">{p.description}</div>
                    </div>

                    {isRecommended ? <Badge color="success">Best value</Badge> : null}
                  </div>

                  <div className="mt-2 text-xs text-secondary">{p.bestFor}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      color="primary"
                      className="!bg-[#00a651] hover:!bg-[#008a44]"
                      onClick={() => callTool("cricket_promotions", { planId: p.id })}
                    >
                      Choose
                    </Button>

                    <Button
                      variant="soft"
                      color="secondary"
                      onClick={() => callTool("cricket_view_plans", { recommendedPlanId: p.id })}
                    >
                      Compare
                    </Button>

                    <Button variant="soft" color="secondary" onClick={() => setLocalView("home")}>
                      Back
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {toolView === "promotions" && (
        <div className="mt-3 rounded-xl border border-default bg-surface p-3">
          <div className="font-semibold text-sm text-[#0b0b0f]">Deals</div>
          <div className="mt-2 text-sm text-secondary">
            (Promotions will render here from your tool output.)
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <Button
              color="primary"
              className="!bg-[#00a651]"
              onClick={() => callTool("cricket_view_plans", {})}
            >
              Back to plans
            </Button>
            <Button variant="soft" color="secondary" onClick={() => setLocalView("home")}>
              Home
            </Button>
          </div>
        </div>
      )}

      {/* STARTER FLOW VIEWS (when tool isn't driving a view) */}
      {toolView !== "plans" && toolView !== "promotions" && localView === "home" && (
        <div className="mt-3 grid gap-2">
          <div className="text-sm text-secondary">What are you interested in?</div>

          <Button
            color="primary"
            className="!bg-[#00a651] hover:!bg-[#008a44] justify-start"
            onClick={() => callTool("cricket_view_plans", {})}
          >
            Plans
          </Button>

          <Button
            variant="soft"
            color="secondary"
            className="justify-start"
            onClick={() => callTool("cricket_promotions", {})}
          >
            Deals
          </Button>

          <Button
            variant="soft"
            color="secondary"
            className="justify-start"
            onClick={() => setLocalView("coverage")}
          >
            Coverage
          </Button>

          <Button
            variant="soft"
            color="secondary"
            className="justify-start"
            onClick={() => setLocalView("phones")}
          >
            Phones
          </Button>

            <Button
            variant="soft"
            color="secondary"
            className="justify-start"
            onClick={() => setLocalView("phones")}
          >
            Is my phone compatible?
          </Button>
        </div>
      )}

      {toolView !== "plans" && toolView !== "promotions" && localView === "coverage" && (
        <div className="mt-3 rounded-xl border border-default bg-surface p-3">
          <div className="font-semibold text-sm text-[#0b0b0f]">Check coverage</div>
          <div className="mt-2 text-sm text-secondary">Enter your ZIP code:</div>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-full border border-default px-3 py-2 text-sm"
              placeholder="ZIP"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <Button
              color="primary"
              className="!bg-[#00a651]"
              onClick={() => callTool("cricket_check_coverage", { zip: zip.trim() })}
            >
              Check
            </Button>
          </div>

          <div className="mt-3">
            <Button variant="soft" color="secondary" onClick={() => setLocalView("home")}>
              Back
            </Button>
          </div>
        </div>
      )}

      {toolView !== "plans" && toolView !== "promotions" && localView === "phones" && (
        <div className="mt-3 rounded-xl border border-default bg-surface p-3">
          <div className="font-semibold text-sm text-[#0b0b0f]">Check your phone</div>
          <div className="mt-2 text-sm text-secondary">Enter your IMEI:</div>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-full border border-default px-3 py-2 text-sm"
              placeholder="IMEI"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
            />
            <Button
              color="primary"
              className="!bg-[#00a651]"
              onClick={() => callTool("cricket_check_device", { imei: imei.trim() })}
            >
              Check
            </Button>
          </div>

          <div className="mt-3">
            <Button variant="soft" color="secondary" onClick={() => setLocalView("home")}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
