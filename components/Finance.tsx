import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Expense, ExpenseCategory, Appointment, AppointmentStatus, AppointmentPaymentStatus, Client, ClientCategory } from '../types';
import { generateFinancialForecast, generateGoalAchievementStrategies } from '../services/geminiService';
import { DollarSign, Plus, Edit, Trash, PieChartIcon, TrendingUp, Sparkles, Loader, Wrench, Check, AlertTriangle, Lightbulb, Lock } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import LockedWidget from './LockedWidget';
import { db } from '@/services/firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, getDocs } from 'firebase/firestore';

// Month labels (pt-BR short)
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943'];

const categoryColors: { [key in ExpenseCategory]: string } = {
    [ExpenseCategory.Marketing]: '#0088FE',
    [ExpenseCategory.Material]: '#00C49F',
    [ExpenseCategory.Aluguel]: '#FFBB28',
    [ExpenseCategory.Transporte]: '#FF8042',
    [ExpenseCategory.Taxas]: '#AF19FF',
    [ExpenseCategory.Outros]: '#FF1943',
};

const PaymentStatusBadge: React.FC<{ status: AppointmentPaymentStatus }> = ({ status }) => {
    const styles: { [key in AppointmentPaymentStatus]?: string } = {
        [AppointmentPaymentStatus.Pago]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        [AppointmentPaymentStatus.Pendente]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    };
    return (
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>
    );
};

const Finance: React.FC = () => {
    const { user, hasAccess } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    const [isForecasting, setIsForecasting] = useState(false);
    const [forecastResult, setForecastResult] = useState<{ value: number; analysis: string } | null>(null);
    const [forecastError, setForecastError] = useState<string | null>(null);
    
    const [monthlyGoal, setMonthlyGoal] = useState<number>(8000);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
    const [aiError, setAiError] = useState<string>('');

    // Load data from Firestore
    useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        // Expenses
        const expensesUnsub = onSnapshot(
            query(collection(db, 'users', user.uid, 'expenses'), orderBy('date', 'asc')),
            (snap) => {
                const items: Expense[] = snap.docs.map((d) => {
                    const data: any = d.data();
                    const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
                    return {
                        id: d.id,
                        description: data.description || '',
                        category: data.category as ExpenseCategory,
                        amount: Number(data.amount) || 0,
                        date,
                    } as Expense;
                });
                setExpenses(items);
            }
        );

        // Appointments
        const apptUnsub = onSnapshot(
            query(collection(db, 'users', user.uid, 'appointments'), orderBy('dateTime', 'asc')),
            (snap) => {
                const items: Appointment[] = snap.docs.map((d) => {
                    const data: any = d.data();
                    const dt = data.dateTime instanceof Timestamp ? data.dateTime.toDate() : new Date(data.dateTime);
                    return {
                        id: d.id,
                        clientName: data.clientName || '',
                        service: data.service || '',
                        dateTime: dt,
                        duration: Number(data.duration) || 0,
                        status: data.status as AppointmentStatus,
                        modality: data.modality || 'Online',
                        price: Number(data.price) || 0,
                        paymentStatus: data.paymentStatus || undefined,
                    } as Appointment;
                });
                setAppointments(items);
                setIsLoading(false);
            }
        );

        // Monthly Goal (settings)
        const settingsRef = doc(db, 'users', user.uid, 'finance', 'settings');
        const settingsUnsub = onSnapshot(settingsRef, (snap) => {
            const data: any = snap.data();
            if (data && typeof data.monthlyGoal === 'number') setMonthlyGoal(data.monthlyGoal);
        });

        // Clients (one-time fetch for AI)
        (async () => {
            try {
                const cs = await getDocs(collection(db, 'users', user.uid, 'clients'));
                const list: Client[] = cs.docs.map((d) => {
                    const data: any = d.data();
                    return {
                        id: d.id,
                        name: data.name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        avatarUrl: data.avatarUrl || '',
                        category: (data.category as ClientCategory) || ClientCategory.New,
                        totalSpent: Number(data.totalSpent) || 0,
                        avgTicket: Number(data.avgTicket) || 0,
                        totalAppointments: Number(data.totalAppointments) || 0,
                        lastVisit: data.lastVisit instanceof Timestamp ? data.lastVisit.toDate() : (data.lastVisit ? new Date(data.lastVisit) : new Date()),
                    } as Client;
                });
                setClients(list);
            } catch {}
        })();

        return () => {
            expensesUnsub();
            apptUnsub();
            settingsUnsub();
        };
    }, [user?.uid]);

    const { receitaRealizada, aReceber, contasAReceber } = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
    let realizada: number = 0;
    let receber: number = 0;
        const contas: (Appointment & { derivedPaymentStatus: AppointmentPaymentStatus })[] = [];
    
        const finishedAppointmentsThisMonth = appointments.filter(app => {
            const appDate = new Date(app.dateTime);
            return app.status === AppointmentStatus.Finished &&
                   appDate.getMonth() === currentMonth &&
                   appDate.getFullYear() === currentYear;
        });
    
        finishedAppointmentsThisMonth.forEach(app => {
            if (app.paymentStatus === AppointmentPaymentStatus.Pago) {
                realizada += Number(app.price) || 0;
            } else {
                receber += Number(app.price) || 0;
                // Overdue unpaid appointments should be shown as 'Pendente' (pending payment) in the UI
                const derivedPaymentStatus = AppointmentPaymentStatus.Pendente;
                contas.push({ ...app, derivedPaymentStatus });
            }
        });
    
        return { receitaRealizada: realizada, aReceber: receber, contasAReceber: contas.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()) };
    }, [appointments]);
    
    const totalExpenses = useMemo(() => expenses.reduce((acc, exp) => acc + exp.amount, 0), [expenses]);
    const netProfit = receitaRealizada - totalExpenses;

    const expenseByCategory = useMemo(() => {
        const categoryMap = expenses.reduce((acc, expense) => {
            if (!acc[expense.category]) {
                acc[expense.category] = 0;
            }
            acc[expense.category] += expense.amount;
            return acc;
        }, {} as { [key in ExpenseCategory]: number });
        
        return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    }, [expenses]);

    const servicePerformance = useMemo(() => {
        const finishedAppointments = appointments.filter(
            (app) => app.status === AppointmentStatus.Finished
        );

    const totalFinishedRevenue = finishedAppointments.reduce((sum: number, app) => sum + (Number(app.price) || 0), 0);

        if (totalFinishedRevenue === 0) return [];

        const revenueByService = finishedAppointments.reduce((acc, app) => {
            if (!acc[app.service]) {
                acc[app.service] = 0;
            }
            acc[app.service] += Number(app.price) || 0;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(revenueByService)
            .map(([name, revenue]) => {
                const rev = Number(revenue) || 0;
                return {
                    name,
                    revenue: rev,
                    percentage: totalFinishedRevenue > 0 ? (rev / totalFinishedRevenue) * 100 : 0,
                };
            })
            .sort((a, b) => b.revenue - a.revenue);
    }, [appointments]);

    const openModal = (expense: Expense | null) => {
        setEditingExpense(expense);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
    };

    const handleSaveExpense = async (expense: Omit<Expense, 'id' | 'date'> & { id?: string; date: string }) => {
        if (!user) return;
        try {
            if (editingExpense && expense.id) {
                const ref = doc(db, 'users', user.uid, 'expenses', expense.id);
                await updateDoc(ref, {
                    description: expense.description,
                    category: expense.category,
                    amount: Number(expense.amount),
                    date: Timestamp.fromDate(new Date(expense.date)),
                    updatedAt: serverTimestamp(),
                } as any);
            } else {
                await addDoc(collection(db, 'users', user.uid, 'expenses'), {
                    description: expense.description,
                    category: expense.category,
                    amount: Number(expense.amount),
                    date: Timestamp.fromDate(new Date(expense.date)),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                } as any);
            }
            closeModal();
        } catch (e) {
            alert('Não foi possível salvar a despesa.');
        }
    };
    
    const handleDeleteExpense = async (expenseId: string) => {
        if (!user) return;
        if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'expenses', expenseId));
            } catch (e) {
                alert('Falha ao excluir a despesa.');
            }
        }
    };

    const handleMarkAsPaid = async (appointmentId: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'appointments', appointmentId), { paymentStatus: AppointmentPaymentStatus.Pago } as any);
        } catch (e) {
            alert('Não foi possível marcar como pago.');
        }
    };

    // Monthly chart data from actuals (last 4 months including current)
    const monthlyChartData = useMemo(() => {
        const now = new Date();
        const buckets: { [key: string]: { year: number; month: number; receita: number; despesas: number } } = {};
        for (let i = 3; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            buckets[key] = { year: d.getFullYear(), month: d.getMonth(), receita: 0, despesas: 0 };
        }
        appointments.forEach((app) => {
            if (app.status !== AppointmentStatus.Finished || app.paymentStatus !== AppointmentPaymentStatus.Pago) return;
            const d = new Date(app.dateTime);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (buckets[key]) buckets[key].receita += Number(app.price) || 0;
        });
        expenses.forEach((exp) => {
            const d = new Date(exp.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (buckets[key]) buckets[key].despesas += exp.amount;
        });
        return Object.values(buckets).map((b) => ({ name: MONTHS[b.month], Receita: b.receita, Despesas: b.despesas }));
    }, [appointments, expenses]);
    
    const handleGenerateForecast = async () => {
        setIsForecasting(true);
        setForecastResult(null);
        setForecastError(null);
        try {
            const resultString = await generateFinancialForecast(monthlyChartData);
            if (resultString && resultString.trim().startsWith('{')) {
                const result = JSON.parse(resultString);
                if (result.forecastValue && result.analysis) {
                    setForecastResult({ value: result.forecastValue, analysis: result.analysis });
                } else {
                     setForecastError("A IA retornou um formato de dados inesperado.");
                }
            } else {
                setForecastError(resultString || "A resposta da IA não foi um JSON válido.");
            }
        } catch (error) {
            console.error("Error generating forecast:", error);
            setForecastError("Falha ao analisar a resposta da IA. O formato pode estar incorreto.");
        } finally {
            setIsForecasting(false);
        }
    };

    const handleGenerateSuggestions = async () => {
        setIsGeneratingSuggestions(true);
        setAiError('');
        setAiSuggestions(null);
        setIsSuggestionModalOpen(true);

        try {
            const resultString = await generateGoalAchievementStrategies(monthlyGoal, receitaRealizada, servicePerformance, clients);
            if (resultString && resultString.trim().startsWith('{')) {
                const result = JSON.parse(resultString);
                if (result.suggestions && Array.isArray(result.suggestions)) {
                    setAiSuggestions(result.suggestions);
                } else {
                    setAiError("A IA retornou sugestões em um formato inesperado.");
                }
            } else {
                setAiError("A IA retornou uma resposta inválida.");
            }
        } catch (error) {
            console.error("Error generating goal suggestions:", error);
            setAiError("Ocorreu um erro ao buscar sugestões. Tente novamente.");
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestão Financeira</h1>
    {isLoading && <p className="text-sm text-gray-500">Carregando dados financeiros...</p>}

      {hasAccess('finance.strategies') ? (
            <GoalProgressCard 
              goal={monthlyGoal} 
              current={receitaRealizada}
              onEdit={() => setIsGoalModalOpen(true)}
              onGenerateSuggestions={handleGenerateSuggestions}
            />
        ) : (
             <GoalProgressCardLocked
                goal={monthlyGoal} 
                current={receitaRealizada}
                onEdit={() => setIsGoalModalOpen(true)}
             />
        )}


      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Receita Realizada (Mês)" value={`R$ ${receitaRealizada.toFixed(2)}`} icon={<DollarSign className="h-6 w-6 text-white"/>} color="bg-green-500" />
        <MetricCard title="A Receber (Pendente)" value={`R$ ${aReceber.toFixed(2)}`} icon={<AlertTriangle className="h-6 w-6 text-white"/>} color="bg-yellow-500" />
        <MetricCard title="Despesas Totais (Mês)" value={`R$ ${totalExpenses.toFixed(2)}`} icon={<DollarSign className="h-6 w-6 text-white"/>} color="bg-red-500" />
        <MetricCard title="Lucro Líquido (Mês)" value={`R$ ${netProfit.toFixed(2)}`} icon={<TrendingUp className="h-6 w-6 text-white"/>} color="bg-blue-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Receita vs. Despesas (Últimos 4 Meses)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
              <YAxis tick={{ fill: '#9ca3af' }} tickFormatter={(value) => `R$${value/1000}k`} />
              <Tooltip cursor={{fill: 'rgba(128, 128, 128, 0.1)'}} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem' }} />
              <Legend />
              <Bar dataKey="Receita" fill="#4ade80" name="Receita" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#f87171" name="Despesas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Análise de Gastos por Categoria</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x  = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                return (
                  <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                );
              }}>
                {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem' }}/>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Contas a Receber */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Contas a Receber (Mês Atual)</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Cliente</th>
                            <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Serviço</th>
                            <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Data</th>
                            <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Status Pag.</th>
                            <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400 text-right">Valor</th>
                            <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contasAReceber.length > 0 ? contasAReceber.map(app => (
                            <tr key={app.id} className="border-b border-gray-100 dark:border-gray-700/50">
                                <td className="p-3 font-medium text-gray-800 dark:text-white">{app.clientName}</td>
                                <td className="p-3 text-gray-600 dark:text-gray-300">{app.service}</td>
                                <td className="p-3 text-gray-600 dark:text-gray-300">{new Date(app.dateTime).toLocaleDateString('pt-BR')}</td>
                                <td className="p-3"><PaymentStatusBadge status={app.derivedPaymentStatus} /></td>
                                <td className="p-3 text-gray-800 dark:text-white font-mono text-right">R$ {app.price.toFixed(2)}</td>
                                <td className="p-3 text-center">
                                    <button
                                        onClick={() => handleMarkAsPaid(app.id)}
                                        className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-semibold py-1 px-3 rounded-full text-xs hover:bg-green-200 dark:hover:bg-green-900 flex items-center justify-center space-x-1.5"
                                    >
                                        <Check className="h-4 w-4"/>
                                        <span>Marcar como Pago</span>
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center p-8 text-gray-500 dark:text-gray-400">
                                    Nenhuma conta a receber para este mês.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      {/* Expenses List */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Histórico de Despesas</h2>
            <button onClick={() => openModal(null)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>Adicionar Despesa</span>
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Descrição</th>
                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Categoria</th>
                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">Data</th>
                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400 text-right">Valor</th>
                        <th className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map(expense => (
                        <tr key={expense.id} className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="p-3 text-gray-800 dark:text-white">{expense.description}</td>
                            <td className="p-3"><span className="px-2 py-1 text-xs font-semibold rounded-full" style={{backgroundColor: `${categoryColors[expense.category]}20`, color: categoryColors[expense.category]}}>{expense.category}</span></td>
                            <td className="p-3 text-gray-600 dark:text-gray-300">{expense.date.toLocaleDateString('pt-BR')}</td>
                            <td className="p-3 text-gray-800 dark:text-white font-mono text-right">R$ {expense.amount.toFixed(2)}</td>
                            <td className="p-3 text-center">
                                <button onClick={() => openModal(expense)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500"><Edit className="h-4 w-4"/></button>
                                <button onClick={() => handleDeleteExpense(expense.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-500"><Trash className="h-4 w-4"/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
      
      {/* Service Performance Analysis */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
              <Wrench className="h-6 w-6 mr-3 text-indigo-500"/>
              Performance de Receita por Serviço
          </h2>
          {servicePerformance.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                  <ResponsiveContainer width="100%" height={250}>
                      <BarChart layout="vertical" data={servicePerformance} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255, 255, 255, 0.1)" />
                          <XAxis type="number" tick={{ fill: '#9ca3af' }} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'dataMax + 100']} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                          <Tooltip
                              cursor={{fill: 'rgba(128, 128, 128, 0.1)'}}
                              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem' }}
                              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                          />
                          <Bar dataKey="revenue" name="Receita" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                  {servicePerformance.map((service, index) => (
                      <div key={index}>
                          <div className="flex justify-between items-center mb-1 text-sm">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{service.name}</span>
                              <span className="font-semibold text-gray-800 dark:text-white">R$ {service.revenue.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                              <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${service.percentage}%` }} title={`${service.percentage.toFixed(1)}%`}></div>
                          </div>
                          <p className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">{service.percentage.toFixed(1)}% da receita total</p>
                      </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum agendamento finalizado encontrado para analisar a performance.</p>
          )}
      </div>

       {/* AI Forecast */}
       {hasAccess('finance.forecast') ? (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-dashed border-indigo-400/50">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center">
                    <Sparkles className="h-6 w-6 mr-2 text-indigo-500"/>
                    Previsão de Faturamento com IA
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">Utilize a IA Gemini para analisar seus dados históricos e prever o faturamento do próximo mês.</p>
                <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700/50 p-8 rounded-lg min-h-[180px]">
                    {isForecasting ? (
                        <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                            <Loader className="h-8 w-8 animate-spin mb-2" />
                            <p>Analisando dados e gerando previsão...</p>
                        </div>
                    ) : forecastResult ? (
                        <div className="text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Previsão para o próximo mês:</p>
                            <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 my-2">
                                R$ {forecastResult.value.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{forecastResult.analysis}"</p>
                        </div>
                    ) : forecastError ? (
                         <p className="text-center text-red-500">{forecastError}</p>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center">Clique no botão abaixo para gerar uma previsão de faturamento usando IA.</p>
                    )}
                    
                    <button 
                        onClick={handleGenerateForecast} 
                        disabled={isForecasting} 
                        className="mt-6 bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                        {isForecasting ? (
                            <>
                                <Loader className="h-5 w-5 animate-spin" />
                                <span>Gerando...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5" />
                                <span>{forecastResult ? 'Gerar Novamente' : 'Gerar Previsão'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
       ) : (
            <LockedWidget featureName="Previsão de Faturamento com IA" />
       )}
      
      {isModalOpen && <ExpenseModal expense={editingExpense} onSave={handleSaveExpense} onClose={closeModal} />}
      {isGoalModalOpen && <GoalModal currentGoal={monthlyGoal} onSave={async (g) => {
            setMonthlyGoal(g);
            if (user) {
                try {
                    await setDoc(doc(db, 'users', user.uid, 'finance', 'settings'), { monthlyGoal: g, updatedAt: serverTimestamp() } as any, { merge: true });
                } catch {}
            }
        }} onClose={() => setIsGoalModalOpen(false)} />}
      {isSuggestionModalOpen && <SuggestionModal isLoading={isGeneratingSuggestions} suggestions={aiSuggestions} error={aiError} onClose={() => setIsSuggestionModalOpen(false)} />}
    </div>
  );
};


const MetricCard: React.FC<{title: string; value: string; icon: React.ReactNode; color: string;}> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4 transition-transform hover:scale-105">
    <div className={`p-3 rounded-full ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
    </div>
  </div>
);

const GoalProgressCard: React.FC<{ goal: number; current: number; onEdit: () => void; onGenerateSuggestions: () => void; }> = ({ goal, current, onEdit, onGenerateSuggestions }) => {
    const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    const isGoalMet = current >= goal;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                         <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Meta de Faturamento Mensal</h2>
                         <button onClick={onEdit} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200">
                            <Edit className="h-4 w-4" />
                         </button>
                    </div>
                    <p className={`mt-2 text-2xl font-bold ${isGoalMet ? 'text-green-500' : 'text-gray-800 dark:text-white'}`}>
                        {`R$ ${current.toFixed(2)}`}
                        <span className="text-lg font-medium text-gray-500 dark:text-gray-400"> / R$ {goal.toFixed(2)}</span>
                    </p>
                </div>
                <button onClick={onGenerateSuggestions} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2">
                    <Sparkles className="h-5 w-5"/>
                    <span>Como atingir minha meta?</span>
                </button>
            </div>
            <div className="mt-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                        className={`h-4 rounded-full transition-all duration-500 ${isGoalMet ? 'bg-green-500' : 'bg-indigo-600'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-right text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{progress.toFixed(1)}%</p>
            </div>
        </div>
    );
};

const GoalProgressCardLocked: React.FC<{ goal: number; current: number; onEdit: () => void; }> = ({ goal, current, onEdit }) => {
    const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    const isGoalMet = current >= goal;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                         <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Meta de Faturamento Mensal</h2>
                         <button onClick={onEdit} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200">
                            <Edit className="h-4 w-4" />
                         </button>
                    </div>
                    <p className={`mt-2 text-2xl font-bold ${isGoalMet ? 'text-green-500' : 'text-gray-800 dark:text-white'}`}>
                        {`R$ ${current.toFixed(2)}`}
                        <span className="text-lg font-medium text-gray-500 dark:text-gray-400"> / R$ {goal.toFixed(2)}</span>
                    </p>
                </div>
                 <div className="relative group">
                    <button disabled className="bg-gray-300 text-gray-500 font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 cursor-not-allowed">
                        <Lock className="h-5 w-5"/>
                        <span>Como atingir minha meta?</span>
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100 z-20 origin-bottom">
                        Disponível no Plano Avançado
                    </span>
                </div>
            </div>
            <div className="mt-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                        className={`h-4 rounded-full transition-all duration-500 ${isGoalMet ? 'bg-green-500' : 'bg-indigo-600'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <p className="text-right text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{progress.toFixed(1)}%</p>
            </div>
        </div>
    );
};


// New GoalModal component
const GoalModal: React.FC<{ currentGoal: number; onSave: (newGoal: number) => void; onClose: () => void; }> = ({ currentGoal, onSave, onClose }) => {
    const [goal, setGoal] = useState(currentGoal);

    const handleSave = () => {
        if (goal > 0) {
            onSave(goal);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Definir Meta de Faturamento</h2>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">R$</span>
                    <input
                        type="number"
                        value={goal}
                        onChange={(e) => setGoal(Number(e.target.value))}
                        className="w-full p-2 pl-8 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                        min="1"
                    />
                </div>
                 <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600">Cancelar</button>
                    <button onClick={handleSave} className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold">Salvar Meta</button>
                </div>
            </div>
        </div>
    );
};

// New SuggestionModal component
const SuggestionModal: React.FC<{ isLoading: boolean; suggestions: string[] | null; error: string; onClose: () => void; }> = ({ isLoading, suggestions, error, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center"><Sparkles className="h-6 w-6 mr-2 text-indigo-500"/> Sugestões da IA</h2>
                <div className="min-h-[200px] flex flex-col justify-center">
                    {isLoading && (
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <Loader className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p>Analisando seus dados para criar as melhores estratégias...</p>
                        </div>
                    )}
                    {error && !isLoading && (
                        <div className="text-center text-red-500">{error}</div>
                    )}
                    {suggestions && !isLoading && (
                        <ul className="space-y-3">
                            {suggestions.map((s, i) => (
                                <li key={i} className="flex items-start p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                                    <Lightbulb className="h-5 w-5 mr-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{s}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="py-2 px-6 rounded-lg bg-indigo-600 text-white font-semibold">Fechar</button>
                </div>
            </div>
        </div>
    );
};

interface ExpenseModalProps {
    expense: Expense | null;
    onSave: (expense: Omit<Expense, 'id' | 'date'> & { id?: string, date: string }) => void;
    onClose: () => void;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ expense, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        id: expense?.id,
        description: expense?.description || '',
        category: expense?.category || ExpenseCategory.Outros,
        amount: expense?.amount || 0,
        date: expense?.date.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                        {expense ? 'Editar Despesa' : 'Adicionar Nova Despesa'}
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                            <input type="text" name="description" id="description" value={formData.description} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
                                <input type="number" name="amount" id="amount" step="0.01" value={formData.amount} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                            </div>
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                                <input type="date" name="date" id="date" value={formData.date} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                            </div>
                        </div>
                         <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                            <select name="category" id="category" value={formData.category} onChange={handleChange} className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                                {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancelar</button>
                        <button type="submit" className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export default Finance;