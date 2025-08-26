import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { servicePalette, hashStringToIndex } from './ServicePalette';
import { ServicePerformance, PeakTimeData, TrendData, Appointment, Service, AppointmentStatus } from '../types';
import { generateBusinessInsights } from '../services/geminiService';
import { BarChart4, Sparkles, Loader, TrendingUp, Clock, DollarSign, Lightbulb } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { format, getHours, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';


// Main Reports Component
const Reports: React.FC = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [insights, setInsights] = useState<string[] | null>(null);
    const [isInsightsLoading, setIsInsightsLoading] = useState(false);
    const [insightsError, setInsightsError] = useState('');

    useEffect(() => {
        if (!user?.uid) {
            setIsLoading(false);
            return;
        };

        const appointmentsCol = collection(db, 'users', user.uid, 'appointments');
        const servicesCol = collection(db, 'users', user.uid, 'services');

        const unsubAppointments = onSnapshot(appointmentsCol, snapshot => {
            const fetchedAppointments = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dateTime: (data.dateTime as Timestamp).toDate(),
                } as Appointment;
            });
            setAppointments(fetchedAppointments);
            setIsLoading(false);
        }, () => setIsLoading(false));

        const unsubServices = onSnapshot(servicesCol, snapshot => {
            const fetchedServices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Service));
            setServices(fetchedServices);
        });

        return () => {
            unsubAppointments();
            unsubServices();
        };
    }, [user?.uid]);

    const finishedAppointments = useMemo(() =>
        appointments.filter(a => a.status === AppointmentStatus.Finished && a.price > 0),
        [appointments]
    );

    const servicePerformanceData = useMemo<ServicePerformance[]>(() => {
        if (!finishedAppointments.length || !services.length) return [];

        const performanceMap = new Map<string, { appointments: number; revenue: number }>();

        finishedAppointments.forEach(app => {
            // In older data, service was the name, now it's the ID. Handle both for compatibility.
            const serviceId = services.find(s => s.id === app.service || s.name === app.service)?.id || app.service;
            const current = performanceMap.get(serviceId) || { appointments: 0, revenue: 0 };
            performanceMap.set(serviceId, {
                appointments: current.appointments + 1,
                revenue: current.revenue + (app.price || 0),
            });
        });

        return Array.from(performanceMap.entries()).map(([serviceId, data]) => {
            const service = services.find(s => s.id === serviceId);
            return {
                serviceId,
                serviceName: service?.name || serviceId,
                ...data,
            };
        }).sort((a, b) => b.revenue - a.revenue).slice(0, 10); // Show top 10

    }, [finishedAppointments, services]);

    const peakTimeData = useMemo<PeakTimeData[]>(() => {
        if (!finishedAppointments.length) return [];
        const periods = { 'Manhã': 0, 'Tarde': 0, 'Noite': 0 };

        finishedAppointments.forEach(app => {
            const hour = getHours(app.dateTime);
            if (hour >= 6 && hour < 12) periods['Manhã']++;
            else if (hour >= 12 && hour < 18) periods['Tarde']++;
            else periods['Noite']++;
        });

        return [
            { period: 'Manhã', appointments: periods['Manhã'] },
            { period: 'Tarde', appointments: periods['Tarde'] },
            { period: 'Noite', appointments: periods['Noite'] },
        ];
    }, [finishedAppointments]);

    const trendData = useMemo<TrendData[]>(() => {
        if (!finishedAppointments.length) return [];

        const trendMap = new Map<string, number>();
        const last12Months: Date[] = [];
        for (let i = 11; i >= 0; i--) {
            last12Months.push(subMonths(new Date(), i));
        }

        last12Months.forEach(date => {
            const monthKey = format(date, 'MMM/yy', { locale: ptBR });
            trendMap.set(monthKey.charAt(0).toUpperCase() + monthKey.slice(1), 0);
        });

        finishedAppointments.forEach(app => {
            const monthKey = format(app.dateTime, 'MMM/yy', { locale: ptBR });
            const capitalizedMonthKey = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
            if (trendMap.has(capitalizedMonthKey)) {
                trendMap.set(capitalizedMonthKey, (trendMap.get(capitalizedMonthKey) || 0) + 1);
            }
        });

        return Array.from(trendMap.entries()).map(([month, value]) => ({ month, value }));
    }, [finishedAppointments]);

    const handleGenerateInsights = async () => {
        if (!servicePerformanceData.length && !peakTimeData.length) {
            setInsightsError("Não há dados suficientes para gerar insights.");
            return;
        }
        setIsInsightsLoading(true);
        setInsightsError('');
        setInsights(null);
        try {
            const resultString = await generateBusinessInsights(servicePerformanceData, peakTimeData);
             if (resultString && resultString.trim().startsWith('{')) {
                const result = JSON.parse(resultString);
                setInsights(result.insights);
            } else {
                setInsightsError(resultString || 'A IA retornou uma resposta inválida.');
            }
        } catch (e) {
            console.error(e);
            setInsightsError('Falha ao processar os insights da IA.');
        } finally {
            setIsInsightsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader className="h-12 w-12 animate-spin text-indigo-500" />
            </div>
        );
    }
    
    if (!finishedAppointments.length) {
        return (
             <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <BarChart4 className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500" />
                <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-white">Sem Dados para Exibir</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                    Comece a registrar seus agendamentos finalizados para ver os relatórios.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center">
                    <BarChart4 className="h-8 w-8 mr-3 text-indigo-500"/>
                    Relatórios Avançados
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                    Analise a performance do seu negócio e obtenha insights com IA para tomar decisões mais inteligentes.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ReportCard title="Análise de Horários de Pico" icon={<Clock/>}>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={peakTimeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
                            <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12}/>
                            <Tooltip cursor={{fill: 'rgba(129, 140, 248, 0.1)'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                            <Bar dataKey="appointments" name="Agendamentos" radius={[4, 4, 0, 0]}>
                                {peakTimeData.map((entry, i) => {
                                    const pal = servicePalette[i % servicePalette.length];
                                    const fill = pal?.hex || '#9ca3af';
                                    return (<Cell key={`peak-${i}`} fill={fill} />);
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ReportCard>
                
                <ReportCard title="Performance por Serviço (Receita)" icon={<DollarSign/>}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart layout="vertical" data={servicePerformanceData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(100, 116, 139, 0.2)" />
                                 <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12} tickFormatter={(value) => `R$${value/1000}k`} />
                                 <YAxis type="category" dataKey="serviceName" width={140} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                 <Tooltip cursor={{fill: 'rgba(129, 140, 248, 0.06)'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} formatter={(value: number) => `R$ ${value.toFixed(2)}`}/>
                                 <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0] }>
                                     {servicePerformanceData.map((entry, index) => {
                                         const idx = hashStringToIndex(entry.serviceId || entry.serviceName || String(index), servicePalette.length);
                                         // use tailwind color for SVG fill; map to CSS color via inline style
                                         const pal = servicePalette[idx];
                                         const fill = pal?.hex || '#60a5fa';
                                         return (<Cell key={`cell-${index}`} fill={fill} />);
                                     })}
                                 </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                </ReportCard>
            </div>
            
            <ReportCard title="Tendência de Agendamentos (Últimos 12 meses)" icon={<TrendingUp/>} fullWidth={true}>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                         <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                         <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}/>
                         <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }} />
                         <Legend wrapperStyle={{fontSize: "14px"}}/>
                         <Line type="monotone" dataKey="value" name="Agendamentos" stroke={servicePalette[5].hex || '#06b6d4'} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </ReportCard>
            
            <ReportCard title="Sugestões de Otimização com IA" icon={<Lightbulb/>}>
                 <div className="flex flex-col items-center justify-center min-h-[250px] p-4 text-center">
                    {isInsightsLoading && <Loader className="h-10 w-10 animate-spin text-indigo-500"/>}
                    {insightsError && <p className="text-red-500">{insightsError}</p>}
                    {insights && !isInsightsLoading && (
                         <ul className="space-y-3 text-left w-full">
                            {insights.map((insight, index) => (
                                <li key={index} className="flex items-start p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                                    <Lightbulb className="h-5 w-5 mr-3 mt-0.5 text-yellow-500 flex-shrink-0"/>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{insight}</p>
                                </li>
                            ))}
                         </ul>
                    )}
                    {!isInsightsLoading && (
                         <button onClick={handleGenerateInsights} className="mt-6 bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:bg-indigo-400" disabled={!servicePerformanceData.length}>
                            <Sparkles className="h-5 w-5"/>
                            <span>{insights ? 'Gerar Novos Insights' : 'Gerar Insights'}</span>
                        </button>
                    )}
                </div>
            </ReportCard>

        </div>
    );
};


// Helper component for report cards
const ReportCard: React.FC<{title: string, icon: React.ReactNode, fullWidth?: boolean, children: React.ReactNode}> = ({ title, icon, fullWidth, children }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md ${fullWidth ? 'lg:col-span-2' : ''}`}>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center">
            <span className="text-indigo-500 mr-3">{icon}</span>
            {title}
        </h2>
        {children}
    </div>
);

export default Reports;