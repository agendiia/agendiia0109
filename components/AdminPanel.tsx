import React, { useState, useEffect } from 'react';
import { PlatformUser, Coupon, PlatformTransaction, ErrorLog, PlatformSettings, UserStatus, PaymentStatus, LogLevel, SubscriptionPlan, AuditLog, PlatformMetrics, RevenueMetrics, UserGrowthMetrics, UsageMetrics, ConversionMetrics, AppointmentMetrics } from '../types';
import { db } from '@/services/firebase';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Shield, LayoutDashboard, Users, DollarSign, TicketPercent, Settings, AlertTriangle, Bell, Plus, Trash, Edit, Send, CheckSquare, Calendar, Plug, CreditCard, MercadoPagoLogo, FileClock, ListChecks, Check, Ban, Archive, X, TrendingUp, Clock, FileText } from './Icons';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import Automations from './Automations';
import ResourceManagement from './ResourceManagement';
import ContentManagement from './ContentManagement';

// Dados agora virão do Firestore em tempo real

// Tooltip Maps
const userStatusTooltips: { [key in UserStatus]: string } = {
    [UserStatus.Active]: "O usuário tem acesso normal à plataforma.",
    [UserStatus.Suspended]: "O acesso do usuário à plataforma foi temporariamente bloqueado.",
};

const paymentStatusTooltips: { [key in PaymentStatus]: string } = {
    [PaymentStatus.Paid]: "Pagamento recebido e confirmado com sucesso.",
    [PaymentStatus.Pending]: "Pagamento aguardando confirmação ou processamento.",
    [PaymentStatus.Failed]: "A tentativa de pagamento falhou.",
};

const couponAndGeneralStatusTooltips: { [key: string]: string } = {
    'Ativo': 'O cupom/item está ativo e pode ser utilizado.',
    'Inativo': 'O cupom/item está inativo e não pode mais ser utilizado.',
};


type AdminTab = 'dashboard' | 'analytics' | 'users' | 'transactions' | 'coupons' | 'settings' | 'automations' | 'logs' | 'communication' | 'gateways' | 'plans' | 'audit' | 'resources' | 'content';

interface MercadoPagoSettings { publicKey: string; accessToken: string; isConnected: boolean; }

// Main Component (modern layout)
const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [globalSearch, setGlobalSearch] = useState('');
    const [isDark, setIsDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));
    // Functions instance for audit logging of admin actions
    const functions = React.useMemo(()=>getFunctions(), []);
    const callRecordAction = React.useMemo(()=> httpsCallable(functions, 'recordAdminAction'), [functions]);

    const toggleTheme = () => {
        const root = document.documentElement;
        if (root.classList.contains('dark')) {
            root.classList.remove('dark');
            setIsDark(false);
            localStorage.setItem('theme','light');
        } else {
            root.classList.add('dark');
            setIsDark(true);
            localStorage.setItem('theme','dark');
        }
    };

    useEffect(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark') {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
    }, []);

    // State Management for sub-components
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
    const [userActionStatus, setUserActionStatus] = useState('');

    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [couponActionStatus, setCouponActionStatus] = useState('');

    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

    const [settings, setSettings] = useState<PlatformSettings>({ enableRegistrations: true, maintenanceMode: false, defaultPlan: 'Profissional', trialDays: 14 });
    const [settingsSaveStatus, setSettingsSaveStatus] = useState('');

    const [mercadoPagoSettings, setMercadoPagoSettings] = useState<MercadoPagoSettings>({ publicKey: '', accessToken: '', isConnected: false });
    const [gatewaySaveStatus, setGatewaySaveStatus] = useState('');

    const [commStatus, setCommStatus] = useState('');

    const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);

    // Analytics state
    const [analyticsData, setAnalyticsData] = useState<{
        platformMetrics: PlatformMetrics | null;
        revenueMetrics: RevenueMetrics | null;
        userGrowthMetrics: UserGrowthMetrics | null;
        usageMetrics: UsageMetrics | null;
        conversionMetrics: ConversionMetrics | null;
        appointmentMetrics: AppointmentMetrics | null;
    }>({
        platformMetrics: null,
        revenueMetrics: null,
        userGrowthMetrics: null,
        usageMetrics: null,
        conversionMetrics: null,
        appointmentMetrics: null,
    });
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState('30d');

    // Load analytics data
    const loadAnalyticsData = async () => {
        setAnalyticsLoading(true);
        setAnalyticsError('');
        try {
            const functions = getFunctions();
            const getAnalytics = httpsCallable(functions, 'getPlatformAnalytics');
            const result = await getAnalytics({ period: selectedPeriod });
            const data = result.data as any;
            
            setAnalyticsData({
                platformMetrics: data.platformMetrics,
                revenueMetrics: data.revenueMetrics,
                userGrowthMetrics: data.userGrowthMetrics,
                usageMetrics: data.usageMetrics,
                conversionMetrics: data.conversionMetrics,
                appointmentMetrics: data.appointmentMetrics,
            });
        } catch (error: any) {
            setAnalyticsError(error.message || 'Erro ao carregar analytics');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    // Load analytics data when period changes
    useEffect(() => {
        if (activeTab === 'analytics') {
            loadAnalyticsData();
        }
    }, [selectedPeriod, activeTab]);

    // --- Handlers ---
    const showTemporaryMessage = (setter: React.Dispatch<React.SetStateAction<string>>, message: string) => {
        setter(message);
        setTimeout(() => setter(''), 4000);
    };

    // User Handlers
    const handleOpenUserModal = (user: PlatformUser | null) => { setEditingUser(user); setIsUserModalOpen(true); };
    const handleSaveUser = async (userToSave: PlatformUser) => {
        try {
            const functions = getFunctions();
            const callUpdateUser = httpsCallable(functions, 'updatePlatformUser');
            await callUpdateUser({ 
                userId: userToSave.id,
                userData: {
                    name: userToSave.name,
                    email: userToSave.email,
                    plan: userToSave.plan,
                    status: userToSave.status
                }
            });
            showTemporaryMessage(setUserActionStatus, 'Usuário salvo com sucesso.');
        } catch (error: any) {
            console.error('Erro ao salvar usuário:', error);
            showTemporaryMessage(setUserActionStatus, `Falha ao salvar usuário: ${error.message || 'Erro desconhecido'}`);
        }
        setIsUserModalOpen(false);
    };
    const handleToggleUserStatus = async (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const newStatus = user.status === UserStatus.Active ? UserStatus.Suspended : UserStatus.Active;
        if (window.confirm(`Tem certeza que deseja alterar o status de ${user.name} para "${newStatus}"?`)) {
            try {
                const functions = getFunctions();
                const callToggleStatus = httpsCallable(functions, 'toggleUserStatus');
                await callToggleStatus({ userId });
                showTemporaryMessage(setUserActionStatus, `Status de ${user.name} alterado para ${newStatus}.`);
                // Audit log
                try { await callRecordAction({ action: 'USER_STATUS_CHANGE', details: `User ${user.email} -> ${newStatus}` }); } catch {}
            } catch (error: any) {
                console.error('Erro ao alterar status:', error);
                showTemporaryMessage(setUserActionStatus, `Falha ao alterar status: ${error.message || 'Erro desconhecido'}`);
            }
        }
    };
    const handleDeleteUser = async (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        if (window.confirm(`ATENÇÃO: Esta ação é irreversível. Tem certeza que deseja excluir permanentemente o usuário ${user.name}? Todos os dados relacionados (agendamentos, transações) também serão removidos.`)) {
            try {
                const functions = getFunctions();
                const callDeleteUser = httpsCallable(functions, 'deletePlatformUser');
                await callDeleteUser({ userId });
                showTemporaryMessage(setUserActionStatus, `Usuário ${user.name} excluído com sucesso.`);
            } catch (error: any) {
                console.error('Erro ao excluir usuário:', error);
                showTemporaryMessage(setUserActionStatus, `Falha ao excluir usuário: ${error.message || 'Erro desconhecido'}`);
            }
        }
    };

    // Coupon Handlers
    const handleOpenCouponModal = (coupon: Coupon | null) => { setEditingCoupon(coupon); setIsCouponModalOpen(true); };
    const handleSaveCoupon = async (couponToSave: Coupon) => {
        try {
            if (couponToSave.id) {
                await updateDoc(doc(db, 'platform_coupons', couponToSave.id), {
                    code: couponToSave.code,
                    discountPercent: couponToSave.discountPercent,
                    expiresAt: Timestamp.fromDate(new Date(couponToSave.expiresAt)),
                    isActive: couponToSave.isActive,
                    maxUses: couponToSave.maxUses ?? null,
                    updatedAt: serverTimestamp(),
                } as any);
            } else {
                await addDoc(collection(db, 'platform_coupons'), {
                    code: couponToSave.code,
                    discountPercent: couponToSave.discountPercent,
                    expiresAt: Timestamp.fromDate(new Date(couponToSave.expiresAt)),
                    isActive: true,
                    timesUsed: 0,
                    maxUses: couponToSave.maxUses ?? null,
                    createdAt: serverTimestamp(),
                } as any);
            }
            setIsCouponModalOpen(false);
            showTemporaryMessage(setCouponActionStatus, 'Cupom salvo.');
        } catch {
            showTemporaryMessage(setCouponActionStatus, 'Falha ao salvar cupom.');
        }
    };
    const handleDeleteCoupon = async (couponId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este cupom?')) {
            try {
                await deleteDoc(doc(db, 'platform_coupons', couponId));
                showTemporaryMessage(setCouponActionStatus, 'Cupom excluído.');
            } catch {
                showTemporaryMessage(setCouponActionStatus, 'Falha ao excluir cupom.');
            }
        }
    };

    // Plan Handlers
    const handleOpenPlanModal = (plan: SubscriptionPlan | null) => { setEditingPlan(plan); setIsPlanModalOpen(true); };
    const handleSavePlan = async (planToSave: SubscriptionPlan) => {
        try {
            if (planToSave.id) {
                await updateDoc(doc(db, 'platform_plans', planToSave.id), {
                    name: planToSave.name,
                    price: planToSave.price,
                    features: planToSave.features,
                    isAdvanced: !!planToSave.isAdvanced,
                    limits: planToSave.limits || {},
                    priceId: planToSave.priceId || null,
                    updatedAt: serverTimestamp(),
                } as any);
            } else {
                await addDoc(collection(db, 'platform_plans'), {
                    name: planToSave.name,
                    price: planToSave.price,
                    features: planToSave.features || [],
                    isAdvanced: !!planToSave.isAdvanced,
                    isArchived: false,
                    limits: planToSave.limits || {},
                    priceId: planToSave.priceId || null,
                    createdAt: serverTimestamp(),
                } as any);
            }
            setIsPlanModalOpen(false);
        } catch {
            setIsPlanModalOpen(false);
        }
    };
    const handleArchivePlan = async (planId: string) => {
        if (window.confirm('Tem certeza que deseja arquivar este plano? Ele não poderá ser escolhido por novos assinantes.')) {
            try { await updateDoc(doc(db, 'platform_plans', planId), { isArchived: true, updatedAt: serverTimestamp() } as any); } catch {}
        }
    };
    
    // Settings Handlers
    const handleSaveSettings = async () => {
        try {
            await setDoc(doc(db, 'platform_settings'), {
                enableRegistrations: settings.enableRegistrations,
                maintenanceMode: settings.maintenanceMode,
                defaultPlan: settings.defaultPlan,
                trialDays: settings.trialDays,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            showTemporaryMessage(setSettingsSaveStatus, 'Configurações salvas com sucesso!');
        } catch {
            showTemporaryMessage(setSettingsSaveStatus, 'Falha ao salvar configurações.');
        }
    };

    // Data subscriptions & initial loads
    useEffect(() => {
        // Users
        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const list: PlatformUser[] = snap.docs.map((d) => {
                const data: any = d.data();
                const created = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
                return {
                    id: d.id,
                    name: data.name || data.displayName || 'Sem nome',
                    email: data.email || '',
                    plan: (data.plan || 'Profissional'),
                    status: (data.status as UserStatus) || UserStatus.Active,
                    joinDate: created,
                    totalRevenue: Number(data.totalRevenue) || 0,
                } as PlatformUser;
            });
            setUsers(list);
        }, () => setUsers([]));

        // Transactions
        const unsubTrx = onSnapshot(collection(db, 'platform_transactions'), (snap) => {
            const list: PlatformTransaction[] = snap.docs.map((d) => {
                const data: any = d.data();
                const ts = data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : new Date());
                return {
                    id: d.id,
                    userId: data.userId || '',
                    userName: data.userName || data.userEmail || 'Usuário',
                    description: data.description || '',
                    amount: Number(data.amount) || 0,
                    gateway: data.gateway || 'Desconhecido',
                    status: (data.status as PaymentStatus) || PaymentStatus.Pending,
                    date: ts,
                } as PlatformTransaction;
            });
            setTransactions(list);
        }, () => setTransactions([]));

        // Coupons
        const unsubCoupons = onSnapshot(collection(db, 'platform_coupons'), (snap) => {
            const list: Coupon[] = snap.docs.map((d) => {
                const data: any = d.data();
                const expires = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : new Date());
                return {
                    id: d.id,
                    code: data.code || '',
                    discountPercent: Number(data.discountPercent) || 0,
                    expiresAt: expires,
                    timesUsed: Number(data.timesUsed) || 0,
                    maxUses: data.maxUses ?? null,
                    isActive: data.isActive !== false,
                } as Coupon;
            });
            setCoupons(list);
        }, () => setCoupons([]));

        // Plans
        const unsubPlans = onSnapshot(collection(db, 'platform_plans'), (snap) => {
            const list: SubscriptionPlan[] = snap.docs.map((d) => {
                const data: any = d.data();
                return {
                    id: d.id,
                    name: data.name || '',
                    price: Number(data.price) || 0,
                    features: Array.isArray(data.features) ? data.features : [],
                    isAdvanced: !!data.isAdvanced,
                    isArchived: !!data.isArchived,
                } as SubscriptionPlan;
            });
            setPlans(list);
        }, () => setPlans([]));

        // Load platform settings
        const loadSettings = async () => {
            try {
                const snap = await getDoc(doc(db, 'platform_settings'));
                const data = snap.exists() ? (snap.data() as any) : null;
                if (data) {
                    setSettings({
                        enableRegistrations: !!data.enableRegistrations,
                        maintenanceMode: !!data.maintenanceMode,
                        defaultPlan: data.defaultPlan || 'Profissional',
                        trialDays: Number(data.trialDays) || 14,
                    });
                }
            } catch {}
        };
        loadSettings();

        // Load MP settings
    const loadMP = async () => {
            try {
        const snap = await getDoc(doc(db, 'platform_mercadopago'));
                if (snap.exists()) {
                    const data = snap.data() as any;
                    setMercadoPagoSettings({
                        publicKey: data.publicKey || '',
                        accessToken: data.accessToken || '',
                        isConnected: !!data.isConnected,
                    });
                }
            } catch {}
        };
        loadMP();

        return () => {
            unsubUsers();
            unsubTrx();
            unsubCoupons();
            unsubPlans();
        };
    }, []);

    const handleConnectGateway = async () => {
         if (mercadoPagoSettings.publicKey && mercadoPagoSettings.accessToken) {
            try {
                await setDoc(doc(db, 'platform_mercadopago'), {
                    publicKey: mercadoPagoSettings.publicKey,
                    accessToken: mercadoPagoSettings.accessToken,
                    isConnected: true,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                setMercadoPagoSettings(prev => ({ ...prev, isConnected: true }));
                showTemporaryMessage(setGatewaySaveStatus, 'Conexão com Mercado Pago estabelecida!');
            } catch {
                showTemporaryMessage(setGatewaySaveStatus, 'Erro ao salvar credenciais.');
            }
        } else {
            showTemporaryMessage(setGatewaySaveStatus, 'Erro: Preencha todos os campos.');
        }
    };

    // Communication Handler
    const handleSendCommunication = () => {
        if (window.confirm('Tem certeza que deseja enviar esta mensagem para todos os usuários?')) {
            showTemporaryMessage(setCommStatus, 'Mensagem enviada para a fila de envio!');
        }
    };

    // Global search filtering
    const term = globalSearch.trim().toLowerCase();
    const filteredUsers = term ? users.filter(u => [u.name, u.email, u.plan].some(f => f.toLowerCase().includes(term))) : users;
    const filteredTransactions = term ? transactions.filter(t => [t.id, t.userName, t.description, t.gateway, t.status].some(f => String(f).toLowerCase().includes(term))) : transactions;
    const filteredCoupons = term ? coupons.filter(c => [c.code, c.discountPercent, c.timesUsed].some(f => String(f).toLowerCase().includes(term))) : coupons;
    const filteredPlans = term ? plans.filter(p => [p.name, p.price].some(f => String(f).toLowerCase().includes(term))) : plans;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard': return <AdminDashboard users={filteredUsers} transactions={filteredTransactions} />;
            case 'analytics': return <AnalyticsPanel 
                data={analyticsData} 
                loading={analyticsLoading} 
                error={analyticsError}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                onRefresh={loadAnalyticsData}
            />;
            case 'users': return <UserManagement users={filteredUsers} onEdit={handleOpenUserModal} onToggleStatus={handleToggleUserStatus} onDelete={handleDeleteUser} statusMessage={userActionStatus} />;
            case 'transactions': return <TransactionManagement transactions={filteredTransactions} />;
            case 'coupons': return <CouponManagement coupons={filteredCoupons} onOpenModal={handleOpenCouponModal} onDelete={handleDeleteCoupon} statusMessage={couponActionStatus} />;
            case 'plans': return <SubscriptionPlanManagement plans={filteredPlans} onOpenModal={handleOpenPlanModal} onArchive={handleArchivePlan} />;
            case 'gateways': return <PaymentGatewaySettings settings={mercadoPagoSettings} setSettings={setMercadoPagoSettings} onConnect={handleConnectGateway} statusMessage={gatewaySaveStatus} />;
            case 'settings': return <PlatformSettingsManagement settings={settings} setSettings={setSettings} onSave={handleSaveSettings} statusMessage={settingsSaveStatus} />;
            case 'automations': return <Automations />;
            case 'audit': return <AuditLogViewer />;
            case 'logs': return <ErrorLogs />;
            case 'communication': return <MassCommunication onSend={handleSendCommunication} statusMessage={commStatus}/>;
            case 'resources': return <ResourceManagement />;
            case 'content': return <ContentManagement />;
            default: return <AdminDashboard users={users} transactions={transactions} />;
        }
    };

    const tabs: { id: AdminTab, label: string, icon: React.ReactNode }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5 mr-2" /> },
        { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-5 w-5 mr-2" /> },
        { id: 'users', label: 'Usuários', icon: <Users className="h-5 w-5 mr-2" /> },
        { id: 'transactions', label: 'Transações', icon: <DollarSign className="h-5 w-5 mr-2" /> },
        { id: 'plans', label: 'Planos', icon: <ListChecks className="h-5 w-5 mr-2" /> },
        { id: 'coupons', label: 'Cupons', icon: <TicketPercent className="h-5 w-5 mr-2" /> },
        { id: 'gateways', label: 'Gateways', icon: <CreditCard className="h-5 w-5 mr-2" /> },
        { id: 'automations', label: 'Automações', icon: <Plug className="h-5 w-5 mr-2" /> },
        { id: 'resources', label: 'Recursos', icon: <Shield className="h-5 w-5 mr-2" /> },
        { id: 'content', label: 'Conteúdo', icon: <FileText className="h-5 w-5 mr-2" /> },
        { id: 'settings', label: 'Configurações', icon: <Settings className="h-5 w-5 mr-2" /> },
        { id: 'audit', label: 'Logs de Auditoria', icon: <FileClock className="h-5 w-5 mr-2" /> },
        { id: 'logs', label: 'Logs de Erro', icon: <AlertTriangle className="h-5 w-5 mr-2" /> },
        { id: 'communication', label: 'Comunicação', icon: <Bell className="h-5 w-5 mr-2" /> },
    ];

    // Modern shell layout
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div 
                    onClick={() => setSidebarOpen(false)} 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden" 
                />
            )}
            
            {/* Sidebar */}
            <aside className={`
                fixed lg:static top-0 left-0 h-full w-72 
                bg-white dark:bg-gray-800 
                border-r border-gray-200 dark:border-gray-700 
                z-40 transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                flex flex-col
            `}>
                {/* Sidebar Header */}
                <div className="h-16 flex items-center px-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Shield className="h-7 w-7 text-indigo-600" />
                        <span className="font-extrabold text-lg bg-gradient-to-r from-indigo-600 to-pink-500 text-transparent bg-clip-text">Agendiia Admin</span>
                    </div>
                </div>
                
                {/* Sidebar Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Main">
                    <div>
                        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Navegação</p>
                        <ul className="space-y-1">
                            {tabs.map(tab => {
                                const active = activeTab === tab.id;
                                return (
                                    <li key={tab.id}>
                                        <button 
                                            onClick={() => { 
                                                setActiveTab(tab.id); 
                                                setSidebarOpen(false); 
                                            }} 
                                            className={`
                                                group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                                                ${active 
                                                    ? 'bg-indigo-600 text-white shadow-md' 
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                                } 
                                                relative
                                            `}
                                        >
                                            <span className={`flex items-center justify-center rounded-md ${active ? 'text-white' : 'text-indigo-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                                {tab.icon}
                                            </span>
                                            <span className="truncate">{tab.label}</span>
                                            {active && <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-gradient-to-b from-indigo-400 to-indigo-700" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </nav>
                
                {/* Sidebar Footer */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-700 text-white shadow-lg text-xs p-3">
                        <p className="font-semibold mb-1">Atalhos</p>
                        <div className="space-y-1 opacity-90">
                            <p><kbd className="px-1.5 py-0.5 bg-white/20 rounded">/</kbd> Buscar</p>
                            <p><kbd className="px-1.5 py-0.5 bg-white/20 rounded">T</kbd> Alternar tema</p>
                        </div>
                    </div>
                </div>
            </aside>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 lg:ml-0">
                {/* Header */}
                <header className="h-16 flex items-center gap-4 px-4 lg:px-8 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <button 
                        onClick={() => setSidebarOpen(true)} 
                        className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" 
                        aria-label="Abrir menu"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                        <div className="relative flex-1 hidden md:block max-w-md">
                            <input 
                                value={globalSearch} 
                                onChange={e => setGlobalSearch(e.target.value)} 
                                placeholder="Buscar usuários, transações, planos…" 
                                className="w-full h-10 pl-10 pr-4 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:placeholder:text-gray-400" 
                                aria-label="Busca global" 
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={toggleTheme} 
                                className="h-9 w-9 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition" 
                                title="Alternar tema"
                            >
                                {isDark ? (
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M21.64 13A9 9 0 0 1 11 2.36 1 1 0 0 0 9.72 3.6 7 7 0 1 0 20.4 14.28 1 1 0 0 0 21.64 13Z" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="5" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07-1.41-1.41M6.46 6.46 5.05 5.05m12.02 0 1.41 1.41M6.46 17.54l-1.41 1.41" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </header>
                
                {/* Main Content Area */}
                <main className="flex-1 px-4 lg:px-8 py-6 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Page Header */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Gerencie recursos e configurações da plataforma.
                                </p>
                            </div>
                            {globalSearch && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Filtro ativo: <strong>{globalSearch}</strong>
                                </span>
                            )}
                        </div>
                        
                        {/* Content Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[400px]">
                            {renderTabContent()}
                        </div>
                    </div>
                </main>
            </div>
            
            {/* Modals */}
            {isUserModalOpen && <UserModal user={editingUser} onSave={handleSaveUser} onClose={() => setIsUserModalOpen(false)} />}
            {isCouponModalOpen && <CouponModal coupon={editingCoupon} onSave={handleSaveCoupon} onClose={() => setIsCouponModalOpen(false)} />}
            {isPlanModalOpen && <PlanModal plan={editingPlan} onSave={handleSavePlan} onClose={() => setIsPlanModalOpen(false)} />}
        </div>
    );
};


// #region Sub-components
const AdminDashboard: React.FC<{ users: PlatformUser[]; transactions: PlatformTransaction[] }> = ({ users, transactions }) => {
    const totalUsers = users.length;
    const activeSubscriptions = users.filter(u => u.status === UserStatus.Active && u.plan !== 'Trial').length;
    const totalRevenue = transactions.reduce((acc, t) => acc + (t.status === PaymentStatus.Paid ? t.amount : 0), 0);
    const totalAppointments = 0; // pode ser preenchido com agregação futura

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total de Usuários" value={String(totalUsers)} icon={<Users className="h-6 w-6 text-white"/>} color="bg-blue-500" />
            <MetricCard title="Assinaturas Ativas" value={String(activeSubscriptions)} icon={<CheckSquare className="h-6 w-6 text-white"/>} color="bg-green-500" />
            <MetricCard title="Receita Total (Mês)" value={`R$ ${totalRevenue.toFixed(2)}`} icon={<DollarSign className="h-6 w-6 text-white"/>} color="bg-purple-500" />
            <MetricCard title="Total de Agendamentos (Mês)" value={String(totalAppointments)} icon={<Calendar className="h-6 w-6 text-white"/>} color="bg-yellow-500" />
        </div>
    );
};

const UserManagement: React.FC<{ users: PlatformUser[], onEdit: (user: PlatformUser) => void, onToggleStatus: (userId: string) => void, onDelete: (userId: string) => void, statusMessage: string }> = ({ users, onEdit, onToggleStatus, onDelete, statusMessage }) => {
    const [orderBy, setOrderBy] = useState<'name' | 'plan' | 'joinDate' | 'revenue'>('joinDate');
    const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
    const [filterStatus, setFilterStatus] = useState<'Todos' | UserStatus>('Todos');
    const [filterPlan, setFilterPlan] = useState<'Todos' | 'Trial' | 'Profissional' | 'Avançado'>('Todos');
    const [filterVerified, setFilterVerified] = useState<'Todos' | 'Verificado' | 'Não Verificado'>('Todos');
    // ...existing code...
    const [actionMsg, setActionMsg] = useState<string>('');

    // Initialize Firebase services with error handling
    const functions = React.useMemo(() => {
        try {
            return getFunctions();
        } catch (error) {
            console.error('Erro ao inicializar Firebase Functions:', error);
            return null;
        }
    }, []);

    const callRecordActionUM = React.useMemo(() => {
        if (!functions) return null;
        try {
            return httpsCallable(functions, 'recordAdminAction');
        } catch (error) {
            console.error('Erro ao criar callable recordAdminAction:', error);
            return null;
        }
    }, [functions]);

    // Callable to force password reset for a platform user
    const callForceReset = React.useMemo(() => {
        if (!functions) return null;
        try {
            return httpsCallable(functions, 'forcePasswordReset');
        } catch (error) {
            console.error('Erro ao criar callable forcePasswordReset:', error);
            return null;
        }
    }, [functions]);

    const sorted = [...users]
        .filter(u => (filterStatus === 'Todos' || u.status === filterStatus))
        .filter(u => (filterPlan === 'Todos' || u.plan === filterPlan))
        .filter(u => (filterVerified === 'Todos' || (filterVerified === 'Verificado' ? u.emailVerified : !u.emailVerified)))
        .sort((a,b) => {
            let va: any; let vb: any;
            switch (orderBy) {
                case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
                case 'plan': va = a.plan; vb = b.plan; break;
                case 'revenue': va = a.totalRevenue; vb = b.totalRevenue; break;
                default: va = a.joinDate.getTime(); vb = b.joinDate.getTime();
            }
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return direction === 'asc' ? cmp : -cmp;
        });

    const toggleSort = (col: typeof orderBy) => {
        if (orderBy === col) {
            setDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setOrderBy(col);
            setDirection('asc');
        }
    };

    // Impersonation action removed from admin UI per request.

    const forceReset = async (uid: string) => {
        if (!callForceReset) {
            setActionMsg('❌ Função de reset de senha não disponível. Verifique a conexão com Firebase Functions.');
            return;
        }

        if (!window.confirm('Forçar redefinição de senha? O usuário precisará criar nova.')) return;
        try { 
            await callForceReset({ userId: uid }); 
            setActionMsg('✅ Reset de senha forçado com sucesso. O usuário precisará redefinir a senha no próximo login.'); 
            // Audit log
            try { 
                if (callRecordActionUM) {
                    await callRecordActionUM({ action: 'FORCE_PASSWORD_RESET', details: `Forced password reset for userId=${uid}` }); 
                }
            } catch {}
        } catch (error: any) { 
            console.error('Erro ao forçar reset:', error);
            setActionMsg(`❌ Falha ao forçar reset: ${error.message || 'Erro desconhecido'}`); 
        }
    };

    return (
        <div className="space-y-4">
            {(statusMessage || actionMsg) && <div className="mb-2 p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-semibold flex justify-between"><span>{statusMessage || actionMsg}</span><button onClick={()=>setActionMsg('')} className="text-indigo-500">x</button></div>}
            <div className="flex flex-wrap gap-2 items-end">
                <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500">Status</label>
                    <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)} className="h-9 bg-gray-100 dark:bg-gray-700 rounded px-2 text-sm">
                        <option>Todos</option>
                        <option value={UserStatus.Active}>Ativo</option>
                        <option value={UserStatus.Suspended}>Suspenso</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500">Plano</label>
                    <select value={filterPlan} onChange={e=>setFilterPlan(e.target.value as any)} className="h-9 bg-gray-100 dark:bg-gray-700 rounded px-2 text-sm">
                        <option>Todos</option>
                        <option>Trial</option>
                        <option>Profissional</option>
                        <option>Avançado</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500">Verificação</label>
                    <select value={filterVerified} onChange={e=>setFilterVerified(e.target.value as any)} className="h-9 bg-gray-100 dark:bg-gray-700 rounded px-2 text-sm">
                        <option>Todos</option>
                        <option value="Verificado">Verificado</option>
                        <option value="Não Verificado">Não Verificado</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500">Ordenar por</label>
                    <select value={orderBy} onChange={e=>setOrderBy(e.target.value as any)} className="h-9 bg-gray-100 dark:bg-gray-700 rounded px-2 text-sm">
                        <option value="joinDate">Data</option>
                        <option value="name">Nome</option>
                        <option value="plan">Plano</option>
                        <option value="revenue">Receita</option>
                    </select>
                </div>
                <button onClick={()=>toggleSort(orderBy)} className="h-9 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm">{direction==='asc'?'Asc':'Desc'}</button>
            </div>
            <div className="overflow-x-auto">
                <TableTemplate
                    headers={['Usuário', 'Plano', 'Status', 'Verificado', 'Último Login', 'Data de Inscrição', 'Receita', 'Ações']}
                    data={sorted}
                    renderRow={(user: PlatformUser) => (
                        <>
                            <td className="p-3">
                                <div className="font-medium text-gray-800 dark:text-white">{user.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                            </td>
                            <td className="p-3 text-gray-600 dark:text-gray-300">{user.plan}</td>
                            <td className="p-3"><StatusBadge status={user.status} tooltipText={userStatusTooltips[user.status]} /></td>
                            <td className="p-3 text-xs">{user.emailVerified ? <span className="text-green-600 dark:text-green-400 font-semibold">Sim</span> : <span className="text-gray-400">Não</span>}</td>
                            <td className="p-3 text-xs text-gray-500 dark:text-gray-400">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : '—'}</td>
                            <td className="p-3 text-gray-600 dark:text-gray-300">{user.joinDate.toLocaleDateString('pt-BR')}</td>
                            <td className="p-3 font-mono text-gray-800 dark:text-white">R$ {user.totalRevenue.toFixed(2)}</td>
                            <td className="p-3">
                                <div className="flex items-center justify-center space-x-1">
                                    <button onClick={() => onEdit(user)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500" title="Editar"><Edit className="h-4 w-4" /></button>
                                    <button onClick={() => onToggleStatus(user.id)} className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 ${user.status === UserStatus.Active ? 'hover:text-red-500' : 'hover:text-green-500'}`} title={user.status === UserStatus.Active ? 'Suspender' : 'Reativar'}>{user.status === UserStatus.Active ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}</button>
                                    <button onClick={() => forceReset(user.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-orange-500" title="Forçar reset senha">R</button>
                                    {/* Impersonation button removed */}
                                    <button onClick={() => onDelete(user.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-500" title="Excluir"><Trash className="h-4 w-4" /></button>
                                </div>
                            </td>
                        </>
                    )}
                />
            </div>
        </div>
    );
};

const TransactionManagement: React.FC<{ transactions: PlatformTransaction[] }> = ({ transactions }) => (
    <div className="overflow-x-auto">
        <TableTemplate
            headers={['Transação ID', 'Usuário', 'Data', 'Descrição', 'Valor', 'Gateway', 'Status']}
            data={transactions}
            renderRow={(t: PlatformTransaction) => (
                <>
                    <td className="p-3 font-mono text-xs text-gray-500 dark:text-gray-400">{t.id}</td>
                    <td className="p-3 font-medium text-gray-800 dark:text-white">{t.userName}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{t.date.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{t.description}</td>
                    <td className="p-3 font-mono text-gray-800 dark:text-white">R$ {t.amount.toFixed(2)}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{t.gateway}</td>
                    <td className="p-3"><StatusBadge status={t.status} tooltipText={paymentStatusTooltips[t.status]} /></td>
                </>
            )}
        />
    </div>
);

const CouponManagement: React.FC<{coupons: Coupon[], onOpenModal: (coupon: Coupon | null) => void, onDelete: (id: string) => void, statusMessage: string}> = ({ coupons, onOpenModal, onDelete, statusMessage }) => {
    return (
        <div>
            {statusMessage && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-lg text-sm font-semibold">{statusMessage}</div>}
            <div className="flex justify-end mb-4">
                <button onClick={() => onOpenModal(null)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 flex items-center space-x-2"><Plus/><span>Criar Cupom</span></button>
            </div>
            <TableTemplate
                headers={['Código', 'Desconto', 'Validade', 'Uso', 'Status', 'Ações']}
                data={coupons}
                renderRow={(c: Coupon) => (
                    <>
                        <td className="p-3 font-mono font-bold text-gray-800 dark:text-white">{c.code}</td>
                        <td className="p-3 text-lg font-semibold text-green-600 dark:text-green-400">{c.discountPercent}%</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{c.expiresAt.toLocaleDateString('pt-BR')}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{c.timesUsed} / {c.maxUses || '∞'}</td>
                        <td className="p-3">
                            <StatusBadge 
                                status={c.isActive ? 'Ativo' : 'Inativo'} 
                                tooltipText={couponAndGeneralStatusTooltips[c.isActive ? 'Ativo' : 'Inativo']} 
                            />
                        </td>
                        <td className="p-3">
                            <div className="flex items-center justify-center space-x-1">
                                <button onClick={() => onOpenModal(c)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500"><Edit className="h-4 w-4"/></button>
                                <button onClick={() => onDelete(c.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-500"><Trash className="h-4 w-4"/></button>
                            </div>
                        </td>
                    </>
                )}
            />
        </div>
    );
};

const PlatformSettingsManagement: React.FC<{settings: PlatformSettings, setSettings: React.Dispatch<React.SetStateAction<PlatformSettings>>, onSave: () => void, statusMessage: string}> = ({ settings, setSettings, onSave, statusMessage }) => {
    const [adminEmailsText, setAdminEmailsText] = React.useState('');
    const [loadingAdmins, setLoadingAdmins] = React.useState(true);
    const [publicBaseUrl, setPublicBaseUrl] = React.useState('');
    const [bookingDomain, setBookingDomain] = React.useState('');
    const [featureFlags, setFeatureFlags] = React.useState<{[k:string]: boolean}>({});
    const functions = React.useMemo(()=>getFunctions(), []);
    const callUpdateSettings = React.useMemo(()=> httpsCallable(functions, 'updatePlatformSettings'), [functions]);
    React.useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'platform_settings'));
                const emails: string[] = (snap.exists() ? (snap.data() as any).adminEmails : []) || [];
                setAdminEmailsText(emails.join('\n'));
                if (snap.exists()) {
                    const data: any = snap.data();
                    setPublicBaseUrl(data.publicBaseUrl || '');
                    setBookingDomain(data.bookingBaseDomain || '');
                    setFeatureFlags(data.featureFlags || {});
                }
            } catch {}
            setLoadingAdmins(false);
        };
        load();
    }, []);
    const saveAdminEmails = async () => {
        const emails = adminEmailsText
            .split(/\r?\n/)
            .map(e => e.trim().toLowerCase())
            .filter(Boolean);
        try {
            await callUpdateSettings({ adminEmails: emails });
            alert('Lista de administradores atualizada.');
        } catch { alert('Falha ao salvar'); }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if(type === 'checkbox') {
            setSettings(s => ({...s, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setSettings(s => ({...s, [name]: value }));
        }
    }
    return (
                <form className="max-w-2xl mx-auto space-y-6">
            <ToggleSetting label="Habilitar novos cadastros" name="enableRegistrations" checked={settings.enableRegistrations} onChange={handleChange} description="Permite que novos profissionais se cadastrem na plataforma." />
            <ToggleSetting label="Modo de Manutenção" name="maintenanceMode" checked={settings.maintenanceMode} onChange={handleChange} description="Desativa o acesso para usuários não-admins. Use para atualizações."/>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectSetting label="Plano Padrão para Novos Usuários" name="defaultPlan" value={settings.defaultPlan} onChange={handleChange} options={['Profissional', 'Avançado']} />
                <InputSetting label="Dias de Trial Gratuito" name="trialDays" value={String(settings.trialDays)} onChange={handleChange} type="number"/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Base URL</label>
                    <input value={publicBaseUrl} onChange={e=>setPublicBaseUrl(e.target.value)} placeholder="https://app.exemplo.com" className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domínio Público de Booking</label>
                    <input value={bookingDomain} onChange={e=>setBookingDomain(e.target.value)} placeholder="agendiia.com.br" className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                </div>
            </div>
            <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">Feature Flags</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.keys(featureFlags).length === 0 && <p className="text-xs text-gray-500 col-span-2">Nenhuma flag definida ainda.</p>}
                    {Object.entries(featureFlags).map(([k,v]) => (
                        <label key={k} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded">
                            <span className="text-sm text-gray-700 dark:text-gray-200">{k}</span>
                            <input type="checkbox" checked={v} onChange={()=>setFeatureFlags(f=>({...f, [k]: !v}))} />
                        </label>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input id="newFlag" placeholder="nova_flag" className="flex-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" onKeyDown={e=>{ if(e.key==='Enter'){ const val=(e.target as HTMLInputElement).value.trim(); if(val){ setFeatureFlags(f=>({...f,[val]:false})); (e.target as HTMLInputElement).value=''; }}}} />
                    <button type="button" onClick={()=>{ const inp=document.getElementById('newFlag') as HTMLInputElement|null; if(inp && inp.value.trim()){ const val=inp.value.trim(); setFeatureFlags(f=>({...f,[val]:false})); inp.value=''; } }} className="px-3 py-2 text-sm rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">Adicionar</button>
                </div>
            </div>
                        <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mails autorizados para o painel Admin (um por linha)</label>
                                <textarea
                                    rows={4}
                                    value={adminEmailsText}
                                    onChange={(e) => setAdminEmailsText(e.target.value)}
                                    placeholder={loadingAdmins ? 'Carregando…' : 'admin@dominio.com'}
                                    className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                                />
                                <div className="pt-2 flex justify-end">
                                    <button type="button" onClick={saveAdminEmails} className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded">Salvar Lista de Admins</button>
                                </div>
                        </div>
            <div className="pt-4 flex flex-wrap items-center justify-end gap-3">
                {statusMessage && <span className="text-green-600 dark:text-green-400 text-sm mr-4">{statusMessage}</span>}
                <button type="button" onClick={()=>{
                    const emails = adminEmailsText.split(/\r?\n/).map(e=>e.trim()).filter(Boolean);
                    callUpdateSettings({ settings: { publicBaseUrl, bookingBaseDomain: bookingDomain }, adminEmails: emails, featureFlags })
                        .then(()=>alert('Configurações salvas'))
                        .catch(()=>alert('Erro ao salvar'));
                }} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700">Salvar Alterações</button>
            </div>
        </form>
    );
};

const ErrorLogs: React.FC = () => {
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    useEffect(() => {
    const unsub = onSnapshot(collection(db, 'platform_errorLogs'), (snap) => {
            const list: ErrorLog[] = snap.docs.map((d) => {
                const data: any = d.data();
                const ts = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date());
                return {
                    id: d.id,
                    timestamp: ts,
                    level: (data.level as LogLevel) || LogLevel.Info,
                    message: data.message || '',
                    context: data.context || undefined,
                } as ErrorLog;
            });
            setLogs(list);
        }, () => setLogs([]));
        return () => unsub();
    }, []);
    const logLevelColors = {
        [LogLevel.Info]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        [LogLevel.Warn]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        [LogLevel.Error]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        [LogLevel.Critical]: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-200 ring-2 ring-red-500',
    }
    return (
        <div className="space-y-3 font-mono text-xs">
            {logs.map(log => (
                <div key={log.id} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg flex items-start gap-4">
                    <span className={`px-2 py-1 rounded font-bold ${logLevelColors[log.level]}`}>{log.level}</span>
                    <span className="text-gray-500 dark:text-gray-400">{log.timestamp.toISOString()}</span>
                    <p className="flex-1 text-gray-800 dark:text-gray-200">{log.message}</p>
                </div>
            ))}
        </div>
    );
};

const MassCommunication: React.FC<{onSend: () => void, statusMessage: string}> = ({ onSend, statusMessage }) => (
    <div className="max-w-2xl mx-auto space-y-4">
        <h3 className="text-lg font-semibold">Enviar Mensagem para Todos os Usuários</h3>
        <input type="text" placeholder="Assunto do E-mail" className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
        <textarea rows={8} placeholder="Escreva sua mensagem aqui... Markdown é suportado." className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 resize-y"/>
        <div className="flex items-center justify-end">
             {statusMessage && <span className="text-green-600 dark:text-green-400 text-sm mr-4">{statusMessage}</span>}
             <button onClick={onSend} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-indigo-700 flex items-center space-x-2"><Send/><span>Enviar Transmissão</span></button>
        </div>
    </div>
);

const SubscriptionPlanManagement: React.FC<{plans: SubscriptionPlan[], onOpenModal: (plan: SubscriptionPlan | null) => void, onArchive: (id: string) => void}> = ({ plans, onOpenModal, onArchive }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Gerenciamento de Planos de Assinatura</h3>
                 <button onClick={() => onOpenModal(null)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 flex items-center space-x-2"><Plus/><span>Criar Plano</span></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {plans.map(plan => (
                    <div key={plan.id} className={`p-5 rounded-xl border-2 ${plan.isArchived ? 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' : 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-900'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4>
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">R${plan.price}<span className="text-base font-medium text-gray-500">/mês</span></p>
                            </div>
                            <StatusBadge status={plan.isArchived ? 'Inativo' : 'Ativo'} tooltipText={plan.isArchived ? 'Plano arquivado, não disponível para novas assinaturas.' : 'Plano ativo para novas assinaturas.'} />
                        </div>
                        <ul className="mt-4 space-y-2 text-sm">
                            {plan.features.map(feature => (
                                <li key={feature} className="flex items-center text-gray-600 dark:text-gray-300"><Check className="h-4 w-4 mr-2 text-green-500"/>{feature}</li>
                            ))}
                        </ul>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-1">
                             <button onClick={() => onOpenModal(plan)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500"><Edit className="h-4 w-4"/></button>
                             {!plan.isArchived && <button onClick={() => onArchive(plan.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-500" title="Arquivar Plano"><Archive className="h-4 w-4"/></button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
};

const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [exporting, setExporting] = useState(false);
    const functions = React.useMemo(()=>getFunctions(), []);
    const callExport = React.useMemo(()=> httpsCallable(functions, 'exportAuditLogsCsv'), [functions]);
    useEffect(() => {
    const unsub = onSnapshot(collection(db, 'platform_auditLogs'), (snap) => {
            const list: AuditLog[] = snap.docs.map((d) => {
                const data: any = d.data();
                const ts = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date());
                return {
                    id: d.id,
                    timestamp: ts,
                    user: data.user || 'System',
                    action: data.action || 'UNKNOWN',
                    details: data.details || '',
                    ipAddress: data.ipAddress || undefined,
                } as AuditLog;
            });
            setLogs(list);
        }, () => setLogs([]));
        return () => unsub();
    }, []);
    const exportCsv = async () => {
        setExporting(true);
        try {
            const res: any = await callExport({ limit: 2000 });
            const csv = res?.data?.csv || '';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `audit-logs-${Date.now()}.csv`; a.click();
            URL.revokeObjectURL(url);
        } catch {}
        setExporting(false);
    };
    return (
        <div className="overflow-x-auto space-y-4">
            <div className="flex justify-end">
                <button onClick={exportCsv} disabled={exporting} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-sm disabled:opacity-50">{exporting?'Exportando...':'Exportar CSV'}</button>
            </div>
            <TableTemplate
                headers={['Timestamp', 'Usuário', 'Ação', 'Detalhes', 'Endereço IP']}
                data={logs}
                renderRow={(log: AuditLog) => (
                    <>
                        <td className="p-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{log.timestamp.toLocaleString('pt-BR')}</td>
                        <td className="p-3 font-medium text-gray-800 dark:text-white">{log.user}</td>
                        <td className="p-3"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{log.action}</span></td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{log.details}</td>
                        <td className="p-3 font-mono text-sm text-gray-500 dark:text-gray-400">{log.ipAddress || 'N/A'}</td>
                    </>
                )}
            />
        </div>
    );
};

const PaymentGatewaySettings: React.FC<{settings: MercadoPagoSettings, setSettings: React.Dispatch<React.SetStateAction<MercadoPagoSettings>>, onConnect: () => void, statusMessage: string}> = ({ settings, setSettings, onConnect, statusMessage }) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value, isConnected: false }));
    };

    return (
        <div className="space-y-8">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-4">
                    <MercadoPagoLogo className="h-10 w-10 text-blue-500" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Configuração do Mercado Pago</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Conecte sua conta do Mercado Pago para processar os pagamentos das assinaturas dos profissionais na plataforma.</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <InputSetting label="Public Key" name="publicKey" value={settings.publicKey} onChange={handleInputChange} />
                    <InputSetting label="Access Token" name="accessToken" value={settings.accessToken} onChange={handleInputChange} type="password" />
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
                    <button onClick={onConnect} className="w-full sm:w-auto bg-indigo-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-indigo-700">
                        Salvar e Conectar
                    </button>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${settings.isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {settings.isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                     {statusMessage && <span className="text-sm text-green-600 dark:text-green-400">{statusMessage}</span>}
                </div>
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                    Suas credenciais são armazenadas de forma segura. Encontre-as no <a href="#" className="underline hover:text-indigo-500">painel de desenvolvedores do Mercado Pago</a>.
                </p>
            </div>
        </div>
    );
};
// #endregion

// #region Helper & Modal Components
const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode, footer: React.ReactNode }> = ({ title, onClose, children, footer }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose} aria-modal="true" role="dialog">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
                    <X className="h-6 w-6" />
                </button>
            </header>
            <main className="p-6">{children}</main>
            <footer className="flex justify-end space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">{footer}</footer>
        </div>
    </div>
);

const UserModal: React.FC<{ user: PlatformUser | null, onSave: (user: PlatformUser) => void, onClose: () => void }> = ({ user, onSave, onClose }) => {
    const [formData, setFormData] = useState(user);
    const [trialDays, setTrialDays] = useState(7);
    const [updating, setUpdating] = useState(false);
    const functions = React.useMemo(()=>getFunctions(), []);
    const callSetPlan = React.useMemo(()=> httpsCallable(functions, 'setUserPlan'), [functions]);
    const callGrantTrial = React.useMemo(()=> httpsCallable(functions, 'grantOrExtendTrial'), [functions]);
    const callRecordActionUModal = React.useMemo(()=> httpsCallable(functions, 'recordAdminAction'), [functions]);
    if (!formData) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => prev ? { ...prev, [e.target.name]: e.target.value } : null);
    };

    const changePlan = async (p: string) => {
        setUpdating(true);
        try {
            await callSetPlan({ userId: formData.id, plan: p });
            setFormData({...formData, plan: p as any});
            try { await callRecordActionUModal({ action: 'PLAN_CHANGE', details: `User ${formData.email} -> plan ${p}` }); } catch {}
        } catch {
            // silent
        } finally { setUpdating(false); }
    };
    const extendTrial = async () => {
        if (!trialDays) return;
        setUpdating(true);
        try {
            await callGrantTrial({ userId: formData.id, extraDays: trialDays });
            try { await callRecordActionUModal({ action: 'TRIAL_EXTENSION', details: `User ${formData.email} +${trialDays} days` }); } catch {}
        } catch {
            // silent
        } finally { setUpdating(false); }
    };

    return (
        <Modal title="Editar Usuário" onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button disabled={updating} onClick={() => onSave(formData)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Salvar</button></>}>
            <div className="space-y-4">
                <InputSetting label="Nome" name="name" value={formData.name} onChange={handleChange} />
                <InputSetting label="Email" name="email" value={formData.email} onChange={handleChange} />
                <SelectSetting label="Plano" name="plan" value={formData.plan} onChange={handleChange} options={['Trial', 'Profissional', 'Avançado']} />
                <SelectSetting label="Status" name="status" value={formData.status} onChange={handleChange} options={Object.values(UserStatus)} />
                <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700/30 space-y-3">
                    <p className="text-xs font-semibold text-gray-500">Ações Administrativas</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={updating} onClick={()=>changePlan('Profissional')} className="px-3 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-indigo-50">Plano Profissional</button>
                        <button type="button" disabled={updating} onClick={()=>changePlan('Avançado')} className="px-3 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-indigo-50">Plano Avançado</button>
                        <button type="button" disabled={updating} onClick={()=>changePlan('Trial')} className="px-3 py-1 text-xs rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-indigo-50">Forçar Trial</button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <input type="number" min={1} value={trialDays} onChange={e=>setTrialDays(Number(e.target.value))} className="w-20 p-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded" />
                        <button type="button" disabled={updating} onClick={extendTrial} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">Estender Trial (dias)</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const CouponModal: React.FC<{ coupon: Coupon | null, onSave: (coupon: Coupon) => void, onClose: () => void }> = ({ coupon, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<Coupon>>(coupon || { code: '', discountPercent: 10, expiresAt: new Date(), isActive: true });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSaveClick = () => {
        onSave(formData as Coupon);
    };

    return (
        <Modal title={coupon ? 'Editar Cupom' : 'Criar Novo Cupom'} onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button onClick={handleSaveClick} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg">Salvar</button></>}>
            <div className="space-y-4">
                <InputSetting label="Código do Cupom" name="code" value={formData.code || ''} onChange={handleChange} />
                <InputSetting label="Percentual de Desconto (%)" name="discountPercent" value={String(formData.discountPercent || '')} onChange={handleChange} type="number" />
                <InputSetting label="Data de Expiração" name="expiresAt" value={new Date(formData.expiresAt || '').toISOString().split('T')[0]} onChange={handleChange} type="date" />
                <InputSetting label="Usos Máximos (deixe em branco para ilimitado)" name="maxUses" value={String(formData.maxUses || '')} onChange={handleChange} type="number" />
                <ToggleSetting label="Cupom Ativo" name="isActive" checked={formData.isActive || false} onChange={handleChange} description="Permite que o cupom seja utilizado."/>
            </div>
        </Modal>
    );
};

const PlanModal: React.FC<{ plan: SubscriptionPlan | null, onSave: (plan: SubscriptionPlan) => void, onClose: () => void }> = ({ plan, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<SubscriptionPlan>>(plan || { name: '', price: 0, features: [], isAdvanced: false, isArchived: false, limits: { maxClients: 100, maxAppointmentsPerMonth: 500, storageMB: 1024 }, priceId: '' });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const name = target.name;
        const type = target.type;

        if (name === 'features') {
            setFormData(prev => ({ ...prev, features: target.value.split('\n') }));
        } else if (type === 'checkbox') {
            const checked = (target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: target.value }));
        }
    };
    
    return (
        <Modal title={plan ? 'Editar Plano' : 'Criar Novo Plano'} onClose={onClose} footer={<><button onClick={onClose}>Cancelar</button><button onClick={() => onSave(formData as SubscriptionPlan)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg">Salvar</button></>}>
            <div className="space-y-4">
                <InputSetting label="Nome do Plano" name="name" value={formData.name || ''} onChange={handleChange}/>
                <InputSetting label="Preço Mensal (R$)" name="price" value={String(formData.price || '')} onChange={handleChange} type="number"/>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recursos (um por linha)</label>
                    <textarea name="features" value={(formData.features || []).join('\n')} onChange={handleChange} rows={4} className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                </div>
                <InputSetting label="Stripe Price ID" name="priceId" value={formData.priceId || ''} onChange={(e:any)=>setFormData(p=>({...p!, priceId:e.target.value}))} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InputSetting label="Máx. Clientes" name="maxClients" value={String(formData.limits?.maxClients ?? '')} onChange={(e:any)=>setFormData(p=>({...p!, limits:{...(p?.limits||{}), maxClients:Number(e.target.value)}}))} type="number" />
                    <InputSetting label="Máx. Agendamentos/Mês" name="maxAppointmentsPerMonth" value={String(formData.limits?.maxAppointmentsPerMonth ?? '')} onChange={(e:any)=>setFormData(p=>({...p!, limits:{...(p?.limits||{}), maxAppointmentsPerMonth:Number(e.target.value)}}))} type="number" />
                    <InputSetting label="Storage (MB)" name="storageMB" value={String(formData.limits?.storageMB ?? '')} onChange={(e:any)=>setFormData(p=>({...p!, limits:{...(p?.limits||{}), storageMB:Number(e.target.value)}}))} type="number" />
                </div>
                <ToggleSetting label="Plano Avançado" name="isAdvanced" checked={formData.isAdvanced || false} onChange={handleChange} description="Marcar como plano superior/recomendado."/>
            </div>
        </Modal>
    );
};

const MetricCard: React.FC<{title: string; value: string; icon: React.ReactNode; color: string;}> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4">
    <div className={`p-3 rounded-full ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
    </div>
  </div>
);

const TableTemplate: React.FC<{headers: string[], data: any[], renderRow: (item: any) => React.ReactNode}> = ({ headers, data, renderRow }) => (
    <table className="w-full text-left">
        <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr>
                {headers.map(h => <th key={h} className="p-3 text-sm font-semibold text-gray-500 dark:text-gray-400">{h}</th>)}
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => (
                <tr key={item.id || index} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {renderRow(item)}
                </tr>
            ))}
        </tbody>
    </table>
);

const StatusBadge: React.FC<{ status: UserStatus | PaymentStatus | 'Ativo' | 'Inativo', tooltipText?: string }> = ({ status, tooltipText }) => {
    const styles: { [key: string]: string } = {
        [UserStatus.Active]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        [UserStatus.Suspended]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        'Inativo': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        [PaymentStatus.Paid]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        [PaymentStatus.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        [PaymentStatus.Failed]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    
    const badge = <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;

    if (!tooltipText) {
        return badge;
    }

    return (
        <div className="relative group inline-block">
            {badge}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100 z-20 origin-bottom">
                {tooltipText}
            </span>
        </div>
    );
};

const ToggleSetting: React.FC<{label:string, name:string, checked:boolean, onChange: (e:any)=>void, description: string}> = ({label, name, checked, onChange, description}) => (
    <div className="flex items-start justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
        <div>
            <label htmlFor={name} className="font-medium text-gray-700 dark:text-gray-200">{label}</label>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <div className="relative inline-block w-10 ml-4 mr-2 align-middle select-none">
            <input type="checkbox" name={name} id={name} checked={checked} onChange={onChange} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
            <label htmlFor={name} className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
        </div>
        <style>{`.toggle-checkbox:checked{right:0;border-color:#4f46e5;transform:translateX(100%)}.toggle-checkbox{transition:all .2s ease-in-out;transform:translateX(0)}.toggle-checkbox:checked+.toggle-label{background-color:#4f46e5}`}</style>
    </div>
);

const InputSetting: React.FC<{label:string, name:string, value:string, onChange:(e:any)=>void, type?:string}> = ({label,name,value,onChange, type='text'}) => (
     <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input type={type} id={name} name={name} value={value} onChange={onChange} className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
    </div>
);

const SelectSetting: React.FC<{label:string, name:string, value:string, onChange:(e:any)=>void, options:string[]}> = ({label,name,value,onChange,options}) => (
     <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);
// #endregion

// Analytics Panel Component
const AnalyticsPanel: React.FC<{
    data: {
        platformMetrics: PlatformMetrics | null;
        revenueMetrics: RevenueMetrics | null;
        userGrowthMetrics: UserGrowthMetrics | null;
        usageMetrics: UsageMetrics | null;
        conversionMetrics: ConversionMetrics | null;
        appointmentMetrics: AppointmentMetrics | null;
    };
    loading: boolean;
    error: string;
    selectedPeriod: string;
    onPeriodChange: (period: string) => void;
    onRefresh: () => void;
}> = ({ data, loading, error, selectedPeriod, onPeriodChange, onRefresh }) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-gray-600">Carregando analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <button
                    onClick={onRefresh}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Period Selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analytics & Métricas</h2>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedPeriod}
                        onChange={(e) => onPeriodChange(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    >
                        <option value="7d">Últimos 7 dias</option>
                        <option value="30d">Últimos 30 dias</option>
                        <option value="90d">Últimos 90 dias</option>
                        <option value="1y">Último ano</option>
                    </select>
                    <button
                        onClick={onRefresh}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Platform Overview */}
            {data.platformMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <AnalyticsCard
                        title="Total de Usuários"
                        value={data.platformMetrics.totalUsers.toString()}
                        icon={<Users className="h-6 w-6" />}
                        color="blue"
                    />
                    <AnalyticsCard
                        title="Usuários Ativos"
                        value={data.platformMetrics.activeUsers.toString()}
                        icon={<CheckSquare className="h-6 w-6" />}
                        color="green"
                    />
                    <AnalyticsCard
                        title="Receita Total"
                        value={`R$ ${data.platformMetrics.totalRevenue.toFixed(2)}`}
                        icon={<DollarSign className="h-6 w-6" />}
                        color="purple"
                    />
                    <AnalyticsCard
                        title="Agendamentos"
                        value={data.platformMetrics.totalAppointments.toString()}
                        icon={<Calendar className="h-6 w-6" />}
                        color="orange"
                    />
                </div>
            )}

            {/* Key Metrics */}
            {data.conversionMetrics && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">KPIs Principais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-indigo-600">{data.conversionMetrics.trialToSubscription}%</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Conversão Trial → Pago</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{data.platformMetrics?.churnRate}%</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Taxa de Churn</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">R$ {data.platformMetrics?.averageLifetimeValue.toFixed(0)}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">LTV Médio</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{data.appointmentMetrics?.averageBookingsPerUser.toFixed(1)}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Agendamentos/Usuário</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Revenue Metrics */}
            {data.revenueMetrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Receita por Plano</h3>
                        <div className="space-y-3">
                            {Object.entries(data.revenueMetrics.byPlan).map(([plan, revenue]) => (
                                <div key={plan} className="flex justify-between items-center">
                                    <span className="text-gray-700 dark:text-gray-300">{plan}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">R$ {Number(revenue).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Crescimento de Receita</h3>
                        <div className="text-center">
                            <div className={`text-3xl font-bold ${data.revenueMetrics.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {data.revenueMetrics.growth >= 0 ? '+' : ''}{data.revenueMetrics.growth}%
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">vs. mês anterior</div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-xl font-semibold text-gray-900 dark:text-white">R$ {data.revenueMetrics.recurring.toFixed(0)}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">Recorrente</div>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900 dark:text-white">R$ {data.revenueMetrics.oneTime.toFixed(0)}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">Único</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Usage & Appointment Metrics */}
            {data.usageMetrics && data.appointmentMetrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Funcionalidades Mais Usadas</h3>
                        <div className="space-y-3">
                            {data.usageMetrics.popularFeatures.map((feature, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <span className="text-gray-700 dark:text-gray-300 capitalize">{feature.feature}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{feature.usage.toFixed(0)} usuários</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Serviços Populares</h3>
                        <div className="space-y-3">
                            {data.appointmentMetrics.popularServices.slice(0, 5).map((service, index) => (
                                <div key={index} className="flex justify-between items-center">
                                    <span className="text-gray-700 dark:text-gray-300">{service.service}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{service.count} agendamentos</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Time Distribution */}
            {data.appointmentMetrics && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Distribuição de Horários de Agendamento</h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {Object.entries(data.appointmentMetrics.timeSlotDistribution).map(([slot, count]) => (
                            <div key={slot} className="text-center">
                                <div className="text-xl font-bold text-indigo-600">{count}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{slot}h</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const AnalyticsCard: React.FC<{
    title: string;
    value: string;
    icon: React.ReactNode;
    color: 'blue' | 'green' | 'purple' | 'orange';
}> = ({ title, value, icon, color }) => {
    const colorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        orange: 'bg-orange-500',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
                <div className={`p-3 rounded-full ${colorClasses[color]} text-white`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;