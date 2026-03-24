import React from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, CircleDollarSign, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const monthlyData = [
  { month: 'Jan', demandes: 18, accords: 11 },
  { month: 'Fév', demandes: 22, accords: 14 },
  { month: 'Mar', demandes: 28, accords: 19 },
  { month: 'Avr', demandes: 25, accords: 17 },
  { month: 'Mai', demandes: 30, accords: 23 },
  { month: 'Juin', demandes: 34, accords: 26 },
];

const weeklyFlow = [
  { day: 'L', volume: 9 },
  { day: 'M', volume: 13 },
  { day: 'M', volume: 8 },
  { day: 'J', volume: 16 },
  { day: 'V', volume: 12 },
];

const pieData = [
  { name: 'Immo', value: 42, color: '#1b0d5b' },
  { name: 'Conso', value: 33, color: '#23b7e5' },
  { name: 'Auto', value: 25, color: '#7c3aed' },
];

const transfers = [
  { label: 'Dossier validé', source: 'Client Martin', trend: 'up' },
  { label: 'Document manquant', source: 'Client Bernard', trend: 'down' },
  { label: 'Relance envoyée', source: 'Client Duval', trend: 'up' },
  { label: 'Signature reçue', source: 'Client Moreau', trend: 'up' },
];

const cards = [
  { title: 'Dossiers ouverts', value: '3 450', delta: '+25%', positive: true, icon: '📁' },
  { title: 'Volume financé', value: '35 256 000 €', delta: '+15%', positive: true, icon: '💶' },
  { title: 'Ticket moyen', value: '35 256 €', delta: '-5%', positive: false, icon: '📈' },
  { title: 'Opérations mois', value: '15 893', delta: '+9%', positive: true, icon: '🏦' },
];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="detail-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Espace Conseiller</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Vue globale de votre activité commerciale (données de démonstration)</p>
        </div>
        <button
          onClick={() => navigate('/new-request')}
          className="text-white rounded-xl flex items-center gap-3 font-bold text-lg hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #ee7728 0%, #f19250 100%)', padding: '15px 36px' }}
        >
          <Plus size={16} />
          Nouveau dossier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">{card.title}</p>
                <p className="text-xl font-bold text-[#1b0d5b] mt-0.5">{card.value}</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-base">
                {card.icon}
              </div>
            </div>
            <p className={`mt-2 text-xs font-semibold ${card.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {card.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 text-sm">Vue marché crédits</h2>
            <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">6 derniers mois</span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="demandes" fill="#1fa3b3" radius={[8, 8, 0, 0]} />
                <Bar dataKey="accords" fill="#102330" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm" style={{ padding: '12px' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Activité du jour</h2>
            <CalendarDays size={14} className="text-slate-400" />
          </div>
          <div className="flex flex-col" style={{ marginTop: '8px', gap: '5px' }}>
            {transfers.map((entry) => (
              <div key={entry.label + entry.source} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '6px 7px' }}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${entry.trend === 'up' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {entry.trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{entry.label}</p>
                  <p className="text-xs text-slate-500">{entry.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-900 text-sm">Répartition portefeuille</h2>
            <CircleDollarSign size={14} className="text-slate-400" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                  {pieData.map((segment) => (
                    <Cell key={segment.name} fill={segment.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 text-xs mt-1">
            {pieData.map((segment) => (
              <div key={segment.name} className="flex items-center gap-1 text-slate-600">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
                {segment.name}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 text-sm">Flux hebdomadaire</h2>
            <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">Semaine en cours</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyFlow}>
                <defs>
                  <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1fa3b3" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1fa3b3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#102330" fill="url(#flowGradient)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
