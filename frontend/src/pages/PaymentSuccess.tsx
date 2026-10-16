import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Optional: could trigger a sync or toast
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center p-6 text-white">
      <div className="max-w-md w-full rounded-3xl bg-white/[0.04] border border-white/10 p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Subscription Activated
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            Welcome to Pro! 🎉
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Your payment was processed successfully via Stripe. All premium developer features, unlimited AI generations, and cloud project storage are now active on your account.
          </p>

          {sessionId && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/8 text-[11px] text-slate-500 font-mono mb-6 truncate">
              Session: {sessionId}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => navigate("/projects")}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-900/40"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Receipt and invoice sent to your email</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
