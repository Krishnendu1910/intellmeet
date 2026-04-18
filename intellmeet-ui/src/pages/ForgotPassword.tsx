import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 🔥 Comet states
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMouse({ x: e.clientX, y: e.clientY });
  };

  // 🔥 Comet animation
  useEffect(() => {
    const animate = () => {
      setTrailPoints(prev => {
        const next = [{ x: mouse.x, y: mouse.y }, ...prev];
        return next.slice(0, 10);
      });
      requestAnimationFrame(animate);
    };
    animate();
  }, [mouse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/forgotpassword`, { email });
      setMessage(res.data.message);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMouse({ x: -9999, y: -9999 })}
      className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden"
    >

      {/* 🔥 Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>

      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* 🔲 Glow blobs */}
      <div className="absolute w-[400px] h-[400px] bg-cyan-400/20 blur-3xl rounded-full top-[-100px] left-[-100px]"></div>
      <div className="absolute w-[400px] h-[400px] bg-emerald-400/20 blur-3xl rounded-full bottom-[-100px] right-[-100px]"></div>

      {/* 🟢 Comet Trail */}
      {trailPoints.map((p, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: 160 - i * 8,
            height: 160 - i * 8,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)",
            opacity: mouse.x < 0 ? 0 : 0.7 - i * 0.06,
            filter: "blur(14px)",
          }}
        />
      ))}

      {/* Card */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">

          <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-4 rounded-2xl shadow-lg shadow-cyan-500/30">
            <KeyRound className="text-white" size={28} />
          </div>

          <div className="mt-6 flex flex-col items-center transition-all duration-700 animate-[fadeInUp_0.8s_ease]">

            <h2 className="text-2xl font-semibold tracking-[0.2em] text-center">
              <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent animate-[flicker_2.5s_infinite]">
                RESET PASSWORD
              </span>
            </h2>

            {/* Divider */}
            <div className="mt-3 w-24 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 blur-[0.5px]" />

          </div>

          <p className="text-slate-400 text-sm text-center mt-3 max-w-xs">
            Enter your email to receive reset instructions
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Success */}
        {message ? (
          <div className="text-center space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-sm">
              {message}
            </div>

            <Link to="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition text-sm">
              <ArrowLeft size={16} /> Back to login
            </Link>
          </div>
        ) : (

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Email */}
            <div>
              <label className="block text-slate-400 text-sm mb-2">
                Email Address
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none
                  transition-all duration-300 ease-out
                  hover:scale-[1.02]
                  focus:scale-[1.03]
                focus:border-cyan-400 
                  focus:ring-2 focus:ring-cyan-400/20 
                  focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                  required
                />
              </div>
            </div>

            {/* Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={`
      relative flex items-center justify-center
      transition-all duration-500 ease-out
      rounded-xl text-white font-semibold
      overflow-hidden

      ${isLoading
                    ? "w-14 h-14 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/40"
                    : isSuccess
                      ? "w-full py-3.5 bg-emerald-500 shadow-lg shadow-emerald-500/40"
                      : "w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-cyan-500/30 hover:scale-[1.03] active:scale-[0.97]"
                  }
    `}
              >
                {/* Loading */}
                {isLoading && (
                  <Loader2 className="animate-spin" size={22} />
                )}

                {/* Success */}
                {isSuccess && !isLoading && (
                  <span className="flex items-center gap-2">
                    ✓ Sent
                  </span>
                )}

                {/* Default */}
                {!isLoading && !isSuccess && "Send Reset Link"}
              </button>
            </div>



            {/* Back */}
            <div className="text-center pt-2">
              <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition text-sm">
                <ArrowLeft size={16} /> Back to login
              </Link>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}