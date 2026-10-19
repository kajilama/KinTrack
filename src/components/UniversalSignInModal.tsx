import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Compass,
  CheckCircle2,
  Plus,
  ArrowRight,
  Phone,
  Mail,
  UserCheck,
  X,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Edit2,
  LogIn,
} from 'lucide-react';
import { FamilyRole } from '../types';
import { requestLocationPermission } from '../utils/nativeLocation';

interface UniversalSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleName: string;
  inviteCode: string;
  currentMemberName?: string;
  currentRole?: string;
  onJoinCircle: (code: string, role: string, userName?: string, phone?: string) => void;
  onCreateCircle: (name: string, adminName?: string, phone?: string) => void;
  onUpdateProfileName?: (name: string, role: string, phone?: string) => void;
}

export const UniversalSignInModal: React.FC<UniversalSignInModalProps> = ({
  isOpen,
  onClose,
  circleName,
  inviteCode,
  currentMemberName = '',
  currentRole = 'Admin',
  onJoinCircle,
  onCreateCircle,
  onUpdateProfileName,
}) => {
  const { user, signInWithGoogle, logout } = useAuth();

  // Step 1 = Enter Name & Sign In / Confirm Profile; Step 2 = Join or Create Circle
  const [step, setStep] = useState<'profile' | 'circle_choice'>('profile');

  // Profile Identity states
  const [profileName, setProfileName] = useState(() => {
    return (
      localStorage.getItem('orbit_active_member_name') ||
      currentMemberName ||
      user?.displayName ||
      ''
    );
  });
  const [profileRole, setProfileRole] = useState<FamilyRole>(
    (currentRole as FamilyRole) || 'Admin'
  );
  const [profilePhone, setProfilePhone] = useState(
    localStorage.getItem('orbit_active_member_phone') || ''
  );
  const [profileEmail, setProfileEmail] = useState(
    localStorage.getItem('orbit_active_member_email') || user?.email || ''
  );

  // Circle action states
  const [circleAction, setCircleAction] = useState<'join' | 'create'>('join');
  const [inputCode, setInputCode] = useState(inviteCode || 'ORBIT-FAMILY');
  const [newCircleName, setNewCircleName] = useState('');
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);

  useEffect(() => {
    if (user && user.displayName) {
      setProfileName(user.displayName);
      if (user.email) setProfileEmail(user.email);
    }
  }, [user]);

  if (!isOpen) return null;

  // Step 1: Confirm Profile Identity (via Manual Name, Phone, Email, or Google)
  const handleConfirmProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = profileName.trim() || user?.displayName || 'Family Member';
    setProfileName(finalName);
    localStorage.setItem('orbit_active_member_name', finalName);
    if (profilePhone.trim()) localStorage.setItem('orbit_active_member_phone', profilePhone.trim());
    if (profileEmail.trim()) localStorage.setItem('orbit_active_member_email', profileEmail.trim());

    if (onUpdateProfileName) {
      onUpdateProfileName(finalName, profileRole, profilePhone.trim() || undefined);
    }

    // Proactively request location permission so GPS dialog pops up for user
    requestLocationPermission().catch(() => {});

    setStep('circle_choice');
  };

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        const gName = signedInUser.displayName || signedInUser.email?.split('@')[0] || 'User';
        setProfileName(gName);
        localStorage.setItem('orbit_active_member_name', gName);
        if (signedInUser.email) {
          setProfileEmail(signedInUser.email);
          localStorage.setItem('orbit_active_member_email', signedInUser.email);
        }
        if (onUpdateProfileName) {
          onUpdateProfileName(gName, profileRole, profilePhone.trim() || undefined);
        }
        requestLocationPermission().catch(() => {});
        setStep('circle_choice');
      }
    } catch (err) {
      console.warn('Google sign-in error:', err);
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  // Step 2: Join Existing Circle
  const handleJoinCircleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = (inputCode || inviteCode || 'ORBIT-FAMILY').trim().toUpperCase();
    const finalName = profileName.trim() || 'Family Member';
    localStorage.setItem('orbit_onboarding_completed', 'true');
    localStorage.setItem('orbit_active_member_name', finalName);
    localStorage.setItem('orbit_active_member_role', profileRole);

    requestLocationPermission().catch(() => {});
    onJoinCircle(code, profileRole, finalName, profilePhone.trim() || undefined);
    onClose();
  };

  // Step 2: Create New Circle
  const handleCreateCircleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCircleName = newCircleName.trim() || 'Our Family Circle';
    const finalName = profileName.trim() || 'Family Admin';
    localStorage.setItem('orbit_onboarding_completed', 'true');
    localStorage.setItem('orbit_active_member_name', finalName);
    localStorage.setItem('orbit_active_member_role', 'Admin');

    requestLocationPermission().catch(() => {});
    onCreateCircle(finalCircleName, finalName, profilePhone.trim() || undefined);
    onClose();
  };

  const handleSkipToCircle = () => {
    localStorage.setItem('orbit_onboarding_completed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 flex flex-col relative max-h-[92vh] overflow-y-auto">
        {/* Close / Skip Button */}
        <button
          onClick={handleSkipToCircle}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Close / Continue"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Banner */}
        <div className="flex flex-col items-center text-center mt-1 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-2">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-black text-white">KinTrack Family</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {step === 'profile'
              ? 'Sign in & set your profile name'
              : `Connected as ${profileName || 'Family Member'}`}
          </p>
        </div>

        {/* STEP 1: Profile & Identity */}
        {step === 'profile' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Your Profile Name &amp; Identity</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                  Required
                </span>
              </div>

              <form onSubmit={handleConfirmProfile} className="space-y-3">
                {/* Profile Name Input */}
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold text-xs">
                    Your Profile Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g., Mom, Dad, Alex, or Lucas"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-indigo-500 text-sm"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This name will appear on the top bar, map location pins, and circle chat.
                  </p>
                </div>

                {/* Role & Cellular Phone */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold text-xs">
                      Family Role
                    </label>
                    <select
                      value={profileRole}
                      onChange={(e) => setProfileRole(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                    >
                      <option value="Dad">Dad</option>
                      <option value="Mom">Mom</option>
                      <option value="Parent">Parent</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Teen">Teen</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold text-xs">
                      Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+1 (555) 0199"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold text-xs">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>

                {/* Continue button */}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                >
                  <span>Continue with Name: {profileName.trim() || 'Family Member'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Optional 1-Click Google Account Sign-In */}
            <div className="pt-1">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  Or 1-Click with Google
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {user ? (
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    <img
                      src={
                        user.photoURL ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80'
                      }
                      alt={user.displayName || 'Google'}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-400"
                    />
                    <div className="truncate leading-tight">
                      <span className="font-bold text-white block truncate">
                        {user.displayName || user.email}
                      </span>
                      <span className="text-[10px] text-emerald-400">Google Account Connected</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const gName = user.displayName || user.email?.split('@')[0] || 'User';
                      setProfileName(gName);
                      localStorage.setItem('orbit_active_member_name', gName);
                      if (user.email) {
                        setProfileEmail(user.email);
                        localStorage.setItem('orbit_active_member_email', user.email);
                      }
                      if (onUpdateProfileName) {
                        onUpdateProfileName(gName, profileRole, profilePhone.trim() || undefined);
                      }
                      setStep('circle_choice');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow shrink-0"
                  >
                    Use Google Name
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningInGoogle}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2.5 shadow transition active:scale-95 border border-slate-700 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {isSigningInGoogle
                      ? 'Connecting to Google...'
                      : 'Sign in with Google (Uses Google Name)'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Join Circle with Invite Code or Create New Circle */}
        {step === 'circle_choice' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-3">
            {/* Active Profile Identity Bar */}
            <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                  {profileName.charAt(0).toUpperCase()}
                </div>
                <div className="truncate leading-tight">
                  <span className="font-bold text-white block truncate">{profileName}</span>
                  <span className="text-[10px] text-indigo-300">
                    Role: {profileRole} {profilePhone ? `• ${profilePhone}` : ''}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setStep('profile')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition"
                title="Change Name or Role"
              >
                <Edit2 className="w-3 h-3 text-indigo-400" />
                <span>Change Name</span>
              </button>
            </div>

            {/* Action Selector Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setCircleAction('join')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  circleAction === 'join'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Join with Invite Code</span>
              </button>
              <button
                onClick={() => setCircleAction('create')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  circleAction === 'create'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Circle</span>
              </button>
            </div>

            {/* Option A: Join with Invite Code Form */}
            {circleAction === 'join' && (
              <form
                onSubmit={handleJoinCircleSubmit}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3.5 text-xs"
              >
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold text-xs">
                    Circle Invite Code
                  </label>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="e.g. ORBIT-FAMILY"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono uppercase font-bold focus:outline-none focus:border-indigo-500 text-sm tracking-wider"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enter the code given by your family member, or default{' '}
                    <code className="text-emerald-400 font-bold">ORBIT-FAMILY</code>
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Join Circle as &quot;{profileName}&quot;</span>
                </button>
              </form>
            )}

            {/* Option B: Create New Circle Form */}
            {circleAction === 'create' && (
              <form
                onSubmit={handleCreateCircleSubmit}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3.5 text-xs"
              >
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold text-xs">
                    New Circle Name
                  </label>
                  <input
                    type="text"
                    value={newCircleName}
                    onChange={(e) => setNewCircleName(e.target.value)}
                    placeholder="e.g., Garcia Family Circle"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold focus:outline-none focus:border-indigo-500 text-sm"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    You will be the circle admin and receive a shareable invite code for other
                    phones.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Circle with Admin &quot;{profileName}&quot;</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <button
            onClick={handleSkipToCircle}
            className="text-slate-400 hover:text-white transition font-medium"
          >
            Continue as Guest
          </button>

          <span>
            Current Circle: <strong className="text-slate-200">{circleName}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
