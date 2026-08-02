import { useEffect, useMemo, useState } from "react";
import { Button } from "@openai/apps-sdk-ui/components/Button";

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string;
  bestFor: string;
};

function readHostToolOutput(): any {
  return (
    (window as any).openai?.toolOutput ??
    (window as any).openai?.globals?.toolOutput ??
    null
  );
}

function isMeaningful(o: any) {
  if (!o || typeof o !== "object") return false;
  if (o.structuredContent?.view) return true;
  if (Array.isArray(o.content) && o.content.length > 0) return true;
  if (typeof o.result === "string") return true;
  return false;
}

export default function App() {
  const [toolOutput, setToolOutput] = useState<any>(() => {
    const init = readHostToolOutput();
    return isMeaningful(init) ? init : {};
  });

  const [localView, setLocalView] = useState<
    "home" | "coverage" | "coverageResult" | "phones"
  >("home");


  // 🔑 SINGLE SOURCE OF TRUTH FOR NAVIGATION
  const [ignoreToolView, setIgnoreToolView] = useState(false);

  const [zip, setZip] = useState("");
  const [imei, setImei] = useState("");
  const [coverageResult, setCoverageResult] = useState<null | "success">(null);
  const [deviceResult, setDeviceResult] = useState<null | "success">(null);



  // Sync from host, but don't overwrite with empty junk
  const syncFromHost = () => {
    const next = readHostToolOutput();
    if (isMeaningful(next)) setToolOutput(next);
  };

  useEffect(() => {
    const handler = () => syncFromHost();
    window.addEventListener("openai:set_globals", handler);

    const id = setInterval(syncFromHost, 400);

    return () => {
      window.removeEventListener("openai:set_globals", handler);
      clearInterval(id);
    };
  }, []);

  const { viewFromTool, plans, recommendedPlanId } = useMemo(() => {
    const sc = toolOutput?.structuredContent ?? {};
    return {
      viewFromTool: (sc.view ?? null) as string | null,
      plans: (sc.plans ?? []) as Plan[],
      recommendedPlanId: sc.recommendedPlanId as string | undefined,
    };
  }, [toolOutput]);

  // 🔑 THIS IS THE ROUTER
  const toolView = ignoreToolView ? null : viewFromTool;

  // If tool changes views, allow it to control UI again
  useEffect(() => {
    if (viewFromTool) setIgnoreToolView(false);
  }, [viewFromTool]);

  async function callTool(name: string, args: any) {
    const res = await (window as any).openai?.callTool?.(name, args);
    if (isMeaningful(res)) setToolOutput(res);
    else syncFromHost();
  }

  const goHome = () => {
    setIgnoreToolView(true);   // 👈 ignore tool routing
    setLocalView("home");
  };

  return (
    <div className="app-shell w-full px-3 py-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 nav-header">
        <img
          src="https://www.cricketwireless.com/uiassets/logo_cricket-green.png"
          height="32"
          width="144"
          alt="Cricket Wireless"
        />

        <Button
          variant="soft"
          color="secondary"
          onClick={() =>
            (window as any).openai?.requestDisplayMode?.({ mode: "fullscreen" })
          }
        >
          Expand
        </Button>
      </div>

      {/* TOOL: PLANS */}
      {toolView === "plans" && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isRecommended = p.id === recommendedPlanId;

            return (
              <div
                key={p.id}
                className="relative rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Green 5G Corner Accent */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#00a651] rounded-bl-2xl flex items-center justify-center text-white text-xs font-bold">
                  5G
                </div>

                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute top-4 left-0 right-0 flex justify-center">
                    <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                      4 lines for $100 monthly
                    </span>
                  </div>
                )}

                <div className={isRecommended ? "mt-8" : ""}>
                  {/* Plan Name */}
                  <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>

                  {/* Price */}
                  <div className="mt-4">
                    <div className="text-4xl font-bold text-gray-900">${p.price}</div>
                    <div className="text-sm text-gray-600">/mo</div>
                    <div className="text-xs text-gray-500 mt-1">when enrolled in Auto Pay</div>
                  </div>

                  {/* First Month Price */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm font-semibold text-gray-900">
                      ${Math.round(p.price * 1.2)} for the first month.
                    </div>
                    <div className="text-xs text-gray-600 mt-2">{p.description}</div>
                  </div>

                  {/* Features */}
                  <div className="mt-4">
                    <div className="text-xs text-gray-600">{p.bestFor}</div>
                    <a href="#" className="text-xs text-blue-600 underline hover:text-blue-800 mt-2 inline-block">
                      What our lawyers say
                    </a>
                  </div>

                  {/* Button */}
                  <button
                    onClick={() =>
                      callTool("cricket_view_plans", { recommendedPlanId: p.id })
                    }
                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    View plan details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Back Button for Plans View */}
      {toolView === "plans" && (
        <div className="mt-4">
          <Button variant="soft" color="secondary" onClick={goHome}>
            Back
          </Button>
        </div>
      )}

      {/* TOOL: PROMOTIONS */}
      {toolView === "promotions" && (
        <div className="mt-3 rounded-xl border p-3">
          <div className="font-semibold text-sm">Deals</div>

          <div className="mt-3 flex gap-2">
            <Button
              color="primary"
              className="!bg-[#00a651]"
              onClick={() => callTool("cricket_view_plans", {})}
            >
              Back to plans
            </Button>

            <Button variant="soft" color="secondary" onClick={goHome}>
              Home
            </Button>
          </div>
        </div>
      )}

      {/* LOCAL HOME */}
      {toolView == null && localView === "home" && (
        <div className="mt-3 grid gap-2">
          <div className="text-sm text-secondary">What are you interested in?</div>

          <Button
            color="primary"
            className="!bg-[#00a651] justify-start"
            onClick={() => {
              setIgnoreToolView(false);
              callTool("cricket_view_plans", {});
            }}
          >
            Plans
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
            Is my phone compatible?
          </Button>
        </div>
      )}

      {/* LOCAL COVERAGE */}
     {toolView == null && localView === "coverage" && coverageResult === null && (
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
        onClick={() => {
          if (zip.trim().length >= 5) {
            setCoverageResult("success");
          }
        }}
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


     {toolView == null && localView === "coverage" && coverageResult === "success" && (
  <div className="mt-3 rounded-xl border border-default bg-surface p-4 text-center">
    <div className="text-lg font-semibold text-[#00a651]">
      🎉 Congrats! Your area has coverage!
    </div>

    <div className="mt-2 text-sm text-secondary">
      Cricket Wireless service is available in your ZIP code.
    </div>

    <div className="mt-4">
      <Button
        color="primary"
        className="!bg-[#00a651]"
        onClick={() => {
          setCoverageResult(null);
          setZip("");
          setLocalView("home");
        }}
      >
        Start Over
      </Button>
    </div>
  </div>
)}


      {/* LOCAL PHONES */}
     {toolView == null && localView === "phones" && deviceResult === null && (
  <div className="mt-3 rounded-xl border border-default bg-surface p-3">
    <div className="font-semibold text-sm text-[#0b0b0f]">Check your phone</div>
    <div className="mt-2 text-sm text-secondary">Enter your IMEI:</div>

    <div className="mt-3 flex gap-2">
      <input
        className="flex-1 rounded-full border border-default px-3 py-2 text-sm"
        placeholder="15-digit IMEI"
        value={imei}
        onChange={(e) => setImei(e.target.value)}
      />

      <Button
        color="primary"
        className="!bg-[#00a651]"
        onClick={() => {
          if (imei.trim().length === 15) {
            setDeviceResult("success");
          }
        }}
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
{toolView == null && localView === "phones" && deviceResult === "success" && (
  <div className="mt-3 rounded-xl border border-default bg-surface p-4 text-center">
    <div className="text-lg font-semibold text-[#00a651]">
      🎉 Yay! Your phone is compatible
    </div>

    <div className="mt-2 text-sm text-secondary">
      Your device works with Cricket Wireless.
    </div>

    <div className="mt-4 flex flex-col gap-2">
      <Button
        color="primary"
        className="!bg-[#00a651]"
        onClick={() => {
          setDeviceResult(null);
          setImei("");
          setLocalView("home");
        }}
      >
        Start Over
      </Button>

      <a
        href="https://www.cricketwireless.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[#00a651] underline"
      >
        Check Cricket Out
      </a>
    </div>
  </div>
)}


    </div>
  );
}
