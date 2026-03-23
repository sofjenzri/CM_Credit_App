import { useAuth } from '../hooks/useAuth';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    try {
      console.log('Login button clicked');
      await login();
    } catch (error) {
      console.error('Login error:', error);
      alert('Échec de la connexion. Vérifiez votre configuration OAuth.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, rgb(239, 246, 255), rgb(224, 231, 255))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        padding: '2rem',
        maxWidth: '28rem',
        width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '0.5rem',
          }}>
            Maestro Process Manager
          </h1>
          <p style={{ color: '#4b5563' }}>
            Connectez-vous avec votre compte UiPath
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            background: '#2563eb',
            color: 'white',
            fontWeight: '600',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
            fontSize: '1rem',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = '#1d4ed8')}
          onMouseLeave={(e) => !isLoading && (e.currentTarget.style.background = '#2563eb')}
        >
          {isLoading ? 'Connexion...' : 'Se connecter avec UiPath'}
        </button>

        <div style={{
          marginTop: '1.5rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          textAlign: 'center',
        }}>
          <p>Assurez-vous d'avoir configuré votre application OAuth dans UiPath Admin Center</p>
        </div>
      </div>
    </div>
  );
}
