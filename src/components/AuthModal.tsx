import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, Mail, Sparkles, CheckCircle2, LogOut, X, Crown, Loader2 } from 'lucide-react';
import { auth, googleProvider } from '../utils/firebaseConfig';
import { signInWithPopup } from 'firebase/auth';

export interface UserProfile {
  name: string;
  email: string;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  avatar?: string;
  uid?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogin,
  onLogout,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setStatusMsg('Please enter a valid email address.');
      return;
    }

    const newUser: UserProfile = {
      name: name || email.split('@')[0] || 'CuteCut Creator',
      email: email,
      tier: 'PRO',
      uid: `local-${Date.now()}`
    };

    onLogin(newUser);
    setStatusMsg('');
    onClose();
  };

  const handleGoogleSignInModal = async () => {
    try {
      setIsGoogleLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const u = res.user;
        const profile: UserProfile = {
          name: u.displayName || u.email?.split('@')[0] || 'CuteCut Creator',
          email: u.email || '',
          tier: 'PRO',
          avatar: u.photoURL || undefined,
          uid: u.uid,
        };
        onLogin(profile);
        onClose();
      }
    } catch (err: any) {
      console.warn('[Firebase Google Sign-In Error]', err);
      setStatusMsg('Google sign-in was canceled or failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDemoProLogin = () => {
    const demoUser: UserProfile = {
      name: 'Guldasta Islam (Pro Creator)',
      email: 'guldasta.pro@cutecut.io',
      tier: 'ENTERPRISE',
      uid: 'demo-pro-user'
    };
    onLogin(demoUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#14141a] border border-[#2e2e3a] rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a36] bg-[#181822]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {user ? 'Account Identity & Tier' : isSignUp ? 'Create CuteCut Account' : 'Creator Sign In'}
              </h2>
              <p className="text-[11px] text-gray-400">
                {user ? 'CUTECUT PRO Engine Identity' : 'Unlock 4K WASM Rendering & AI Sync'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252532] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {user ? (
            /* Logged in state view */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-teal-950/40 to-slate-900 border border-cyan-500/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-400 to-teal-400 flex items-center justify-center font-black text-black text-lg shadow-lg">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{user.name}</h3>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-400 text-black font-mono">
                      {user.tier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-300">Included License Features:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-cyan-300 p-2 rounded-lg bg-[#1a1a24] border border-cyan-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Microsecond AI Voice Sync</span>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300 p-2 rounded-lg bg-[#1a1a24] border border-cyan-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>4K 60fps WASM Export</span>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300 p-2 rounded-lg bg-[#1a1a24] border border-cyan-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Waveform Graph Engine</span>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300 p-2 rounded-lg bg-[#1a1a24] border border-cyan-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Unlimited Local Projects</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Account</span>
              </button>
            </div>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {statusMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium">
                  {statusMsg}
                </div>
              )}

              {isSignUp && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Guldasta Creator"
                      className="w-full bg-[#1c1c26] border border-[#2d2d3c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="creator@cutecut.io"
                    className="w-full bg-[#1c1c26] border border-[#2d2d3c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#1c1c26] border border-[#2d2d3c] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 font-bold text-xs text-black shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                {isSignUp ? 'Create PRO Account' : 'Sign In to Workspace'}
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-[#2a2a36] w-full" />
                <span className="bg-[#14141a] px-3 text-[10px] text-gray-500 font-mono uppercase">OR</span>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignInModal}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 disabled:opacity-75 text-gray-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow-md transition cursor-pointer"
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{isGoogleLoading ? 'Connecting Google Account...' : 'Sign in with Google'}</span>
                <span className="ml-auto bg-cyan-100 text-cyan-800 font-mono text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase">
                  Cloud Firestore
                </span>
              </button>

              <button
                type="button"
                onClick={handleDemoProLogin}
                className="w-full py-2.5 rounded-xl bg-[#1d1d28] hover:bg-[#252536] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Quick Sign In as PRO Member</span>
              </button>

              <p className="text-center text-[11px] text-gray-400 pt-2">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-cyan-400 font-bold underline hover:text-cyan-300"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up Free'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
