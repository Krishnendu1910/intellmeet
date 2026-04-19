import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [ripples, setRipples] = useState<any[]>([]);
    const [trailPoints, setTrailPoints] = useState<{ x: number, y: number }[]>([]);
    const fullText = "INTELLMEET";
    const [displayText, setDisplayText] = useState("");

    useEffect(() => {
        const chars = "!@#$%^&*()_+=-{}[]<>?/|";
        let i = 0;

        const interval = setInterval(() => {
            let glitchText = fullText
                .split("")
                .map((char, index) => {
                    if (index < i) return fullText[index];

                    return Math.random() > 0.5
                        ? chars[Math.floor(Math.random() * chars.length)]
                        : fullText[index];
                })
                .join("");

            setDisplayText(glitchText);

            i++;
            if (i > fullText.length) {
                clearInterval(interval);
                setDisplayText(fullText);
            }
        }, 130);

        return () => clearInterval(interval);
    }, []);

    const [mouse, setMouse] = useState({ x: 0, y: 0 });

    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();

    const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const API_URL = raw_url.replace(/\/api\/?$/, '');

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

    const handleClick = (e: React.MouseEvent) => {
        const id = Date.now();
        setRipples(prev => [...prev, { x: e.clientX, y: e.clientY, id }]);

        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== id));
        }, 600);
    };

    const rafRef = useRef<number | null>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            setMouse({ x: e.clientX, y: e.clientY });
            rafRef.current = null;
        });
    };

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const [inputGlow, setInputGlow] = useState<{ x: number; y: number; active: boolean }>({
        x: 0,
        y: 0,
        active: false,
    });

    const handleInputMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setInputGlow({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            active: true,
        });
    };

    const handleInputLeave = () => {
        setInputGlow(prev => ({ ...prev, active: false }));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, {
                email,
                password,
            });

            const token = response.data.accessToken || response.data.token;
            setAuth(token, response.data.user);
            navigate('/dashboard');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Failed to login. Check your credentials.');
        }
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onMouseLeave={() => setMouse({ x: -9999, y: -9999 })}
            className="min-h-screen bg-[#020617] flex items-center justify-center px-4 sm:px-6 py-6 relative overflow-hidden"
        >

            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl animate-gradient"></div>
            </div>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>

            <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(
            200px circle at ${mouse.x}px ${mouse.y}px,
            rgba(34,211,238,0.18),
            transparent 60%
          )`,
                }}
            ></div>

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
                        background: "radial-gradient(circle, rgba(34,211,238,0.25), transparent 70%)",
                        opacity: mouse.x < 0 ? 0 : 0.7 - i * 0.06,
                        filter: "blur(14px)",
                    }}
                />
            ))}

            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/asfalt-light.png')]"></div>

            <div className="relative w-full max-w-md sm:max-w-lg p-5 sm:p-8 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

                <div className="flex flex-col items-center mb-6 sm:mb-8">
                    <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-3 rounded-2xl shadow-lg shadow-cyan-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
                            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
                            <rect width="14" height="12" x="2" y="6" rx="2" />
                        </svg>
                    </div>

                    <h1 className="mt-5 sm:mt-6 text-xl sm:text-3xl font-semibold tracking-[0.2em] sm:tracking-[0.25em] text-white text-center">
                        <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent animate-[flicker_2s_infinite]">
                            {displayText}
                        </span>
                    </h1>

                    <p className="text-slate-400 text-xs sm:text-sm mt-3 sm:mt-4 text-center">
                        Enter your credentials to access your account
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 sm:p-3 rounded-lg mb-4 sm:mb-6 text-xs sm:text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
                    <div>
                        <label className="block text-slate-400 text-xs sm:text-sm mb-1 sm:mb-2 transition-colors focus-within:text-cyan-400">
                            Email Address
                        </label>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                            <div
                                className="absolute inset-0 rounded-xl pointer-events-none"
                                style={{
                                    background: inputGlow.active
                                        ? `radial-gradient(120px circle at ${inputGlow.x}px ${inputGlow.y}px, rgba(34,211,238,0.25), transparent 60%)`
                                        : "transparent",
                                }}
                            />

                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onMouseMove={handleInputMouseMove}
                                onMouseLeave={handleInputLeave}
                                placeholder="name@company.com"
                                className="relative w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500 outline-none transition-all duration-300 ease-out sm:hover:scale-[1.02] sm:focus:scale-[1.03] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-slate-400 text-xs sm:text-sm mb-1 sm:mb-2 transition-colors focus-within:text-cyan-400">
                            Password
                        </label>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                            <div
                                className="absolute inset-0 rounded-xl pointer-events-none"
                                style={{
                                    background: inputGlow.active
                                        ? `radial-gradient(120px circle at ${inputGlow.x}px ${inputGlow.y}px, rgba(34,211,238,0.25), transparent 60%)`
                                        : "transparent",
                                }}
                            />

                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onMouseMove={handleInputMouseMove}
                                onMouseLeave={handleInputLeave}
                                placeholder="Enter your password"
                                className="relative w-full pl-10 pr-10 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500 outline-none transition-all duration-300 ease-out sm:hover:scale-[1.02] sm:focus:scale-[1.03] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                                required
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <div className="flex justify-end mt-2">
                            <Link
                                to="/forgot-password"
                                className="text-cyan-400 text-xs hover:text-cyan-300 transition"
                            >
                                Forgot Password?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 sm:py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 active:scale-[0.97]"
                    >
                        Connect to Workspace
                    </button>

                </form>

                <p className="mt-6 sm:mt-8 text-center text-slate-400 text-xs sm:text-sm">
                    Don't have an account?{" "}
                    <Link to="/register" className="text-cyan-400 hover:text-cyan-300 transition">
                        Create one for free
                    </Link>
                </p>

            </div>
        </div>
    );
}