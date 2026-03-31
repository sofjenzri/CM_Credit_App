import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock3, Filter, Search, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { casesService, type CaseListItem } from '../services/cases';
import CreditChatbot from '../components/CreditChatbot';

type GroupKey = 'running' | 'completed' | 'faulted';

const RUNNING_STATUSES = new Set(['running', 'paused', 'transitioning', 'pending', 'en cours', 'active', 'inprogress']);
const COMPLETED_STATUSES = new Set(['completed', 'cancelled', 'accepté', 'validé']);
const FAULTED_STATUSES = new Set(['faulted', 'failed', 'error', 'rejeté']);

const normalizeStatus = (value?: string) => String(value || '').toLowerCase().trim();

const groupForStatus = (status?: string): GroupKey => {
  const normalized = normalizeStatus(status);
  if (FAULTED_STATUSES.has(normalized)) return 'faulted';
  if (COMPLETED_STATUSES.has(normalized)) return 'completed';
  if (RUNNING_STATUSES.has(normalized)) return 'running';
  return 'running';
};

const formatAmount = (value?: string | number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';
  return `${new Intl.NumberFormat('fr-FR').format(numericValue)} €`;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const hasDirectTaskLink = (item: CaseListItem) => item.currentActivityType === 'AppTask' && Boolean(item.currentTaskId);

const SubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupKey>('running');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await casesService.getCases();
      setCases(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement des dossiers';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCases(false);
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    void loadCases(true);
  }, [refreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(handleRefresh, 5000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return cases.filter((item) => {
      const groupMatch = groupForStatus(item.status) === activeGroup;
      const searchMatch =
        !query ||
        String(item.caseId || '').toLowerCase().includes(query) ||
        String(item.clientName || '').toLowerCase().includes(query) ||
        String(item.id || '').toLowerCase().includes(query);
      return groupMatch && searchMatch;
    });
  }, [cases, searchQuery, activeGroup]);

  const groupCount = (group: GroupKey) => cases.filter((item) => groupForStatus(item.status) === group).length;

  const averageDays = useMemo(() => {
    const values = cases
      .map((item) => {
        if (!item.createdTime) return null;
        const diffMs = Date.now() - new Date(item.createdTime).getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return null;
        return diffMs / (1000 * 60 * 60 * 24);
      })
      .filter((value): value is number => value !== null);

    if (!values.length) return '-';
    const avg = values.reduce((total, value) => total + value, 0) / values.length;
    return `${avg.toFixed(1)} jours`;
  }, [cases]);

  const conformityRate = useMemo(() => {
    if (!cases.length) return '-';
    const healthy = cases.filter((item) => groupForStatus(item.status) !== 'faulted').length;
    return `${Math.round((healthy / cases.length) * 100)}%`;
  }, [cases]);

  const warningCount = useMemo(() => cases.filter((item) => groupForStatus(item.status) === 'faulted').length, [cases]);

  const weeklyVolumeData = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date);
      return { key, label, dossiers: 0 };
    });

    const dayIndex = new Map(days.map((day, index) => [day.key, index]));

    cases.forEach((item) => {
      if (!item.createdTime) return;
      const date = new Date(item.createdTime);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const index = dayIndex.get(key);
      if (index === undefined) return;
      days[index].dossiers += 1;
    });

    return days.map(({ label, dossiers }) => ({ label, dossiers }));
  }, [cases]);

  const statusDistributionData = useMemo(() => {
    const running = cases.filter((item) => groupForStatus(item.status) === 'running').length;
    const completed = cases.filter((item) => groupForStatus(item.status) === 'completed').length;
    const faulted = cases.filter((item) => groupForStatus(item.status) === 'faulted').length;
    return [
      { name: 'En cours', value: running, color: '#06b6d4' },
      { name: 'Achevés', value: completed, color: '#10b981' },
      { name: 'En erreur', value: faulted, color: '#f59e0b' },
    ];
  }, [cases]);

  const productDistributionData = useMemo(() => {
    const counters = new Map<string, number>();

    cases.forEach((item) => {
      const label = String(item.creditType || 'Non renseigné').trim() || 'Non renseigné';
      counters.set(label, (counters.get(label) || 0) + 1);
    });

    return [...counters.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [cases]);

  return (
    <div className="detail-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes dossiers en cours</h1>
          <p className="text-slate-500 mt-1">Dossiers réels synchronisés depuis les entités case management</p>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            className="rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center gap-2 hover:bg-slate-50"
            style={{ padding: '10px 28px' }}
            onClick={() => loadCases(true)}
            disabled={refreshing}
          >
            <Filter size={16} />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center px-3 rounded-xl bg-slate-100 border border-slate-200 max-w-md w-full" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
            <Search size={16} className="text-slate-500" />
            <input
              className="bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 w-full"
              placeholder="Rechercher un client, un dossier..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'running' as const, label: 'En cours', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
              { key: 'completed' as const, label: 'Achevés', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { key: 'faulted' as const, label: 'En erreur', className: 'bg-red-50 text-red-700 border-red-200' },
            ].map((group) => (
              <button
                key={group.key}
                onClick={() => setActiveGroup(group.key)}
                className={`rounded-lg border text-sm font-semibold transition-colors ${
                  activeGroup === group.key ? group.className : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                style={{ padding: '8px 24px' }}
              >
                {group.label} ({groupCount(group.key)})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-6 p-6 rounded-xl bg-slate-50 text-slate-600">Chargement des dossiers...</div>
        ) : error ? (
          <div className="mt-6 p-6 rounded-xl bg-red-50 border border-red-100 text-red-700">{error}</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Dossier</th>
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Client</th>
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Produit</th>
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Montant</th>
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Statut</th>
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Création</th>
                  <th className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200">
                    <td className="py-1.5 px-4 font-semibold text-[#1b0d5b] leading-tight">
                      <button
                        className="hover:underline underline-offset-2"
                        onClick={() => navigate(`/cases/${row.id}`)}
                      >
                        {row.caseId || row.id}
                      </button>
                    </td>
                    <td className="py-1.5 px-4 text-slate-700 leading-tight">{row.clientName || '-'}</td>
                    <td className="py-1.5 px-4 text-slate-700 leading-tight">{row.creditType || '-'}</td>
                    <td className="py-1.5 px-4 text-slate-900 font-semibold leading-tight">{formatAmount(row.requestedAmount)}</td>
                    <td className="py-1.5 px-4 leading-tight">
                      {hasDirectTaskLink(row) ? (
                        <button
                          className="text-sm font-normal leading-tight text-orange-600 hover:underline underline-offset-2"
                          onClick={() => navigate(`/cases/${row.id}/tasks/${row.currentTaskId}`)}
                        >
                          {row.currentActivityLabel || row.dossierStatus || row.status || '-'}
                        </button>
                      ) : (
                        <span className="text-sm font-normal leading-tight text-slate-700">
                          {row.currentActivityLabel || row.dossierStatus || row.status || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-4 text-slate-500 text-sm leading-tight">{formatDate(row.createdTime)}</td>
                    <td className="py-1.5 px-4 leading-tight">
                      <button
                        className="text-cyan-600 hover:text-cyan-500 hover:underline underline-offset-2 font-semibold text-sm leading-none"
                        onClick={() => navigate(`/cases/${row.id}`)}
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCases.length === 0 && (
              <div className="text-center text-slate-500 py-10">Aucun dossier dans cette catégorie.</div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <Clock3 size={16} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Délai moyen</p>
            <p className="font-bold text-slate-900">{averageDays}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Conformité</p>
            <p className="font-bold text-slate-900">{conformityRate}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={16} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Points d’attention</p>
            <p className="font-bold text-slate-900">{warningCount} dossiers</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Volume dossiers (7 derniers jours)</h3>
            <span className="text-xs text-slate-500">Temps réel</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(value: number) => [`${value}`, 'Dossiers']} />
                <Bar dataKey="dossiers" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Répartition des statuts</h3>
            <span className="text-xs text-slate-500">Portefeuille global</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistributionData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={74}
                  paddingAngle={3}
                >
                  {statusDistributionData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}`, 'Dossiers']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs mt-1">
            {statusDistributionData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">Top produits traités</h3>
          <span className="text-xs text-slate-500">Basé sur les dossiers chargés</span>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productDistributionData} layout="vertical" margin={{ left: 20, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#334155' }} />
              <Tooltip formatter={(value: number) => [`${value}`, 'Dossiers']} />
              <Bar dataKey="value" fill="#0284c7" radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <CreditChatbot />
    </div>
  );
};

export default SubmissionsPage;
