import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { User, Mail, Lock, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getStrength = (password: string) => {
    let score = 0;
    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength(password);

  const strengthConfig = [
    { label: "Weak", color: "bg-red-500", width: "25%" },
    { label: "Fair", color: "bg-yellow-500", width: "50%" },
    { label: "Good", color: "bg-cyan-500", width: "75%" },
    { label: "Strong", color: "bg-emerald-500", width: "100%" },
  ];

  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMouse({ x: e.clientX, y: e.clientY });
  };

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/register`, { name, email, password });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
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

      <div className="relative z-10 w-full max-w-md sm:max-w-lg p-5 sm:p-8 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-3 rounded-2xl shadow-lg shadow-cyan-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
              <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
              <rect width="14" height="12" x="2" y="6" rx="2" />
            </svg>
          </div>

          <h2 className="mt-5 sm:mt-6 text-lg sm:text-2xl font-semibold tracking-[0.15em] sm:tracking-[0.2em] text-center">
            <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent animate-[flicker_2.5s_infinite]">
              CREATE WORKSPACE
            </span>
          </h2>

          <div className="mt-3 w-20 sm:w-24 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 blur-[0.5px]" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 sm:p-3 rounded-lg mb-4 sm:mb-6 text-xs sm:text-sm text-center">
            {error}
          </div>
        )}

        {isSuccess ? (
          <div className="text-center space-y-4">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
            <p className="text-slate-300 text-xs sm:text-sm">
              Verification link sent to <span className="text-white">{email}</span>
            </p>
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm">
              Back to login
            </Link>
          </div>
        ) : (

          <form onSubmit={handleRegister} className="space-y-4 sm:space-y-5">

            <div>
              <label className="block text-slate-400 text-xs sm:text-sm mb-1 sm:mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm
                  placeholder:text-slate-500 outline-none transition-all duration-300 ease-out
                  sm:hover:scale-[1.02] sm:focus:scale-[1.03]
                  focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20
                  focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs sm:text-sm mb-1 sm:mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm
                  placeholder:text-slate-500 outline-none transition-all duration-300 ease-out
                  sm:hover:scale-[1.02] sm:focus:scale-[1.03]
                  focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20
                  focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs sm:text-sm mb-1 sm:mb-2">Password</label>

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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {password && (
                <div className="mt-2 sm:mt-3 space-y-1">
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${strengthConfig[strength > 0 ? strength - 1 : 0].color}`}
                      style={{
                        width: strengthConfig[strength > 0 ? strength - 1 : 0].width,
                      }}
                    />
                  </div>

                  <p className="text-[10px] sm:text-xs text-slate-400">
                    Strength:{" "}
                    <span className="text-white font-medium">
                      {strength > 0 ? strengthConfig[strength - 1].label : "Too weak"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="relative group mt-2 sm:mt-3">
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 
                transition duration-500 pointer-events-none
                bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.25),transparent)]
                animate-[shine_1.5s_linear_infinite]"
              />

              <button
                type="submit"
                disabled={isLoading}
                className="relative w-full flex justify-center items-center
                bg-gradient-to-r from-teal-500 to-cyan-500
                sm:hover:from-teal-600 sm:hover:to-cyan-600
                text-white py-2.5 sm:py-3.5 rounded-xl text-sm sm:text-base
                transition-all duration-300 ease-out
                shadow-lg shadow-cyan-500/30
                sm:hover:shadow-cyan-500/60
                sm:hover:scale-[1.04]
                active:scale-[0.96]
                disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Create Account"}
              </button>
            </div>

          </form>
        )}

        {!isSuccess && (
          <p className="mt-6 sm:mt-8 text-center text-slate-400 text-xs sm:text-sm">
            Already have an account?{" "}
            <Link to="/" className="text-cyan-400 hover:text-cyan-300">
              Sign in here
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}