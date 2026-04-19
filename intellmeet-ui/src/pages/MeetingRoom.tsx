import { Download } from "lucide-react";
import { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare, X, Users, Pin, Hand, Smile, Settings, Shield, Star, UserMinus, Check, Circle, StopCircle, Sparkles, Loader2, Send, FileText, Plus, CheckSquare, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const FloatingEmojiStyles = () => (
  <style>{`
    @keyframes floatUp {
      0% { transform: translateY(0) scale(0.5); opacity: 0; }
      20% { transform: translateY(-50px) scale(1.2); opacity: 1; }
      100% { transform: translateY(-400px) scale(1); opacity: 0; }
    }
    .emoji-float {
      animation: floatUp 3s ease-out forwards;
    }
  `}</style>
);

interface VideoPlayerProps {
  stream: MediaStream | null;
  name: string;
  profilePic?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isLocal?: boolean;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  isScreenShare?: boolean;
}

const VideoPlayer = memo(({ stream, name, profilePic, isMuted = false, isVideoOff = false, isLocal = false, isSpeaking = false, isHandRaised = false, isScreenShare = false }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream && stream.getTracks().length > 0) {
      videoElement.srcObject = stream;
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError') console.error('Video play error:', error);
        });
      }
    }
  }, [stream, isVideoOff]);

  return (
    <div className={`bg-slate-900 h-full w-full relative flex items-center justify-center rounded-2xl overflow-hidden group border-2 shadow-lg transition-all ${isSpeaking ? 'border-blue-500 shadow-blue-500/30' : 'border-slate-800'}`}>
      {isVideoOff ? (
        <div className={`h-20 w-20 md:h-24 md:w-24 rounded-full flex items-center justify-center font-bold text-slate-300 text-3xl uppercase shadow-xl border-4 overflow-hidden transition-all ${isSpeaking ? 'bg-slate-700 border-blue-500 shadow-blue-500/40' : 'bg-slate-800 border-slate-700'}`}>
          {profilePic ? (
            <img src={profilePic} alt={name} className="h-full w-full object-cover" />
          ) : (
            name ? name.charAt(0) : 'U'
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className={`h-full w-full ${isScreenShare ? 'object-contain bg-black' : 'object-cover'} ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''}`}
        />
      )}

      {isHandRaised && (
        <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg z-20 animate-bounce">
          <Hand size={16} className="text-white" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-slate-900/80 backdrop-blur-md pl-2 pr-3 py-1.5 rounded-lg text-[10px] md:text-xs font-medium border border-slate-700/50 text-white flex items-center gap-1.5 shadow-lg z-10">
        {isMuted ? <MicOff size={14} className="text-red-500" /> : <Mic size={14} className={isSpeaking ? "text-blue-400" : "text-emerald-500"} />}
        <span className="truncate max-w-[100px] md:max-w-[150px]">{name}</span>
      </div>
    </div>
  );
});

export default function MeetingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);


  //extra 
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [trailPoints, setTrailPoints] = useState<{ x: number, y: number }[]>([]);
  const fullText = "READY TO JOIN?";
  const [glitchText, setGlitchText] = useState("");




  const iceConfigRef = useRef<any>({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  const [inLobby, setInLobby] = useState(!sessionStorage.getItem(`intellmeet_room_${roomId}`));
  const [isWaiting, setIsWaiting] = useState(false);
  const [myRole, setMyRole] = useState<'creator' | 'co-host' | 'guest'>('guest');
  const [roomRoles, setRoomRoles] = useState<{ [key: string]: 'creator' | 'co-host' | 'guest' }>({});
  const [joinRequests, setJoinRequests] = useState<any[]>([]);

  const [globalPermissions, setGlobalPermissions] = useState({ mic: true, video: true, screen: true, record: false, notes: true, tasks: true });
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const [showSidebar, setShowSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'notes'>('chat');
  const [messages, setMessages] = useState<{ text: string, sender: string, time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [sharedNotes, setSharedNotes] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('unassigned');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [meetingTasks, setMeetingTasks] = useState<{ id: string, text: string, status: string, creator: string, assigneeId?: string | null, assigneeName?: string }[]>([]);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(localStorage.getItem('intellmeet_isMuted') === 'true');
  const [isVideoOff, setIsVideoOff] = useState(localStorage.getItem('intellmeet_isVideoOff') === 'true');

  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [key: string]: string }>({});
  const [peerPics, setPeerPics] = useState<{ [key: string]: string }>({});
  const [peerStatus, setPeerStatus] = useState<{ [key: string]: { isMuted: boolean, isVideoOff: boolean } }>({});
  const [speakingPeers, setSpeakingPeers] = useState<{ [key: string]: boolean }>({});

  const [layoutMode, setLayoutMode] = useState<'grid' | 'sidebar'>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [liveCaption, setLiveCaption] = useState('');
  const [toastNotification, setToastNotification] = useState<{ msg: string, sender: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const screenSocketRef = useRef<Socket | null>(null);
  const screenPeersRef = useRef<{ [key: string]: RTCPeerConnection }>({});

  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<{ [key: string]: boolean }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number, emoji: string, left: number }[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [fullTranscript, setFullTranscript] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<string | null>(null);

  const user = useAuthStore((state: any) => state.user);

  const getUserId = () => {
    if (user?._id || user?.id) return user._id || user.id;
    let localAnonId = localStorage.getItem('intellmeet_anon_id');
    if (!localAnonId) {
      localAnonId = `anon_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('intellmeet_anon_id', localAnonId);
    }
    return localAnonId;
  };
  const userIdStore = getUserId();
  const [userName] = useState(() => user?.name || user?.firstName || `Guest-${Math.floor(Math.random() * 1000)}`);
  const userProfilePic = user?.profilePic || '';



  // Glitch Text Animation Logic (From Login.tsx)
  useEffect(() => {
    if (!inLobby) return;
    const chars = "!@#$%^&*()_+=-{}[]<>?/|";
    let i = 0;
    const interval = setInterval(() => {
      let text = fullText.split("").map((char, index) => {
        if (index < i) return fullText[index];
        return Math.random() > 0.5 ? chars[Math.floor(Math.random() * chars.length)] : fullText[index];
      }).join("");
      setGlitchText(text);
      i++;
      if (i > fullText.length) {
        clearInterval(interval);
        setGlitchText(fullText);
      }
    }, 130);
    return () => clearInterval(interval);
  }, [inLobby]);

  // Trail points for Lobby (From Login.tsx)
  useEffect(() => {
    const animate = () => {
      setTrailPoints(prev => [{ x: mouse.x, y: mouse.y }, ...prev].slice(0, 12));
      requestAnimationFrame(animate);
    };
    animate();
  }, [mouse]);





  const showNotification = (msg: string, sender: string = "System") => {
    setToastNotification({ msg, sender });
    setTimeout(() => setToastNotification(null), 4000);
  };

  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const raw_url = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';
        const API_URL = raw_url.replace(/\/api\/?$/, '');
        const token = localStorage.getItem('token');

        const res = await fetch(`${API_URL}/api/meetings/ice-servers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          iceConfigRef.current = { iceServers: data };
        }
      } catch (error) {
        console.error("Failed to fetch secure TURN credentials", error);
      }
    };
    fetchIceServers();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showSidebar, activeTab, typingUsers]);

  useEffect(() => {
    let isMounted = true;
    const newSocket = io(((import.meta as any).env.VITE_SOCKET_URL) || 'http://localhost:5000');
    setSocket(newSocket);

    const setupMedia = async () => {
      let stream: MediaStream;
      let initialMute = localStorage.getItem('intellmeet_isMuted') === 'true';
      let initialVideoOff = localStorage.getItem('intellmeet_isVideoOff') === 'true';

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          initialVideoOff = true;
          if (isMounted) setIsVideoOff(true);
        } catch (vErr) {
          stream = new MediaStream();
          initialMute = true;
          initialVideoOff = true;
          if (isMounted) { setIsMuted(true); setIsVideoOff(true); }
        }
      }

      if (!isMounted || !stream) return;

      if (initialMute && stream.getAudioTracks().length > 0) stream.getAudioTracks()[0].enabled = false;
      if (initialVideoOff && stream.getVideoTracks().length > 0) stream.getVideoTracks()[0].enabled = false;

      setMyStream(stream);
      setupAudioMeter(stream);

      if (!inLobby) {
        newSocket.emit('join-request', { roomId, userId: userIdStore, userName, profilePic: userProfilePic });
      }

      newSocket.on('user-connected', async ({ userId, userName: incomingName, profilePic: incomingPic }: any) => {
        setPeerNames(prev => ({ ...prev, [userId]: incomingName }));
        if (incomingPic) setPeerPics(prev => ({ ...prev, [userId]: incomingPic as string }));
        newSocket.emit('request-media-status', userId);

        const pc = createPeerConnection(userId, newSocket, stream!);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        newSocket.emit('offer', { target: userId, sdp: offer, userName, profilePic: userProfilePic });
      });

      newSocket.on('offer', async (data: any) => {
        setPeerNames(prev => ({ ...prev, [data.caller]: data.userName }));
        if (data.profilePic) setPeerPics(prev => ({ ...prev, [data.caller]: data.profilePic as string }));
        newSocket.emit('request-media-status', data.caller);

        const pc = createPeerConnection(data.caller, newSocket, stream!);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newSocket.emit('answer', { target: data.caller, sdp: answer, userName, profilePic: userProfilePic });
      });

      newSocket.on('answer', async (data: any) => {
        setPeerNames(prev => ({ ...prev, [data.caller]: data.userName }));
        if (data.profilePic) setPeerPics(prev => ({ ...prev, [data.caller]: data.profilePic as string }));
        const pc = peersRef.current[data.caller];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      });

      newSocket.on('sync-initial-data', (data: any) => {
        if (data.notes) setSharedNotes(data.notes);
        if (data.tasks) setMeetingTasks(data.tasks);
        if (data.chatHistory) setMessages(data.chatHistory);
      });

      newSocket.on('ice-candidate', async (data: { caller: string, candidate: RTCIceCandidateInit }) => {
        const pc = peersRef.current[data.caller];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      });
    };

    setupMedia();

    newSocket.on('receive-notes', (notes: string) => setSharedNotes(notes));
    newSocket.on('receive-task', (task: any) => setMeetingTasks(prev => [...prev, task]));

    newSocket.on('join-approved', ({ role, permissions }) => {
      if (!isMounted) return;
      setIsWaiting(false);
      setMyRole(role);
      setGlobalPermissions(permissions);
      sessionStorage.setItem(`intellmeet_room_${roomId}`, 'true');

      newSocket.emit('join-room', { roomId, userName, profilePic: userProfilePic });
      setTimeout(() => {
        const currentMuted = localStorage.getItem('intellmeet_isMuted') === 'true';
        const currentVideoOff = localStorage.getItem('intellmeet_isVideoOff') === 'true';
        newSocket.emit('media-status-change', { roomId, isMuted: currentMuted, isVideoOff: currentVideoOff });
      }, 1000);
    });

    newSocket.on('join-error', (err) => { alert(err); navigate('/dashboard'); });
    newSocket.on('participant-waiting', (data) => setJoinRequests(prev => [...prev, data]));
    newSocket.on('join-denied', () => { alert("Host declined your request."); sessionStorage.removeItem(`intellmeet_room_${roomId}`); navigate('/dashboard'); });
    newSocket.on('kicked-out', () => { alert("You have been removed from the meeting."); sessionStorage.removeItem(`intellmeet_room_${roomId}`); navigate('/dashboard'); });

    newSocket.on('meeting-ended-by-host', () => {
      showNotification("The host has ended this meeting.", "System");
      myStream?.getTracks().forEach(t => t.stop());
      if (isRecording) mediaRecorderRef.current?.stop();
      sessionStorage.removeItem(`intellmeet_room_${roomId}`);
      setTimeout(() => navigate(`/summary/${roomId}`), 2000);
    });

    newSocket.on('roles-updated', (roles) => {
      setRoomRoles(roles);
      if (roles[userIdStore]) setMyRole(roles[userIdStore]);
    });
    newSocket.on('role-changed', (role) => {
      setMyRole(role);
      if (role === 'co-host') showNotification("You are now a Co-Host!");
      if (role === 'guest') showNotification("You are no longer a Co-Host.");
    });
    newSocket.on('permissions-updated', (perms) => setGlobalPermissions(perms));

    newSocket.on('peer-media-status', (data: { userId: string, isMuted: boolean, isVideoOff: boolean }) => {
      setPeerStatus(prev => ({ ...prev, [data.userId]: { isMuted: data.isMuted, isVideoOff: data.isVideoOff } }));
    });

    newSocket.on('peer-speaking', (data: { userId: string, isSpeaking: boolean }) => {
      setSpeakingPeers(prev => ({ ...prev, [data.userId]: data.isSpeaking }));
    });

    newSocket.on('request-media-status-from', () => {
      const currentMuted = localStorage.getItem('intellmeet_isMuted') === 'true';
      const currentVideoOff = localStorage.getItem('intellmeet_isVideoOff') === 'true';
      newSocket.emit('media-status-change', { roomId, isMuted: currentMuted, isVideoOff: currentVideoOff });
    });

    newSocket.on('user-disconnected', (peerId: string) => {
      if (peersRef.current[peerId]) {
        peersRef.current[peerId].close();
        delete peersRef.current[peerId];
      }
      setRemoteStreams(prev => { const s = { ...prev }; delete s[peerId]; return s; });
      setPeerNames(prev => { const n = { ...prev }; delete n[peerId]; return n; });
      setPeerPics(prev => { const p = { ...prev }; delete p[peerId]; return p; });
      setPeerStatus(prev => { const st = { ...prev }; delete st[peerId]; return st; });
      setSpeakingPeers(prev => { const sp = { ...prev }; delete sp[peerId]; return sp; });
      setRaisedHands(prev => { const rh = { ...prev }; delete rh[peerId]; return rh; });
      setPinnedUserId(prev => prev === peerId ? null : prev);
      setJoinRequests(prev => prev.filter(r => r.socketId !== peerId));
    });

    newSocket.on('receive-message', (data: { text: string, sender: string }) => {
      if (!showSidebar && data.sender !== userName) {
        showNotification(data.text, data.sender);
      }
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { text: data.text, sender: data.sender, time }]);
    });

    newSocket.on('user-typing', (data: { userName: string }) => {
      if (data.userName !== userName) {
        setTypingUsers(prev => prev.includes(data.userName) ? prev : [...prev, data.userName]);
      }
    });

    newSocket.on('user-stopped-typing', (data: { userName: string }) => {
      setTypingUsers(prev => prev.filter(n => n !== data.userName));
    });

    newSocket.on('receive-transcript', (data: { text: string }) => {
      setLiveCaption(data.text);
      setFullTranscript(prev => prev + '\n' + data.text);
      setTimeout(() => setLiveCaption(''), 4000);
    });

    newSocket.on('peer-raised-hand', (data: { userId: string, userName: string, isRaised: boolean }) => {
      setRaisedHands(prev => ({ ...prev, [data.userId]: data.isRaised }));
      if (data.isRaised) showNotification("Raised their hand ✋", data.userName);
    });

    newSocket.on('peer-reaction', (data: { userId: string, emoji: string }) => {
      triggerFloatingEmoji(data.emoji);
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
      clearTimeout(typingTimeoutRef.current);
      Object.values(peersRef.current).forEach(pc => pc.close());
      if (audioContextRef.current) audioContextRef.current.close();

      if (screenSocketRef.current) screenSocketRef.current.disconnect();
      Object.values(screenPeersRef.current).forEach(pc => pc.close());
      setLocalScreenStream(prev => { prev?.getTracks().forEach(t => t.stop()); return null; });
    };
    // NAYA: Dependecy array me iceConfig add kiya
  }, [roomId, userName, userProfilePic, navigate, userIdStore]);

  const handleJoinClick = () => {
    setInLobby(false);
    setIsWaiting(true);
    socket?.emit('join-request', { roomId, userId: userIdStore, userName, profilePic: userProfilePic });
  };

  const leaveMeeting = () => {
    myStream?.getTracks().forEach(t => t.stop());
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }
    sessionStorage.removeItem(`intellmeet_room_${roomId}`);
    navigate('/dashboard');
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSharedNotes(e.target.value);
    socket?.emit('update-notes', { roomId, notes: e.target.value });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;

    let assigneeIdValue = null;
    let assigneeNameValue = 'Unassigned';

    if (selectedAssignee !== 'unassigned') {
      assigneeIdValue = selectedAssignee;

      if (selectedAssignee === userIdStore) {
        assigneeNameValue = userName;
      } else {
        assigneeNameValue = peerNames[selectedAssignee] || 'Unknown';
      }
    }

    const newTask = {
      id: Date.now().toString(),
      text: newTaskInput,
      status: 'todo',
      creator: userName,
      assigneeId: assigneeIdValue || user?._id || user?.id || null,
      assigneeName: assigneeNameValue || user?.name || user?.firstName || 'You',
      assigneeProfilePic: user?.profilePic || ""
    };

    setMeetingTasks(prev => [...prev, newTask]);
    socket?.emit('add-task', { roomId, task: newTask });
    setNewTaskInput('');
    setSelectedAssignee('unassigned');
  };

  const triggerFloatingEmoji = (emoji: string) => {
    const id = Date.now() + Math.random();
    const left = Math.max(10, Math.min(90, 50 + (Math.random() * 40 - 20)));
    setFloatingEmojis(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => { setFloatingEmojis(prev => prev.filter(e => e.id !== id)); }, 3000);
  };

  const sendReaction = (emoji: string) => {
    triggerFloatingEmoji(emoji);
    socket?.emit('send-reaction', { roomId, emoji });
    setShowEmojiPicker(false);
  };

  const toggleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    setRaisedHands(prev => ({ ...prev, 'local': newState }));
    socket?.emit('toggle-raise-hand', { roomId, userName, isRaised: newState });
  };

  const setupAudioMeter = (stream: MediaStream) => {
    if (!stream.getAudioTracks().length) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const audioContext = audioContextRef.current;

    try {
      const microphone = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      microphone.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speakingTimeout: any;

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;

        if (average > 15) {
          if (!speakingPeers['local']) {
            setSpeakingPeers(prev => ({ ...prev, 'local': true }));
            socket?.emit('speaking-status', { roomId, isSpeaking: true });
          }
          clearTimeout(speakingTimeout);
          speakingTimeout = setTimeout(() => {
            setSpeakingPeers(prev => ({ ...prev, 'local': false }));
            socket?.emit('speaking-status', { roomId, isSpeaking: false });
          }, 1000);
        }
        requestAnimationFrame(checkAudioLevel);
      };
      checkAudioLevel();
    } catch (e) { console.warn("Audio Context error:", e); }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      recognitionRef.current = recognition;
    }

    let captionTimeout: any;

    recognition.onresult = (event: any) => {
      let currentText = '';
      let isFinalChunk = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentText += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinalChunk = true;
      }

      if (currentText.trim()) {
        const displayText = currentText.length > 100 ? '...' + currentText.slice(-100) : currentText;
        setLiveCaption(displayText);

        clearTimeout(captionTimeout);
        captionTimeout = setTimeout(() => setLiveCaption(''), 4000);

        if (isFinalChunk) {
          const finalStr = `${userName}: ${currentText.trim()}`;
          socket?.emit('send-transcript', finalStr);
          setFullTranscript(prev => prev + '\n' + finalStr);
        }
      }
    };

    recognition.onend = () => {
      if (!isMuted && captionsEnabled && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') console.warn("Microphone permission denied for captions.");
    };

    if (!isMuted && captionsEnabled && !inLobby && !isWaiting) {
      try { recognition.start(); } catch (e) { }
    } else {
      try { recognition.stop(); } catch (e) { }
    }

    return () => {
      clearTimeout(captionTimeout);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try { recognition.stop(); } catch (e) { }
    };
  }, [isMuted, socket, captionsEnabled, inLobby, isWaiting]);

  const generateAISummary = async () => {
    if (fullTranscript.length < 20) {
      alert("Please speak a bit more. Not enough conversation has happened to summarize yet!");
      return;
    }
    setIsGeneratingAI(true);
    showNotification("AI is analyzing the meeting... please wait.", "IntellMeet AI");
    try {
      const base_url = ((import.meta as any).env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
      const token = localStorage.getItem('token');
      const res = await fetch(`${base_url}/api/meetings/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ transcript: fullTranscript, roomId: roomId })
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      setAiSummaryResult(data.summary);
      showNotification("In-Meeting AI Summary Generated!", "System");
    } catch (err: any) {
      console.error(err);
      showNotification("Failed to generate AI summary.", "Error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!window.confirm("Are you sure you want to end this meeting for everyone?")) return;
    setIsGeneratingAI(true);
    showNotification("Wrapping up meeting and generating final report...", "System");
    try {
      const base_url = ((import.meta as any).env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
      const token = localStorage.getItem('token');
      await fetch(`${base_url}/api/meetings/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          roomId: roomId,
          transcript: fullTranscript,
          chatMessages: messages,
          sharedNotes: sharedNotes,
          manualTasks: meetingTasks
        })
      });
      socket?.emit('host-ended-meeting', { roomId });
      myStream?.getTracks().forEach(t => t.stop());
      if (isRecording) mediaRecorderRef.current?.stop();
      sessionStorage.removeItem(`intellmeet_room_${roomId}`);
      navigate(`/summary/${roomId}`);
    } catch (err: any) {
      console.error(err);
      showNotification("Failed to end meeting properly.", "Error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const createPeerConnection = (peerId: string, currentSocket: Socket, stream: MediaStream) => {
    // NAYA: Updated to use dynamic iceConfig state
    const pc = new RTCPeerConnection(iceConfigRef.current);
    peersRef.current[peerId] = pc;
    pc.onicecandidate = (event) => { if (event.candidate) currentSocket.emit('ice-candidate', { target: peerId, candidate: event.candidate }); };
    pc.ontrack = (event) => { setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] })); };

    if (stream && stream.getTracks().length > 0) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
    }
    return pc;
  };

  const toggleMute = () => {
    if (!inLobby && myRole === 'guest' && !globalPermissions.mic && isMuted) return alert("Host has disabled microphones.");
    if (myStream && myStream.getAudioTracks().length > 0) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      const newMutedState = !audioTrack.enabled;
      setIsMuted(newMutedState);
      localStorage.setItem('intellmeet_isMuted', String(newMutedState));
      if (!inLobby && !isWaiting) socket?.emit('media-status-change', { roomId, isMuted: newMutedState, isVideoOff });
    }
  };

  const toggleVideo = () => {
    if (!inLobby && myRole === 'guest' && !globalPermissions.video && isVideoOff) return alert("Host has disabled cameras.");
    if (myStream && myStream.getVideoTracks().length > 0) {
      const videoTrack = myStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      const newVideoState = !videoTrack.enabled;
      setIsVideoOff(newVideoState);
      localStorage.setItem('intellmeet_isVideoOff', String(newVideoState));
      if (!inLobby && !isWaiting) socket?.emit('media-status-change', { roomId, isMuted, isVideoOff: newVideoState });
    }
  };

  const toggleScreenShare = async () => {
    if (myRole === 'guest' && !globalPermissions.screen && !localScreenStream) return alert("Host has disabled screen sharing for participants.");
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
      if (screenSocketRef.current) {
        screenSocketRef.current.disconnect();
        screenSocketRef.current = null;
      }
      Object.values(screenPeersRef.current).forEach(pc => pc.close());
      screenPeersRef.current = {};
      setPinnedUserId(prev => prev === 'local-screen' ? null : prev);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setLocalScreenStream(stream);

        stream.getVideoTracks()[0].onended = () => {
          setLocalScreenStream(prev => {
            if (prev) {
              prev.getTracks().forEach(t => t.stop());
              if (screenSocketRef.current) { screenSocketRef.current.disconnect(); screenSocketRef.current = null; }
              Object.values(screenPeersRef.current).forEach(pc => pc.close());
              screenPeersRef.current = {};
              setPinnedUserId(p => p === 'local-screen' ? null : p);
            }
            return null;
          });
        };

        const sSocket = io((import.meta as any).env.VITE_SOCKET_URL || 'http://localhost:5000');
        screenSocketRef.current = sSocket;
        const screenName = `${userName}'s Presentation`;

        sSocket.emit('join-room', { roomId, userName: screenName });
        setTimeout(() => { sSocket.emit('media-status-change', { roomId, isMuted: false, isVideoOff: false }); }, 1000);

        sSocket.on('user-connected', async ({ userId }) => {
          // NAYA: Updated to use dynamic iceConfig state
          const pc = new RTCPeerConnection(iceConfigRef.current);
          screenPeersRef.current[userId] = pc;
          pc.onicecandidate = (e) => { if (e.candidate) sSocket.emit('ice-candidate', { target: userId, candidate: e.candidate }); };
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sSocket.emit('offer', { target: userId, sdp: offer, userName: screenName });
        });

        sSocket.on('offer', async (data) => {
          // NAYA: Updated to use dynamic iceConfig state
          const pc = new RTCPeerConnection(iceConfigRef.current);
          screenPeersRef.current[data.caller] = pc;
          pc.onicecandidate = (e) => { if (e.candidate) sSocket.emit('ice-candidate', { target: data.caller, candidate: e.candidate }); };
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sSocket.emit('answer', { target: data.caller, sdp: answer, userName: screenName });
        });

        sSocket.on('answer', async (data) => {
          const pc = screenPeersRef.current[data.caller];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(() => { });
        });

        sSocket.on('ice-candidate', async (data) => {
          const pc = screenPeersRef.current[data.caller];
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => { });
        });

        setPinnedUserId('local-screen');

      } catch (err: any) {
        if (err.name !== "NotAllowedError") console.error("Screen share error:", err);
      }
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      showNotification("Recording saved automatically!", "System");
      return;
    }

    try {
      const constraints: any = {
        video: { displaySurface: "browser" },
        audio: true
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `IntellMeet-Recording-${roomId}-${new Date().toISOString().split('T')[0]}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        stream.getTracks().forEach(track => track.stop());
      };

      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          showNotification("Recording saved automatically!", "System");
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      showNotification("Meeting Recording Started!", "System");

    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        console.error("Recording error:", err);
        showNotification("Failed to start recording.", "System");
      }
    }
  };

  const handleSecurityUpdate = (type: 'mic' | 'video' | 'screen' | 'record' | 'notes' | 'tasks') => {
    const newPerms = { ...globalPermissions, [type]: !globalPermissions[type] };
    setGlobalPermissions(newPerms);
    socket?.emit('update-permissions', { roomId, permissions: newPerms });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    if (socket) {
      socket.emit('user-typing', { roomId, userName });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('user-stopped-typing', { roomId, userName });
      }, 2000);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socket) {
      socket.emit('send-message', { roomId, text: chatInput, sender: userName });
      socket.emit('user-stopped-typing', { roomId, userName });
      setChatInput('');
    }
  };

  const allPeerIds = Object.keys(peerNames);

  const sortedPeerIds = [...allPeerIds].sort((a, b) => {
    if (raisedHands[a] && !raisedHands[b]) return -1;
    if (!raisedHands[a] && raisedHands[b]) return 1;
    if (speakingPeers[a] && !speakingPeers[b]) return -1;
    if (!speakingPeers[a] && speakingPeers[b]) return 1;
    const aVideoOn = !peerStatus[a]?.isVideoOff;
    const bVideoOn = !peerStatus[b]?.isVideoOff;
    if (aVideoOn && !bVideoOn) return -1;
    if (!aVideoOn && bVideoOn) return 1;
    return (peerNames[a] || '').localeCompare(peerNames[b] || '');
  });

  const activePeers = sortedPeerIds.filter(id => !peerStatus[id]?.isVideoOff);
  const hiddenPeers = sortedPeerIds.filter(id => peerStatus[id]?.isVideoOff);

  if (localScreenStream) {
    activePeers.unshift('local-screen');
  }

  const groupedPeersLimit = hiddenPeers.length > 3 ? 2 : hiddenPeers.length;
  const renderedHiddenPeers = hiddenPeers.slice(0, groupedPeersLimit);
  const remainingHiddenCount = hiddenPeers.length - groupedPeersLimit;

  const totalTiles = activePeers.length + renderedHiddenPeers.length + (remainingHiddenCount > 0 ? 1 : 0);

  const getGridClasses = (count: number) => {
    if (count <= 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-3 grid-rows-4 md:grid-cols-4 md:grid-rows-3';
  };

  let autoPinned = null;
  if (layoutMode === 'sidebar') {
    autoPinned = sortedPeerIds.length > 0 ? sortedPeerIds[0] : 'local';
  } else if (sortedPeerIds.length > 0 && speakingPeers[sortedPeerIds[0]]) {
    autoPinned = sortedPeerIds[0];
  }

  const displayPinnedId = pinnedUserId || autoPinned;

  if (inLobby) {
    return (
      <div
        onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
        className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden"
      >
        <FloatingEmojiStyles />

        {/* 🌊 Login.tsx Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl animate-gradient"></div>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

        {/* 🟢 Mouse Glow Effect */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(200px circle at ${mouse.x}px ${mouse.y}px, rgba(34,211,238,0.18), transparent 60%)` }}
        ></div>

        {/* 🟢 Comet Trail Glow */}
        {trailPoints.map((p, i) => (
          <div key={i} className="absolute pointer-events-none rounded-full"
            style={{
              left: p.x, top: p.y,
              width: 160 - i * 8, height: 160 - i * 8,
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle, rgba(34,211,238,0.25), transparent 70%)",
              opacity: 0.7 - i * 0.06, filter: "blur(14px)",
            }}
          />
        ))}

        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/asfalt-light.png')]"></div>

        {/* 🎯 MAIN LOBBY CARD */}
        <div className="relative w-full max-w-4xl p-6 md:p-8 rounded-[2rem] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col items-center">

          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-teal-500 to-cyan-500 p-3 rounded-2xl shadow-lg shadow-cyan-500/30 mb-6">
              <VideoIcon size={32} className="text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-[0.25em] text-white text-center">
              <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent animate-[flicker_2s_infinite]">
                {glitchText}
              </span>
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full items-start">










            {/* Left: Video Preview Section */}
            <div className="w-full flex flex-col justify-between h-full">
              <div className="relative w-full rounded-2xl overflow-hidden bg-black/40 border border-white/10 shadow-2xl group flex-1 min-h-[260px]">
                <div className="absolute inset-0">
                  <VideoPlayer
                    stream={myStream}
                    name={`${userName} (You)`}
                    profilePic={userProfilePic}
                    isVideoOff={isVideoOff}
                    isMuted={isMuted} // PASSING isMuted state
                    isLocal={true}
                  />
                </div>




                {/* Internal Overlay Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-30">
                  <button onClick={toggleMute} className={`p-4 rounded-2xl transition-all duration-300 ${isMuted ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40' : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20'}`}>
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button onClick={toggleVideo} className={`p-4 rounded-2xl transition-all duration-300 ${isVideoOff ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40' : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20'}`}>
                    {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Join Actions */}
            <div className="w-full space-y-6 flex flex-col justify-start mt-2">
              <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-4 text-center">Identity Matrix</h3>
                <div className="flex items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-cyan-500/30">
                    {userProfilePic ? <img src={userProfilePic} className="h-full w-full object-cover" /> : <div className="bg-slate-800 h-full w-full flex items-center justify-center font-bold text-cyan-400">{userName.charAt(0)}</div>}
                  </div>
                  <span className="font-mono text-cyan-400 text-base font-bold truncate">{userName}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleJoinClick}
                  className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 active:scale-[0.97] uppercase tracking-widest text-sm"
                >
                  Join Meeting
                </button>
                <button
                  onClick={leaveMeeting}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all border border-white/10 uppercase tracking-widest text-[10px]"
                >
                  Abort Session
                </button>
              </div>
              <p className="text-[9px] text-slate-500 text-center uppercase tracking-[0.2em] italic">End-to-end encrypted protocol active</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isWaiting) {
    return (
      <div
        onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#020617] overflow-hidden"
      >

        {/* 🌊 GRADIENT */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl animate-gradient"></div>
        </div>

        {/* BASE GLOW */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>

        {/* GRID */}
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

        {/* 🟢 MOUSE GLOW */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(
            200px circle at ${mouse.x}px ${mouse.y}px,
            rgba(34,211,238,0.18),
            transparent 60%
          )`,
          }}
        />

        {/* 🎯 CARD */}
        <div className="relative w-full max-w-md p-8 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_70px_rgba(0,0,0,0.8)] text-center animate-in fade-in zoom-in duration-500">

          {/* 🔄 SPINNER */}
          <div className="relative flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-500/30"></div>
            <div className="absolute w-16 h-16 border-4 border-t-cyan-400 border-transparent rounded-full animate-spin"></div>
          </div>

          {/* TITLE */}
          <h2 className="text-2xl font-bold mb-2">
            <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent">
              Joining Meeting
            </span>
          </h2>

          {/* SUBTEXT */}
          <p className="text-slate-400 text-sm">
            Verifying host permissions. Please wait.
          </p>

          {/* BUTTON */}
          <button
            onClick={leaveMeeting}
            className="mt-8 w-full py-3 rounded-xl font-semibold text-white
          bg-white/10 backdrop-blur-md border border-white/10
          hover:bg-white/20 transition-all duration-300 active:scale-[0.97]"
          >
            Leave
          </button>

        </div>
      </div>
    );
  }



  return (
    <div
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      className="fixed inset-0 h-[100dvh] w-full text-white flex overflow-hidden font-sans bg-[#020617]"
    >


      {/* 🌊 Animated Gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl animate-gradient"></div>
      </div>

      {/* Base Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.15),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.15),transparent_40%)]"></div>

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* Mouse Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(
      200px circle at ${mouse.x}px ${mouse.y}px,
      rgba(34,211,238,0.18),
      transparent 60%
    )`,
        }}
      />

      {/* Trail */}
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
            opacity: 0.7 - i * 0.06,
            filter: "blur(14px)",
          }}
        />
      ))}

      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/asfalt-light.png')]"></div>
      <FloatingEmojiStyles />





      {showSidebar && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" 
        onClick={() => setShowSidebar(false)} 
        />
      )
    }





      {/* ✅ KEEP THIS (Floating Emojis) */}
      <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
        {floatingEmojis.map(emoji => (
          <div
            key={emoji.id}
            className="absolute bottom-24 text-5xl emoji-float"
            style={{ left: `${emoji.left}%` }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>

      {aiSummaryResult && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">

          {/* 🔥 BACKGROUND */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl"></div>

          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl"></div>
          </div>

          {/* 🎯 CARD */}
          <div className="relative w-full max-w-lg p-6 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_70px_rgba(0,0,0,0.9)]">

            {/* ❌ CLOSE */}
            <button
              onClick={() => setAiSummaryResult(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition"
            >
              <X size={20} />
            </button>

            {/* ✨ HEADER */}
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
              <Sparkles size={22} className="text-cyan-400" />
              <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent">
                AI Meeting Summary
              </span>
            </h2>

            {/* 📄 CONTENT */}
            <div className="bg-black/40 border border-white/10 backdrop-blur-xl p-5 rounded-xl text-slate-200 text-sm leading-relaxed max-h-[60vh] overflow-y-auto space-y-2">

              {aiSummaryResult.split('\n').map((line, i) => {
                if (line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={`line-${i}`}>
                      {parts.map((part, index) =>
                        index % 2 === 1 ? (
                          <strong
                            key={`bold-${i}-${index}`}
                            className="text-white bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md shadow-sm"
                          >
                            {part}
                          </strong>
                        ) : (
                          <span key={`text-${i}-${index}`}>{part}</span>
                        )
                      )}
                    </p>
                  );
                }

                if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                  return (
                    <li
                      key={`list-${i}`}
                      className="ml-4 text-cyan-300 list-disc"
                    >
                      {line.replace(/^[-*]/, '').trim()}
                    </li>
                  );
                }

                return <p key={`para-${i}`}>{line}</p>;
              })}
            </div>

            {/* 🔘 BUTTON */}
            <button
              onClick={() => setAiSummaryResult(null)}
              className="mt-6 w-full py-3 rounded-xl font-semibold text-white
        bg-gradient-to-r from-teal-500 to-cyan-500
        shadow-lg shadow-cyan-500/30
        hover:scale-[1.03] active:scale-[0.97]
        transition-all"
            >
              Close
            </button>

          </div>
        </div>
      )}


      {showSecurityModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">

          {/* 🔥 BACKGROUND BLUR + GRADIENT */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl"></div>

          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl"></div>
          </div>

          {/* 🎯 MODAL CARD */}
          <div className="relative w-full max-w-sm mx-4 p-6 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

            {/* CLOSE BUTTON */}
            <button
              onClick={() => setShowSecurityModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition"
            >
              <X size={20} />
            </button>

            {/* HEADER */}
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Shield size={22} className="text-cyan-400" />
              <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent">
                Security Controls
              </span>
            </h2>

            {/* OPTIONS */}
            <div className="space-y-3">

              <p className="text-sm text-slate-400 mb-3">
                Allow participants to:
              </p>

              {[
                { key: 'mic', label: 'Turn on Microphone' },
                { key: 'video', label: 'Turn on Video' },
                { key: 'screen', label: 'Share Screen' },
                { key: 'record', label: 'Record Meeting' },
                { key: 'notes', label: 'Edit Shared Notes' },
                { key: 'tasks', label: 'Create Tasks' }
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-[1.02]"
                >
                  <span className="text-sm font-medium text-slate-200">
                    {item.label}
                  </span>

                  {/* 🔘 CUSTOM TOGGLE */}
                  <button
                    type="button"
                    onClick={() => handleSecurityUpdate(item.key as any)}
                    className={`w-12 h-6 rounded-full transition-all relative ${globalPermissions[item.key as keyof typeof globalPermissions]
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                      : 'bg-slate-700'
                      }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${globalPermissions[item.key as keyof typeof globalPermissions]
                        ? 'translate-x-6'
                        : 'translate-x-0'
                        }`}
                    />
                  </button>
                </label>
              ))}

            </div>
          </div>
        </div>
      )}



      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">

          {/* 🔥 BACKGROUND */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl"></div>

          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-3xl"></div>
          </div>

          {/* 🎯 CARD */}
          <div className="relative w-full max-w-md mx-4 p-6 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)]">

            {/* CLOSE */}
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition"
            >
              <X size={20} />
            </button>

            {/* HEADER */}
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings size={22} className="text-cyan-400" />
              <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent">
                Meeting Settings
              </span>
            </h2>

            <div className="space-y-4">

              {/* 🎤 LIVE CAPTIONS */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex justify-between items-center hover:bg-white/10 transition-all duration-300">
                <div>
                  <p className="text-sm text-slate-200 font-semibold">Live Captions</p>
                  <p className="text-xs text-slate-400">Auto-transcribe speech to text</p>
                </div>

                {/* 🔘 TOGGLE */}
                <button
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                  className={`w-12 h-6 rounded-full transition-all relative ${captionsEnabled
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                    : 'bg-slate-700'
                    }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${captionsEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {/* 🧩 LAYOUT MODE */}
              {/* <div className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all duration-300">
                <p className="text-sm text-slate-200 font-semibold mb-1">Layout Mode</p>
                <p className="text-xs text-slate-400 mb-3">Choose how videos are displayed</p>

                <select
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value as 'grid' | 'sidebar')}
                >
                  <option value="grid">Auto Grid</option>
                  <option value="sidebar">Sidebar Priority</option>
                </select>
              </div> */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all duration-300">
                <p className="text-sm text-slate-200 font-semibold mb-1">Layout Mode</p>
                <p className="text-xs text-slate-400 mb-3">Choose how videos are displayed</p>

                <div className="relative">
                  <select
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as 'grid' | 'sidebar')}
                  >
                    <option value="grid" className="bg-slate-900">Auto Grid</option>
                    <option value="sidebar" className="bg-slate-900">Sidebar Priority</option>
                  </select>

                  {/* 🔽 FIXED ALIGNED ICON */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}




      {/* EMOJI REACTIONS */}
      {showEmojiPicker && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200]">

          {/* 🔥 BACK GLOW */}
          <div className="absolute inset-0 -z-10">
            <div className="w-full h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 opacity-20 blur-2xl rounded-full"></div>
          </div>

          {/* 🎯 MAIN CONTAINER */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-3 flex gap-4 shadow-[0_0_40px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-2">

            {['👍', '👏', '❤️', '😂', '😲', '🎉'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="relative text-2xl md:text-3xl transition-all duration-300 hover:scale-125 active:scale-95"
              >
                {/* 🔵 HOVER GLOW */}
                <span className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl opacity-0 hover:opacity-100 transition"></span>

                {/* EMOJI */}
                <span className="relative z-10">{emoji}</span>
              </button>
            ))}

          </div>
        </div>
      )}


      <div className={`flex-1 flex flex-col p-2 md:p-4 relative transition-all duration-300 ${showSidebar ? 'md:mr-[350px]' : 'w-full'} h-full`}>

        {toastNotification && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 bg-slate-800 border-l-4 border-blue-500 shadow-2xl px-4 py-3 rounded-lg z-50 flex flex-col animate-in slide-in-from-top-4 fade-in duration-300 max-w-xs">
            <span className="text-xs text-blue-400 font-bold uppercase">{toastNotification.sender}</span>
            <span className="text-sm text-slate-200 truncate">{toastNotification.msg}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center mb-3 md:mb-5 px-3 md:px-4 z-10 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] py-2 md:py-3">

          {/* 🧠 ROOM INFO */}
          <h2 className="text-sm md:text-xl font-bold tracking-tight flex items-center gap-3">

            <span className="text-slate-400 text-xs md:text-sm">Room:</span>

            <span className="bg-gradient-to-r from-white via-cyan-300 to-teal-400 bg-clip-text text-transparent font-semibold">
              {roomId}
            </span>

            <div className="hidden sm:flex gap-2 ml-2">
              {myRole === 'creator' && (
                <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                  Host
                </span>
              )}
              {myRole === 'co-host' && (
                <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                  Co-Host
                </span>
              )}
            </div>
          </h2>

          {/* ⚙️ ACTIONS */}
          <div className="flex gap-2 items-center relative">

            {/* 📱 MOBILE */}
            <div className="md:hidden flex items-center gap-2">

              {myRole === 'creator' && (
                <button
                  onClick={handleEndMeeting}
                  disabled={isGeneratingAI}
                  className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white shadow-lg transition flex items-center gap-1 active:scale-[0.95]"
                >
                  {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <StopCircle size={14} />}
                  End
                </button>
              )}

              {(myRole === 'creator' || myRole === 'co-host') && (
                <button
                  onClick={() => setShowSecurityModal(true)}
                  className="bg-white/10 backdrop-blur-md border border-white/10 p-2 rounded-xl text-cyan-400 hover:bg-white/20 transition"
                >
                  <Shield size={16} />
                </button>
              )}

              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-white/10 backdrop-blur-md border border-white/10 p-2 rounded-xl text-slate-300 hover:bg-white/20 transition"
              >
                <Settings size={16} />
              </button>

              <button
                onClick={leaveMeeting}
                className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[10px] rounded-xl font-bold text-white hover:bg-white/20 transition"
              >
                Leave
              </button>
            </div>

            {/* 💻 DESKTOP */}
            <div className="hidden md:flex items-center gap-2">

              <button
                onClick={generateAISummary}
                disabled={isGeneratingAI}
                className="bg-purple-500/10 text-purple-400 border border-purple-500/40 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow hover:shadow-purple-500/30"
              >
                {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                <span>AI Summary</span>
              </button>

              {myRole === 'creator' && (
                <button
                  onClick={handleEndMeeting}
                  disabled={isGeneratingAI}
                  className="bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 rounded-xl font-bold hover:from-red-600 hover:to-rose-700 text-white shadow-lg transition active:scale-[0.97]"
                >
                  End Meeting
                </button>
              )}

              {(myRole === 'creator' || myRole === 'co-host') && (
                <button
                  onClick={() => setShowSecurityModal(true)}
                  className="bg-white/10 backdrop-blur-md border border-white/10 p-2 rounded-xl text-cyan-400 hover:bg-white/20 transition"
                >
                  <Shield size={18} />
                </button>
              )}

              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-white/10 backdrop-blur-md border border-white/10 p-2 rounded-xl text-slate-300 hover:bg-white/20 transition"
              >
                <Settings size={18} />
              </button>

              <button
                onClick={leaveMeeting}
                className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 text-sm rounded-xl font-bold text-white hover:bg-white/20 transition ml-2"
              >
                Leave Call
              </button>
            </div>

          </div>
        </div>


        <div className={`flex-1 flex overflow-hidden pb-[80px] md:pb-24 px-2 md:px-4 gap-3 md:gap-5 min-h-0 ${displayPinnedId ? 'flex-col md:flex-row' : 'flex-col'} backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)]`}>
          {displayPinnedId === 'local' ? (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} profilePic={userProfilePic} isMuted={true} isVideoOff={isVideoOff} isLocal={true} isSpeaking={speakingPeers['local']} isHandRaised={isHandRaised} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">Click to unpin</div>
            </div>
          ) : displayPinnedId === 'local-screen' && localScreenStream ? (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={localScreenStream} name={`${userName}'s Presentation`} isMuted={true} isVideoOff={false} isLocal={true} isScreenShare={true} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">Click to unpin</div>
            </div>
          ) : (displayPinnedId && peerNames[displayPinnedId]) ? (
            <div className="w-full md:flex-1 h-[60%] md:h-full rounded-2xl shadow-2xl relative cursor-pointer flex-shrink-0 transition-all overflow-hidden" onClick={() => setPinnedUserId(null)}>
              <VideoPlayer stream={remoteStreams[displayPinnedId] || new MediaStream()} name={peerNames[displayPinnedId] || "Participant"} profilePic={peerPics[displayPinnedId]} isMuted={peerStatus[displayPinnedId]?.isMuted} isVideoOff={peerStatus[displayPinnedId]?.isVideoOff} isSpeaking={speakingPeers[displayPinnedId]} isHandRaised={raisedHands[displayPinnedId]} />
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs border border-white/20 z-20">{pinnedUserId ? "Click to unpin" : "Main Stage"}</div>
            </div>
          ) : null}

          <div className={`grid gap-2 md:gap-4 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${displayPinnedId ? 'grid-cols-3 md:grid-cols-1 w-full md:w-64 h-[25%] md:h-full flex-shrink-0 overflow-y-auto content-start auto-rows-[100px] md:auto-rows-[140px]' : `${getGridClasses(totalTiles)} w-full h-full flex-1`}`}>
            {activePeers.map(id => {
              if (id === displayPinnedId) return null;
              if (id === 'local-screen') {
                return (
                  <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-all duration-300 hover:scale-[1.03] w-full h-full relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] min-h-0 min-w-0">
                    <VideoPlayer stream={localScreenStream!} name={`${userName}'s Presentation`} isMuted={true} isVideoOff={false} isLocal={true} isScreenShare={true} />
                  </div>
                );
              }
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-all duration-300 hover:scale-[1.03] w-full h-full relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} profilePic={peerPics[id]} isMuted={peerStatus[id]?.isMuted} isVideoOff={false} isSpeaking={speakingPeers[id]} isHandRaised={raisedHands[id]} />
                </div>
              );
            })}

            {renderedHiddenPeers.map(id => {
              if (id === displayPinnedId) return null;
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-all duration-300 hover:scale-[1.03] w-full h-full relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} profilePic={peerPics[id]} isMuted={peerStatus[id]?.isMuted} isVideoOff={true} isSpeaking={speakingPeers[id]} isHandRaised={raisedHands[id]} />
                </div>
              );
            })}

            {remainingHiddenCount > 0 && !displayPinnedId && (
              <div onClick={() => { setShowSidebar(true); setActiveTab('participants'); }} className="cursor-pointer transition-all duration-300 hover:scale-[1.03] w-full h-full relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] min-h-0 min-w-0">
                <div className="bg-slate-900 h-full w-full relative flex items-center justify-center rounded-2xl overflow-hidden group border-2 border-slate-800 shadow-lg">
                  <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xl md:text-3xl shadow-xl group-hover:bg-slate-700 transition-colors">
                    +{remainingHiddenCount}
                  </div>
                  <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-slate-900/90 backdrop-blur pl-2 pr-3 py-1.5 rounded-lg text-[10px] md:text-xs font-medium border border-slate-700 text-white flex items-center gap-1.5 shadow-lg z-10">
                    <Users size={14} className="text-blue-400" />
                    <span>Others</span>
                  </div>
                </div>
              </div>
            )}

            {allPeerIds.length === 0 && !localScreenStream && (
              <div className="col-span-full h-full w-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/20 rounded-2xl border border-slate-800/50 min-h-[200px]">
                <MonitorUp size={48} className="mb-4 opacity-20 md:opacity-40" />
                <p className="text-sm md:text-base text-center px-4">Waiting for others to join...</p>
              </div>
            )}
          </div>
        </div>

        {displayPinnedId !== 'local' && (
          <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-28 md:right-8 w-24 h-36 md:w-48 md:h-32 bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl border-2 border-slate-700 overflow-hidden shadow-2xl z-20 transition-all">
            <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} profilePic={userProfilePic} isMuted={isMuted} isVideoOff={isVideoOff} isLocal={true} isSpeaking={speakingPeers['local']} isHandRaised={isHandRaised} />
          </div>
        )}

        {liveCaption && captionsEnabled && (
          <div className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-36 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-center backdrop-blur-md z-20 border border-white/10 shadow-2xl max-w-[90%] md:max-w-[70%] pointer-events-none">
            <p className="text-white text-xs md:text-base font-medium leading-relaxed">{liveCaption}</p>
          </div>
        )}



        {/*Control bar*/}

        <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-8 left-1/2 -translate-x-1/2 z-40">

          {/* 🌊 Glow Background */}
          <div className="absolute inset-0 blur-2xl opacity-20 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 rounded-full"></div>

          {/* MAIN BAR */}
          <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 
            shadow-[0_20px_60px_rgba(0,0,0,0.8)] px-3 py-2 md:px-6 md:py-3 
            rounded-full flex gap-2 md:gap-4 items-center 
            w-max max-w-[95vw] overflow-x-auto 
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {/* 🎤 MIC */}
            <button
              onClick={toggleMute}
              className={`group p-3 md:p-4 rounded-full transition-all duration-300 shrink-0 
              transform hover:scale-110 active:scale-95
              ${isMuted
                  ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                  : (myRole === 'guest' && !globalPermissions.mic
                    ? 'bg-white/10 border border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]')
                }`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* 📷 CAMERA */}
            <button
              onClick={toggleVideo}
              className={`group p-3 md:p-4 rounded-full transition-all duration-300 shrink-0 
      transform hover:scale-110 active:scale-95
      ${isVideoOff
                  ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                  : (myRole === 'guest' && !globalPermissions.video
                    ? 'bg-white/10 border border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]')
                }`}
            >
              {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
            </button>

            {/* ✋ HAND */}
            <button
              onClick={toggleRaiseHand}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 shrink-0 
      transform hover:scale-110 active:scale-95
      ${isHandRaised
                  ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}
            >
              <Hand size={20} />
            </button>

            {/* 😊 EMOJI */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 shrink-0 
      transform hover:scale-110 active:scale-95
      ${showEmojiPicker
                  ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}
            >
              <Smile size={20} />
            </button>

            {/* 🖥 SCREEN SHARE */}
            <button
              onClick={toggleScreenShare}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 hidden md:block shrink-0 
      transform hover:scale-110 active:scale-95
      ${localScreenStream
                  ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                  : (myRole === 'guest' && !globalPermissions.screen
                    ? 'bg-white/10 border border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]')
                }`}
            >
              <MonitorUp size={20} />
            </button>

            {/* 🔴 RECORD */}
            <button
              onClick={() => {
                if (myRole === 'guest' && !globalPermissions.record) return alert("Host has disabled recording for participants.");
                toggleRecording();
              }}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 hidden md:block shrink-0 
      transform hover:scale-110 active:scale-95
      ${isRecording
                  ? 'bg-red-600 shadow-[0_0_25px_rgba(220,38,38,0.7)] animate-pulse'
                  : (myRole === 'guest' && !globalPermissions.record
                    ? 'bg-white/10 border border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]')
                }`}
            >
              {isRecording ? <StopCircle size={20} /> : <Circle size={20} />}
            </button>

            {/* DIVIDER */}
            <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/30 to-transparent mx-1 md:mx-2 shrink-0"></div>

            {/* 💬 CHAT */}
            <button
              onClick={() => { setShowSidebar(!showSidebar); setActiveTab('chat'); }}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 shrink-0 
      transform hover:scale-110 active:scale-95
      ${showSidebar && activeTab === 'chat'
                  ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}
            >
              <MessageSquare size={20} />
            </button>

            {/* 👥 PARTICIPANTS */}
            <button
              onClick={() => { setShowSidebar(!showSidebar); setActiveTab('participants'); }}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 hidden md:block shrink-0 relative 
      transform hover:scale-110 active:scale-95
      ${showSidebar && activeTab === 'participants'
                  ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}
            >
              <Users size={20} />
              {joinRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] h-5 w-5 flex items-center justify-center rounded-full border-2 border-slate-900 animate-pulse">
                  {joinRequests.length}
                </span>
              )}
            </button>

            {/* 📝 NOTES */}
            <button
              onClick={() => { setShowSidebar(!showSidebar); setActiveTab('notes'); }}
              className={`p-3 md:p-4 rounded-full transition-all duration-300 hidden md:block shrink-0 
      transform hover:scale-110 active:scale-95
      ${showSidebar && activeTab === 'notes'
                  ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}
            >
              <FileText size={20} />
            </button>

          </div>
        </div>
      </div>


      <div
        className={`
        fixed top-0 right-0 h-full w-[85%] max-w-[350px]
      bg-slate-950 border-l border-slate-800
        z-50 transform transition-transform duration-300

        ${showSidebar ? 'translate-x-0' : 'translate-x-full'}

        md:translate-x-0 md:relative md:w-[350px]
        `}
      >

        {/* 🌊 Gradient Overlay */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-teal-400/10 to-emerald-500/10 blur-2xl"></div>
        </div>

        {/* HEADER */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5 backdrop-blur-xl">

          {/* Tabs */}
          <div className="flex gap-1 w-full bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-xl">

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all duration-300
        ${activeTab === 'chat'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              Chat
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all duration-300 relative
        ${activeTab === 'participants'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              People ({Object.keys(peerNames).length + 1})

              {joinRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] h-4 w-4 flex items-center justify-center rounded-full shadow-lg">
                  {joinRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all duration-300
        ${activeTab === 'notes'
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              Notes
            </button>
          </div>

          {/* Close */}
          <button
            onClick={() => setShowSidebar(false)}
            className="ml-3 text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 p-2 rounded-xl transition-all duration-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= CHAT ================= */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-transparent min-h-0 overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="text-center flex flex-col items-center justify-center h-full text-slate-500">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                    <MessageSquare size={48} className="relative z-10 opacity-40 text-cyan-400" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-50">Secure_Channel_Empty</p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.sender === userName;
                  const isFile = m.text.startsWith('DATA_FILE:');

                  // Logic to safely handle files without crashing
                  let fileData: any = null;
                  if (isFile) {
                    try {
                      // Crash Prevention: Slice string correctly before parsing
                      const jsonString = m.text.substring(10);
                      fileData = JSON.parse(jsonString);
                    } catch (e) {
                      console.error("File parse error", e);
                    }
                  }

                  return (
                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`flex items-center gap-2 mb-1.5 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isMe ? 'text-cyan-400' : 'text-teal-400'}`}>
                          {isMe ? 'You' : m.sender}
                        </span>
                        <span className="text-[8px] text-slate-600 font-mono">{m.time}</span>
                      </div>

                      <div
                        className={`group relative p-3 text-sm break-words transition-all duration-300 shadow-2xl
                ${isMe
                            ? 'bg-gradient-to-br from-cyan-500 to-teal-500 text-black rounded-2xl rounded-tr-sm'
                            : 'bg-white/5 border border-white/10 text-slate-200 rounded-2xl rounded-tl-sm backdrop-blur-xl'}`}
                        style={{ maxWidth: '85%' }}
                      >
                        {isFile ? (
                          fileData ? (
                            <div className="space-y-2 min-w-[140px]">
                              {fileData.type?.startsWith('image/') ? (
                                <div className="relative rounded-lg overflow-hidden border border-black/10 max-h-64 bg-black/20">
                                  <img
                                    src={fileData.content}
                                    alt="shared"
                                    className="max-w-full h-auto object-contain mx-auto"
                                    // Adding low-priority loading to prevent main thread block
                                    loading="lazy"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <a href={fileData.content} download={fileData.name} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:scale-110 transition">
                                      <Download size={18} />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
                                  <div className="p-2 bg-white/10 rounded-md"><FileText size={20} className={isMe ? "text-black" : "text-cyan-400"} /></div>
                                  <div className="flex-1 overflow-hidden">
                                    <p className="text-[10px] font-bold truncate">{fileData.name}</p>
                                    <p className="text-[8px] opacity-60 uppercase">
                                      {fileData.size ? (fileData.size / (1024 * 1024)).toFixed(2) : "0"} MB
                                    </p>
                                  </div>
                                  <a href={fileData.content} download={fileData.name} className={`p-1.5 rounded-md hover:bg-white/10 transition-colors ${isMe ? "text-black" : "text-white"}`}>
                                    <Download size={16} />
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 italic text-xs opacity-50">
                              <Loader2 size={12} className="animate-spin" /> Processing Media...
                            </div>
                          )
                        ) : (
                          <p className="leading-relaxed font-medium">{m.text}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* INPUT SECTION */}
            <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-2xl">
              <form onSubmit={sendMessage} className="flex gap-2 items-center bg-black/40 border border-white/10 rounded-2xl p-1.5 pr-2 focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all">

                <label className="p-2.5 text-slate-500 hover:text-cyan-400 cursor-pointer transition-colors hover:bg-white/5 rounded-xl">
                  <Plus size={20} />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // i. 100MB Limit
                        if (file.size > 100 * 1024 * 1024) return alert("File too large! Max 100MB allowed.");

                        const reader = new FileReader();
                        reader.onload = () => {
                          try {
                            const payload = {
                              name: file.name,
                              type: file.type,
                              size: file.size,
                              content: reader.result // This is the heavy part
                            };

                            // Emit data string directly
                            socket?.emit('send-message', {
                              roomId,
                              text: `DATA_FILE:${JSON.stringify(payload)}`,
                              sender: userName
                            });
                          } catch (err) {
                            console.error("Memory Buffer Overflow", err);
                            alert("System Memory full. Try a smaller file.");
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = ''; // Reset input to allow same file again
                    }}
                  />
                </label>

                <input
                  type="text"
                  value={chatInput}
                  onChange={handleTyping}
                  placeholder="Send matrix log..."
                  className="flex-1 bg-transparent px-2 py-3 text-sm text-white placeholder-slate-600 outline-none font-mono"
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-teal-400 disabled:opacity-30 p-3 rounded-xl text-black hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= NOTES & TASKS ================= */}
        {activeTab === 'notes' && (
          <div className="flex-1 flex flex-col p-4 space-y-6 overflow-y-auto custom-scrollbar pb-20">

            {/* 📝 SHARED NOTES SECTION */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] flex items-center gap-2">
                  <FileText size={14} /> Meeting Registry
                </h4>
                <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Live_Sync</span>
              </div>

              <textarea
                value={sharedNotes}
                onChange={handleNotesChange}
                placeholder="Type workspace logs here..."
                className="w-full h-48 bg-black/40 border border-white/10 rounded-[1.5rem] p-4 text-sm text-slate-200 outline-none focus:border-cyan-500 transition-all font-mono resize-none shadow-inner"
              />
              <p className="text-[9px] text-slate-500 italic px-2">Neural synchronization active for all nodes.</p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2"></div>

            {/* ✅ ACTION ITEMS SECTION */}
            <div className="flex flex-col flex-1 space-y-4">
              <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] flex items-center gap-2 px-1">
                <CheckSquare size={14} /> Objective Board
              </h4>

              {/* TASK INPUT FORM */}
              <form onSubmit={handleAddTask} className="space-y-3">
                <div className="flex gap-2 group/input">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Initialize new task..."
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-purple-500/50 transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskInput.trim()}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="relative">
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-slate-300 outline-none appearance-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="unassigned">Assign to (Optional)</option>
                    <option value="local">{userName} (You)</option>
                    {Object.keys(peerNames).map(id => (
                      <option key={id} value={id}>{peerNames[id]}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </form>

              {/* TASK LIST DISPLAY */}
              <div className="space-y-3 mt-2">
                {meetingTasks.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-[2rem] opacity-30">
                    <CheckSquare size={32} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No active objectives</p>
                  </div>
                ) : (
                  meetingTasks.slice().reverse().map((task) => {
                    {/* LOGIC: Resolving the @Unknown name issue */ }
                    const displayName = task.assigneeId === userIdStore || task.assigneeId === 'local'
                      ? 'You'
                      : (task.assigneeName && task.assigneeName !== 'Unknown'
                        ? task.assigneeName
                        : (peerNames[task.assigneeId || ''] || 'Participant'));

                    return (
                      <div
                        key={task.id}
                        className="group bg-white/[0.03] border border-white/10 p-4 rounded-2xl backdrop-blur-xl hover:border-purple-500/30 transition-all duration-300 shadow-xl relative overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-start gap-4">
                            <p className="text-sm text-slate-200 font-medium leading-relaxed">{task.text}</p>

                            <div className="flex-shrink-0">
                              <span className="text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-md shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                                @{displayName}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[9px] text-slate-500 uppercase tracking-tighter">
                              Origin: <span className="text-slate-400">{task.creator === userName ? 'You' : task.creator}</span>
                            </span>
                            <span className="text-[8px] font-mono text-slate-600">ID_{task.id.slice(-4)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= PARTICIPANTS ================= */}
        {activeTab === 'participants' && (
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">

            {/* 1. WAITING ROOM (Host only) */}
            {(myRole === 'creator' || myRole === 'co-host') && joinRequests.length > 0 && (
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] mb-3 px-1 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Waiting Room ({joinRequests.length})
                </h4>
                {joinRequests.map(req => (
                  <div key={req.socketId} className="bg-white/5 border border-amber-500/20 p-3 rounded-xl mb-2 flex justify-between items-center backdrop-blur-xl">
                    <span className="text-sm font-bold text-slate-200 truncate pr-2">{req.userName}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => { socket?.emit('accept-join', { targetSocketId: req.socketId, targetUserId: req.targetUserId, roomId }); setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId)); }} className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white p-1.5 rounded-lg transition-all"><Check size={16} /></button>
                      <button onClick={() => { socket?.emit('reject-join', { targetSocketId: req.socketId }); setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId)); }} className="bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white p-1.5 rounded-lg transition-all"><X size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-3 px-1">
              In Meeting
            </h4>

            <div className="space-y-2">
              {/* 2. LOCAL USER (YOU) - CLICKABLE FIXED */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/10 border border-white/20 shadow-lg group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)] flex-shrink-0">
                    {userProfilePic
                      ? <img src={userProfilePic} className="h-full w-full object-cover" alt="You" />
                      : <div className="flex items-center justify-center h-full bg-slate-800 font-bold text-cyan-400">{userName.charAt(0)}</div>
                    }
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-white truncate">{userName} (You)</span>
                    <span className="text-[9px] text-cyan-400 font-black uppercase tracking-tighter">{myRole === 'creator' ? 'Host' : myRole}</span>
                  </div>
                </div>

                {/* MEDIA CONTROLS FOR SELF */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <button
                    onClick={toggleMute}
                    className={`p-1.5 rounded-lg transition-all ${isMuted ? 'bg-rose-500/20 text-rose-500' : 'hover:bg-white/10 text-emerald-500'}`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={`p-1.5 rounded-lg transition-all ${isVideoOff ? 'bg-rose-500/20 text-rose-500' : 'hover:bg-white/10 text-cyan-400'}`}
                    title={isVideoOff ? "Start Video" : "Stop Video"}
                  >
                    {isVideoOff ? <VideoOff size={16} /> : <VideoIcon size={16} />}
                  </button>

                  <div className="w-px h-4 bg-white/10 mx-0.5" />

                  <button
                    onClick={() => setPinnedUserId(pinnedUserId === 'local' ? null : 'local')}
                    className={`p-1.5 rounded-lg transition-all ${pinnedUserId === 'local' ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-500 hover:text-white'}`}
                  >
                    <Pin size={16} />
                  </button>
                </div>
              </div>

              {/* 3. REMOTE PARTICIPANTS (Indicators only as we can't force-mute others without extra socket logic) */}
              {sortedPeerIds.map(id => {
                const role = roomRoles[id] || 'guest';
                const isTargetCreator = role === 'creator';
                const canToggleCoHost = myRole === 'creator' && !isTargetCreator;
                const canKick = (myRole === 'creator' && !isTargetCreator) || (myRole === 'co-host' && role === 'guest');

                return (
                  <div key={id} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${speakingPeers[id] ? 'bg-cyan-500/5 border-cyan-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`relative h-10 w-10 rounded-full overflow-hidden border flex-shrink-0 transition-all ${speakingPeers[id] ? 'border-cyan-400 animate-pulse' : 'border-white/10'}`}>
                        {peerPics[id]
                          ? <img src={peerPics[id]} className="h-full w-full object-cover" alt="User" />
                          : <div className="flex items-center justify-center h-full bg-slate-800 font-bold text-slate-400">{peerNames[id]?.charAt(0)}</div>
                        }
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-medium truncate ${speakingPeers[id] ? 'text-cyan-300' : 'text-slate-200'}`}>{peerNames[id]}</span>
                        {role !== 'guest' && <span className={`text-[9px] font-black uppercase tracking-tighter ${role === 'creator' ? 'text-blue-400' : 'text-amber-400'}`}>{role}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {/* Visual indicators for others */}
                      <div className="p-1.5">
                        {peerStatus[id]?.isMuted ? <MicOff size={16} className="text-rose-500/70" /> : <Mic size={16} className="text-emerald-500/70" />}
                      </div>

                      <div className="w-px h-4 bg-white/10 mx-1" />

                      <button onClick={() => setPinnedUserId(pinnedUserId === id ? null : id)} className={`p-1.5 rounded-lg transition-all ${pinnedUserId === id ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-500 hover:text-white'}`}>
                        <Pin size={16} />
                      </button>

                      {canToggleCoHost && (
                        <button onClick={() => socket?.emit(role === 'co-host' ? 'remove-cohost' : 'make-cohost', { targetSocketId: id, roomId })} className="p-1.5 text-slate-500 hover:text-amber-400 transition-all" title="Toggle Co-Host">
                          <Star size={16} />
                        </button>
                      )}
                      {canKick && (
                        <button onClick={() => socket?.emit('kick-user', { targetSocketId: id, targetUserId: id, roomId })} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-all">
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>




      <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
        {floatingEmojis.map(emoji => (
          <div
            key={emoji.id}
            className="absolute bottom-24 text-5xl emoji-float"
            style={{ left: `${emoji.left}%` }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}