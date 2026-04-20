import { useEffect, useState, useRef, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare, X, Users, Pin, Hand, Smile, Settings, Shield, Star, UserMinus, Check, Circle, StopCircle, Sparkles, Loader2, Send, FileText, Plus, CheckSquare } from 'lucide-react';
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

  const iceConfigRef = useRef<any>({ 
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
  });
  const [inLobby, setInLobby] = useState(!sessionStorage.getItem(`intellmeet_room_${roomId}`));
  const [isWaiting, setIsWaiting] = useState(false); 
  const [myRole, setMyRole] = useState<'creator' | 'co-host' | 'guest'>('guest');
  const [roomRoles, setRoomRoles] = useState<{[key: string]: 'creator' | 'co-host' | 'guest'}>({});
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  
  const [globalPermissions, setGlobalPermissions] = useState({ mic: true, video: true, screen: true, record: false, notes: true, tasks: true });
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  
  const [showSidebar, setShowSidebar] = useState(false); 
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'notes'>('chat');
  const [messages, setMessages] = useState<{text: string, sender: string, time: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [sharedNotes, setSharedNotes] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('unassigned');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [meetingTasks, setMeetingTasks] = useState<{id: string, text: string, status: string, creator: string, assigneeId?: string | null, assigneeName?: string}[]>([]);

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
  const [toastNotification, setToastNotification] = useState<{msg: string, sender: string} | null>(null);
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
        if(role === 'co-host') showNotification("You are now a Co-Host!");
        if(role === 'guest') showNotification("You are no longer a Co-Host.");
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

    newSocket.on('receive-message', (data: {text: string, sender: string}) => {
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
  }, [roomId, userName, userProfilePic, navigate, userIdStore ]); 

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
        assigneeNameValue = peerNames[selectedAssignee] || userName; 
    }

    const newTask = { 
        id: Date.now().toString(), 
        text: newTaskInput, 
        status: 'todo', 
        creator: userName,
        assigneeId: assigneeIdValue,
        assigneeName: assigneeNameValue
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
            for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            
            if (average > 15) { 
                if (!speakingPeers['local']) {
                    setSpeakingPeers(prev => ({...prev, 'local': true}));
                    socket?.emit('speaking-status', { roomId, isSpeaking: true });
                }
                clearTimeout(speakingTimeout);
                speakingTimeout = setTimeout(() => {
                    setSpeakingPeers(prev => ({...prev, 'local': false}));
                    socket?.emit('speaking-status', { roomId, isSpeaking: false });
                }, 1000); 
            }
            requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
    } catch(e) { console.warn("Audio Context error:", e); }
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
        try { recognitionRef.current.start(); } catch (e) {} 
      } 
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') console.warn("Microphone permission denied for captions.");
    };
    
    if (!isMuted && captionsEnabled && !inLobby && !isWaiting) { 
       try { recognition.start(); } catch (e) {} 
    } else { 
       try { recognition.stop(); } catch (e) {} 
    }

    return () => { 
       clearTimeout(captionTimeout);
       recognition.onresult = null; 
       recognition.onend = null; 
       recognition.onerror = null;
       try { recognition.stop(); } catch (e) {} 
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
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(()=>{});
        });

        sSocket.on('ice-candidate', async (data) => {
          const pc = screenPeersRef.current[data.caller];
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(()=>{});
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold text-white mb-8">Ready to join?</h2>
        <div className="w-full max-w-3xl bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center">
          <div className="h-[300px] md:h-[400px] w-full rounded-2xl overflow-hidden mb-8 relative border-2 border-slate-700 bg-black">
            <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} profilePic={userProfilePic} isMuted={true} isVideoOff={isVideoOff} isLocal={true} />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between w-full gap-6">
             <div className="flex gap-4">
               <button onClick={toggleMute} className={`p-4 rounded-full shadow-lg transition-all ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                 {isMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
               </button>
               <button onClick={toggleVideo} className={`p-4 rounded-full shadow-lg transition-all ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                 {isVideoOff ? <VideoOff size={24} className="text-white" /> : <VideoIcon size={24} className="text-white" />}
               </button>
             </div>
             <div className="flex gap-3 w-full md:w-auto">
                 <button onClick={leaveMeeting} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-4 rounded-xl font-bold text-lg w-full md:w-auto shadow-lg transition-transform hover:scale-[1.02]">Cancel</button>
                 <button onClick={handleJoinClick} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg w-full md:w-auto shadow-lg transition-transform hover:scale-[1.02]">Join Meeting</button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (isWaiting) {
      return (
          <div className="fixed inset-0 bg-slate-900 z-[200] flex flex-col items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold text-white mb-2">Joining Meeting...</h2>
              <p className="text-slate-400">Verifying host permissions. Please wait.</p>
              <button onClick={leaveMeeting} className="mt-8 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white font-medium transition-colors">Leave</button>
            </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-slate-900 text-white flex overflow-hidden font-sans">
      <FloatingEmojiStyles />

      {showSidebar && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowSidebar(false)} />
      )}

      {aiSummaryResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-slate-900 border border-purple-500/30 p-6 rounded-2xl max-w-lg w-full shadow-2xl relative">
              <button onClick={() => setAiSummaryResult(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-purple-400"><Sparkles size={24}/> AI Meeting Summary</h2>
              <div className="bg-slate-800 p-5 rounded-xl text-slate-200 text-sm leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar">
                {aiSummaryResult.split('\n').map((line, i) => {
                  if (line.includes('**')) {
                    const parts = line.split('**');
                    return (
                      <p key={`line-${i}`} className="mb-3">
                        {parts.map((part, index) => index % 2 === 1 ? <strong key={`bold-${i}-${index}`} className="text-white bg-slate-950 px-1 rounded">{part}</strong> : <span key={`text-${i}-${index}`}>{part}</span>)}
                      </p>
                    );
                  }
                  if (line.trim().startsWith('-') || line.trim().startsWith('*')) return <li key={`list-${i}`} className="ml-4 mb-2 text-blue-200">{line.replace(/^[-*]/, '').trim()}</li>
                  return <p key={`para-${i}`} className="mb-3">{line}</p>
                })}
              </div>
              <button onClick={() => setAiSummaryResult(null)} className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl font-bold transition">Close</button>
           </div>
        </div>
      )}

      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
           <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl relative">
              <button onClick={() => setShowSecurityModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Shield size={24} className="text-blue-500"/> Security Controls</h2>
              
              <div className="space-y-3">
                 <p className="text-sm text-slate-400 mb-2">Allow participants to:</p>
                 <label className="flex items-center justify-between p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition">
                    <span className="font-medium text-sm">Turn on Microphone</span>
                    <input type="checkbox" checked={globalPermissions.mic} onChange={() => handleSecurityUpdate('mic')} className="w-4 h-4 text-blue-600 rounded" />
                 </label>
                 <label className="flex items-center justify-between p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition">
                    <span className="font-medium text-sm">Turn on Video</span>
                    <input type="checkbox" checked={globalPermissions.video} onChange={() => handleSecurityUpdate('video')} className="w-4 h-4 text-blue-600 rounded" />
                 </label>
                 <label className="flex items-center justify-between p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition">
                    <span className="font-medium text-sm">Share Screen</span>
                    <input type="checkbox" checked={globalPermissions.screen} onChange={() => handleSecurityUpdate('screen')} className="w-4 h-4 text-blue-600 rounded" />
                 </label>
                 <label className="flex items-center justify-between p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition">
                    <span className="font-medium text-sm">Record Meeting</span>
                    <input type="checkbox" checked={globalPermissions.record} onChange={() => handleSecurityUpdate('record')} className="w-4 h-4 text-blue-600 rounded" />
                 </label>
                 <label className="flex items-center justify-between p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition">
                    <span className="font-medium text-sm">Edit Shared Notes</span>
                    <input type="checkbox" checked={globalPermissions.notes} onChange={() => handleSecurityUpdate('notes')} className="w-4 h-4 text-blue-600 rounded" />
                 </label>
                 <label className="flex items-center justify-between p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-700 transition">
                    <span className="font-medium text-sm">Create Tasks</span>
                    <input type="checkbox" checked={globalPermissions.tasks} onChange={() => handleSecurityUpdate('tasks')} className="w-4 h-4 text-blue-600 rounded" />
                 </label>
              </div>
           </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
           <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl relative">
              <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={24}/> Meeting Settings</h2>
              
              <div className="space-y-4">
                 <div className="bg-slate-800 p-4 rounded-xl flex justify-between items-center">
                    <div>
                       <p className="text-sm text-slate-200 font-semibold">Live Captions</p>
                       <p className="text-xs text-slate-400">Auto-transcribe speech to text</p>
                    </div>
                    <button onClick={() => setCaptionsEnabled(!captionsEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${captionsEnabled ? 'bg-blue-600' : 'bg-slate-600'}`}>
                       <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${captionsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></span>
                    </button>
                 </div>

                 <div className="bg-slate-800 p-4 rounded-xl">
                    <p className="text-sm text-slate-200 font-semibold mb-1">Layout Mode</p>
                    <p className="text-xs text-slate-400 mb-3">Choose how videos are displayed</p>
                    <select 
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm w-full outline-none focus:border-blue-500 transition-colors"
                      value={layoutMode}
                      onChange={(e) => setLayoutMode(e.target.value as 'grid' | 'sidebar')}
                    >
                      <option value="grid">Auto Grid</option>
                      <option value="sidebar">Sidebar Priority</option>
                    </select>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showEmojiPicker && (
         <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-full px-4 py-3 flex gap-3 md:gap-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] z-[200] animate-in fade-in slide-in-from-bottom-2">
            {['👍', '👏', '❤️', '😂', '😲', '🎉'].map(emoji => (
               <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-125 transition-transform">{emoji}</button>
            ))}
         </div>
      )}

      <div className={`flex-1 flex flex-col p-2 md:p-4 relative transition-all duration-300 ${showSidebar ? 'md:mr-[350px]' : 'w-full'} h-full`}>
        
        {toastNotification && (
           <div className="absolute top-4 right-4 md:top-8 md:right-8 bg-slate-800 border-l-4 border-blue-500 shadow-2xl px-4 py-3 rounded-lg z-50 flex flex-col animate-in slide-in-from-top-4 fade-in duration-300 max-w-xs">
              <span className="text-xs text-blue-400 font-bold uppercase">{toastNotification.sender}</span>
              <span className="text-sm text-slate-200 truncate">{toastNotification.msg}</span>
           </div>
        )}

        <div className="flex justify-between items-center mb-2 md:mb-4 px-2 z-10 bg-slate-900/60 md:bg-transparent backdrop-blur-md md:backdrop-blur-none rounded-xl md:rounded-none py-2 md:py-0">
          
          <h2 className="text-sm md:text-xl font-bold tracking-tight px-2 flex items-center gap-2">
            Room: {roomId} 
            <div className="hidden sm:flex gap-1 ml-2">
               {myRole === 'creator' && <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Host</span>}
               {myRole === 'co-host' && <span className="bg-yellow-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Co-Host</span>}
            </div>
          </h2>

          <div className="flex gap-2 items-center relative">
            <div className="md:hidden flex items-center gap-1.5 sm:gap-2">
               {myRole === 'creator' && (
                 <button onClick={handleEndMeeting} disabled={isGeneratingAI} className="bg-red-600 hover:bg-red-700 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-white shadow-lg transition flex items-center gap-1">
                   {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <StopCircle size={14} />} End
                 </button>
               )}
               {(myRole === 'creator' || myRole === 'co-host') && (
                 <button onClick={() => setShowSecurityModal(true)} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-blue-400 border border-slate-700 transition" title="Host Controls">
                   <Shield size={16} />
                 </button>
               )}
               <button onClick={() => setShowSettingsModal(true)} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-slate-300 border border-slate-700 transition" title="Settings">
                 <Settings size={16} />
               </button>
               <button onClick={leaveMeeting} className="bg-slate-800 hover:bg-slate-700 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs rounded-lg font-bold border border-slate-700 transition text-white">
                 Leave
               </button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <button onClick={generateAISummary} disabled={isGeneratingAI} className="bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2">
                {isGeneratingAI ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                <span>AI Summary</span>
              </button>
              {myRole === 'creator' && (
                <button onClick={handleEndMeeting} disabled={isGeneratingAI} className="bg-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-800 text-white shadow-lg transition">
                  End Meeting
                </button>
              )}
              {(myRole === 'creator' || myRole === 'co-host') && (
                <button onClick={() => setShowSecurityModal(true)} className="bg-slate-800 p-2 rounded-lg text-blue-400 hover:bg-slate-700 transition">
                  <Shield size={18} />
                </button>
              )}
              <button onClick={() => setShowSettingsModal(true)} className="bg-slate-800 p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition">
                <Settings size={18} />
              </button>
              <button onClick={leaveMeeting} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm rounded-lg font-bold transition ml-2">
                Leave Call
              </button>
            </div>
          </div>
        </div>
        
        <div className={`flex-1 flex overflow-hidden pb-[80px] md:pb-24 px-1 md:px-2 gap-2 md:gap-4 min-h-0 ${displayPinnedId ? 'flex-col md:flex-row' : 'flex-col'}`}>
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
                    <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                      <VideoPlayer stream={localScreenStream!} name={`${userName}'s Presentation`} isMuted={true} isVideoOff={false} isLocal={true} isScreenShare={true} />
                    </div>
                 );
              }
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} profilePic={peerPics[id]} isMuted={peerStatus[id]?.isMuted} isVideoOff={false} isSpeaking={speakingPeers[id]} isHandRaised={raisedHands[id]} />
                </div>
              );
            })}

            {renderedHiddenPeers.map(id => {
              if (id === displayPinnedId) return null;
              return (
                <div key={id} onClick={() => setPinnedUserId(id)} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
                  <VideoPlayer stream={remoteStreams[id] || new MediaStream()} name={peerNames[id] || "Participant"} profilePic={peerPics[id]} isMuted={peerStatus[id]?.isMuted} isVideoOff={true} isSpeaking={speakingPeers[id]} isHandRaised={raisedHands[id]} />
                </div>
              );
            })}

            {remainingHiddenCount > 0 && !displayPinnedId && (
              <div onClick={() => { setShowSidebar(true); setActiveTab('participants'); }} className="cursor-pointer transition-transform hover:scale-[1.02] w-full h-full relative min-h-0 min-w-0">
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
          <div className="absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-28 md:right-8 w-24 h-36 md:w-48 md:h-32 bg-slate-950 rounded-xl border-2 border-slate-700 overflow-hidden shadow-2xl z-20 transition-all">
             <VideoPlayer stream={myStream || new MediaStream()} name={`${userName} (You)`} profilePic={userProfilePic} isMuted={isMuted} isVideoOff={isVideoOff} isLocal={true} isSpeaking={speakingPeers['local']} isHandRaised={isHandRaised} />
          </div>
        )}

        {liveCaption && captionsEnabled && (
          <div className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-36 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 md:px-6 md:py-3 rounded-2xl text-center backdrop-blur-md z-20 border border-white/10 shadow-2xl max-w-[90%] md:max-w-[70%] pointer-events-none">
            <p className="text-white text-xs md:text-base font-medium leading-relaxed">{liveCaption}</p>
          </div>
        )}

        <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-lg px-2 py-2 md:px-6 md:py-3 rounded-full flex gap-2 md:gap-4 z-40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 w-max max-w-[95vw] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-center">
          
          <button onClick={toggleMute} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isMuted ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : (myRole === 'guest' && !globalPermissions.mic ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600')}`}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <button onClick={toggleVideo} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isVideoOff ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : (myRole === 'guest' && !globalPermissions.video ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600')}`}>
            {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>

          <button onClick={toggleRaiseHand} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${isHandRaised ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} title="Raise Hand">
            <Hand size={20} />
          </button>

          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-3 md:p-4 rounded-full transition-all duration-200 shrink-0 ${showEmojiPicker ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`} title="Reactions">
            <Smile size={20} />
          </button>

          <button onClick={toggleScreenShare} className={`p-3 md:p-4 rounded-full transition-all duration-200 hidden md:block shrink-0 ${localScreenStream ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : (myRole === 'guest' && !globalPermissions.screen ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-slate-300')}`} title="Present Screen">
            <MonitorUp size={20} />
          </button>

          <button 
            onClick={() => {
                if (myRole === 'guest' && !globalPermissions.record) return alert("Host has disabled recording for participants.");
                toggleRecording();
            }} 
            className={`p-3 md:p-4 rounded-full transition-all duration-200 hidden md:block shrink-0 ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse' : (myRole === 'guest' && !globalPermissions.record ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-slate-300')}`} 
            title={isRecording ? "Stop Recording" : "Start Recording"}
          >
            {isRecording ? <StopCircle size={20} /> : <Circle size={20} />}
          </button>

          <div className="w-px h-8 bg-slate-600 mx-0.5 md:mx-2 shrink-0"></div>
          
          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('chat'); }} className={`p-3 md:p-4 rounded-full transition-all shrink-0 md:hidden block ${showSidebar && activeTab === 'chat' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <MessageSquare size={20} />
          </button>

          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('chat'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block shrink-0 ${showSidebar && activeTab === 'chat' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <MessageSquare size={20} />
          </button>
          
          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('participants'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block shrink-0 relative ${showSidebar && activeTab === 'participants' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <Users size={20} />
            {joinRequests.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] h-5 w-5 flex items-center justify-center rounded-full border-2 border-slate-900">{joinRequests.length}</span>}
          </button>

          <button onClick={() => { setShowSidebar(!showSidebar); setActiveTab('notes'); }} className={`p-3 md:p-4 rounded-full transition-all hidden md:block shrink-0 relative ${showSidebar && activeTab === 'notes' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
            <FileText size={20} />
          </button>
        </div>
      </div>

      <div className={`${showSidebar ? 'translate-x-0' : 'translate-x-full'} fixed top-0 right-0 h-[100dvh] w-full md:w-[350px] bg-slate-900 border-l border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[60] flex flex-col transition-transform duration-300 ease-in-out`}>
        <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950">
          <div className="flex gap-1 w-full bg-slate-800/50 p-1 rounded-xl">
             <button onClick={() => setActiveTab('chat')} className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${activeTab === 'chat' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Chat</button>
             <button onClick={() => setActiveTab('participants')} className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-colors relative ${activeTab === 'participants' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                People ({Object.keys(peerNames).length + 1})
                {joinRequests.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] h-4 w-4 flex items-center justify-center rounded-full">{joinRequests.length}</span>}
             </button>
             <button onClick={() => setActiveTab('notes')} className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${activeTab === 'notes' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Notes</button>
          </div>
          <button onClick={() => setShowSidebar(false)} className="ml-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>
        
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-slate-900/50 min-h-0 overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {messages.length === 0 ? (
                 <div className="text-center flex flex-col items-center justify-center h-full text-slate-500">
                    <MessageSquare size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Say hello to everyone!</p>
                 </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.sender === userName;
                  return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full`}>
                    {!isMe && <span className="text-[10px] text-slate-400 mb-1 ml-1">{m.sender}</span>}
                    <div className={`p-3 text-sm break-words shadow-sm relative ${isMe ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm border border-slate-700/50'} max-w-[85%]`}>
                      {m.text}
                      <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{m.time}</span>
                    </div>
                  </div>
                )})
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>
            
            <div className="px-4 h-6 flex items-center shrink-0">
              {typingUsers.length > 0 && (
                <div className="text-xs text-blue-400 italic flex items-center gap-2 font-medium">
                  <div className="flex gap-0.5">
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                  </div>
                  {typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : 'Multiple people are typing...'}
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="shrink-0 p-3 border-t border-slate-800 bg-slate-950 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex gap-2 items-center bg-slate-900 border border-slate-700 rounded-xl p-1 pr-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={handleTyping} 
                  className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none text-white placeholder-slate-500" 
                  placeholder="Send a message..." 
                />
                <button type="submit" disabled={!chatInput.trim()} className="bg-blue-600 disabled:opacity-50 p-2 rounded-lg text-white transition-all hover:bg-blue-700 hover:shadow-lg">
                  <Send size={16} className="ml-0.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="flex-1 flex flex-col bg-slate-900/50 p-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-[calc(1rem+env(safe-area-inset-bottom))]">
            
            <div className="flex flex-col h-1/2 mb-4">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><FileText size={14}/> Live Shared Notes</h4>
               <textarea 
                  value={sharedNotes}
                  onChange={handleNotesChange}
                  disabled={myRole === 'guest' && !globalPermissions.notes}
                  placeholder={myRole === 'guest' && !globalPermissions.notes ? "Host disabled typing in shared notes." : "Type here... Everyone in the meeting can see and edit this document in real-time."}
                  className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-blue-500 resize-none transition-colors shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
               />
               <p className="text-[10px] text-slate-500 mt-1 italic">Edits are synced instantly with all participants.</p>
            </div>

            <div className="w-full h-px bg-slate-800 my-2"></div>

            <div className="flex flex-col flex-1 min-h-[200px]">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckSquare size={14}/> Action Items</h4>
               
               <form onSubmit={handleAddTask} className="flex flex-col gap-2 mb-3">
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newTaskInput} 
                        onChange={(e) => setNewTaskInput(e.target.value)} 
                        disabled={myRole === 'guest' && !globalPermissions.tasks}
                        placeholder={myRole === 'guest' && !globalPermissions.tasks ? "Task creation disabled by host." : "Add a new task..."} 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                      />
                      <button type="submit" disabled={!newTaskInput.trim() || (myRole === 'guest' && !globalPermissions.tasks)} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center">
                        <Plus size={16} />
                      </button>
                  </div>
                  <select 
                      value={selectedAssignee} 
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      disabled={myRole === 'guest' && !globalPermissions.tasks}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                      <option value="unassigned">Assign to (Optional)</option>
                      <option value="local">{userName} (You)</option>
                      {Object.keys(peerNames).map(id => (
                          <option key={id} value={id}>{peerNames[id]}</option>
                      ))}
                  </select>
               </form>

               <div className="flex-1 overflow-y-auto space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {meetingTasks.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                        <CheckSquare size={32} className="mb-2" />
                        <span className="text-xs">No tasks added yet</span>
                     </div>
                  ) : (
                     meetingTasks.map((task) => (
                        <div key={task.id} className="bg-slate-800/50 border border-slate-700/50 p-2.5 rounded-lg flex flex-col">
                           <div className="flex justify-between items-start">
                               <span className="text-sm text-slate-200">{task.text}</span>
                               {task.assigneeName && task.assigneeName !== 'Unassigned' && (
                                   <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 whitespace-nowrap ml-2">
                                       @ {task.assigneeName}
                                   </span>
                               )}
                           </div>
                           <span className="text-[9px] text-slate-400 mt-1">Added by {task.creator}</span>
                        </div>
                     ))
                  )}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
             
             {(myRole === 'creator' || myRole === 'co-host') && joinRequests.length > 0 && (
                <div className="mb-6">
                   <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      Waiting Room ({joinRequests.length})
                   </h4>
                   {joinRequests.map(req => (
                      <div key={req.socketId} className="bg-slate-800 p-3 rounded-xl mb-2 flex justify-between items-center border border-yellow-500/30 shadow-lg">
                         <span className="text-sm font-bold text-yellow-400 truncate flex-1 min-w-0 pr-2">{req.userName}</span>
                         <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { socket?.emit('accept-join', { targetSocketId: req.socketId, targetUserId: req.targetUserId, roomId }); setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId)); }} className="bg-emerald-600 hover:bg-emerald-500 p-1.5 rounded-lg text-white transition-colors"><Check size={16}/></button>
                            <button onClick={() => { socket?.emit('reject-join', { targetSocketId: req.socketId }); setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId)); }} className="bg-red-600 hover:bg-red-500 p-1.5 rounded-lg text-white transition-colors"><X size={16}/></button>
                         </div>
                      </div>
                   ))}
                </div>
             )}

             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">In Meeting</h4>
             
             <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl mb-2 border border-slate-800">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                   <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-700 border-2 border-blue-500 flex items-center justify-center font-bold text-lg relative overflow-hidden">
                     {userProfilePic ? (
                        <img src={userProfilePic} alt="P" className="h-full w-full object-cover" />
                     ) : (
                        userName.charAt(0)
                     )}
                     {speakingPeers['local'] && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                   </div>
                   <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm truncate">{userName} (You)</span>
                      <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">{myRole === 'creator' ? 'Host' : myRole}</span>
                   </div>
                </div>
                <div className="flex gap-1 items-center flex-shrink-0 ml-2">
                   {isHandRaised && <Hand size={14} className="text-blue-400 mr-1 animate-bounce" />}
                   {isMuted ? <MicOff size={16} className="text-red-500" /> : <Mic size={16} className="text-emerald-500" />}
                   {isVideoOff ? <VideoOff size={16} className="text-red-500 ml-1" /> : <VideoIcon size={16} className="text-blue-400 ml-1" />}
                   <div className="w-px h-4 bg-slate-700 mx-1"></div>
                   <button onClick={() => setPinnedUserId(pinnedUserId === 'local' ? null : 'local')} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors" title={pinnedUserId === 'local' ? "Unpin" : "Pin to screen"}>
                      <Pin size={16} className={pinnedUserId === 'local' ? "text-blue-400" : "text-slate-400"} />
                   </button>
                </div>
             </div>

             {sortedPeerIds.map(id => {
                const role = roomRoles[id] || 'guest';
                const isTargetCreator = role === 'creator';
                const canToggleCoHost = myRole === 'creator' && !isTargetCreator;
                const canKick = (myRole === 'creator' && !isTargetCreator) || (myRole === 'co-host' && role === 'guest');

                return (
                  <div key={id} className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${speakingPeers[id] ? 'bg-blue-900/20 border-blue-800/50' : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700'}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                       <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-lg text-slate-300 relative overflow-hidden">
                          {peerPics[id] ? (
                             <img src={peerPics[id]} alt="P" className="h-full w-full object-cover" />
                          ) : (
                             (peerNames[id] || 'P').charAt(0)
                          )}
                          {speakingPeers[id] && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
                       </div>
                       <div className="flex flex-col min-w-0">
                          <span className={`font-medium text-sm truncate ${speakingPeers[id] ? 'text-blue-200' : 'text-slate-200'}`}>{peerNames[id] || "Participant"}</span>
                          {role !== 'guest' && <span className={`text-[10px] font-medium uppercase tracking-wider ${role === 'creator' ? 'text-blue-400' : 'text-yellow-500'}`}>{role === 'creator' ? 'Host' : role}</span>}
                       </div>
                    </div>
                    <div className="flex gap-1 items-center flex-shrink-0 ml-2">
                       {raisedHands[id] && <Hand size={14} className="text-blue-400 mr-1 animate-bounce" />}
                       {peerStatus[id]?.isMuted ? <MicOff size={14} className="text-red-500/80" /> : <Mic size={14} className="text-emerald-500/80" />}
                       {peerStatus[id]?.isVideoOff ? <VideoOff size={14} className="text-red-500/80 ml-1" /> : <VideoIcon size={14} className="text-blue-400/80 ml-1" />}
                       <div className="w-px h-4 bg-slate-700 mx-1"></div>
                       <button onClick={() => setPinnedUserId(pinnedUserId === id ? null : id)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors" title={pinnedUserId === id ? "Unpin" : "Pin to screen"}>
                          <Pin size={16} className={pinnedUserId === id ? "text-blue-400" : "text-slate-400"} />
                       </button>
                       
                       {canToggleCoHost && (
                           <button onClick={() => socket?.emit(role === 'co-host' ? 'remove-cohost' : 'make-cohost', { targetSocketId: id, roomId })} className={`p-1.5 rounded-md transition-colors ml-1 ${role === 'co-host' ? 'text-yellow-500 hover:bg-red-500/20 hover:text-red-400' : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-500/20'}`} title={role === 'co-host' ? "Remove Co-Host" : "Make Co-Host"}>
                               {role === 'co-host' ? <UserMinus size={16} /> : <Star size={16} />}
                           </button>
                       )}
                       {canKick && (
                           <button onClick={() => socket?.emit('kick-user', { targetSocketId: id, targetUserId: id, roomId })} className="p-1.5 hover:bg-red-600/20 text-red-500 rounded-md transition-colors ml-1" title="Kick from meeting">
                               <UserMinus size={16} />
                           </button>
                       )}
                    </div>
                  </div>
                );
             })}
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