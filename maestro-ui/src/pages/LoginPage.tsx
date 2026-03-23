import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { isAuthenticated, startOAuthLogin } from '../services/oauth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleOAuthSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      await startOAuthLogin();
    } catch {
      setError('Impossible de démarrer la connexion OAuth UiPath.');
      setIsLoading(false);
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:gap-16">
        {/* Left: Branding */}
        <div className="hidden lg:flex flex-col justify-center space-y-12 text-white">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 bg-gradient-brand rounded-2xl flex items-center justify-center font-bold text-2xl text-white">
                  CM
                </div>
              </div>
              <h1 className="text-5xl font-bold leading-tight">
                Credit Management <span className="text-brand-500">Platform</span>
              </h1>
            </div>
            <p className="text-xl text-slate-300 leading-relaxed">
              Modern credit underwriting and loan processing for the digital age.
            </p>
          </div>

          <div className="space-y-6">
            {[
              { icon: '📊', title: 'Real-time Analytics', desc: 'Track submissions and metrics in real-time' },
              { icon: '🔒', title: 'Enterprise Security', desc: 'Bank-grade encryption and compliance' },
              { icon: '⚡', title: 'Fast Processing', desc: 'Streamlined workflow from application to approval' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start space-x-4">
                <div className="text-3xl mt-1">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8 animate-slide-in-up">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-slate-900">Connexion</h2>
              <p className="text-slate-600">Authentification sécurisée OAuth UiPath (PKCE)</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-800 text-sm flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5" />
                <p>
                  Tu vas être redirigé vers UiPath Identity pour te connecter, puis revenir automatiquement sur le portail.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOAuthSignIn}
                disabled={isLoading}
                className="w-full bg-gradient-brand text-white font-semibold py-3 rounded-lg hover:shadow-lg transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 group"
              >
                <span>{isLoading ? 'Redirection OAuth...' : 'Se connecter avec UiPath OAuth'}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="text-center text-sm text-slate-600 border-t border-slate-200 pt-6">
              <p>Accès sécurisé via OAuth2 + PKCE</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
