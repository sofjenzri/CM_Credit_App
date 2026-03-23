import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MaestroProcesses } from '@uipath/uipath-typescript/maestro-processes';

interface ProcessStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

export default function Dashboard() {
  const { sdk } = useAuth();
  const [stats, setStats] = useState<ProcessStats>({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sdk) {
      loadStats();
    }
  }, [sdk]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const maestroProcesses = new MaestroProcesses(sdk!);
      const processes = await maestroProcesses.getAll();
      
      setStats({
        total: processes.length,
        running: 0, // À calculer selon vos besoins
        completed: 0,
        failed: 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Processus totaux"
          value={stats.total}
          color="blue"
        />
        <StatCard
          title="En cours"
          value={stats.running}
          color="yellow"
        />
        <StatCard
          title="Terminés"
          value={stats.completed}
          color="green"
        />
        <StatCard
          title="Échoués"
          value={stats.failed}
          color="red"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  color: 'blue' | 'yellow' | 'green' | 'red';
}

function StatCard({ title, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-75 mb-2">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
