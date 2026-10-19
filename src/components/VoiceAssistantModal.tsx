import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Sparkles, X, Send } from 'lucide-react';
import { FamilyMember, SavedPlace } from '../types';
import { speakVoiceAlert } from '../utils/audio';

// SpeechRecognition type polyfill for Webkit browsers
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Record<string, FamilyMember>;
  places: SavedPlace[];
  onSelectMember: (memberId: string) => void;
  onTriggerSos?: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  members,
  places,
  onSelectMember,
  onTriggerSos,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isOpen) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setIsListening(false);
      return;
    }

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const resultTranscript = event.results[current][0].transcript;
        setTranscript(resultTranscript);

        if (event.results[current].isFinal) {
          handleQuery(resultTranscript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognitionInstance(recognition);
      try {
        recognition.start();
      } catch (err) {
        console.warn('Could not auto-start recognition:', err);
      }
    }
  }, [isOpen]);

  const toggleListening = () => {
    if (isListening && recognitionInstance) {
      recognitionInstance.stop();
      setIsListening(false);
    } else if (recognitionInstance) {
      setTranscript('');
      try {
        recognitionInstance.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const handleQuery = (query: string) => {
    const q = query.toLowerCase();
    let reply = '';
    let targetMember: FamilyMember | null = null;

    // Check query for members
    const memberList = Object.values(members);

    // Mom
    if (q.includes('mom') || q.includes('mother') || q.includes('sarah')) {
      targetMember = memberList.find((m) => m.role === 'Mom' || m.name.toLowerCase().includes('sarah')) || null;
    }
    // Dad
    else if (q.includes('dad') || q.includes('father') || q.includes('mark')) {
      targetMember = memberList.find((m) => m.role === 'Dad' || m.name.toLowerCase().includes('mark')) || null;
    }
    // Emma / Daughter / Sister
    else if (q.includes('emma') || q.includes('daughter') || q.includes('sister')) {
      targetMember = memberList.find((m) => m.role === 'Daughter' || m.name.toLowerCase().includes('emma')) || null;
    }
    // Lucas / Son / Brother
    else if (q.includes('lucas') || q.includes('son') || q.includes('brother')) {
      targetMember = memberList.find((m) => m.role === 'Son' || m.name.toLowerCase().includes('lucas')) || null;
    }

    if (q.includes('emergency') || q.includes('sos') || q.includes('help')) {
      reply = "Triggering family emergency SOS broadcast and siren alert!";
      setResponseText(reply);
      speakVoiceAlert(reply, true);
      if (onTriggerSos) onTriggerSos();
      return;
    }

    if (q.includes('who is driving') || q.includes('anyone driving') || q.includes('driving')) {
      const drivers = memberList.filter((m) => m.speedMph >= 15);
      if (drivers.length === 0) {
        reply = "No one in your family is currently driving. Everyone is stationary or walking.";
      } else {
        const names = drivers.map((d) => `${d.name} (${d.speedMph} mph)`).join(', ');
        reply = `Currently driving: ${names}.`;
      }
      setResponseText(reply);
      speakVoiceAlert(reply);
      return;
    }

    if (q.includes('battery')) {
      const lowBatt = memberList.filter((m) => m.battery <= 25);
      if (lowBatt.length > 0) {
        reply = `Attention: ${lowBatt.map((m) => m.name).join(' and ')} have low battery under 25%.`;
      } else {
        const stats = memberList.map((m) => `${m.name}: ${m.battery}%`).join(', ');
        reply = `Family battery status: ${stats}.`;
      }
      setResponseText(reply);
      speakVoiceAlert(reply);
      return;
    }

    if (targetMember) {
      onSelectMember(targetMember.id);
      const place = targetMember.location.placeName || targetMember.location.address || 'on the map';
      const isDriving = targetMember.speedMph >= 15;
      const speedStr = isDriving ? `, driving at ${targetMember.speedMph} miles per hour` : '';

      reply = `${targetMember.name} is currently at ${place}${speedStr}. Battery is at ${targetMember.battery}%.`;
      setResponseText(reply);
      speakVoiceAlert(reply);
      return;
    }

    // Fallback answer
    reply = "I couldn't identify which family member you're asking about. Try saying: Where's Mom, Where's Dad, or Who is driving?";
    setResponseText(reply);
    speakVoiceAlert(reply);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col items-center relative ring-1 ring-white/10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Orbit AI Avatar Beacon */}
        <div className="relative my-4 flex items-center justify-center">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
              isListening
                ? 'bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 shadow-[0_0_50px_rgba(56,189,248,0.5)] scale-110'
                : 'bg-slate-800 border border-slate-700'
            }`}
          >
            {isListening ? (
              <Mic className="w-10 h-10 text-white animate-bounce" />
            ) : (
              <Sparkles className="w-10 h-10 text-indigo-400" />
            )}
          </div>
          {isListening && (
            <div className="absolute inset-0 -m-4 rounded-full border border-sky-400/40 animate-ping pointer-events-none" />
          )}
        </div>

        <h3 className="font-extrabold text-xl text-white flex items-center gap-2">
          <span>Hey KinTrack</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
            Family Voice AI
          </span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {isListening ? 'Listening... Speak your question now' : 'Tap the microphone or choose a voice prompt'}
        </p>

        {/* Live Transcript / Response Box */}
        <div className="w-full mt-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 min-h-[90px] flex flex-col justify-center text-center">
          {transcript && (
            <p className="text-xs text-slate-400 font-mono mb-1">
              &ldquo;{transcript}&rdquo;
            </p>
          )}
          {responseText ? (
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
              <Volume2 className="w-4 h-4 shrink-0 text-emerald-400 animate-pulse" />
              <span>{responseText}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Say &ldquo;Where&apos;s mom?&rdquo; or &ldquo;Who is driving?&rdquo;
            </p>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="w-full mt-4 flex flex-wrap gap-2 justify-center">
          {[
            "Where's mom?",
            "Where is dad?",
            "Where's Lucas?",
            "Is Emma at school?",
            "Who is driving right now?",
            "Check family battery levels",
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setTranscript(chip);
                handleQuery(chip);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-xs text-slate-200 transition active:scale-95 flex items-center gap-1.5"
            >
              <span>💬</span>
              <span>{chip}</span>
            </button>
          ))}
        </div>

        {/* Manual Input Fallback */}
        <div className="w-full mt-5 flex items-center gap-2">
          <input
            type="text"
            placeholder="Or type a question (e.g., Where's mom?)..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && transcript.trim()) {
                handleQuery(transcript);
              }
            }}
            className="flex-1 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => {
              if (transcript.trim()) handleQuery(transcript);
            }}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shrink-0"
            title="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-xl text-white transition shrink-0 ${
              isListening ? 'bg-rose-600 hover:bg-rose-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title={isListening ? 'Stop listening' : 'Start microphone'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
