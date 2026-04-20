import { useState, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  Video, Calendar, User, LogOut, Copy, Plus, Menu, ChevronLeft, Search,
  Users, Lock, Loader2, X, Trash2, Clock, History, Link as LinkIcon, FileText, CheckSquare, BarChart3, Target, CheckCircle2, TrendingUp, Activity, Download, ArrowRight, AlertCircle, AlertTriangle, Pin, Mail, ShieldCheck, UserMinus, Camera, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

import Login from './pages/Login';
import Register from './pages/Register';
import MeetingRoom from './pages/MeetingRoom';
import MeetingSummary from './pages/MeetingSummary';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import { useAuthStore } from './store/authStore';

interface TaskData {
  id: string;
  text: string;
  status: 'todo' | 'in-progress' | 'done';
  assigneeId?: string;
  assigneeName?: string;
}

interface MeetingData {
  _id: string;
  title: string;
  date: string;
  time: string;
  roomId: string;
  isWaitingRoom?: boolean;
  status?: string;
  summary?: string;
  tasks?: TaskData[];
}

interface UserData {
  _id?: string;
  id?: string;
  name?: string;
  firstName?: string;
  email?: string;
  profilePic?: string;
}

interface AuthState {
  token: string | null;
  user: UserData | null;
  logout: () => void;
  setUser: (user: UserData) => void;
}

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const token = useAuthStore((state: unknown) => (state as AuthState).token);
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const generateRoomCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const getStr = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${getStr(3)}-${getStr(4)}-${getStr(3)}`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state: unknown) => (state as AuthState).user);
  const logout = useAuthStore((state: unknown) => (state as AuthState).logout);
  const token = useAuthStore((state: unknown) => (state as AuthState).token);
  const setUser = useAuthStore((state: unknown) => (state as AuthState).setUser);

  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'history' | 'tasks' | 'analytics' | 'profile'>(() => {
    return (localStorage.getItem('intellmeet_active_tab') as any) || 'home';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [trailPoints, setTrailPoints] = useState<{ x: number, y: number }[]>([]);
  const [isMouseOnMain, setIsMouseOnMain] = useState(false);
  const rafRef = useRef<number | null>(null);

  // States for Filter, Search & Pagination
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'expired'>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 6;
  const [taskSearch, setTaskSearch] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [passStrength, setPassStrength] = useState({ score: 0, label: '', color: 'bg-transparent' });

  // NEW: State for Terminate Identity Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  // LOGIC: Functional Termination
  const handleFinalWipe = () => {
    logout();
    navigate('/');
    showToast("Identity Terminated Successfully", "success");
  };

  useEffect(() => {
    setShowScheduleModal(false);
    localStorage.setItem('intellmeet_active_tab', activeTab);
  }, [activeTab]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      setMouse({ x: e.clientX, y: e.clientY });
      rafRef.current = null;
    });
  };

  useEffect(() => {
    const animate = () => {
      setTrailPoints(prev => [{ x: mouse.x, y: mouse.y }, ...prev].slice(0, 12));
      requestAnimationFrame(animate);
    };
    const handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, [mouse]);

  const [joinCode, setJoinCode] = useState('');
  const [instantRoomCode] = useState(generateRoomCode());
  const [instantWaitingRoom, setInstantWaitingRoom] = useState(false);
  const env = (import.meta as unknown as { env: Record<string, string> }).env;
  const base_url = (env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/api\/?$/, '');
  const API_URL = `${base_url}/api`;
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [newName, setNewName] = useState(user?.name || user?.firstName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [isWaitingRoom, setIsWaitingRoom] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledMeetings, setScheduledMeetings] = useState<MeetingData[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [deleteHint, setDeleteHint] = useState('');

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!showTerminateModal) return;

    const word = "DELETE";
    let i = 0;

    const interval = setInterval(() => {
      setDeleteHint(word.slice(0, i + 1));
      i++;
      if (i === word.length) clearInterval(interval);
    }, 120);

    return () => clearInterval(interval);
  }, [showTerminateModal]);

  useEffect(() => {
    setShowTerminateModal(false);
    setConfirmDeleteText('');
  }, [activeTab]);

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowTerminateModal(false);
      setConfirmDeleteText('');
      setIsClosing(false);
    }, 180); // match CSS duration
  };

  // ESC to close + focus trap + initial focus
  useEffect(() => {
    if (!showTerminateModal) return;

    // lock scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // focus first input
    setTimeout(() => firstInputRef.current?.focus(), 0);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'Tab') {
        // simple focus trap
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [showTerminateModal]);

  // auto-close on tab change
  useEffect(() => {
    if (showTerminateModal) closeModal();
  }, [activeTab]);

  useEffect(() => {
    if ((activeTab === 'schedule' || activeTab === 'history' || activeTab === 'tasks' || activeTab === 'analytics') && token) {
      if (scheduledMeetings.length > 0) return;
      const fetchMeetings = async () => {
        setIsLoadingMeetings(true);
        try {
          const res = await fetch(`${API_URL}/meetings`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.status === 401) { logout(); return; }
          if (res.ok) { const data = await res.json(); setScheduledMeetings(data); }
        } catch (err) { console.error(err); } finally { setIsLoadingMeetings(false); }
      };
      fetchMeetings();
    }
  }, [activeTab, token, API_URL, logout, scheduledMeetings.length]);

  const handleJoin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (joinCode.trim()) {
      let code = joinCode.trim();
      if (code.includes('/meeting/')) code = code.split('/meeting/')[1].split('/')[0];
      navigate(`/meeting/${code}`);
    }
  };

  const startInstantMeeting = async () => {
    try {
      const now = new Date();
      const res = await fetch(`${API_URL}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: 'Instant Meeting', roomId: instantRoomCode, isWaitingRoom: instantWaitingRoom, date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` })
      });
      if (res.ok) { navigate(`/meeting/${instantRoomCode}`); }
      else { throw new Error('Failed to start meeting'); }
    } catch (err) { showToast((err as Error).message || 'Error creating meeting', 'error'); }
  };

  const copyToClipboard = (text: string, isLink: boolean = false) => {
    navigator.clipboard.writeText(text);
    showToast(isLink ? 'Invite Link copied!' : 'Room Code copied!', 'success');
  };

  const handleScheduleMeeting = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsScheduling(true);
    const newRoomId = generateRoomCode();
    try {
      const res = await fetch(`${API_URL}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: meetingTitle, date: meetingDate, time: meetingTime, roomId: newRoomId, isWaitingRoom })
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledMeetings(prev => [...prev, data]);
        setShowScheduleModal(false);
        setMeetingTitle(''); setMeetingDate(''); setMeetingTime('');
        showToast('Meeting Scheduled!', 'success');
      }
    } catch (err) { showToast((err as Error).message || 'Failed to schedule', 'error'); } finally { setIsScheduling(false); }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/meetings/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { setScheduledMeetings(prev => prev.filter(m => m._id !== id)); showToast('Meeting removed', 'success'); }
    } catch (err) { console.error(err); }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim() || newName === user?.name) return;
    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: newName }) });
      if (res.ok) { const data = await res.json(); if (user) setUser({ ...user, name: data.name }); showToast('Profile updated!', 'success'); }
    } catch (err) { showToast('Error updating profile', 'error'); } finally { setIsUpdatingProfile(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('File size should be less than 2MB', 'error'); return; }
    setAvatarPreview(URL.createObjectURL(file));
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch(`${API_URL}/auth/profile/avatar`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      if (res.ok) { const updatedUser = await res.json(); setUser(updatedUser); showToast('Profile picture updated!', 'success'); }
    } catch (err) { showToast('Error uploading profile picture', 'error'); } finally { setIsUploadingAvatar(false); setAvatarPreview(null); }
  };

  const checkPasswordStrength = (pass: string) => {
    setNewPassword(pass);
    if (!pass) { setPassStrength({ score: 0, label: '', color: 'bg-transparent' }); return; }
    const score = pass.length < 6 ? 1 : pass.length < 10 ? 2 : 3;
    const feedback = score === 1 ? { label: 'Weak', color: 'bg-rose-500' } : score === 2 ? { label: 'Medium', color: 'bg-amber-500' } : { label: 'Strong', color: 'bg-emerald-500' };
    setPassStrength({ score, ...feedback });
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || newPassword.length < 6) return;
    setIsUpdatingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ currentPassword, newPassword }) });
      if (res.ok) { showToast('Password updated!', 'success'); setCurrentPassword(''); setNewPassword(''); setPassStrength({ score: 0, label: '', color: 'bg-transparent' }); }
    } catch (err) { showToast('Error updating password', 'error'); } finally { setIsUpdatingPassword(false); }
  };

  const handleUpdateTaskStatus = async (roomId: string, taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    try {
      const res = await fetch(`${API_URL}/meetings/room/${roomId}/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) {
        setScheduledMeetings(prev => prev.map(m => {
          if (m.roomId === roomId && m.tasks) {
            return { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } as TaskData : t) };
          }
          return m;
        }));
        showToast('Task updated!', 'success');
      }
    } catch (err) { showToast('Failed to update task', 'error'); }
  };

  const handleDeleteTask = async (roomId: string, taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`${API_URL}/meetings/room/${roomId}/tasks/${taskId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setScheduledMeetings(prev => prev.map(m => {
          if (m.roomId === roomId && m.tasks) {
            return { ...m, tasks: m.tasks.filter(t => t.id !== taskId) };
          }
          return m;
        }));
        showToast('Task deleted successfully!', 'success');
      }
    } catch (err) { showToast('Failed to delete task', 'error'); }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, roomId: string) => { e.dataTransfer.setData('taskId', taskId); e.dataTransfer.setData('roomId', roomId); };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (e: React.DragEvent, newStatus: 'todo' | 'in-progress' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId'); const roomId = e.dataTransfer.getData('roomId');
    if (taskId && roomId) await handleUpdateTaskStatus(roomId, taskId, newStatus);
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const [h, m] = timeStr.split(':'); const hour = parseInt(h); const ampm = hour >= 12 ? 'PM' : 'AM';
      const hr = hour % 12 || 12; return `${hr}:${m} ${ampm}`;
    } catch (e) { return timeStr; }
  };

  // --- CORE DERIVED LOGIC ---
  const now = new Date();
  const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const allTasks = scheduledMeetings.flatMap(m => (m.tasks || []).map(t => ({ ...t, roomId: m.roomId, roomTitle: m.title })));
  const doneTasksCount = allTasks.filter(t => t.status === 'done').length;

  const pastMeetingsFiltered = scheduledMeetings
    .filter(m => {
      const isPast = m.status === 'Completed' || m.date < currentDateStr || (m.date === currentDateStr && m.time < currentTimeStr);
      if (!isPast) return false;
      const matchesSearch = m.title.toLowerCase().includes(historySearch.toLowerCase());
      const matchesFilter = historyFilter === 'all' ? true : historyFilter === 'completed' ? m.status === 'Completed' : m.status !== 'Completed';
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });

  const pagedHistory = pastMeetingsFiltered.slice(0, historyPage * itemsPerPage);
  const upcomingMeetings = scheduledMeetings.filter(m => m.status !== 'Completed' && (m.date > currentDateStr || (m.date === currentDateStr && m.time >= currentTimeStr)));

  const filteredTasks = allTasks.filter(t =>
    t.text.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.roomTitle.toLowerCase().includes(taskSearch.toLowerCase())
  );

  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  // Analytics Helpers
  const meetingDatesMap = scheduledMeetings.reduce((acc, m) => { const d = m.date.substring(5); acc[d] = (acc[d] || 0) + 1; return acc; }, {} as Record<string, number>);
  const trendData = Object.keys(meetingDatesMap).sort().slice(-7).map(date => ({ name: date, Meetings: meetingDatesMap[date] }));
  const pieChartData = [
    { name: 'To Do', value: todoTasks.length, color: '#f43f5e' },
    { name: 'Processing', value: inProgressTasks.length, color: '#f59e0b' },
    { name: 'Done', value: doneTasks.length, color: '#10b981' },
  ].filter(item => item.value > 0);

  const meetingWiseData = scheduledMeetings.filter(m => m.tasks && m.tasks.length > 0).slice(-6).map(m => ({
    name: m.title.length > 12 ? m.title.substring(0, 12) + '...' : m.title, fullTitle: m.title, date: m.date, total: (m.tasks || []).length, Done: (m.tasks || []).filter(t => t.status === 'done').length, progress: Math.round(((m.tasks || []).filter(t => t.status === 'done').length / (m.tasks || []).length) * 100)
  }));

  const exportAnalyticsCSV = () => {
    if (meetingWiseData.length === 0) { showToast("No data available", "error"); return; }
    const rows = meetingWiseData.map(m => `"${m.fullTitle}",${m.date},${m.total},${m.Done},${m.progress}%`);
    const csvContent = "data:text/csv;charset=utf-8,Meeting,Date,Tasks,Done,Progress\n" + rows.join('\n');
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "IntellMeet_Analytics.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("Report Exported!", "success");
  };

  const tabList = ['home', 'schedule', 'history', 'tasks', 'analytics', 'profile'];
  const activeIndex = tabList.indexOf(activeTab);
  const filterList = ['all', 'completed', 'expired'] as const;
  const activeFilterIndex = filterList.indexOf(historyFilter);

  return (
    <div className="min-h-[100dvh] bg-[#020617] text-white flex flex-col md:flex-row font-sans relative overflow-hidden">

      {/* SIDEBAR */}
      {!showScheduleModal && !showTerminateModal && (
        <div
          className={`
            fixed md:sticky top-0 left-0 h-full z-[210]
            bg-[#020617]/95 backdrop-blur-3xl border-r border-white/10
            flex flex-col
            transition-all duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            w-[280px] sm:w-[320px] ${isSidebarOpen ? 'md:w-64' : 'md:w-20'}
            overflow-y-auto overflow-x-hidden
            `}
        >

          {/* Top Section */}
          <div
            className={`flex items-center justify-between md:justify-start gap-3 p-6 border-b border-white/10 h-[80px] ${!isSidebarOpen && 'md:justify-center'
              }`}
          >
            <div className="flex items-center gap-3">
              <button
                className="bg-gradient-to-br from-teal-500 to-cyan-500 p-2 rounded-xl shadow-lg shadow-cyan-500/30 hover:scale-110 active:scale-90 transition-transform flex-shrink-0"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
              </button>

              {isSidebarOpen && (
                <h1 className="text-lg md:text-xl font-bold tracking-[0.15em] bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent whitespace-nowrap overflow-hidden uppercase">
                  INTELLMEET
                </h1>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-col w-full flex-1 p-3 gap-2 relative">

            {/* Active Indicator */}
            {isSidebarOpen && (
              <div
                className="hidden md:block absolute left-3 right-3 h-[48px] bg-cyan-500/10 border border-cyan-500/30 rounded-xl transition-all duration-300 ease-in-out z-0 pointer-events-none shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                style={{
                  transform: `translateY(${activeIndex * 56}px)`
                }}
              />
            )}

            {tabList.map((id) => {
              const icons: Record<string, any> = {
                home: Video,
                schedule: Calendar,
                history: History,
                tasks: CheckSquare,
                analytics: BarChart3,
                profile: User
              };

              const Icon = icons[id];

              return (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id as any);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`flex items-center gap-4 p-3 md:px-4 md:py-3 rounded-xl transition-all duration-300 relative z-10 h-[48px] w-full ${!isSidebarOpen && 'md:justify-center'
                    } ${activeTab === id
                      ? 'text-cyan-400'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <Icon
                    size={20}
                    className={activeTab === id ? 'scale-110' : ''}
                  />

                  {isSidebarOpen && (
                    <span className="text-xs font-black tracking-widest uppercase">
                      {id}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Logout Container (Fixed to Bottom) */}
          <div className="mt-auto p-4 border-t border-white/10">
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className={`flex items-center gap-4 w-full p-3 rounded-xl text-red-400/80 hover:bg-red-500/10 transition-all group ${!isSidebarOpen && 'justify-center'
                }`}
            >
              <LogOut
                size={20}
                className="group-hover:translate-x-1 transition-transform"
              />

              {isSidebarOpen && (
                <span className="text-xs font-black tracking-widest uppercase">
                  Logout
                </span>
              )}
            </button>
          </div>

        </div>
      )}

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && !showScheduleModal && !showTerminateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* CONTENT AREA */}
      <div className="flex-1 flex flex-col w-full min-h-screen relative overflow-x-hidden">

        {/* MOBILE HEADER (Visible only on small screens) */}
        {!showScheduleModal && !showTerminateModal && (
          <div className="md:hidden flex items-center p-4 border-b border-white/10 bg-[#020617]/80 backdrop-blur-2xl sticky top-0 z-[130]">
            <div className="flex items-center gap-4" onClick={() => setIsSidebarOpen(true)}>
              <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-2 rounded-lg shadow-md">
                <Menu size={18} className="text-white" />
              </div>
              <h1 className="text-base font-bold tracking-widest text-white uppercase">
                INTELLMEET
              </h1>
            </div>
          </div>
        )}

        <div className="flex-1 w-full overflow-y-auto overflow-x-hidden relative z-10 transition-all duration-500" onMouseMove={handleMouseMove} onMouseEnter={() => setIsMouseOnMain(true)}>
          {/* Animated Background Canvas */}
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none bg-[#020617]">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-[0.15] blur-3xl animate-gradient"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>
            <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            {isMouseOnMain && (
              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(200px circle at ${mouse.x - (window.innerWidth > 768 ? (isSidebarOpen ? 256 : 80) : 0)}px ${mouse.y}px, rgba(34,211,238,0.18), transparent 60%)` }} />)}</div>
          {isMouseOnMain && trailPoints.map((p, i) => (
            <div key={i} className="absolute pointer-events-none rounded-full" style={{ left: p.x - (window.innerWidth > 768 ? (isSidebarOpen ? 256 : 80) : 0), top: p.y, width: 160 - i * 8, height: 160 - i * 8, transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(34,211,238,0.25), transparent 70%)", opacity: 0.7 - i * 0.06, filter: "blur(14px)", zIndex: 0 }} />
          ))}

          <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 md:p-10 pb-24 md:pb-10 relative z-20">
            {toast && (<div className={`fixed top-4 right-4 p-4 rounded-xl shadow-2xl z-[300] border-l-4 animate-in slide-in-from-top-4 fade-in ${toast.type === 'success' ? 'bg-slate-900 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-red-500 text-red-400'}`}><p className="font-semibold text-sm">{toast.msg}</p></div>)}

            {/* SCHEDULE MEETING MODAL */}
            {showScheduleModal && (
              <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 overflow-hidden">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowScheduleModal(false)}></div>
                <div className="bg-white/[0.05] backdrop-blur-3xl border border-white/10 rounded-[2rem] w-full max-w-md p-6 sm:p-8 relative shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300 z-10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] -mr-16 -mt-16"></div>
                  <button onClick={() => setShowScheduleModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors z-10"><X size={20} /></button>
                  <div className="mb-8">
                    <div className="bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-cyan-500/30 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><Calendar size={24} className="text-cyan-400" /></div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase tracking-widest">Schedule Meeting</h2>
                  </div>
                  <form onSubmit={handleScheduleMeeting} className="space-y-5 relative">
                    <input type="text" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Session Title" className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-cyan-400 transition-all placeholder:text-slate-600" required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-cyan-400 transition-all text-slate-300 [color-scheme:dark]" required />
                      <input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-cyan-400 transition-all text-slate-300 [color-scheme:dark]" required />
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-400 cursor-pointer group/label">
                      <input type="checkbox" checked={isWaitingRoom} onChange={(e) => setIsWaitingRoom(e.target.checked)} className="rounded-md text-cyan-500 bg-black/50 border-white/20 w-5 h-5 focus:ring-cyan-500/50 transition-all" />
                      <span className="group-hover:text-white transition-colors">Enable Waiting Room</span>
                    </label>
                    <button type="submit" disabled={isScheduling} className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.97] flex justify-center items-center gap-2 tracking-widest uppercase text-xs">
                      {isScheduling ? <Loader2 size={18} className="animate-spin" /> : "Confirm Schedule"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TERMINATE MODAL */}
            {showTerminateModal && (
              <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-rose-950/40 backdrop-blur-xl" onClick={closeModal} />
                <div ref={modalRef} role="dialog" aria-modal="true" className={`bg-rose-950/30 backdrop-blur-3xl border border-rose-500/30 rounded-[2.5rem] w-full max-w-sm p-8 sm:p-10 relative shadow-[0_0_100px_rgba(244,63,94,0.3)] overflow-hidden z-10 transition-all duration-200 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} ${isShaking ? 'animate-shake' : ''}`} onClick={(e) => e.stopPropagation()}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[50px] -mr-16 -mt-16" />
                  <div className="text-center">
                    <div className="bg-rose-500/20 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/30 text-rose-500"><AlertTriangle size={32} /></div>
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter mb-4">CRITICAL WIPE</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">Termination will irreversibly delete all data markers.</p>
                    <input ref={firstInputRef} type="text" placeholder={`Type ${deleteHint} to confirm`} value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)} className="w-full mb-6 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-rose-400" />
                    <button onClick={() => { if (confirmDeleteText !== 'DELETE') { setIsShaking(true); setTimeout(() => setIsShaking(false), 400); return; } handleFinalWipe(); }} disabled={confirmDeleteText !== 'DELETE'} className={`w-full font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-widest active:scale-95 ${confirmDeleteText === 'DELETE' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-rose-900/40 text-rose-300 cursor-not-allowed'}`}>Proceed with Termination</button>
                    <button onClick={closeModal} className="w-full mt-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-4 rounded-2xl transition-all uppercase text-[10px] tracking-widest">Abort Process</button>
                  </div>
                </div>
              </div>
            )}

            {/* HOME TAB */}
            {activeTab === 'home' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 w-full">
                <div className="relative group mb-12">
                  <div className="absolute -inset-x-20 -top-20 h-64 bg-cyan-500/5 blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-[2.5rem] rotate-45 group-hover:rotate-90 group-hover:border-cyan-400 transition-all duration-1000" />
                        <div className="absolute inset-2 border border-white/10 rounded-[2rem] -rotate-12 group-hover:rotate-0 transition-all duration-700" />
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-[#020617] border border-white/20 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative">
                          {user?.profilePic ? <img src={user.profilePic} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Profile" /> : <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950"><span className="text-2xl sm:text-3xl font-black text-cyan-500 font-mono">{(user?.name || 'U').charAt(0)}</span></div>}
                          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-transparent opacity-50" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 z-20">
                          <div className="relative flex h-5 w-5 sm:h-6 sm:w-6">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-20"></span>
                            <span className="relative inline-flex rounded-full h-full w-full bg-[#020617] border border-cyan-500 items-center justify-center"><div className="h-2 w-2 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" /></span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center md:text-left pt-2 sm:pt-4 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 w-fit mx-auto md:mx-0">
                          <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                          <span className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em]">Status: Authorized_User</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest border-l border-white/10 pl-3 hidden md:block">Uplink_Node: {user?._id?.substring(0, 6).toUpperCase() || 'CORE_01'}</span>
                      </div>
                      <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tighter leading-tight mb-4 bg-gradient-to-r from-white via-cyan-100 to-teal-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">Welcome, {user?.name || 'User'}</h2>
                      <p className="text-slate-400 text-sm md:text-base font-medium max-w-lg flex items-center gap-3 justify-center md:justify-start">
                        <span className="font-mono text-cyan-500/50">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
                        Neural sync complete. Ready to orchestrate session.
                      </p>
                    </div>
                  </div>
                  <div className="mt-10 flex items-center gap-4 opacity-50">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent" />
                    <div className="flex gap-1">{[...Array(4)].map((_, i) => (<div key={i} className="h-1 w-1 rounded-full bg-slate-800" />))}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[
                    { label: "Meetings", value: "12", icon: Video, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                    { label: "Hours", value: "36h", icon: Clock, color: "text-purple-400", bg: "bg-purple-500/10" },
                    { label: "Tasks", value: allTasks.length, icon: CheckSquare, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { label: "Efficiency", value: "92%", icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10" },
                  ].map((item, i) => (
                    <div key={i} className="group relative bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 transition-all duration-500 hover:scale-[1.05] hover:border-white/20 hover:shadow-2xl overflow-hidden">
                      <div className={`absolute top-0 right-0 w-20 sm:w-24 h-20 sm:h-24 ${item.bg} blur-[50px] -mr-12 -mt-12 transition-all duration-500 group-hover:scale-150`}></div>
                      <div className="relative z-10 flex flex-col items-center md:items-start gap-4">
                        <div className={`p-2.5 sm:p-3 rounded-2xl ${item.bg} border border-white/5 transition-transform duration-500 group-hover:rotate-[10deg] group-hover:scale-110 shadow-lg`}><item.icon size={20} className={item.color} /></div>
                        <div className="text-center md:text-left">
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{item.label}</p>
                          <p className="text-xl sm:text-3xl font-bold text-white tracking-tight font-mono">{item.value}</p>
                        </div>
                      </div>
                      <div className={`absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent transition-all duration-700 group-hover:w-full`}></div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {/* NEW MEETING CARD */}
                  <div className="group relative bg-white/[0.04] backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[2rem] transition-all duration-500 shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden hover:-translate-y-2">
                    <div className="absolute inset-0 rounded-[2rem] border border-cyan-500/20 group-hover:border-cyan-400/50 transition"></div>
                    <div className="absolute top-0 right-0 w-48 sm:w-56 h-48 sm:h-56 bg-cyan-500/10 blur-[100px] group-hover:bg-cyan-500/20"></div>
                    <div className="relative">
                      <div className="bg-gradient-to-br from-teal-500/30 to-cyan-500/30 border border-cyan-400/40 p-4 rounded-2xl w-fit mb-8 shadow-[0_0_20px_rgba(34,211,238,0.3)]"><Video size={32} className="text-cyan-300" /></div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-3 uppercase tracking-[0.25em]"><span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">NEW MEETING</span></h3>
                      <p className="text-slate-400 text-sm mb-8 leading-relaxed">Initialize an instant workspace with end-to-end encryption.</p>
                      <label className="flex items-center gap-3 mb-6 text-sm text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={instantWaitingRoom} onChange={(e) => setInstantWaitingRoom(e.target.checked)} className="w-5 h-5 rounded border-white/10 bg-black/40 text-cyan-500 focus:ring-cyan-500/50" /> Enable Waiting Room
                      </label>
                      <div className="space-y-5">
                        <div className="flex justify-between bg-black/60 p-4 rounded-2xl border border-white/10 group/code transition-colors hover:border-cyan-500/30">
                          <span className="text-xs sm:text-sm font-mono text-cyan-300 tracking-[0.2em]">{instantRoomCode}</span>
                          <button onClick={() => copyToClipboard(instantRoomCode)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy size={18} /></button>
                        </div>
                        <button onClick={startInstantMeeting} className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 py-4 rounded-2xl font-black text-black tracking-widest uppercase shadow-lg shadow-cyan-500/20 hover:scale-[1.03] transition active:scale-95">Connect to Workspace</button>
                      </div>
                    </div>
                  </div>

                  {/* JOIN MEETING CARD */}
                  <div className="group relative bg-white/[0.04] backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[2rem] transition-all duration-500 shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden hover:-translate-y-2">
                    <div className="absolute inset-0 border border-emerald-500/20 rounded-[2rem] group-hover:border-emerald-400/50"></div>
                    <div className="absolute top-0 right-0 w-48 sm:w-56 h-48 sm:h-56 bg-emerald-500/10 blur-[100px] group-hover:bg-emerald-500/20"></div>
                    <div className="relative">
                      <div className="bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-400/40 p-4 rounded-2xl w-fit mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)]"><Users size={32} className="text-emerald-300" /></div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-3 uppercase tracking-[0.25em]"><span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">JOIN MEETING</span></h3>
                      <p className="text-slate-400 text-sm mb-8 leading-relaxed">Sync with an active workspace using a sequence code.</p>
                      <form onSubmit={handleJoin} className="space-y-5">
                        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter Sequence Code" className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 font-mono focus:outline-none focus:border-emerald-500/50 transition-colors" />
                        <button type="submit" disabled={!joinCode.trim()} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 py-4 rounded-2xl font-black text-black tracking-widest uppercase shadow-lg shadow-cyan-500/20 hover:scale-[1.03] transition active:scale-95 disabled:opacity-50 disabled:grayscale">Join Workspace</button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* RECENT ACTIVITY */}
                <div className="bg-white/[0.04] border border-white/10 rounded-[2rem] p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
                  <h3 className="text-xl font-bold mb-6 text-slate-200 flex items-center gap-3"><Activity size={20} className="text-cyan-400" /> System Logs / Recent Activity</h3>
                  <div className="space-y-4 text-sm">
                    {[
                      { label: "Meeting completed", time: "2h ago", color: "text-cyan-400" },
                      { label: "Task generated", time: "5h ago", color: "text-purple-400" },
                      { label: "Joined workspace", time: "Yesterday", color: "text-emerald-400" },
                    ].map((log, i) => (
                      <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl hover:bg-white/5 transition-colors group/log border border-transparent hover:border-white/5">
                        <span className="text-slate-400 group-hover/log:text-slate-200 transition-colors">{log.label}</span>
                        <span className={`font-mono text-xs ${log.color} opacity-80 mt-1 sm:mt-0`}>{log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}


            {/* SCHEDULE TAB */}
            {activeTab === 'schedule' && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 w-full">
                <div className="relative group mb-12">
                  <div className="absolute -inset-x-20 -top-20 h-64 bg-cyan-500/5 blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-[2.5rem] rotate-45 group-hover:rotate-90 group-hover:border-cyan-400 transition-all duration-1000" />
                        <div className="absolute inset-2 border border-white/10 rounded-[2rem] -rotate-12 group-hover:rotate-0 transition-all duration-700" />
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-[#020617] border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative"><Calendar size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" /></div>
                      </div>
                    </div>
                    <div className="text-center md:text-left pt-2 sm:pt-4 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 w-fit"><div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" /><span className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em]">System_Status: Orchestrating_Syncs</span></div>
                          </div>
                          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight mb-2 bg-gradient-to-r from-white via-cyan-100 to-teal-400 bg-clip-text text-transparent">Planned Sessions</h2>
                          <p className="text-slate-400 font-medium italic">Manage upcoming team sync protocols.</p>
                        </div>
                        <button onClick={() => setShowScheduleModal(true)} className="w-full sm:w-auto flex justify-center items-center gap-3 bg-white/5 hover:bg-cyan-500 hover:text-black border border-white/10 px-6 py-4 rounded-[1.8rem] font-black transition-all shadow-xl uppercase tracking-[0.2em] text-[10px]">
                          <Plus size={18} /> Schedule New Session
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* INSIGHTS */}
                  <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 group hover:border-cyan-500/40 transition-all duration-500">
                    <div className="flex items-center gap-5">
                      <div className="p-4 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg"><Activity size={24} /></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Total Matrix</p><p className="text-2xl font-bold text-white font-mono">{scheduledMeetings.length}</p></div>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 group hover:border-yellow-500/40 transition-all duration-500">
                    <div className="flex items-center gap-5">
                      <div className="p-4 rounded-2xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-lg"><Calendar size={24} /></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Pending Syncs</p><p className="text-2xl font-bold text-white font-mono">{upcomingMeetings.length}</p></div>
                    </div>
                  </div>
                  <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 group hover:border-emerald-500/40 transition-all duration-500">
                    <div className="flex items-center gap-5">
                      <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg"><CheckCircle2 size={24} /></div>
                      <div><p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Finalized</p><p className="text-2xl font-bold text-white font-mono">{scheduledMeetings.filter(m => m.status === 'Completed').length}</p></div>
                    </div>
                  </div>
                </div>

                <div className="mt-12">
                   <h3 className="text-xs text-slate-500 uppercase tracking-[0.3em] mb-5 font-black flex items-center gap-3">Suggested Time Slots</h3>
                   <div className="flex flex-wrap gap-4">
                     {["10:00 AM", "12:30 PM", "03:00 PM", "06:15 PM"].map((slot, i) => (
                       <button key={i} onClick={() => { setMeetingTime(slot.split(' ')[0]); setShowScheduleModal(true); }} className="px-5 py-3 text-xs font-mono font-bold rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all">{slot}</button>
                     ))}
                   </div>
                </div>

                <div className="mt-12">
                  {upcomingMeetings.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 sm:p-20 backdrop-blur-3xl text-center">
                      <Calendar size={64} className="text-slate-700 mx-auto mb-6" />
                      <h3 className="text-xl sm:text-2xl font-bold mb-2 uppercase tracking-widest text-white">No Upcoming Meetings</h3>
                      <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">Archive buffer empty. Start a new meeting to begin.</p>
                      <button onClick={startInstantMeeting} className="bg-cyan-500 text-black px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest">Start Instant Meeting</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {upcomingMeetings.map((m) => (
                        <div key={m._id} className="bg-white/[0.04] backdrop-blur-xl border border-white/10 p-6 sm:p-8 rounded-[2.5rem] group hover:border-cyan-500/40 transition-all hover:-translate-y-1">
                          <div className="flex justify-between items-start mb-6">
                            <h3 className="font-bold text-lg truncate pr-4 text-white uppercase">{m.title}</h3>
                            {m.isWaitingRoom && <span className="text-[8px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-1 rounded-full font-black uppercase">Wait</span>}
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-xs mb-8"><Clock size={14} />{m.date} | {formatDisplayTime(m.time)}</div>
                          <div className="flex gap-2">
                             <button onClick={() => navigate(`/meeting/${m.roomId}`)} className="flex-1 bg-cyan-500 text-black font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all">Sync Now</button>
                             <button onClick={() => handleDeleteMeeting(m._id)} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-500 hover:text-red-500 transition-all"><Trash2 size={18}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 w-full">
                <div className="relative group mb-12">
                  <div className="absolute -inset-x-20 -top-20 h-64 bg-cyan-500/5 blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-[2.5rem] rotate-45 group-hover:rotate-90 group-hover:border-cyan-400 transition-all duration-1000" />
                        <div className="absolute inset-2 border border-white/10 rounded-[2rem] -rotate-12 group-hover:rotate-0 transition-all duration-700" />
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-[#020617] border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative"><History size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" /></div>
                      </div>
                    </div>
                    <div className="text-center md:text-left pt-2 sm:pt-4 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 w-fit mx-auto md:mx-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                              <span className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em]">Archive_System: Fetching_Logs</span>
                            </div>
                          </div>
                          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight mb-2 bg-gradient-to-r from-white via-cyan-100 to-teal-400 bg-clip-text text-transparent">Session Archive</h2>
                          <p className="text-slate-400 font-medium italic text-sm">Neural retrieval of legacy workspace data protocols.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:pl-[136px] mt-8 relative z-10">
                    <div className="relative w-full sm:flex-1 max-w-md group/search">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-cyan-400 transition-colors" size={18} />
                      <input type="text" placeholder="Search records..." value={historySearch} onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }} className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none focus:border-cyan-500/50" />
                    </div>
                    <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-[1.2rem] w-full sm:w-auto">
                      {filterList.map((f) => (
                        <button key={f} onClick={() => { setHistoryFilter(f); setHistoryPage(1); }} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${historyFilter === f ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {pagedHistory.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 sm:p-20 text-center uppercase tracking-widest text-slate-700 font-black">No Records Found</div>
                  ) : (
                    <>
                      {pagedHistory.map((m) => (
                        <div key={m._id} className="group bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 sm:p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-white/[0.05] transition-all">
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="h-12 w-12 rounded-2xl bg-black/40 flex items-center justify-center text-cyan-500 flex-shrink-0"><History size={20} /></div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-white truncate uppercase text-sm sm:text-base">{m.title}</h4>
                              <p className="text-[10px] text-slate-500 font-mono uppercase">{m.date} | {m.roomId.split('-')[0]}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full md:w-auto">
                            {(m.status === 'Completed' || m.summary) && <button onClick={() => navigate(`/summary/${m.roomId}`)} className="flex-1 md:flex-none bg-purple-500/10 border border-purple-500/20 text-purple-400 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all">Summary</button>}
                            <button onClick={() => navigate(`/meeting/${m.roomId}`)} className="flex-1 md:flex-none bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all">Re-Sync</button>
                            <button onClick={() => handleDeleteMeeting(m._id)} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-600 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-8 relative z-10">
                        {pastMeetingsFiltered.length > pagedHistory.length && (
                          <button
                            onClick={() => setHistoryPage(prev => prev + 1)}
                            className="group flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black text-cyan-400 px-10 py-4 rounded-2xl font-black transition-all shadow-xl uppercase tracking-[0.2em] text-[10px] active:scale-95"
                          >
                            <Activity size={16} className="group-hover:animate-pulse" />
                            Load More Records
                            <ChevronDown size={16} />
                          </button>
                        )}
                        {historyPage > 1 && (
                          <button
                            onClick={() => setHistoryPage(1)}
                            className="group flex items-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 px-10 py-4 rounded-2xl font-black transition-all uppercase tracking-[0.2em] text-[10px] active:scale-95"
                          >
                            Show Less
                            <ChevronUp size={16} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 w-full">
                <div className="relative group mb-12">
                  <div className="absolute -inset-x-20 -top-20 h-64 bg-cyan-500/5 blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-[2.5rem] rotate-45 group-hover:rotate-90 group-hover:border-cyan-400 transition-all duration-1000" />
                        <div className="absolute inset-2 border border-white/10 rounded-[2rem] -rotate-12 group-hover:rotate-0 transition-all duration-700" />
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-[#020617] border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative"><CheckSquare size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" /></div>
                      </div>
                    </div>
                    <div className="text-center md:text-left pt-2 sm:pt-4 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 w-fit mx-auto md:mx-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                              <span className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em]">Task_Engine: Processing_Matrix</span>
                            </div>
                          </div>
                          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight mb-2 bg-gradient-to-r from-white via-cyan-100 to-teal-400 bg-clip-text text-transparent uppercase">Intelligence Board</h2>
                          <div className="relative max-w-md mx-auto md:mx-0 mt-6 group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/50" size={18} />
                            <input type="text" placeholder="Query Board Matrix..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none focus:border-cyan-500/50" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-start relative z-10">
                  {[
                    { title: 'To Do', color: 'bg-rose-500', key: 'todo' },
                    { title: 'Processing', color: 'bg-amber-500', key: 'in-progress' },
                    { title: 'Finalized', color: 'bg-emerald-500', key: 'done' }
                  ].map((col) => (
                    <div key={col.key} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key as any)} className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 flex flex-col max-h-[80vh] min-h-[400px]">
                      <div className="mb-6 flex items-center justify-between pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${col.color} animate-pulse shadow-[0_0_10px_currentColor]`} />
                          <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-200">{col.title}</h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">[{filteredTasks.filter(t => t.status === col.key).length}]</span>
                      </div>
                      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredTasks.filter(t => t.status === col.key).map((t) => (
                          <div key={t.id} draggable onDragStart={(e) => handleDragStart(e, t.id, t.roomId)} className="bg-black/40 p-5 rounded-2xl border border-white/5 cursor-grab active:cursor-grabbing hover:border-cyan-500/40 transition-all group">
                            <p className={`text-sm leading-relaxed mb-4 ${col.key === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{t.text}</p>
                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                              <span className="text-[8px] uppercase tracking-widest font-black text-slate-500">{t.assigneeName || 'OPERATOR'}</span>
                              <div className="flex gap-2">
                                <button onClick={() => handleDeleteTask(t.roomId, t.id)} className="text-slate-700 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                                {col.key !== 'done' && <button onClick={() => handleUpdateTaskStatus(t.roomId, t.id, col.key === 'todo' ? 'in-progress' : 'done')} className="text-slate-700 hover:text-cyan-400 transition-colors"><ArrowRight size={14} /></button>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 w-full min-w-0">
                <div className="relative group mb-12">
                  <div className="absolute -inset-x-20 -top-20 h-64 bg-cyan-500/5 blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-[2.5rem] rotate-45 group-hover:rotate-90 group-hover:border-cyan-400 transition-all duration-1000" />
                        <div className="absolute inset-2 border border-white/10 rounded-[2rem] -rotate-12 group-hover:rotate-0 transition-all duration-700" />
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-[#020617] border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative"><BarChart3 size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" /></div>
                      </div>
                    </div>
                    <div className="text-center md:text-left pt-2 sm:pt-4 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 w-fit mx-auto md:mx-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                              <span className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em]">Metrics_System: Analyzing_Data</span>
                            </div>
                          </div>
                          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight mb-2 bg-gradient-to-r from-white via-cyan-100 to-teal-400 bg-clip-text text-transparent">Intelligence Insights</h2>
                          <p className="text-slate-400 font-medium italic text-sm">Advanced productivity mapping and performance synchronization.</p>
                        </div>
                        <button onClick={exportAnalyticsCSV} className="w-full sm:w-auto bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600 hover:text-black text-emerald-400 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all">
                          <Download size={18} /> Export Matrix
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 relative z-10">
                   {[
                     { label: 'Meetings', val: scheduledMeetings.length, icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                     { label: 'Tasks', val: allTasks.length, icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                     { label: 'Finalized', val: doneTasksCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                     { label: 'Efficiency', val: `${allTasks.length > 0 ? Math.round((doneTasksCount / allTasks.length) * 100) : 0}%`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' }
                   ].map((kpi, i) => (
                     <div key={i} className="bg-white/[0.03] border border-white/10 p-6 rounded-[2rem] flex flex-col items-center text-center transition-all hover:border-white/20">
                       <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color} mb-4`}><kpi.icon size={20} /></div>
                       <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.label}</h4>
                       <span className="text-xl sm:text-3xl font-bold font-mono text-white">{kpi.val}</span>
                     </div>
                   ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 relative z-10">
                   <div className="bg-white/[0.02] border border-white/10 p-6 sm:p-8 rounded-[2.5rem] h-[400px] group">
                     <h3 className="text-[10px] font-black mb-8 text-slate-500 uppercase tracking-[0.4em]">Neural Trend Visualizer</h3>
                     <ResponsiveContainer width="100%" height="80%">
                       <AreaChart data={trendData}>
                         <defs><linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                         <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                         <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                         <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                         <RechartsTooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }} />
                         <Area type="monotone" dataKey="Meetings" stroke="#22d3ee" strokeWidth={3} fill="url(#colorMeetings)" />
                       </AreaChart>
                     </ResponsiveContainer>
                   </div>

                   <div className="bg-white/[0.02] border border-white/10 p-6 sm:p-8 rounded-[2.5rem] h-[400px]">
                     <h3 className="text-[10px] font-black mb-8 text-slate-500 uppercase tracking-[0.4em]">Logic Distribution</h3>
                     <ResponsiveContainer width="100%" height="80%">
                       <PieChart>
                         <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                           {pieChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                         </Pie>
                         <RechartsTooltip contentStyle={{ backgroundColor: '#020617', border: 'none', borderRadius: '12px' }} />
                       </PieChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] overflow-hidden relative z-10">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-white/5 text-[9px] text-slate-500 uppercase font-black tracking-[0.3em]">
                          <th className="p-6">Workspace Title</th>
                          <th className="p-6">Sync Date</th>
                          <th className="p-6 text-center">Neural Buffer</th>
                          <th className="p-6">State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {meetingWiseData.length > 0 ? meetingWiseData.map((m, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.04] transition-all text-xs">
                            <td className="p-6 font-black uppercase tracking-widest text-slate-200">{m.fullTitle}</td>
                            <td className="p-6 font-mono text-slate-500">{m.date}</td>
                            <td className="p-6 text-center"><span className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-cyan-300 font-mono text-[10px]">{m.total} Units</span></td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <div className="w-full bg-white/5 h-1 rounded-full"><div className={`h-full rounded-full ${m.progress === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`} style={{ width: `${m.progress}%` }} /></div>
                                <span className="font-mono text-[10px] text-slate-400">{m.progress}%</span>
                              </div>
                            </td>
                          </tr>
                        )) : <tr><td colSpan={4} className="p-20 text-center text-slate-700 italic uppercase tracking-[0.4em] text-[10px] font-black">Matrix Empty</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-5xl mx-auto pb-10">
                <div className="relative group mb-12">
                  <div className="absolute -inset-x-20 -top-20 h-64 bg-cyan-500/5 blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 relative z-10">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-[2.5rem] rotate-45 group-hover:rotate-90 group-hover:border-cyan-400 transition-all duration-1000" />
                        <div className="absolute inset-2 border border-white/10 rounded-[2rem] -rotate-12 group-hover:rotate-0 transition-all duration-700" />
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-[#020617] border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative"><User size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" /></div>
                      </div>
                    </div>
                    <div className="text-center md:text-left pt-2 sm:pt-4 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 w-fit mx-auto md:mx-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                              <span className="text-[9px] font-mono text-slate-300 uppercase tracking-[0.2em]">Profile_System: Config_Active</span>
                            </div>
                          </div>
                          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight mb-2 bg-gradient-to-r from-white via-cyan-100 to-teal-400 bg-clip-text text-transparent uppercase">Intelligence Profile</h2>
                          <p className="text-slate-500 mt-2 italic text-sm">Configure system identity and security protocols matrix.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white/[0.03] border border-white/10 p-6 sm:p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group/card transition-all duration-500 hover:border-white/20">
                      <h3 className="text-xs font-black mb-8 flex items-center gap-3 uppercase tracking-[0.4em] text-slate-400 group-hover/card:text-cyan-400 transition-colors"><User size={16} /> Identity Matrix</h3>
                      <div className="flex flex-col sm:flex-row items-center gap-8 lg:gap-12 mb-10 pb-10 border-b border-white/5">
                        <div className="relative group/avatar">
                          <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-[2.5rem] bg-black/60 border-2 border-white/10 flex items-center justify-center overflow-hidden transition-all duration-500 group-hover/avatar:border-cyan-500/50">
                            {avatarPreview ? <img src={avatarPreview} className="h-full w-full object-cover" alt="Preview" /> : user?.profilePic ? <img src={user.profilePic} className="h-full w-full object-cover" alt="Avatar" /> : <span className="text-6xl font-black text-white opacity-20">{(user?.name || 'U').charAt(0)}</span>}
                            {isUploadingAvatar && <div className="absolute inset-0 bg-[#020617]/80 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" size={32} /></div>}
                          </div>
                          <label className="absolute -bottom-3 -right-3 bg-gradient-to-br from-teal-500 to-cyan-500 p-3 rounded-2xl cursor-pointer shadow-xl hover:scale-110 transition-all z-20">
                            <Camera size={20} className="text-[#020617]" />
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                          </label>
                        </div>
                        <div className="flex-1 space-y-2 text-center sm:text-left">
                          <p className="text-lg font-bold text-white uppercase tracking-widest">Neural Link</p>
                          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">Update system biometric identifier signature (Max 2MB).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Alias Signature</label>
                          <div className="relative group/input">
                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within/input:text-cyan-400 transition-colors" />
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-cyan-500/50 text-white font-mono" placeholder="Enter Alias..." />
                          </div>
                        </div>
                        <div className="space-y-3 opacity-60">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Relay Email</label>
                          <div className="relative"><Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" /><input type="email" value={user?.email || ''} disabled className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pl-12 text-sm text-slate-500 cursor-not-allowed font-mono" /></div>
                        </div>
                      </div>
                      <button onClick={handleUpdateProfile} disabled={isUpdatingProfile || newName === user?.name} className="mt-10 w-full sm:w-auto bg-white/5 hover:bg-cyan-500 hover:text-black border border-white/10 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-xl uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-4 disabled:opacity-20">{isUpdatingProfile ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Update Protocol</button>
                    </div>

                    <div className="bg-rose-500/[0.02] border border-rose-500/10 p-6 sm:p-8 rounded-[2.5rem] flex flex-col sm:flex-row justify-between items-center gap-6 group hover:bg-rose-500/[0.05] transition-all">
                       <div className="flex items-center gap-5 text-center sm:text-left">
                         <div className="bg-rose-500/10 p-4 rounded-2xl text-rose-500 group-hover:scale-110 transition-transform"><UserMinus size={24} /></div>
                         <div><h4 className="text-sm font-black text-white uppercase tracking-widest">Terminate Identity</h4><p className="text-xs text-slate-500 italic">Irreversibly wipe all neural archives.</p></div>
                       </div>
                       <button onClick={() => setShowTerminateModal(true)} className="w-full sm:w-auto text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] hover:bg-rose-500 hover:text-white px-8 py-3 rounded-xl transition-all border border-rose-500/20">Execute Wipe</button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 p-6 sm:p-10 rounded-[3rem] shadow-2xl transition-all hover:border-white/20 group/crypto">
                      <h3 className="text-xs font-black mb-10 flex items-center gap-3 uppercase tracking-[0.4em] text-slate-400 group-hover/crypto:text-emerald-400 transition-colors"><Lock size={16} /> Cryptography</h3>
                      <div className="space-y-6">
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current_Key</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm focus:border-emerald-500/50 outline-none text-white font-mono" placeholder="••••••••" /></div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-end px-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New_Cipher</label><span className={`text-[9px] font-black uppercase tracking-widest ${passStrength.color.replace('bg-', 'text-')}`}>{passStrength.label}</span></div>
                          <input type="password" value={newPassword} onChange={(e) => checkPasswordStrength(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm focus:border-emerald-500/50 outline-none text-white font-mono" placeholder="Min. 6 chars" />
                          <div className="flex gap-2 h-1.5 px-1">{[1, 2, 3].map(i => (<div key={i} className={`h-full flex-1 rounded-full transition-all duration-700 ${passStrength.score >= i ? passStrength.color : 'bg-white/5'}`} />))}</div>
                        </div>
                        <button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !currentPassword || newPassword.length < 6} className="w-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black text-emerald-400 font-black py-4 rounded-2xl transition-all text-[10px] uppercase tracking-widest flex justify-center items-center gap-3 disabled:opacity-20">{isUpdatingPassword ? <Loader2 size={18} className="animate-spin" /> : <TrendingUp size={18} />} Re-Encrypt Matrix</button>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/5 border border-white/5"><p className="text-[9px] text-slate-600 leading-relaxed font-medium uppercase tracking-widest italic">AES-256-GCM protocol active. Pass-keys are hashed via PBKDF2 logic.</p></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:resettoken" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/meeting/:roomId" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
        <Route path="/summary/:roomId" element={<ProtectedRoute><MeetingSummary /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}