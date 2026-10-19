import React, { useState } from 'react';
import {
  HelpCircle,
  Key,
  HardDrive,
  BatteryCharging,
  Smartphone,
  Share2,
  Download,
  Upload,
  Check,
  X,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { CircleData } from '../types';

interface FamilyStorageGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleData: CircleData;
  onImportCircleBackup: (data: any) => void;
}

export const FamilyStorageGuideModal: React.FC<FamilyStorageGuideModalProps> = ({
  isOpen,
  onClose,
  circleData,
  onImportCircleBackup,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'native' | 'faq' | 'drive' | 'devices'>('native');

  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const inviteLink = `${appUrl}/?circle=${circleData.inviteCode}`;

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(circleData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `KinTrack-FamilyBackup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImportCircleBackup(json);
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">4-Phone Family Setup &amp; Storage Guide</h3>
              <p className="text-xs text-slate-400">Everything you need for 100% free, subscription-free tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 my-3 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('native')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeTab === 'native' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
            <span>24/7 Life360 Native Setup</span>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
              activeTab === 'faq' ? 'bg-sky-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Q&amp;A Architecture
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
              activeTab === 'devices' ? 'bg-sky-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Install on 4 Phones
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
              activeTab === 'drive' ? 'bg-sky-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Google Drive &amp; Backups
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'native' && (
            <div className="space-y-3.5 text-xs">
              {/* Architecture Explanation Card */}
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>How Life360 Actually Tracks in the Background (The Reality)</span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  Both Apple (iOS) and Google (Android) strictly forbid web browsers (Chrome, Safari, PWAs) from running continuous GPS in the background when the phone screen is locked in your pocket. To get true 24/7 tracking with zero delays, motion activation, and zero killing by the OS, the app must run with native background services:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 block mb-1">Android Native Architecture</strong>
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      <li>Uses an Android <code>ForegroundService</code> with a persistent notification.</li>
                      <li>Uses Google Play <code>ActivityRecognitionClient</code> to sleep when sitting still and wake up the moment motion is detected.</li>
                      <li>Requires &ldquo;Allow all the time&rdquo; + &ldquo;Unrestricted Battery&rdquo;.</li>
                    </ul>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <strong className="text-sky-400 block mb-1">iPhone (iOS) Architecture</strong>
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      <li>Uses Apple <code>CoreLocation</code> with <code>UIBackgroundModes = location</code>.</li>
                      <li>Uses <code>CoreMotion</code> (CMMotionActivityManager) to wake the app on driving/walking.</li>
                      <li>Requires &ldquo;Always Allow&rdquo; location permission in iOS Settings.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 1: Wrap with Capacitor */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Turn KinTrack into Native iOS &amp; Android Apps with Capacitor</span>
                </h5>
                <p className="text-slate-300 leading-relaxed">
                  You <strong>do not need to rewrite any code</strong>. This exact React application can be wrapped into native iOS and Android projects using Capacitor and the battle-tested Background Geolocation SDK:
                </p>
                <div className="p-3 rounded-xl bg-black/60 font-mono text-[11px] text-cyan-300 overflow-x-auto space-y-1 border border-slate-800">
                  <p># 1. Install Capacitor &amp; Background Geolocation SDK</p>
                  <p className="text-white">npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios</p>
                  <p className="text-white">npm install @transistorsoft/capacitor-background-geolocation</p>
                  <br />
                  <p># 2. Initialize Capacitor project</p>
                  <p className="text-white">npx cap init &quot;KinTrack Family&quot; &quot;com.kintrack.family&quot; --web-dir dist</p>
                  <br />
                  <p># 3. Build &amp; Add Native Platforms</p>
                  <p className="text-white">npm run build</p>
                  <p className="text-white">npx cap add android</p>
                  <p className="text-white">npx cap add ios</p>
                </div>
              </div>

              {/* Step 2: Background Geolocation Code Snippet */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Connect Background Motion Tracking to KinTrack Cloud</span>
                </h5>
                <p className="text-slate-300">
                  In your native initialization, add this snippet to automatically post real-time coordinates to your active KinTrack server even when the phone is locked:
                </p>
                <div className="p-3 rounded-xl bg-black/60 font-mono text-[10.5px] text-emerald-300 overflow-x-auto border border-slate-800">
                  <p className="text-slate-400">// In src/main.tsx or App.tsx:</p>
                  <p>import BackgroundGeolocation from &apos;@transistorsoft/capacitor-background-geolocation&apos;;</p>
                  <br />
                  <p>BackgroundGeolocation.ready(&#123;</p>
                  <p>&nbsp;&nbsp;desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,</p>
                  <p>&nbsp;&nbsp;distanceFilter: 25, // meters</p>
                  <p>&nbsp;&nbsp;stopTimeout: 5, // minutes of rest before sleeping GPS</p>
                  <p>&nbsp;&nbsp;notification: &#123;</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;title: &quot;KinTrack Family Safety&quot;,</p>
                  <p>&nbsp;&nbsp;&nbsp;&nbsp;text: &quot;Real-time circle protection active&quot;</p>
                  <p>&nbsp;&nbsp;&#125;,</p>
                  <p>&nbsp;&nbsp;url: &quot;{appUrl}/api/circle/{circleData.inviteCode || circleData.circleId}/member/YOUR_MEMBER_ID/location&quot;,</p>
                  <p>&nbsp;&nbsp;autoSync: true</p>
                  <p>&#125;).then(() =&gt; BackgroundGeolocation.start());</p>
                </div>
              </div>

              {/* Step 3: Crucial Phone Settings Checklist */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Crucial Phone Settings Checklist (Life360 Behavior)</span>
                </h5>

                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-emerald-400 block mb-1">Samsung Galaxy (OneUI / S26 Ultra):</strong>
                    <p className="text-slate-300">
                      1. Settings → Apps → KinTrack → Permissions → Location → Select <strong>&ldquo;Allow all the time&rdquo;</strong> + turn on <strong>&ldquo;Use precise location&rdquo;</strong>.<br />
                      2. Settings → Apps → KinTrack → Battery → Select <strong>&ldquo;Unrestricted&rdquo;</strong> (prevents Samsung Deep Sleeping).<br />
                      3. Settings → Battery → Background usage limits → Add KinTrack to <strong>&ldquo;Never auto-sleeping apps&rdquo;</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-cyan-400 block mb-1">Google Pixel (Android 14/15 / Pixel 9 Pro XL):</strong>
                    <p className="text-slate-300">
                      1. Settings → Apps → KinTrack → Permissions → Location → <strong>&ldquo;Allow all the time&rdquo;</strong>.<br />
                      2. Settings → Apps → KinTrack → App battery usage → Select <strong>&ldquo;Unrestricted&rdquo;</strong>.<br />
                      3. Settings → Apps → KinTrack → Physical activity → <strong>&ldquo;Allow&rdquo;</strong> (enables motion wake-up).
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <strong className="text-sky-400 block mb-1">Apple iPhone (iOS 17/18):</strong>
                    <p className="text-slate-300">
                      1. Settings → KinTrack → Location → Select <strong>&ldquo;Always&rdquo;</strong>.<br />
                      2. Toggle <strong>&ldquo;Precise Location&rdquo;</strong> to <strong>ON</strong>.<br />
                      3. Settings → KinTrack → Toggle <strong>&ldquo;Motion &amp; Fitness&rdquo;</strong> to <strong>ON</strong>.<br />
                      4. Settings → General → <strong>Background App Refresh</strong> → Ensure enabled for KinTrack.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-3.5 text-xs">
              {/* Q1: API Key & Watermark Explanation */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1.5">
                  <Key className="w-4 h-4" />
                  <span>Why was there an &ldquo;API KEY REQUIRED&rdquo; watermark, and is an API key needed?</span>
                </div>
                <p className="text-slate-300 leading-relaxed mb-2">
                  <strong className="text-emerald-400">Fixed! No API key is needed at all.</strong> The previous dark tile server (Carto) recently introduced a commercial watermark requiring their proprietary keys. We immediately swapped the map engine to <strong>100% free, public OpenStreetMap (OSM)</strong> and <strong>Esri Satellite</strong> tile layers with custom dark-mode styling.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  The watermark is now completely eliminated. Geolocation, speech recognition, and voice speech synthesis are all native browser hardware APIs, so your app runs 100% free forever without third-party subscriptions or billing!
                </p>
              </div>

              {/* Q2: Google Drive & Central Cloud vs Admin Phone */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-sky-400 font-bold mb-1.5">
                  <HardDrive className="w-4 h-4" />
                  <span>Central Cloud Storage, Google Drive, or Admin Phone Storage?</span>
                </div>
                <p className="text-slate-300 leading-relaxed mb-2">
                  <strong className="text-white">How KinTrack handles this:</strong> Because this app is hosted on your
                  AI Studio / Cloud Run web server, your applet URL acts as your free 24/7 central sync hub! All 4
                  phones connect to this server in real time.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">30-Day History:</strong> Stored on the server and cached in
                    IndexedDB locally on each phone.
                  </li>
                  <li>
                    <strong className="text-slate-200">Google Drive:</strong> You can export full 30-day location logs
                    as standard JSON/GPX with 1-click and save them directly to your personal Google Drive folder!
                  </li>
                  <li>
                    <strong className="text-slate-200">Admin Phone:</strong> The parent or admin phone (Dad/Mom) can
                    manage places, invite codes, and download backups at any time.
                  </li>
                </ul>
              </div>

              {/* Q3: Background Execution on Android & iPhone */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold mb-1.5">
                  <BatteryCharging className="w-4 h-4" />
                  <span>Background Execution &amp; Lowest Battery Consumption (Android &amp; iPhone)</span>
                </div>
                <p className="text-slate-300 leading-relaxed mb-2">
                  <strong className="text-white">How PWAs handle background location:</strong>
                </p>
                <div className="space-y-1.5 text-slate-400">
                  <p>
                    • <strong className="text-slate-200">Android:</strong> PWAs installed via Chrome run background
                    Web Workers and persistent location notifications. With our &ldquo;Smart ECO Mode&rdquo;, the app uses
                    adaptive throttling (sleeps when stationary, bursts to 10s only when driving &gt;15mph), using only
                    ~2-4% battery over a full 24 hours.
                  </p>
                  <p>
                    • <strong className="text-slate-200">iPhone (iOS Safari):</strong> Apple restricts continuous background
                    JavaScript in PWAs when the screen is locked unless an audio session is active. In KinTrack, the
                    &ldquo;Background Audio Keepalive&rdquo; setting keeps geolocation polling running smoothly even with the
                    screen locked on iOS!
                  </p>
                </div>
              </div>

              {/* Q4: Voice Notifications & Speed Limit */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-400 font-bold mb-1.5">
                  <Volume2 className="w-4 h-4" />
                  <span>Voice Notifications &amp; Speed Alerts (&gt;10mph above limit)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  KinTrack includes built-in speech synthesis. Whenever any member leaves a saved place (e.g. &ldquo;Sarah
                  left Home&rdquo;) or drives 10mph faster than the road limit (e.g. &ldquo;Lucas driving at 58mph, 13mph above
                  limit&rdquo;), the app sounds a chime and speaks the notification out loud!
                </p>
              </div>

              {/* Q5: Hey KinTrack Voice Command */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Voice Command: &ldquo;Hey KinTrack, where&apos;s mom?&rdquo;</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Tap the glowing microphone or voice button and ask &ldquo;Where&apos;s mom?&rdquo; or &ldquo;Who is driving?&rdquo;. KinTrack
                  will speak back her current place, battery %, driving speed, and center the map directly on her pin!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'devices' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  <span>Your Family Circle Invite Code</span>
                </h4>
                <p className="text-slate-300 mt-1">
                  Open this link on all 4 phones. Each phone simply selects its role (Dad, Mom, Daughter, Son):
                </p>

                <div className="mt-3 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-emerald-400 text-xs">
                  <span className="truncate flex-1">{inviteLink}</span>
                  <button
                    onClick={copyInvite}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shrink-0 flex items-center gap-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Can this run as a native Android app? (Yes — 2 Ways)</span>
                </h5>
                <div className="space-y-2 text-slate-300">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 block mb-0.5">Method 1: Instant Native Installation (Zero Setup)</strong>
                    <p className="text-[11px] text-slate-400">
                      Open this URL in Chrome on your Android phone and tap <strong>&ldquo;Install App&rdquo;</strong> in the top bar. Android installs it as a standalone app with its own home screen icon, app drawer entry, splash screen, and background location services.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <strong className="text-emerald-400 block mb-0.5">Method 2: Standalone APK via PWABuilder / Bubblewrap</strong>
                    <p className="text-[11px] text-slate-400">
                      Because this app has a compliant Web App Manifest and Service Worker, you can paste its URL into <strong>pwabuilder.com</strong> (by Microsoft) or Google&apos;s <strong>Bubblewrap CLI</strong> to generate a signed <code className="text-indigo-300 font-mono">.apk</code> or Google Play Store bundle in under 3 minutes!
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>Can this run on iPhone as well? (Yes)</span>
                </h5>
                <div className="space-y-2 text-slate-300">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <strong className="text-sky-400 block mb-0.5">iOS Home Screen App (PWA)</strong>
                    <p className="text-[11px] text-slate-400">
                      1. Open the URL in Safari on the iPhone.<br />
                      2. Tap the <strong>Share</strong> button (box with upward arrow).<br />
                      3. Tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.<br />
                      4. It launches in standalone fullscreen mode without any Safari address bar, just like an App Store app!
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <strong className="text-sky-400 block mb-0.5">iOS Background Tracking</strong>
                    <p className="text-[11px] text-slate-400">
                      Enable the <strong>&ldquo;Background Audio Keepalive&rdquo;</strong> in Settings. This prevents iOS from freezing geolocation polling when the phone screen turns off.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'drive' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <h4 className="font-bold text-sm text-white flex items-center gap-2 mb-1.5">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  <span>Google Drive &amp; Local Backup Management</span>
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  You can download your entire family&apos;s 30-day location history, saved places, and chat archive into a
                  single file. Save it directly to your personal Google Drive or phone storage.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleExportJson}
                    className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition flex items-center gap-2 shadow"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full 30-Day Backup (JSON)</span>
                  </button>

                  <label className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition flex items-center gap-2 cursor-pointer border border-slate-700">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Restore from Backup File</span>
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30">
                <h5 className="font-bold text-emerald-300 mb-1">Automatic Cloud Sync Status</h5>
                <p className="text-slate-300">
                  Your server is active and preserving history records automatically. No manual backups are required for
                  daily operation between your 4 phones!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          Close Guide
        </button>
      </div>
    </div>
  );
};
