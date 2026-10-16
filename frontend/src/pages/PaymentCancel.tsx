import { useNavigate } from "react-router-dom";
import { XCircle, ArrowLeft, RotateCcw } from "lucide-react";

export function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center p-6 text-white">
      <div className="max-w-md w-full rounded-3xl bg-white/[0.04] border border-white/10 p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-slate-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-6 text-amber-400 shadow-lg shadow-amber-950/40">
            <XCircle className="w-9 h-9" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            Checkout Cancelled
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Your payment session was cancelled and no charges were made. You can continue using your free tier or upgrade whenever you're ready.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/projects")}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-900/40"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Dashboard
            </button>
            <button
              onClick={() => navigate("/projects?upgrade=true")}
              className="w-full py-2.5 rounded-xl bg-white/6 hover:bg-white/10 text-slate-300 text-sm font-medium flex items-center justify-center gap-2 transition-all border border-white/8"
            >
              <RotateCcw className="w-4 h-4" />
              View Pricing Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentCancel;
