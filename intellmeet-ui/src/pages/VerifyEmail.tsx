import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const hasFetched = useRef(false);

  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number | null>(null);

  // Optimized animation for mobile: disable hover trails on touch devices
  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const animate = () => {
      setTrailPoints(prev => {
        const next = [{ x: mouse.x, y: mouse.y }, ...prev];
        return next.slice(0, 12);
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mouse]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMouse({ x: e.clientX, y: e.clientY });
  };

  const raw_url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = raw_url.replace(/\/api\/?$/, '');

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const verifyToken = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/verifyemail/${token}`);
        setMessage(res.data.message);
        setStatus('success');
      } catch (err: any) {
        setMessage(err.response?.data?.message || 'Verification failed.');
        setStatus('error');
      }
    };

    if (token) verifyToken();
  }, [token, API_URL]);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMouse({ x: -9999, y: -9999 })}
      className="min-h-screen bg-[#020617] flex items-center justify-center px-4 sm:px-6 py-6 relative overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl animate-gradient"></div>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* Spotlight & Trails */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(200px circle at ${mouse.x}px ${mouse.y}px, rgba(34,211,238,0.18), transparent 60%)`,
        }}
      />

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

      {/* Verification Card */}
      <div className="relative w-full max-w-md sm:max-w-lg p-5 sm:p-8 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] text-center">
        <div className="flex justify-center mb-5 sm:mb-6">
          {status === 'success' && <CheckCircle2 className="text-emerald-400" size={40} />}
          {status === 'error' && <XCircle className="text-red-400" size={40} />}
          {status === 'loading' && <Loader2 className="animate-spin text-cyan-400" size={40} />}
        </div>

        {status === 'loading' && (
          <>
            <h2 className="text-lg sm:text-2xl font-semibold text-white">Verifying Email...</h2>
            <p className="text-slate-400 mt-2 text-xs sm:text-sm">Please wait</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h2 className="text-lg sm:text-2xl font-semibold text-white">Email Verified</h2>
            <p className="text-slate-400 mt-2 mb-5 sm:mb-6 text-xs sm:text-sm">{message}</p>
            <Link
              to="/"
              className="w-full inline-block py-2.5 sm:py-3.5 rounded-xl font-semibold text-white
              bg-gradient-to-r from-teal-500 to-cyan-500
              shadow-lg shadow-cyan-500/30
              sm:hover:shadow-cyan-500/50 sm:hover:scale-[1.03] active:scale-[0.97]
              transition-all duration-300"
            >
              Connect to Workspace
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-lg sm:text-2xl font-semibold text-white">Verification Failed</h2>
            <p className="text-slate-400 mt-2 mb-5 sm:mb-6 text-xs sm:text-sm">{message}</p>
            <Link
              to="/"
              className="w-full inline-block py-2.5 sm:py-3.5 rounded-xl font-semibold text-white
              bg-gradient-to-r from-red-500 to-pink-500
              shadow-lg shadow-red-500/30
              sm:hover:shadow-red-500/50
              sm:hover:scale-[1.03] active:scale-[0.97]
              transition-all duration-300"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}