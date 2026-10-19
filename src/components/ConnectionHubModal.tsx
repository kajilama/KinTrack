import React, { useState, useEffect } from 'react';
import {
  Server,
  Wifi,
  WifiOff,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Cloud,
  Laptop,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  getServerUrl,
  setServerUrl,
  testServerConnection,
  DEFAULT_CLOUD_SERVER_URL,
} from '../utils/apiConfig';
import { isNativeApp } from '../utils/nativeLocation';

interface ConnectionHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconnected?: () => void;
}

export const ConnectionHubModal: React.FC<ConnectionHubModalProps> = ({
  isOpen,
  onClose,
  onReconnected,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    latencyMs?: number;
    error?: string;
  }>({ tested: false, ok: false });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getServerUrl();
      setCustomUrl(current || DEFAULT_CLOUD_SERVER_URL);
      setTestResult({ tested: false, ok: false });
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async (urlToTest?: string) => {
    const target = urlToTest !== undefined ? urlToTest : customUrl;
    setIsTesting(true);
    setTestResult({ tested: false, ok: false });
    try {
      const res = await testServerConnection(target);
      setTestResult({
        tested: true,
        ok: res.ok,
        latencyMs: res.latencyMs,
        error: res.error,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        ok: false,
        error: err.message || 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setServerUrl(customUrl);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
      onReconnected?.();
    }, 800);
  };

  const handleSetPreset = (url: string) => {
    setCustomUrl(url);
    handleTest(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Family Circle Hub & Multi-Phone Sync</h3>
              <p className="text-xs text-slate-400">
                {isNativeApp() ? 'Android Native App' : 'Web & PWA Client'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-Device Sync Explanation */}
        <div className="mt-4 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200/90 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-indigo-300">
            <Smartphone className="w-4 h-4 text-indigo-400" />
            How Multi-Phone Tracking Works (Life360 Style)
          </div>
          <p className="leading-relaxed">
            All family phones share the same <strong>Circle Code</strong> and connect to this{' '}
            <strong>Server Hub</strong>. When Phone A updates its GPS, the Hub instantly streams the new
            coordinates, speed, and safety alerts to Phone B in real-time.
          </p>
        </div>

        {/* Server URL Input */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Server Hub Address (URL)</span>
            {testResult.tested && (
              <span
                className={`text-[11px] font-bold flex items-center gap-1 ${
                  testResult.ok ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {testResult.ok ? (
                  <>
                    <Check className="w-3 h-3" /> Connected ({testResult.latencyMs}ms)
                  </>
                ) : (
                  <>
                    <X className="w-3 h-3" /> {testResult.error || 'Unreachable'}
                  </>
                )}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://... or http://192.168.1.xxx:3000"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              onClick={() => handleTest()}
              disabled={isTesting || !customUrl.trim()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              Test
            </button>
          </div>
        </div>

        {/* Fast Presets */}
        <div className="mt-4 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Quick Hub Presets
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSetPreset(DEFAULT_CLOUD_SERVER_URL)}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 text-left transition flex items-start gap-2.5"
            >
              <Cloud className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-xs text-white">Cloud Server (Global)</div>
                <div className="text-[10px] text-slate-400">Works anywhere via Mobile Data & Wi-Fi</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                const sampleIp = 'http://192.168.1.100:3000';
                setCustomUrl(sampleIp);
              }}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 text-left transition flex items-start gap-2.5"
            >
              <Laptop className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-xs text-white">Local Mac/PC Network</div>
                <div className="text-[10px] text-slate-400">e.g. http://192.168.x.x:3000 on Wi-Fi</div>
              </div>
            </button>
          </div>
        </div>

        {/* Local Dev Server Instructions */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Testing locally on your Mac:
          </div>
          <p className="text-slate-400 leading-relaxed">
            1. On your Mac terminal, find your Wi-Fi IP: <code className="text-indigo-300">ipconfig getifaddr en0</code><br />
            2. Run <code className="text-indigo-300">npm run dev</code> in your project directory.<br />
            3. Enter <code className="text-indigo-300">http://&lt;YOUR_MAC_IP&gt;:3000</code> above on both phones!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-lg ${
              saveSuccess ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" /> Connected!
              </>
            ) : (
              'Save & Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
