
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

export const Auth = ({ onLogin }: { onLogin: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Removing explicit options to let Supabase use the Dashboard defaults.
      // This fixes the 403 "redirect_uri_mismatch" error in most cases.
    });
    if (error) {
        alert(error.message);
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#131314] z-[100]">
       <div className="w-full max-w-md p-8 bg-[#1e1f20] border border-[#444746] rounded-3xl shadow-2xl">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
             </div>
          </div>
          <h1 className="text-3xl font-bold text-white text-center mb-2">NeuroNote AI</h1>
          <p className="text-gray-400 text-center mb-8">Sign in to sync your notes across devices</p>

          {sent ? (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-4 rounded-xl text-center">
              <p className="font-bold mb-2">Check your email!</p>
              <p className="text-sm">We've sent a magic link to <br/><span className="text-white">{email}</span></p>
              <button 
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#444746]"></div>
                <span className="flex-shrink mx-4 text-gray-500 text-xs">OR</span>
                <div className="flex-grow border-t border-[#444746]"></div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <input
                    className="w-full bg-[#131314] border border-[#444746] rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  className="w-full bg-transparent border border-[#444746] text-white font-bold py-3 rounded-xl hover:bg-white/5 transition-all transform active:scale-95 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Sign in with Magic Link'}
                </button>
              </form>
              
              <button 
                onClick={onLogin}
                className="w-full py-2 text-sm text-gray-500 hover:text-white transition-colors"
              >
                Continue as Guest (No Sync)
              </button>
            </div>
          )}
          <div className="mt-8 pt-6 border-t border-[#444746] text-center">
               <p className="text-xs text-gray-500">Powered by Gemini & Supabase</p>
          </div>
       </div>
    </div>
  );
};
