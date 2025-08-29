import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import LimitedAccountBanner from './LimitedAccountBanner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO, addDays, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, Users, Clock, ChevronUp, ChevronDown, Activity, AlertTriangle, Star, Target, TrendingUp, PieChartIcon } from './Icons';
import { Appointment, Service, Client, Expense } from '../types';
import { generateBusinessInsights } from '../services/geminiService';

interface DashboardMetrics {
  totalRevenue: number;
  totalAppointments: number;
  totalClients: number;
  averageTicket: number;
  revenueGrowth: number;
  appointmentGrowth: number;
  clientGrowth: number;
  ticketGrowth: number;
}

interface ServicePerformance {
  name: string;
  appointments: number;
  revenue: number;
  color: string;
}

interface PeakTime {
  hour: string;
  appointments: number;
}

interface ClientAnalysis {
  id: string;
  name: string;
  email: string;
  phone: string;
  appointmentCount: number;
  totalSpent: number;
  lastAppointment: Date;
  category: 'VIP' | 'Regular' | 'Novo';
  avgTicket: number;
}

interface ExpenseCategory {
  name: string;
  value: number;
  color: string;
}

export const Reports: React.FC = () => {
  const { user, hasAccess } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [servicePerformance, setServicePerformance] = useState<ServicePerformance[]>([]);
  const [peakTimes, setPeakTimes] = useState<PeakTime[]>([]);
  const [clientAnalysis, setClientAnalysis] = useState<ClientAnalysis[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Service palette colors
  const servicePalette = {
    colors: [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ]
  };

  const expenseColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

  useEffect(() => {
    if (!user?.uid || !hasAccess('reports.view')) return;

    const unsubscribes: (() => void)[] = [];

    // Appointments subscription
    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('userId', '==', user.uid),
      orderBy('dateTime', 'desc')
    );
    
    unsubscribes.push(
      onSnapshot(appointmentsQuery, (snapshot) => {
        const appointmentsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            dateTime: data.dateTime instanceof Timestamp ? data.dateTime.toDate() : new Date(data.dateTime)
          };
        }) as Appointment[];
        setAppointments(appointmentsData);
      })
    );

    // Services subscription
    const servicesQuery = query(
      collection(db, 'services'),
      where('userId', '==', user.uid)
    );
    
    unsubscribes.push(
      onSnapshot(servicesQuery, (snapshot) => {
        const servicesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Service[];
        setServices(servicesData);
      })
    );

    // Clients subscription
    const clientsQuery = query(
      collection(db, 'clients'),
      where('userId', '==', user.uid)
    );
    
    unsubscribes.push(
      onSnapshot(clientsQuery, (snapshot) => {
        const clientsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Client[];
        setClients(clientsData);
      })
    );

    // Expenses subscription
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('userId', '==', user.uid)
    );
    
    unsubscribes.push(
      onSnapshot(expensesQuery, (snapshot) => {
        const expensesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: data.date instanceof Timestamp ? data.date.toDate() : parseISO(data.date)
          };
        }) as Expense[];
        setExpenses(expensesData);
        setLoading(false);
      })
    );

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user?.uid, hasAccess]);

  useEffect(() => {
    if (appointments.length > 0 && services.length > 0 && clients.length > 0) {
      calculateMetrics();
      calculateServicePerformance();
      calculatePeakTimes();
      calculateClientAnalysis();
      calculateExpenseCategories();
    }
  }, [appointments, services, clients, expenses, period]);

  const getPeriodDates = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        end = new Date(now.getFullYear(), quarterMonth + 3, 0);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    return { start, end };
  };

  const getPreviousPeriodDates = () => {
    const { start, end } = getPeriodDates();
    const duration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { start: previousStart, end: previousEnd };
  };

  const filterByPeriod = (items: any[], dateField: string = 'dateTime') => {
    const { start, end } = getPeriodDates();
    return items.filter(item => {
      const date = item[dateField];
      return date >= start && date <= end;
    });
  };

  const calculateMetrics = () => {
    const { start, end } = getPeriodDates();
    const { start: prevStart, end: prevEnd } = getPreviousPeriodDates();

    // Current period
    const currentAppointments = appointments.filter(apt => 
      apt.dateTime >= start && apt.dateTime <= end && apt.status === 'confirmed'
    );
    const currentRevenue = currentAppointments.reduce((total, apt) => total + (apt.price || 0), 0);
    const currentClients = new Set(currentAppointments.map(apt => apt.clientId)).size;

    // Previous period
    const previousAppointments = appointments.filter(apt =>
      apt.dateTime >= prevStart && apt.dateTime <= prevEnd && apt.status === 'confirmed'
    );
    const previousRevenue = previousAppointments.reduce((total, apt) => total + (apt.price || 0), 0);
    const previousClients = new Set(previousAppointments.map(apt => apt.clientId)).size;

    // Growth calculations
    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const appointmentGrowth = previousAppointments.length > 0 ? ((currentAppointments.length - previousAppointments.length) / previousAppointments.length) * 100 : 0;
    const clientGrowth = previousClients > 0 ? ((currentClients - previousClients) / previousClients) * 100 : 0;
    
    const currentAvgTicket = currentAppointments.length > 0 ? currentRevenue / currentAppointments.length : 0;
    const previousAvgTicket = previousAppointments.length > 0 ? previousRevenue / previousAppointments.length : 0;
    const ticketGrowth = previousAvgTicket > 0 ? ((currentAvgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0;

    setMetrics({
      totalRevenue: currentRevenue,
      totalAppointments: currentAppointments.length,
      totalClients: currentClients,
      averageTicket: currentAvgTicket,
      revenueGrowth,
      appointmentGrowth,
      clientGrowth,
      ticketGrowth
    });
  };

  const calculateServicePerformance = () => {
    const periodAppointments = filterByPeriod(appointments.filter(apt => apt.status === 'confirmed'));
    
    const serviceStats = services.map((service, index) => {
      const serviceAppointments = periodAppointments.filter(apt => apt.serviceId === service.id);
      const revenue = serviceAppointments.reduce((total, apt) => total + (apt.price || 0), 0);
      
      return {
        name: service.name,
        appointments: serviceAppointments.length,
        revenue,
        color: servicePalette.colors[index % servicePalette.colors.length]
      };
    }).filter(service => service.appointments > 0)
      .sort((a, b) => b.revenue - a.revenue);

    setServicePerformance(serviceStats);
  };

  const calculatePeakTimes = () => {
    const periodAppointments = filterByPeriod(appointments.filter(apt => apt.status === 'confirmed'));
    
    const hourStats: { [hour: string]: number } = {};
    
    periodAppointments.forEach(apt => {
      const hour = format(apt.dateTime, 'HH:00');
      hourStats[hour] = (hourStats[hour] || 0) + 1;
    });

    const peakData = Object.entries(hourStats)
      .map(([hour, appointments]) => ({ hour, appointments }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    setPeakTimes(peakData);
  };

  const calculateClientAnalysis = () => {
    const periodAppointments = filterByPeriod(appointments.filter(apt => apt.status === 'confirmed'));
    
    const clientStats = clients.map(client => {
      const clientAppointments = periodAppointments.filter(apt => apt.clientId === client.id);
      const totalSpent = clientAppointments.reduce((total, apt) => total + (apt.price || 0), 0);
      const appointmentCount = clientAppointments.length;
      const lastAppointment = clientAppointments.length > 0 
        ? new Date(Math.max(...clientAppointments.map(apt => apt.dateTime.getTime())))
        : new Date(0);

      let category: 'VIP' | 'Regular' | 'Novo' = 'Novo';
      if (totalSpent > 1000) category = 'VIP';
      else if (appointmentCount > 2) category = 'Regular';

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        appointmentCount,
        totalSpent,
        lastAppointment,
        category,
        avgTicket: appointmentCount > 0 ? totalSpent / appointmentCount : 0
      };
    }).filter(client => client.appointmentCount > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    setClientAnalysis(clientStats);
  };

  const calculateExpenseCategories = () => {
    const periodExpenses = filterByPeriod(expenses, 'date');
    
    const categoryStats: { [category: string]: number } = {};
    
    periodExpenses.forEach(expense => {
      const category = expense.category || 'Outros';
      categoryStats[category] = (categoryStats[category] || 0) + expense.amount;
    });

    const expenseData = Object.entries(categoryStats)
      .map(([name, value], index) => ({
        name,
        value,
        color: expenseColors[index % expenseColors.length]
      }))
      .sort((a, b) => b.value - a.value);

    setExpenseCategories(expenseData);
  };

  const generateAIInsights = async () => {
    if (!metrics || !servicePerformance.length) return;

    setLoadingInsights(true);
    try {
      const context = {
        period: period === 'week' ? 'semana' : period === 'month' ? 'mês' : 'trimestre',
        metrics,
        servicePerformance: servicePerformance.slice(0, 3),
        topClients: clientAnalysis.slice(0, 5),
        expenseCategories: expenseCategories.slice(0, 3)
      };

      const insights = await generateBusinessInsights(context);
      setAiInsights(insights);
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      setAiInsights('Não foi possível gerar insights no momento. Tente novamente mais tarde.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (!hasAccess('reports.view')) {
    return <LimitedAccountBanner feature="Relatórios Avançados" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios Avançados</h1>
        
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'week' | 'month' | 'quarter')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
            <option value="quarter">Este Trimestre</option>
          </select>
          
          <button
            onClick={generateAIInsights}
            disabled={loadingInsights}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            {loadingInsights ? 'Gerando...' : 'Insights IA'}
          </button>
        </div>
      </div>

      {/* Métricas Dashboard */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Receita Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <div className="flex items-center mt-1">
                  {metrics.revenueGrowth >= 0 ? (
                    <ChevronUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm ${metrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(metrics.revenueGrowth)}
                  </span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Agendamentos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics.totalAppointments}
                </p>
                <div className="flex items-center mt-1">
                  {metrics.appointmentGrowth >= 0 ? (
                    <ChevronUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm ${metrics.appointmentGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(metrics.appointmentGrowth)}
                  </span>
                </div>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Clientes Ativos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics.totalClients}
                </p>
                <div className="flex items-center mt-1">
                  {metrics.clientGrowth >= 0 ? (
                    <ChevronUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm ${metrics.clientGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(metrics.clientGrowth)}
                  </span>
                </div>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ticket Médio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(metrics.averageTicket)}
                </p>
                <div className="flex items-center mt-1">
                  {metrics.ticketGrowth >= 0 ? (
                    <ChevronUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm ${metrics.ticketGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(metrics.ticketGrowth)}
                  </span>
                </div>
              </div>
              <Target className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance de Serviços */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance de Serviços
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={servicePerformance}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'revenue' ? formatCurrency(value as number) : value,
                  name === 'revenue' ? 'Receita' : 'Agendamentos'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '0.5rem' }}
              />
              <Bar dataKey="revenue" fill="#3B82F6" name="revenue" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horários de Pico */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Horários de Pico
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={peakTimes}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value) => [value, 'Agendamentos']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '0.5rem' }}
              />
              <Area type="monotone" dataKey="appointments" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Análise de Clientes e Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Análise de Clientes */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5" />
            Top Clientes
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Cliente</th>
                  <th className="text-center py-2 text-gray-600 dark:text-gray-400">Categoria</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Agendamentos</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Total Gasto</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {clientAnalysis.slice(0, 8).map((client) => (
                  <tr key={client.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                        <p className="text-xs text-gray-500">{client.email}</p>
                      </div>
                    </td>
                    <td className="text-center py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        client.category === 'VIP' ? 'bg-yellow-100 text-yellow-800' :
                        client.category === 'Regular' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {client.category}
                      </span>
                    </td>
                    <td className="text-right py-3 text-gray-900 dark:text-white">
                      {client.appointmentCount}
                    </td>
                    <td className="text-right py-3 text-gray-900 dark:text-white">
                      {formatCurrency(client.totalSpent)}
                    </td>
                    <td className="text-right py-3 text-gray-900 dark:text-white">
                      {formatCurrency(client.avgTicket)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribuição de Despesas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Despesas por Categoria
          </h2>
          {expenseCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expenseCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Nenhuma despesa registrada no período
            </div>
          )}
        </div>
      </div>

      {/* Insights de IA */}
      {aiInsights && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Insights Inteligentes
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {aiInsights}
            </div>
          </div>
        </div>
      )}

      {/* Alerta de dados insuficientes */}
      {appointments.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-300">
                Dados Insuficientes
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Para gerar relatórios completos, registre alguns agendamentos, serviços e clientes primeiro.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
