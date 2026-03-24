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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-8">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-20">
        {/* Left: Branding */}
        <div className="hidden lg:flex flex-col justify-center" style={{ gap: '56px' }}>
          <div className="flex flex-col" style={{ gap: '7px' }}>
            <h1 className="text-4xl font-bold leading-tight text-slate-900">
              Credit Management <span style={{ color: '#ee7728' }}>Platform</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed">
              Modern credit underwriting and loan processing for the digital age.
            </p>
          </div>

          <div className="flex flex-col" style={{ gap: '40px' }}>
            {[
              { icon: '📊', title: 'Real-time Analytics', desc: 'Track submissions and metrics in real-time' },
              { icon: '🔒', title: 'Enterprise Security', desc: 'Bank-grade encryption and compliance' },
              { icon: '⚡', title: 'Fast Processing', desc: 'Streamlined workflow from application to approval' },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{feature.title}</h3>
                  <p className="text-slate-500 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white rounded-3xl animate-slide-in-up flex flex-col" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)', padding: '56px', gap: '48px' }}>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Connexion</h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start space-x-3 animate-fade-in">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex flex-col" style={{ gap: '24px' }}>
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-sm flex items-start gap-3">
                <ShieldCheck size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p>
                  Tu vas être redirigé vers UiPath Identity pour te connecter, puis revenir automatiquement sur le portail.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOAuthSignIn}
                disabled={isLoading}
                className="w-full text-white font-semibold rounded-xl hover:shadow-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 group text-base"
                style={{ background: 'linear-gradient(135deg, #ee7728 0%, #f19250 100%)', padding: '21px 24px' }}
              >
                <span>{isLoading ? 'Redirection OAuth...' : 'Se connecter avec UiPath OAuth'}</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="text-center text-xs text-slate-400 border-t border-slate-100" style={{ paddingTop: '32px' }}>
              <p>Accès sécurisé via OAuth2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
