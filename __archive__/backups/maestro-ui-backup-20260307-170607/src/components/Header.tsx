import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const { logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              UiPath Maestro Process Manager
            </h1>
          </div>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
