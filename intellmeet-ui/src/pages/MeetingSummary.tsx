import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Loader2, BarChart3, Users, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '../store/authStore'; 

export default function MeetingSummary() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentUser = useAuthStore((state: any) => state.user);

  useEffect(() => {
    const fetchMeetingData = async () => {
      try {
        const base_url = ((import.meta as any).env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/api\/?$/, '');
        const token = localStorage.getItem('token');
        
        const res = await fetch(`${base_url}/api/meetings/room/${roomId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setMeeting(data);
        }
      } catch (err) {
        console.error("Failed to fetch meeting summary", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingData();
  }, [roomId]);

  const downloadNotes = () => {
    if (!meeting?.sharedNotes) {
      alert("No shared notes available for this meeting.");
      return;
    }
    const element = document.createElement("a");
    const file = new Blob([meeting.sharedNotes], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${meeting.title || 'Meeting'}_Shared_Notes.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
        <p className="text-lg sm:text-xl font-bold text-slate-300">Loading Summary...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center font-sans px-4">
        <p className="mb-4 text-slate-400 text-sm sm:text-base">Meeting Not Found.</p>
        <button onClick={() => navigate('/dashboard')} className="bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700 transition text-sm">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const summaryText = meeting.summary || "No AI summary was generated for this meeting.";

  const tasks = meeting.tasks || [];
  const todoCount = tasks.filter((t: any) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t: any) => t.status === 'in-progress').length;
  const doneCount = tasks.filter((t: any) => t.status === 'done').length;

  const pieChartData = [
    { name: 'To Do', value: todoCount, color: '#ef4444' },
    { name: 'In Progress', value: inProgressCount, color: '#eab308' },
    { name: 'Done', value: doneCount, color: '#10b981' },
  ].filter(item => item.value > 0);

  const host = meeting.host;
  const participants = meeting.participants || [];
  const allUsers: any[] = [];

  if (host) allUsers.push({ ...host, isHost: true });
  participants.forEach((p: any) => {
    if (!allUsers.find(u => u._id === p._id)) {
      allUsers.push({ ...p, isHost: false });
    }
  });

  const isCurrentUserHost = Boolean(currentUser?.email && host?.email && currentUser.email === host.email);

  return (
    <div className="min-h-screen bg-[#020617] text-white px-4 sm:px-6 lg:px-10 py-6 relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="max-w-6xl mx-auto relative z-10">

        {/* HEADER */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition text-sm"
          >
            <ArrowLeft size={16}/> Back
          </button>

          <button
            onClick={downloadNotes}
            className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-teal-500 to-cyan-500
            shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition"
          >
            <Download size={16}/> Download Notes
          </button>
        </div>

        {/* TOP CARD */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 md:p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] mb-6 flex flex-col md:flex-row justify-between gap-5 sm:gap-6">

          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3">
              <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent">
                {meeting.title || 'Meeting Summary'}
              </span>
            </h1>

            <div className="flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400">
              <span className="bg-white/5 border border-white/10 px-2 sm:px-3 py-1 rounded-lg">ID: {meeting.roomId}</span>
              <span className="bg-white/5 border border-white/10 px-2 sm:px-3 py-1 rounded-lg">
                {meeting.date} at {meeting.time}
              </span>
              <span className="bg-white/5 border border-white/10 px-2 sm:px-3 py-1 rounded-lg text-cyan-400">
                Completed
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full md:w-auto">
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl text-center">
              <p className="text-[10px] sm:text-xs text-slate-400">Participants</p>
              <p className="text-xl sm:text-2xl font-bold text-cyan-400">{allUsers.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4 rounded-xl text-center">
              <p className="text-[10px] sm:text-xs text-slate-400">AI Tasks</p>
              <p className="text-xl sm:text-2xl font-bold text-teal-400">{tasks.length}</p>
            </div>
          </div>

        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

          {/* SUMMARY */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">

              <h2 className="text-base sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
                <Sparkles className="text-cyan-400"/> Meeting Transcript & AI Notes
              </h2>

              <div className="bg-black/40 border border-white/10 rounded-xl p-4 sm:p-5 text-slate-300 text-xs sm:text-sm leading-relaxed">

                {summaryText.split('\n').map((line: string, i: number) => {
                  if (line.includes('**')) {
                    const parts = line.split('**');
                    return (
                      <p key={i} className="mb-3">
                        {parts.map((part, index) =>
                          index % 2 === 1
                            ? <strong key={index} className="text-white">{part}</strong>
                            : part
                        )}
                      </p>
                    );
                  }
                  if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                    return <p key={i} className="ml-4 mb-2 text-cyan-300">{line.replace(/^[-*]/, '').trim()}</p>
                  }
                  return <p key={i} className="mb-3">{line}</p>;
                })}

              </div>

            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-5 sm:space-y-6">

            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
              <h2 className="text-sm sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <BarChart3 className="text-cyan-400"/> Task Resolution
              </h2>

              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieChartData} dataKey="value">
                      {pieChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color}/>
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-28 sm:h-32 flex items-center justify-center text-slate-500 text-xs sm:text-sm bg-black/30 rounded-xl border border-white/10">
                  No tasks generated
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">

              <div className="flex justify-between mb-3 sm:mb-4">
                <h2 className="text-sm sm:text-lg font-bold flex items-center gap-2">
                  <Users className="text-cyan-400"/> Roster
                </h2>
                <span className="text-[10px] sm:text-xs bg-white/10 px-2 py-1 rounded-md">{allUsers.length} Joined</span>
              </div>

              <div className="space-y-2 sm:space-y-3">
                {allUsers.map((u, idx) => {
                  const isMe = Boolean(currentUser?.email && u?.email && currentUser.email === u.email);

                  return (
                    <div key={idx} className="bg-white/5 border border-white/10 p-2.5 sm:p-3 rounded-xl flex items-center gap-3">

                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-slate-800 flex items-center justify-center text-xs sm:text-sm font-bold">
                        {u.profilePic ? (
                          <img src={u.profilePic} className="h-full w-full object-cover rounded-full"/>
                        ) : (
                          u.name?.charAt(0)
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-bold flex items-center gap-2 flex-wrap">
                          {u.name}
                          {u.isHost && <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">HOST</span>}
                          {isMe && <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded">(You)</span>}
                        </p>

                        {(isCurrentUserHost || isMe) ? (
                          <p className="text-[10px] sm:text-xs text-slate-400 break-all">{u.email}</p>
                        ) : (
                          <p className="text-[10px] sm:text-xs text-slate-500 italic">Email hidden</p>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}