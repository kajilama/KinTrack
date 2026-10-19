import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  X,
  FileText,
  Shield,
  Gauge,
  Battery,
  MapPin,
  RefreshCw,
  Compass,
  Bot,
  User,
  Clock,
} from 'lucide-react';
import { FamilyMember, SavedPlace } from '../types';
import { speakVoiceAlert, unlockAudioContext } from '../utils/audio';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

interface JarvisAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleName: string;
  members: Record<string, FamilyMember>;
  places: SavedPlace[];
  onSelectMember?: (memberId: string) => void;
}

interface JarvisMessage {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  timestamp: number;
}

export const JarvisAiModal: React.FC<JarvisAiModalProps> = ({
  isOpen,
  onClose,
  circleId,
  circleName,
  members,
  places,
  onSelectMember,
}) => {
  const [messages, setMessages] = useState<JarvisMessage[]>([
    {
      id: 'welcome',
      sender: 'jarvis',
      text: `Hello! I am **Jarvis**, your KinTrack Family personal safety & tracking assistant.\n\nI monitor real-time GPS locations, today's morning & afternoon timelines, road speed limits, driving trends, and battery levels.\n\nTry asking me:\n• *"Hey Jarvis, where's mom and where was she earlier today in the morning?"*\n• *"Where is everyone right now?"*\n• *"Who has low battery?"*\n• *"Is anyone speeding?"*`,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSpeechEnabled, setVoiceSpeechEnabled] = useState(true);
  const [isAlwaysListening, setIsAlwaysListening] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Start speech recognition helper
  const startListening = () => {
    if (!recognitionRef.current || isSpeakingRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // already started or busy
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch {}
  };

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Web Speech Recognition for "Hey Jarvis" wake word & hands-free voice commands
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      return;
    }

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimText += trans;
          }
        }

        const currentSpeech = (finalTranscript || interimText).trim();
        setLiveTranscript(currentSpeech);

        if (finalTranscript.trim()) {
          const raw = finalTranscript.trim();
          const lower = raw.toLowerCase().replace(/[,!?.]$/, '');

          // If user simply said the wake word
          if (lower === 'hey jarvis' || lower === 'jarvis' || lower === 'hello jarvis' || lower === 'hi jarvis') {
            setLiveTranscript('');
            const greeting = "Yes, I'm listening! You can ask me where anyone is, their morning locations, battery levels, or driving speed.";
            const greetingMsg: JarvisMessage = {
              id: `jarvis-greet-${Date.now()}`,
              sender: 'jarvis',
              text: greeting,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, greetingMsg]);
            if (voiceSpeechEnabled) {
              isSpeakingRef.current = true;
              setIsSpeaking(true);
              stopListening();
              speakVoiceAlert(greeting, true).finally(() => {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                if (isAlwaysListening) {
                  setTimeout(startListening, 300);
                }
              });
            }
            return;
          }

          // Filter out wake word prefixes if user said "Hey Jarvis, where is mom?"
          let command = raw;
          if (lower.startsWith('hey jarvis')) {
            command = raw.slice(10).replace(/^[,!.\s]+/, '');
          } else if (lower.startsWith('jarvis')) {
            command = raw.slice(6).replace(/^[,!.\s]+/, '');
          }

          if (command.trim().length > 1) {
            setLiveTranscript('');
            handleSendQuery(command);
          }
        }
      };

      recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('Speech recognition status:', err.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (isOpen && isAlwaysListening && !isSpeakingRef.current) {
          setTimeout(() => {
            if (isOpen && !isSpeakingRef.current) {
              startListening();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;

      if (isAlwaysListening) {
        unlockAudioContext();
        startListening();
      }
    }

    return () => {
      stopListening();
    };
  }, [isOpen, isAlwaysListening]);

  if (!isOpen) return null;

  const toggleMic = () => {
    unlockAudioContext();
    if (!recognitionRef.current) {
      alert('Voice recognition is not supported on this browser. You can type queries below.');
      return;
    }

    if (isListening) {
      setIsAlwaysListening(false);
      stopListening();
    } else {
      setIsAlwaysListening(true);
      startListening();
    }
  };

  const handleSendQuery = async (queryText?: string) => {
    const q = (queryText || inputText).trim();
    if (!q) return;

    unlockAudioContext();

    const userMsg: JarvisMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/circle/${circleId}/jarvis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || 'I checked the circle telemetry, but could not produce a response.';
        const jarvisMsg: JarvisMessage = {
          id: `jarvis-${Date.now()}`,
          sender: 'jarvis',
          text: replyText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, jarvisMsg]);

        // Speak aloud if voice speech is enabled
        if (voiceSpeechEnabled) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          stopListening();
          // Strip markdown symbols for natural speech synthesis
          const cleanSpeech = replyText
            .replace(/[#*_`~>•-]/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .slice(0, 1000);
          speakVoiceAlert(cleanSpeech, true).finally(() => {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            if (isAlwaysListening) {
              setTimeout(() => {
                startListening();
              }, 400);
            }
          });
        }
      } else {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.warn('Jarvis query error:', err);
      const errMsg: JarvisMessage = {
        id: `jarvis-err-${Date.now()}`,
        sender: 'jarvis',
        text: '⚠️ I encountered an error communicating with the intelligence service. Live GPS telemetry is still active on your map.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    { label: "Where's mom & morning history?", query: "Hey Jarvis, where's mom and where was she earlier today in the morning?" },
    { label: 'Where is everyone?', query: 'Where is everyone right now and what are their battery levels?' },
    { label: 'Check battery status', query: 'Which family members have low battery and who is charging?' },
    { label: 'Speeding & Driving check', query: 'Is anyone currently driving or exceeding the road speed limit?' },
    { label: 'Most visited places', query: 'What are the family geofenced places and who is there?' },
    { label: 'Daily Safety Report', query: 'Generate an executive family safety and location intelligence report for today.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-indigo-500/40 rounded-3xl shadow-2xl flex flex-col h-[85vh] max-h-[720px] overflow-hidden">
        {/* Futuristic Jarvis Header */}
        <div className="px-5 py-4 border-b border-indigo-900/50 bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-cyan-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Bot className="w-5 h-5 text-white animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-slate-900"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white tracking-wide">Jarvis</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  AI Family Agent
                </span>
              </div>
              <p className="text-[11px] text-slate-400">KinTrack Real-Time Intelligence & Trends</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceSpeechEnabled(!voiceSpeechEnabled)}
              className={`p-2 rounded-xl border transition ${
                voiceSpeechEnabled
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
              title={voiceSpeechEnabled ? 'Jarvis Speech Audio: ON' : 'Jarvis Speech Audio: OFF'}
            >
              {voiceSpeechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Close Jarvis"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Quick:
          </span>
          {QUICK_PROMPTS.map((qp, i) => (
            <button
              key={i}
              onClick={() => handleSendQuery(qp.query)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-indigo-950 hover:border-indigo-500/50 border border-slate-700/60 text-slate-300 text-xs font-medium whitespace-nowrap transition shrink-0 active:scale-95 disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m) => {
            const isJarvis = m.sender === 'jarvis';
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs leading-relaxed ${isJarvis ? 'items-start' : 'items-end justify-end'}`}
              >
                {isJarvis && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] whitespace-pre-wrap break-words ${
                    isJarvis
                      ? 'bg-slate-800/90 border border-slate-700/80 text-slate-200 shadow-md'
                      : 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-900/30'
                  }`}
                >
                  {m.text}
                  <div className={`text-[9px] mt-1.5 opacity-60 flex items-center gap-1 ${isJarvis ? 'justify-start' : 'justify-end'}`}>
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {!isJarvis && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-3 text-xs text-cyan-300 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-cyan-500/40 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              </div>
              <span className="bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700">
                Jarvis is analyzing live GPS telemetry and morning timelines...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Controls & Mic Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col gap-2">
          {isSpeaking && (
            <div className="px-3 py-1.5 rounded-xl bg-indigo-950/90 border border-indigo-500/50 text-indigo-200 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-semibold">Jarvis is speaking aloud...</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                  setIsSpeaking(false);
                }}
                className="text-[10px] text-rose-300 hover:text-white shrink-0 ml-2 font-bold underline"
              >
                Stop Voice
              </button>
            </div>
          )}

          {isListening && (
            <div className="px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0"></span>
                <span className="truncate">
                  {liveTranscript ? `Heard: "${liveTranscript}"` : 'Listening for "Hey Jarvis" or voice command...'}
                </span>
              </span>
              <button onClick={toggleMic} className="text-[10px] text-cyan-300 hover:text-white shrink-0 ml-2 font-bold underline">
                Mute Mic
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuery();
            }}
            className="flex items-center gap-2"
          >
            {/* Mic Button */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-3 rounded-2xl border transition active:scale-95 shadow-md flex items-center justify-center ${
                isListening
                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-cyan-400'
              }`}
              title={isListening ? 'Stop listening' : 'Speak to Jarvis (Microphone)'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Input Text Box */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Jarvis anything about family locations, battery, morning trips..."
              disabled={isLoading}
              className="flex-1 bg-slate-800/90 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 transition shadow-lg active:scale-95"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
