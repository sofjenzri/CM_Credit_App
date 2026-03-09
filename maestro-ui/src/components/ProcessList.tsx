import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MaestroProcesses } from '@uipath/uipath-typescript/maestro-processes';

interface Process {
  id: string;
  name: string;
  description?: string;
}

export default function ProcessList() {
  const { sdk } = useAuth();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sdk) {
      loadProcesses();
    }
  }, [sdk]);

  const loadProcesses = async () => {
    try {
      setLoading(true);
      const maestroProcesses = new MaestroProcesses(sdk!);
      const data = await maestroProcesses.getAll();
      setProcesses(data as any[]);
    } catch (error) {
      console.error('Failed to load processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcess = async (processId: string) => {
    try {
      // Logique pour démarrer un processus
      console.log('Starting process:', processId);
      alert('Fonctionnalité à implémenter');
    } catch (error) {
      console.error('Failed to start process:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Processus Maestro</h2>
        <button
          onClick={loadProcesses}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
        >
          Actualiser
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  Aucun processus trouvé
                </td>
              </tr>
            ) : (
              processes.map((process) => (
                <tr key={process.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {process.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {process.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleStartProcess(process.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Démarrer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
