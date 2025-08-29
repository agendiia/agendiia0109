import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { format, startOfWeek, startOfMonth, startOfQuarter, endOfWeek, endOfMonth, endOfQuarter, isWithinInterval, parseISO, subWeeks, subMonths, subQuarters } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Target, Activity, Users, TrendingUp, DollarSign, Calendar, Clock, AlertCircle } from 'lucide-react';
import { generateBusinessInsights } from '../services/geminiService';
import LockedFeature from './LockedFeature';

interface DashboardMetrics {
  totalRevenue: number;
  totalAppointments: number;
  totalClients: number;
  averageTicket: number;
  monthlyGrowth: number;
  conversionRate: number;
}

interface ServicePerformance {
  name: string;
  appointments: number;
  revenue: number;
  averagePrice: number;
  marketShare: number;
}

interface PeakTimeData {
  hour: string;
  appointments: number;
  revenue: number;
}

interface ClientCategory {
  name: string;
  totalSpent: number;
  totalAppointments: number;
  averageTicket: number;
  category: 'VIP' | 'Frequent' | 'Occasional' | 'New';
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
  transactions: number;
}

type Period = 'week' | 'month' | 'quarter';

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export default function Reports() {
  const { user, hasAccess } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Verificação de acesso
  if (!hasAccess('reports.view')) {
    return (
      <LockedFeature 
        title="Relatórios Avançados"
        description="Acesse insights detalhados sobre seu negócio, performance de serviços e análise de clientes"
        requiredPlan="Avançado"
      />
    );
  }

  // Função para obter range de datas
  const getDateRange = (period: Period) => {
    const now = new Date();
    switch (period) {
      case 'week':
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
    }
  };

  // Carregamento de dados em tempo real
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Appointments
    unsubscribes.push(
      onSnapshot(collection(db, 'users', user.uid, 'appointments'), snapshot => {
        const fetchedAppointments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dateTime: doc.data().dateTime.toDate()
        }));
        setAppointments(fetchedAppointments);
      }, () => setIsLoading(false))
    );

    // Services
    unsubscribes.push(
      onSnapshot(collection(db, 'users', user.uid, 'services'), snapshot => {
        const fetchedServices = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setServices(fetchedServices);
      })
    );

    // Clients
    unsubscribes.push(
      onSnapshot(collection(db, 'users', user.uid, 'clients'), snapshot => {
        const fetchedClients = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        setClients(fetchedClients);
      })
    );

    // Expenses
    unsubscribes.push(
      onSnapshot(query(collection(db, 'users', user.uid, 'expenses'), orderBy('date', 'desc')), snapshot => {
        const fetchedExpenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          amount: Number(doc.data().amount) || 0
        }));
        setExpenses(fetchedExpenses);
        setIsLoading(false);
      })
    );

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [user?.uid]);

  // Cálculo das métricas principais
  const metrics = useMemo<DashboardMetrics>(() => {
    const { start, end } = getDateRange(period);
    const periodAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start, end })
    );

    const totalRevenue = periodAppointments.reduce((sum, app) => sum + (app.price || 0), 0);
    const totalAppointments = periodAppointments.length;
    const uniqueClients = new Set(periodAppointments.map(app => app.clientId)).size;
    const averageTicket = totalRevenue / (totalAppointments || 1);

    // Cálculo do crescimento mensal
    const prevPeriodStart = period === 'week' ? subWeeks(start, 1) : 
                           period === 'month' ? subMonths(start, 1) : 
                           subQuarters(start, 1);
    const prevPeriodEnd = period === 'week' ? subWeeks(end, 1) : 
                         period === 'month' ? subMonths(end, 1) : 
                         subQuarters(end, 1);
    
    const prevAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start: prevPeriodStart, end: prevPeriodEnd })
    );
    const prevRevenue = prevAppointments.reduce((sum, app) => sum + (app.price || 0), 0);
    const monthlyGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Taxa de conversão (clientes que voltaram)
    const returningClients = periodAppointments.filter(app => {
      const clientPrevAppointments = appointments.filter(a => 
        a.clientId === app.clientId && a.dateTime < app.dateTime
      );
      return clientPrevAppointments.length > 0;
    });
    const conversionRate = uniqueClients > 0 ? (returningClients.length / uniqueClients) * 100 : 0;

    return {
      totalRevenue,
      totalAppointments,
      totalClients: uniqueClients,
      averageTicket,
      monthlyGrowth,
      conversionRate
    };
  }, [appointments, period]);

  // Performance de serviços
  const servicePerformance = useMemo<ServicePerformance[]>(() => {
    const { start, end } = getDateRange(period);
    const periodAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start, end })
    );

    const serviceStats = services.map(service => {
      const serviceAppointments = periodAppointments.filter(app => app.serviceId === service.id);
      const revenue = serviceAppointments.reduce((sum, app) => sum + (app.price || 0), 0);
      const appointmentCount = serviceAppointments.length;

      return {
        name: service.name,
        appointments: appointmentCount,
        revenue,
        averagePrice: revenue / (appointmentCount || 1),
        marketShare: (appointmentCount / (periodAppointments.length || 1)) * 100
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return serviceStats;
  }, [appointments, services, period]);

  // Análise de horários de pico
  const peakTimes = useMemo<PeakTimeData[]>(() => {
    const { start, end } = getDateRange(period);
    const periodAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start, end })
    );

    const hourlyStats: { [hour: string]: { appointments: number; revenue: number } } = {};

    periodAppointments.forEach(app => {
      const hour = format(app.dateTime, 'HH:00');
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { appointments: 0, revenue: 0 };
      }
      hourlyStats[hour].appointments++;
      hourlyStats[hour].revenue += app.price || 0;
    });

    return Object.entries(hourlyStats)
      .map(([hour, stats]) => ({ hour, ...stats }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [appointments, period]);

  // Análise de clientes
  const clientAnalysis = useMemo<ClientCategory[]>(() => {
    const { start, end } = getDateRange(period);
    const periodAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start, end })
    );

    const clientStats = clients.map(client => {
      const clientAppointments = periodAppointments.filter(app => app.clientId === client.id);
      const totalSpent = clientAppointments.reduce((sum, app) => sum + (app.price || 0), 0);
      const totalAppointments = clientAppointments.length;
      const averageTicket = totalSpent / (totalAppointments || 1);

      // Categorização de clientes
      let category: 'VIP' | 'Frequent' | 'Occasional' | 'New' = 'New';
      if (totalSpent > 1000 || totalAppointments > 10) category = 'VIP';
      else if (totalAppointments > 5) category = 'Frequent';
      else if (totalAppointments > 1) category = 'Occasional';

      return {
        name: client.name,
        totalSpent,
        totalAppointments,
        averageTicket,
        category
      };
    }).filter(client => client.totalAppointments > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    return clientStats;
  }, [appointments, clients, period]);

  // Análise de despesas
  const expenseCategories = useMemo<ExpenseCategory[]>(() => {
    const { start, end } = getDateRange(period);
    const periodExpenses = expenses.filter(expense =>
      isWithinInterval(expense.date, { start, end })
    );

    const categoryStats: { [category: string]: { amount: number; transactions: number } } = {};
    const totalExpenses = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    periodExpenses.forEach(expense => {
      const category = expense.category || 'Outros';
      if (!categoryStats[category]) {
        categoryStats[category] = { amount: 0, transactions: 0 };
      }
      categoryStats[category].amount += expense.amount;
      categoryStats[category].transactions++;
    });

    return Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category,
        amount: stats.amount,
        percentage: (stats.amount / totalExpenses) * 100,
        transactions: stats.transactions
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, period]);

  // Geração de insights com IA
  const generateAIInsights = async () => {
    if (!metrics || !servicePerformance.length) return;

    setLoadingInsights(true);
    try {
      const serviceData = servicePerformance.slice(0, 3).map(s => ({
        serviceName: s.name,
        appointments: s.appointments,
        revenue: s.revenue
      }));

      const peakData = [
        { period: 'Manhã' as const, appointments: 0 },
        { period: 'Tarde' as const, appointments: 0 },
        { period: 'Noite' as const, appointments: 0 }
      ];

      // Convert hour data to period data
      peakTimes.forEach(peak => {
        const hour = parseInt(peak.hour.split(':')[0]);
        if (hour >= 6 && hour < 12) {
          peakData[0].appointments += peak.appointments;
        } else if (hour >= 12 && hour < 18) {
          peakData[1].appointments += peak.appointments;
        } else {
          peakData[2].appointments += peak.appointments;
        }
      });

      const insights = await generateBusinessInsights(serviceData, peakData);
      
      // Parse JSON response
      if (insights && insights.trim().startsWith('{')) {
        const result = JSON.parse(insights);
        setAiInsights(result.insights?.join('\n\n') || insights);
      } else {
        setAiInsights(insights);
      }
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      setAiInsights('Não foi possível gerar insights no momento. Tente novamente mais tarde.');
    } finally {
      setLoadingInsights(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando relatórios...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Relatórios Avançados</h1>
          <p className="text-gray-600">Análise completa da performance do seu negócio</p>
          
          {/* Period Selector */}
          <div className="mt-6 flex gap-4">
            {(['week', 'month', 'quarter'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === p 
                    ? 'bg-violet-600 text-white' 
                    : 'bg-white text-gray-600 hover:bg-violet-50'
                }`}
              >
                {p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Trimestre'}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Receita Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-sm ${metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.monthlyGrowth >= 0 ? '+' : ''}{metrics.monthlyGrowth.toFixed(1)}% vs período anterior
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-8 w-8 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Agendamentos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.totalAppointments}</p>
            <p className="text-sm text-gray-500">Total no período</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-8 w-8 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Clientes Únicos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.totalClients}</p>
            <p className="text-sm text-gray-500">Clientes atendidos</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-8 w-8 text-orange-600" />
              <span className="text-sm font-medium text-gray-600">Ticket Médio</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              R$ {metrics.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-500">Por agendamento</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-8 w-8 text-indigo-600" />
              <span className="text-sm font-medium text-gray-600">Taxa de Retorno</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.conversionRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">Clientes que retornaram</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="h-8 w-8 text-red-600" />
              <span className="text-sm font-medium text-gray-600">Performance</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {servicePerformance.length > 0 ? servicePerformance[0].marketShare.toFixed(1) : '0'}%
            </p>
            <p className="text-sm text-gray-500">Serviço top</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Service Performance */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance por Serviço</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={servicePerformance.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'revenue' ? `R$ ${Number(value).toLocaleString('pt-BR')}` : value,
                  name === 'revenue' ? 'Receita' : 'Agendamentos'
                ]} />
                <Bar dataKey="revenue" fill="#8B5CF6" />
                <Bar dataKey="appointments" fill="#06B6D4" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Peak Times */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Horários de Pico</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={peakTimes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="appointments" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Analysis and Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Clients */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clientes</h3>
            <div className="space-y-4">
              {clientAnalysis.slice(0, 5).map((client, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <p className="text-sm text-gray-600">
                      {client.totalAppointments} agendamentos • {client.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      R$ {client.totalSpent.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-sm text-gray-600">
                      Ticket: R$ {client.averageTicket.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Despesas</h3>
            {expenseCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${category} (${percentage.toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Valor']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>Nenhuma despesa registrada no período</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Insights de IA</h3>
            <button
              onClick={generateAIInsights}
              disabled={loadingInsights}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {loadingInsights ? 'Gerando...' : 'Gerar Insights'}
            </button>
          </div>
          {aiInsights ? (
            <div className="prose max-w-none">
              <div className="bg-gradient-to-r from-violet-50 to-blue-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-gray-700 font-sans">{aiInsights}</pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Clique em "Gerar Insights" para obter análises inteligentes sobre seu negócio</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
