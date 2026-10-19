import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Smartphone,
  Copy,
  Check,
  X,
  Share2,
  Users,
  CheckCircle2,
} from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl?: string;
  circleId?: string;
  inviteCode?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  targetUrl,
  circleId,
  inviteCode,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const activeCode = (inviteCode || circleId || 'ORBIT-FAMILY').trim().toUpperCase();
  const currentLiveUrl = targetUrl || `${window.location.origin}/?circle=${encodeURIComponent(activeCode)}`;

  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(currentLiveUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });
  }, [isOpen, currentLiveUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentLiveUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join our KinTrack Family Circle',
          text: `Join our family circle on KinTrack Family with invite code: ${activeCode}`,
          url: currentLiveUrl,
        });
      } catch {
        // User dismissed share dialog
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Invite Family Member</h3>
              <p className="text-xs text-slate-400">Scan QR Code or Share Invite Code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite Code Highlight Box */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Circle Invite Code
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono tracking-wider">
              {activeCode}
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 active:scale-95"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center text-center my-4">
          <div className="p-4 bg-white rounded-3xl shadow-2xl ring-4 ring-indigo-500/20">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Scan to join circle ${activeCode}`}
                className="w-52 h-52 rounded-xl object-contain mx-auto"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-500 text-xs font-medium">
                Generating QR code...
              </div>
            )}
          </div>
          <p className="text-xs text-slate-300 mt-3 font-medium flex items-center justify-center gap-1.5">
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>Scan with phone camera (Samsung, iPhone, Android)</span>
          </p>
        </div>

        {/* Direct Link Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-emerald-400 text-xs">
            <span className="truncate flex-1 text-left select-all">{currentLiveUrl}</span>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shrink-0 flex items-center gap-1 active:scale-95 text-xs"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>

          {'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>Share Link with Family</span>
            </button>
          )}
        </div>

        {/* Simple Steps */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <strong className="text-slate-200 block">How to join on another phone:</strong>
          <p>1. Open camera on the second phone and point at this QR code.</p>
          <p>2. Tap the link to open the app. The invite code <strong className="text-emerald-400">{activeCode}</strong> is automatically filled.</p>
          <p>3. Sign in or enter your name to connect instantly.</p>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};
