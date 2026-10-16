import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Sparkles, Zap, Shield, Loader2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { PlanResponse, SubscriptionResponse } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingModal({ open, onOpenChange }: PricingModalProps) {
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<number | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPlansAndSubscription();
    }
  }, [open]);

  const loadPlansAndSubscription = async () => {
    setLoading(true);
    try {
      const [plansData, subData] = await Promise.allSettled([
        api.getPlans(),
        api.getMySubscription(),
      ]);

      if (plansData.status === "fulfilled") {
        setPlans(plansData.value);
      }
      if (subData.status === "fulfilled") {
        setSubscription(subData.value);
      }
    } catch (err: any) {
      console.error("Failed to load subscription data:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSubscribed =
    subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";

  const handleCheckout = async (plan: PlanResponse) => {
    if (!plan.id) return;
    setCheckoutPlanId(plan.id);
    try {
      const res = await api.createCheckoutSession(plan.id);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        toast({
          title: "Checkout Error",
          description: "Stripe checkout session could not be created. Please check your Stripe keys.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Checkout Failed",
        description: err.message || "Failed to start Stripe checkout session.",
        variant: "destructive",
      });
    } finally {
      setCheckoutPlanId(null);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api.openCustomerPortal();
      if (res.portalUrl) {
        window.location.href = res.portalUrl;
      }
    } catch (err: any) {
      toast({
        title: "Portal Error",
        description: err.message || "Failed to open Stripe customer portal.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  // Fallback plans if backend plans list is not yet loaded
  const displayPlans = plans.length > 0 ? plans : [
    {
      id: 1,
      name: "Free Starter",
      price: "Free",
      maxProjects: 5,
      maxTokensPerDay: 25000,
      unlimitedAi: false,
    },
    {
      id: 2,
      name: "Pro Developer",
      price: "$20/mo",
      maxProjects: 50,
      maxTokensPerDay: 500000,
      unlimitedAi: true,
    },
    {
      id: 3,
      name: "Team Enterprise",
      price: "$60/mo",
      maxProjects: 200,
      maxTokensPerDay: 2000000,
      unlimitedAi: true,
    },
  ];

  const getPlanFeatures = (plan: PlanResponse) => {
    const isPro = plan.name.toLowerCase().includes("pro");
    const isTeam = plan.name.toLowerCase().includes("team") || plan.name.toLowerCase().includes("enterprise");

    if (isTeam) {
      return [
        `${plan.maxProjects || 200} Projects with MinIO cloud`,
        "Unlimited AI generations & previews",
        "Team collaboration with role permissions",
        "Custom domains & automated SSL",
        "Dedicated priority infrastructure",
        "24/7 Premium technical support",
      ];
    }
    if (isPro) {
      return [
        `${plan.maxProjects || 50} Active web projects`,
        "Unlimited AI streaming generations",
        "100 Live previews per month",
        "Export & download full source code",
        "High-priority Gemini processing",
        "Standard email & chat support",
      ];
    }
    return [
      `${plan.maxProjects || 5} Web projects`,
      "25,000 AI tokens per day",
      "10 Live preview builds",
      "Community support",
      "Standard response speed",
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-[#0d0d14] border-white/10 text-white p-0 overflow-hidden rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-white/8 bg-gradient-to-b from-violet-950/20 to-transparent">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Simple, Transparent Pricing
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Supercharge your developer workflow
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm mt-1.5">
            Upgrade to Pro for unlimited AI generation, custom domains, and seamless MinIO cloud deployments.
          </DialogDescription>

          {isSubscribed && (
            <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center gap-2 text-xs text-violet-200">
                <Shield className="w-4 h-4 text-violet-400" />
                <span>
                  You have an active <strong>{subscription?.plan?.name || "Pro"}</strong> subscription.
                </span>
              </div>
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all"
              >
                {portalLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                Manage in Stripe
              </button>
            </div>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {displayPlans.map((plan) => {
                const isPro = plan.name.toLowerCase().includes("pro");
                const isTeam = plan.name.toLowerCase().includes("team") || plan.name.toLowerCase().includes("enterprise");
                const isCurrentPlan = subscription?.plan?.id === plan.id;
                const features = getPlanFeatures(plan);

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl flex flex-col justify-between transition-all p-6 ${
                      isPro
                        ? "bg-gradient-to-b from-violet-900/30 via-white/[0.04] to-white/[0.02] border-2 border-violet-500/60 shadow-xl shadow-violet-950/40"
                        : "bg-white/[0.03] border border-white/8 hover:border-white/15"
                    }`}
                  >
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-0.5 rounded-full bg-violet-600 text-[11px] font-bold text-white tracking-wide uppercase shadow-lg shadow-violet-900/50">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div>
                      {/* Plan Header */}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        {isPro && <Zap className="w-4 h-4 text-violet-400" />}
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-1 my-4">
                        <span className="text-3xl font-extrabold text-white">
                          {plan.price || (plan.name.includes("Free") ? "Free" : "$20/mo")}
                        </span>
                      </div>

                      {/* Features List */}
                      <ul className="space-y-2.5 my-6 text-xs text-slate-300">
                        {features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                            <span className="leading-relaxed">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <div className="mt-4 pt-4 border-t border-white/8">
                      {isCurrentPlan ? (
                        <button
                          disabled
                          className="w-full py-2.5 rounded-xl bg-white/10 text-slate-400 text-xs font-semibold cursor-default"
                        >
                          Current Active Plan
                        </button>
                      ) : plan.name.toLowerCase().includes("free") ? (
                        <button
                          disabled
                          className="w-full py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-semibold cursor-default"
                        >
                          Included by Default
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCheckout(plan)}
                          disabled={checkoutPlanId === plan.id}
                          className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                            isPro
                              ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40"
                              : "bg-white/10 hover:bg-white/15 text-white"
                          }`}
                        >
                          {checkoutPlanId === plan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Upgrade to {plan.name.split(" ")[0]}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Secure Stripe Notice */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Guaranteed safe checkout powered by Stripe. Cancel anytime in one click.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
