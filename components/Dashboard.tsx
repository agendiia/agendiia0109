import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, Calendar, AverageTicket, TrendingUp, UserPlus, NoShow, Send, Loader } from './Icons';
import { generateChatResponse } from '../services/geminiService';
import { Appointment, AppointmentStatus, Client, ClientCategory } from '../types';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import LockedWidget from './LockedWidget';
import { LoadingSpinner, LoadingState } from './LoadingState';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4 transition-transform hover:scale-105">
    <div className={`p-3 rounded-full ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
      {change && <p className="text-xs text-green-500">{change}</p>}
    </div>
  </div>
);

// State-driven datasets (fetched from Firestore)
interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const Dashboard: React.FC = () => {
  const { hasAccess, user } = useAuth();
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<any[]>([]);
  const [newClientsData, setNewClientsData] = useState<any[]>([]);
  const [servicePerformanceData, setServicePerformanceData] = useState<any[]>([]);
  const [servicePage, setServicePage] = useState<number>(1);
  const [servicePageSize, setServicePageSize] = useState<number>(5);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [revenueThisMonth, setRevenueThisMonth] = useState<number>(0);
  const [consultasThisMonth, setConsultasThisMonth] = useState<number>(0);
  const [ticketMedio, setTicketMedio] = useState<number>(0);
  const [noShowRate, setNoShowRate] = useState<number>(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
      { sender: 'ai', text: 'Olá! Como posso ajudar a analisar seus dados de negócio hoje?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasAutoScrolledRef = useRef<boolean>(false);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isChatLoading) return;

    const userMessage = userInput.trim();
    setUserInput('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsChatLoading(true);

    // Create abort controller for this request
    const currentAbortController = new AbortController();
    abortControllerRef.current = currentAbortController;

    try {
      const context = {
        recentAppointments,
        servicePerformance: servicePerformanceData,
        monthlyRevenue: monthlyRevenueData,
        newClients: newClientsData,
        currentDate: new Date().toISOString().split('T')[0]
      };

      const response = await generateChatResponse(userMessage, context);
      
      if (!currentAbortController.signal.aborted) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: response }]);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && !currentAbortController.signal.aborted) {
        setChatHistory(prev => [...prev, { 
          sender: 'ai', 
          text: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.' 
        }]);
      }
    } finally {
      if (!currentAbortController.signal.aborted) {
        setIsChatLoading(false);
      }
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    // Avoid auto-scrolling on initial mount (e.g., after login). Only scroll
    // when new messages are appended after the first render or when the
    // loading state changes subsequently. Also skip auto-scroll for the
    // initial greeting message (chatHistory length === 1).
    if (!chatEndRef.current) return;
    if (!hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true;
      return;
    }
    if (chatHistory.length <= 1) return;
    chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length, isChatLoading]);

  useEffect(() => {
    if (!user) return;

    // Real-time listeners
    const apptQuery = query(collection(db, 'users', user.uid, 'appointments'), orderBy('dateTime', 'desc'));
    const recentApptQuery = query(collection(db, 'users', user.uid, 'appointments'), orderBy('createdAt', 'desc'), limit(10));
    const servicesQuery = collection(db, 'users', user.uid, 'services');
    const clientsQuery = collection(db, 'users', user.uid, 'clients');

    const unsubRecent = onSnapshot(recentApptQuery, (snap) => {
      const appts = snap.docs.map(d => ({ id: d.id, ...(d.data() as any || {}) }));
      setRecentAppointments(appts.map(a => ({ clientName: (a as any).clientName || (a as any).client || '', service: (a as any).service || '', date: (a as any).dateTime?.toDate ? (a as any).dateTime.toDate().toISOString().split('T')[0] : ((a as any).dateTime || ''), status: (a as any).status || '' })));
    });

    const unsubAll = onSnapshot(apptQuery, (snap) => {
      const apptAll = snap.docs.map(d => ({ id: d.id, ...(d.data() as any || {}) }));

      // Services performance
      onSnapshot(servicesQuery, (svcSnap) => {
        const services = svcSnap.docs.map(d => ({ id: d.id, ...(d.data() as any || {}) }));
        const perf = services.map(s => {
          const svcId = s.id;
          const svcName = (s as any).name || 'N/A';
          const matchingAppts = apptAll.filter(a => {
            const ad = a as any;
            return ((ad.serviceId && ad.serviceId === svcId) || (ad.service && ad.service === svcName)) && (ad.status === AppointmentStatus.Confirmed || ad.status === AppointmentStatus.Finished);
          });
          const revenue = matchingAppts.reduce((sum, a) => sum + Number((a as any).price || 0), 0);
          return { serviceId: svcId, serviceName: svcName, revenue, appointments: matchingAppts.length };
        });
        setServicePerformanceData(perf);
      });

      // Monthly revenue
      const now = new Date();
      const months = Array.from({ length: 12 }).map((_, i) => ({ name: monthLabels[i], Faturamento: 0, Despesas: 0 }));
      apptAll.forEach(a => {
        const ad = a as any;
        const dt = ad.dateTime?.toDate ? ad.dateTime.toDate() : (ad.dateTime ? new Date(ad.dateTime) : null);
        if (!dt || ad.status === AppointmentStatus.Canceled) return;
        if (dt.getFullYear() !== now.getFullYear()) return;
        const m = dt.getMonth();
        const price = Number(ad.price || 0);
        if (ad.status === AppointmentStatus.Confirmed || ad.status === AppointmentStatus.Finished) {
          months[m].Faturamento += price;
        }
      });
      setMonthlyRevenueData(months.slice(0, 12));

      // Current month metrics
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const apptsThisMonth = apptAll.filter(a => {
        const ad = a as any;
        const dt = ad.dateTime?.toDate ? ad.dateTime.toDate() : (ad.dateTime ? new Date(ad.dateTime) : null);
        return dt && dt.getFullYear() === currentYear && dt.getMonth() === currentMonth;
      });

      const revenue = apptsThisMonth
        .filter(a => (a as any).status === AppointmentStatus.Confirmed || (a as any).status === AppointmentStatus.Finished)
        .reduce((s, a) => s + Number((a as any).price || 0), 0);
      const consultasCount = apptsThisMonth.filter(a => (a as any).status === AppointmentStatus.Confirmed || (a as any).status === AppointmentStatus.Finished).length;
      const noShowCount = apptsThisMonth.filter(a => (a as any).status === AppointmentStatus.Problem).length;
      const totalConsideredForNoShow = apptsThisMonth.filter(a => 
          (a as any).status === AppointmentStatus.Confirmed || 
          (a as any).status === AppointmentStatus.Finished ||
          (a as any).status === AppointmentStatus.Problem
      ).length;

      setRevenueThisMonth(revenue);
      setConsultasThisMonth(consultasCount);
      setTicketMedio(consultasCount > 0 ? revenue / consultasCount : 0);
      setNoShowRate(totalConsideredForNoShow > 0 ? Math.round((noShowCount / totalConsideredForNoShow) * 100) : 0);
    });

    const unsubClients = onSnapshot(clientsQuery, (snap) => {
      const clients = snap.docs.map(d => ({ id: d.id, ...(d.data() as any || {}) }));
      const now = new Date();
      const newClientsByMonth = Array.from({ length: 12 }).map((_, i) => ({ name: monthLabels[i], 'Novos Clientes': 0 }));
      clients.forEach(c => {
        const cd = c as any;
        const created = cd.createdAt?.toDate ? cd.createdAt.toDate() : (cd.createdAt ? new Date(cd.createdAt) : null);
        if (!created) return;
        if (created.getFullYear() !== now.getFullYear()) return;
        newClientsByMonth[created.getMonth()]['Novos Clientes'] += 1;
      });
      setNewClientsData(newClientsByMonth.slice(0, 12));
    });

    // cleanup
    return () => {
      unsubRecent();
      unsubAll();
      unsubClients();
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Faturamento Mensal"
            value={`R$ ${revenueThisMonth.toFixed(2)}`}
            change=""
          icon={<DollarSign className="h-6 w-6 text-white" />}
          color="bg-green-500"
        />
        <MetricCard
          title="Consultas Este Mês"
            value={`${consultasThisMonth}`}
            change=""
          icon={<Calendar className="h-6 w-6 text-white" />}
          color="bg-blue-500"
        />
        <MetricCard
          title="Ticket Médio"
            value={`R$ ${ticketMedio.toFixed(2)}`}
            change=""
          icon={<AverageTicket className="h-6 w-6 text-white" />}
          color="bg-purple-500"
        />
        <MetricCard
          title="Taxa de No-Show"
            value={`${noShowRate}%`}
            change=""
          icon={<NoShow className="h-6 w-6 text-white" />}
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" /> Faturamento vs Despesas
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Faturamento" fill="#10b981" />
              <Bar dataKey="Despesas" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* New Clients Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
            <UserPlus className="h-5 w-5 mr-2" /> Novos Clientes
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={newClientsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="Novos Clientes" stroke="#6366f1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* AI Chat */}
        {hasAccess('dashboard.ai_chat') ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Insights com IA</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg h-96 flex flex-col">
              <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-xs lg:max-w-md p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 flex items-center">
                      <Loader className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm">Analisando...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Pergunte algo sobre seus dados..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isChatLoading}
                    className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isChatLoading || !userInput.trim()}
                    className="bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <LockedWidget featureName="Insights com IA" />
        )}
      </div>
      
  {/* Services - removed per request */}
    </div>
  );
};

export default Dashboard;
