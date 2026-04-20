import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const { resettoken } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const animate = () => {
      setTrailPoints(prev => {
        const next = [{ x: mouse.x, y: mouse.y }, ...prev];
        return next.slice(0, 12);
      });
      requestAnimationFrame(animate);
    };
    animate();
  }, [mouse]);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match');
    setError('');
    setIsLoading(true);

    try {
      const res = await axios.put(`${API_URL}/api/auth/resetpassword/${resettoken}`, { password });
      setMessage(res.data.message);
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired token.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setMouse({ x: -9999, y: -9999 })}
      className="min-h-screen bg-[#020617] flex items-center justify-center px-4 sm:px-6 py-6 relative overflow-hidden"
    >

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>

      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* Glow blobs (fixed) */}
      <div className="absolute w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-cyan-400/20 blur-3xl rounded-full top-[-80px] left-[-80px] pointer-events-none max-w-[100vw]"></div>
      <div className="absolute w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-emerald-400/20 blur-3xl rounded-full bottom-[-80px] right-[-80px] pointer-events-none max-w-[100vw]"></div>

      {/* Comet */}
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
      <div className="relative z-10 w-full max-w-md sm:max-w-lg p-5 sm:p-7 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

        <div className="flex flex-col items-center mb-6 sm:mb-7">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-3 rounded-2xl shadow-lg shadow-cyan-500/30">
            <ShieldCheck className="text-white" size={24} />
          </div>

          <h2 className="mt-5 sm:mt-6 text-lg sm:text-2xl font-semibold tracking-[0.15em] sm:tracking-[0.2em] text-center">
            <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent animate-[flicker_2.5s_infinite]">
              SET NEW PASSWORD
            </span>
          </h2>

          <div className="mt-3 w-20 sm:w-24 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 blur-[0.5px]" />

          <p className="text-slate-400 text-xs sm:text-sm text-center mt-3">
            Your new password must be at least 6 characters.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 sm:p-3 rounded-lg mb-4 sm:mb-5 text-xs sm:text-sm text-center">
            {error}
          </div>
        )}

        {message ? (
          <div className="text-center space-y-4 animate-[fadeInUp_0.5s_ease]">
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-3 sm:p-4 rounded-xl text-xs sm:text-sm">
              {message}
            </div>
            <p className="text-slate-400 text-xs sm:text-sm">Redirecting to login...</p>
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm">Go to Login</Link>
          </div>
        ) : (

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">

            <div>
              <label className="block text-slate-400 text-xs sm:text-sm mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm
                  placeholder:text-slate-500 outline-none transition-all duration-300 ease-out
                  sm:hover:scale-[1.02] sm:focus:scale-[1.03]
                  focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20
                  focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs sm:text-sm mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm
                  placeholder:text-slate-500 outline-none transition-all duration-300 ease-out
                  sm:hover:scale-[1.02] sm:focus:scale-[1.03]
                  focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20
                  focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-2.5 sm:py-3.5 rounded-xl
              sm:hover:scale-[1.04] active:scale-[0.96]
              shadow-lg shadow-cyan-500/30 sm:hover:shadow-cyan-500/60 transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "Save Password"}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}