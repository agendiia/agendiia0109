import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle, Activity, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, isToday, isFuture, isPast, addDays, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DayMetrics {
  totalRevenue: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  pendingAppointments: number;
}

interface WeekMetrics {
  currentWeek: DayMetrics;
  previousWeek: DayMetrics;
}

interface AppointmentItem {
  id: string;
  clientName: string;
  serviceName: string;
  dateTime: Date;
  status: string;
  price: number;
}

interface CurrentStatus {
  status: 'livre' | 'ocupado' | 'pausa';
  nextAppointment?: Date;
  currentAppointment?: AppointmentItem;
}

const MetricCard: React.FC<{
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, change, icon, color, subtitle }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <div className={`p-3 rounded-full ${color}`}>
        {icon}
      </div>
      {change !== undefined && (
        <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
    <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'confirmado':
        return { color: 'bg-blue-100 text-blue-800', label: 'Confirmado' };
      case 'finished':
      case 'finalizado':
        return { color: 'bg-green-100 text-green-800', label: 'Finalizado' };
      case 'canceled':
      case 'cancelado':
        return { color: 'bg-red-100 text-red-800', label: 'Cancelado' };
      case 'pending':
      case 'pendente':
        return { color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' };
      default:
        return { color: 'bg-gray-100 text-gray-800', label: status };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          clientName: doc.data().clientName || doc.data().client || '',
          serviceName: doc.data().service || '',
          dateTime: doc.data().dateTime?.toDate() || new Date(),
          status: doc.data().status || 'pending',
          price: Number(doc.data().price) || 0
        }));
        setAppointments(fetchedAppointments);
      })
    );

    // Services
    unsubscribes.push(
      onSnapshot(collection(db, 'users', user.uid, 'services'), snapshot => {
        setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      })
    );

    // Clients
    unsubscribes.push(
      onSnapshot(collection(db, 'users', user.uid, 'clients'), snapshot => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      })
    );

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [user?.uid]);

  // Métricas do dia
  const dayMetrics = useMemo<DayMetrics>(() => {
    const today = new Date();
    const todayAppointments = appointments.filter(app => isToday(app.dateTime));

    return {
      totalRevenue: todayAppointments
        .filter(app => app.status === 'finished' || app.status === 'finalizado')
        .reduce((sum, app) => sum + app.price, 0),
      confirmedAppointments: todayAppointments.filter(app => 
        app.status === 'confirmed' || app.status === 'confirmado'
      ).length,
      completedAppointments: todayAppointments.filter(app => 
        app.status === 'finished' || app.status === 'finalizado'
      ).length,
      cancelledAppointments: todayAppointments.filter(app => 
        app.status === 'canceled' || app.status === 'cancelado'
      ).length,
      pendingAppointments: todayAppointments.filter(app => 
        app.status === 'pending' || app.status === 'pendente'
      ).length
    };
  }, [appointments]);

  // Métricas da semana com comparativo
  const weekMetrics = useMemo<WeekMetrics>(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { locale: ptBR });
    const currentWeekEnd = endOfWeek(now, { locale: ptBR });
    const previousWeekStart = startOfWeek(subDays(now, 7), { locale: ptBR });
    const previousWeekEnd = endOfWeek(subDays(now, 7), { locale: ptBR });

    const currentWeekAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start: currentWeekStart, end: currentWeekEnd })
    );

    const previousWeekAppointments = appointments.filter(app =>
      isWithinInterval(app.dateTime, { start: previousWeekStart, end: previousWeekEnd })
    );

    const calculateMetrics = (apps: AppointmentItem[]): DayMetrics => ({
      totalRevenue: apps
        .filter(app => app.status === 'finished' || app.status === 'finalizado')
        .reduce((sum, app) => sum + app.price, 0),
      confirmedAppointments: apps.filter(app => 
        app.status === 'confirmed' || app.status === 'confirmado'
      ).length,
      completedAppointments: apps.filter(app => 
        app.status === 'finished' || app.status === 'finalizado'
      ).length,
      cancelledAppointments: apps.filter(app => 
        app.status === 'canceled' || app.status === 'cancelado'
      ).length,
      pendingAppointments: apps.filter(app => 
        app.status === 'pending' || app.status === 'pendente'
      ).length
    });

    return {
      currentWeek: calculateMetrics(currentWeekAppointments),
      previousWeek: calculateMetrics(previousWeekAppointments)
    };
  }, [appointments]);

  // Próximos agendamentos
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(app => isFuture(app.dateTime) && (app.status === 'confirmed' || app.status === 'confirmado'))
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
      .slice(0, 10);
  }, [appointments]);

  // Status em tempo real
  const currentStatus = useMemo<CurrentStatus>(() => {
    const now = new Date();
    const currentAppointment = appointments.find(app => {
      const start = app.dateTime;
      const end = addDays(start, 0); // Assumindo 1h de duração
      end.setHours(start.getHours() + 1);
      return isWithinInterval(now, { start, end }) && 
             (app.status === 'confirmed' || app.status === 'confirmado');
    });

    if (currentAppointment) {
      return {
        status: 'ocupado',
        currentAppointment
      };
    }

    const nextAppointment = upcomingAppointments[0];
    return {
      status: 'livre',
      nextAppointment: nextAppointment?.dateTime
    };
  }, [appointments, upcomingAppointments]);

  // Cálculo de variações percentuais
  const getPercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueChange = getPercentageChange(
    weekMetrics.currentWeek.totalRevenue,
    weekMetrics.previousWeek.totalRevenue
  );

  const appointmentsChange = getPercentageChange(
    weekMetrics.currentWeek.completedAppointments,
    weekMetrics.previousWeek.completedAppointments
  );

  // Dados para gráfico da semana
  const weeklyData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dayAppointments = appointments.filter(app => 
        format(app.dateTime, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      
      data.push({
        day: format(date, 'EEE', { locale: ptBR }),
        agendamentos: dayAppointments.filter(app => 
          app.status === 'finished' || app.status === 'finalizado'
        ).length,
        receita: dayAppointments
          .filter(app => app.status === 'finished' || app.status === 'finalizado')
          .reduce((sum, app) => sum + app.price, 0)
      });
    }
    
    return data;
  }, [appointments]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com Status em Tempo Real */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                currentStatus.status === 'ocupado' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                <Activity className="h-4 w-4 mr-2" />
                {currentStatus.status === 'ocupado' ? 'Ocupado' : 'Livre'}
              </div>
              {currentStatus.nextAppointment && (
                <p className="text-sm text-gray-600 mt-2">
                  Próximo: {format(currentStatus.nextAppointment, 'HH:mm')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Métricas do Dia */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Métricas de Hoje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Receita do Dia"
              value={`R$ ${dayMetrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={<DollarSign className="h-6 w-6 text-white" />}
              color="bg-green-500"
              subtitle="Agendamentos finalizados"
            />
            <MetricCard
              title="Agendamentos Confirmados"
              value={dayMetrics.confirmedAppointments.toString()}
              icon={<CheckCircle className="h-6 w-6 text-white" />}
              color="bg-blue-500"
              subtitle="Para hoje"
            />
            <MetricCard
              title="Agendamentos Finalizados"
              value={dayMetrics.completedAppointments.toString()}
              icon={<Calendar className="h-6 w-6 text-white" />}
              color="bg-purple-500"
              subtitle="Concluídos hoje"
            />
            <MetricCard
              title="Cancelamentos"
              value={dayMetrics.cancelledAppointments.toString()}
              icon={<XCircle className="h-6 w-6 text-white" />}
              color="bg-red-500"
              subtitle="Cancelados hoje"
            />
          </div>
        </div>

        {/* Métricas da Semana com Comparativo */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Comparativo Semanal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard
              title="Receita da Semana"
              value={`R$ ${weekMetrics.currentWeek.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              change={revenueChange}
              icon={<TrendingUp className="h-6 w-6 text-white" />}
              color="bg-emerald-500"
              subtitle="vs semana anterior"
            />
            <MetricCard
              title="Agendamentos da Semana"
              value={weekMetrics.currentWeek.completedAppointments.toString()}
              change={appointmentsChange}
              icon={<Users className="h-6 w-6 text-white" />}
              color="bg-indigo-500"
              subtitle="vs semana anterior"
            />
          </div>
        </div>

        {/* Gráfico da Semana e Próximos Agendamentos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico Semanal */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance dos Últimos 7 Dias</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'receita' ? `R$ ${Number(value).toLocaleString('pt-BR')}` : value,
                    name === 'receita' ? 'Receita' : 'Agendamentos'
                  ]}
                />
                <Bar dataKey="agendamentos" fill="#8B5CF6" />
                <Bar dataKey="receita" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Próximos Agendamentos */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Próximos Agendamentos</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{appointment.clientName}</p>
                        <p className="text-xs text-gray-600">{appointment.serviceName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {format(appointment.dateTime, 'HH:mm')}
                      </p>
                      <p className="text-xs text-gray-600">
                        {format(appointment.dateTime, 'dd/MM')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum agendamento próximo</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Atual Detalhado */}
        {currentStatus.currentAppointment && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Agendamento Atual</h3>
                <p className="text-blue-100">Cliente: {currentStatus.currentAppointment.clientName}</p>
                <p className="text-blue-100">Serviço: {currentStatus.currentAppointment.serviceName}</p>
                <p className="text-blue-100">
                  Horário: {format(currentStatus.currentAppointment.dateTime, 'HH:mm')}
                </p>
              </div>
              <div className="text-right">
                <div className="bg-white/20 px-4 py-2 rounded-lg">
                  <p className="text-sm">Valor</p>
                  <p className="text-xl font-bold">
                    R$ {currentStatus.currentAppointment.price.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
