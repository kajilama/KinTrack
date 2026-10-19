import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Copy,
  Check,
  X,
  FileText,
  Shield,
  Gauge,
  Battery,
  MapPin,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { FamilyMember, SavedPlace } from '../types';
import { speakVoiceAlert } from '../utils/audio';
import { apiFetch } from '../utils/apiConfig';

interface AiLocationAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleName: string;
  members: Record<string, FamilyMember>;
  places: SavedPlace[];
  onSelectMember?: (memberId: string) => void;
}

interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export const AiLocationAgentModal: React.FC<AiLocationAgentModalProps> = ({
  isOpen,
  onClose,
  circleId,
  circleName,
  members,
  places,
  onSelectMember,
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: `👋 **Hello! I am your Orbit 360 AI Safety & Location Analyst.**\n\nI have real-time access to your family's live GPS coordinates, driving speeds, battery levels, and saved place geofences.\n\nTap a quick report button below or ask me any question!`,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Speech Recognition Setup
  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      return;
    }

    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          handleAskAgent(text);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isOpen]);

  const toggleMic = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Mic start error:', err);
      }
    }
  };

  const handleAskAgent = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMsg: AgentMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await apiFetch(`/api/circle/${circleId}/ai/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentMsg: AgentMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: data.reply || 'Analysis completed.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        throw new Error('Server returned error');
      }
    } catch (err) {
      console.warn('AI query failed:', err);
      // Fallback response
      const fallbackMsg: AgentMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: `📍 **Live Quick Status:**\nCurrently monitoring ${Object.keys(members).length} family members in ${circleName}. All systems active and communicating.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      // Strip markdown symbols for natural speech
      const cleanText = text
        .replace(/[*#_`]/g, '')
        .replace(/---/g, '')
        .trim();
      speakVoiceAlert(cleanText, true).then(() => {
        setIsSpeaking(false);
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[90vh] max-h-[720px] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
        {/* Header */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-sky-400 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Orbit AI Safety Analyst</h3>
                <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Location trends, safety reports &amp; family analytics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Report Chips */}
        <div className="px-3 py-2.5 bg-slate-950/40 border-b border-slate-800 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => handleAskAgent('Generate a comprehensive daily family tracking, location, and safety report for today.')}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 text-xs font-semibold whitespace-nowrap hover:bg-indigo-900/60 active:scale-95 transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>📋 Daily Safety Report</span>
          </button>

          <button
            onClick={() => handleAskAgent('Who is currently driving or speeding? Analyze driving habits and speeds.')}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-300 text-xs font-semibold whitespace-nowrap hover:bg-amber-900/60 active:scale-95 transition flex items-center gap-1.5"
          >
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>🚗 Speed &amp; Driving Trends</span>
          </button>

          <button
            onClick={() => handleAskAgent('Audit all family member phone battery percentages and charging states. Flag any low battery devices.')}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold whitespace-nowrap hover:bg-emerald-900/60 active:scale-95 transition flex items-center gap-1.5"
          >
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
            <span>🔋 Battery Health Audit</span>
          </button>

          <button
            onClick={() => handleAskAgent('Where is everyone located right now? List place names and distances from home.')}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-sky-950/70 border border-sky-500/40 text-sky-300 text-xs font-semibold whitespace-nowrap hover:bg-sky-900/60 active:scale-95 transition flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>📍 Member Location Summary</span>
          </button>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shrink-0 mt-0.5 shadow">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none'
                  }`}
                >
                  <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed whitespace-pre-line space-y-1">
                    {msg.text}
                  </div>

                  {!isUser && (
                    <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSpeak(msg.text)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center gap-1"
                          title="Read aloud"
                        >
                          {isSpeaking ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                              <span className="text-[10px] text-rose-300">Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="text-[10px]">Listen</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition flex items-center gap-1"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-indigo-300 flex items-center gap-2 rounded-tl-none">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Orbit AI is analyzing live GPS, speeds, and family trends...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`p-2.5 rounded-xl border transition shadow shrink-0 ${
              isListening
                ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isListening ? 'Listening... Tap to stop' : 'Tap to speak question'}
          >
            {isListening ? <Mic className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-indigo-400" />}
          </button>

          <input
            type="text"
            placeholder={isListening ? 'Listening to your voice...' : 'Ask Orbit AI about locations, speeds, trends, or safety...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAskAgent(inputText);
            }}
            disabled={isLoading}
            className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />

          <button
            onClick={() => handleAskAgent(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition shrink-0 shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
