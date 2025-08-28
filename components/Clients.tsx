import React, { useState, useMemo, useEffect } from 'react';
import { Client, ClientCategory, Appointment, AppointmentStatus, CommunicationLog, CommunicationType, Service } from '../types';
import { generateClientSummary, generateClientCommunication } from '../services/geminiService';
import { sendEmail, sendWhatsApp } from '../services/brevoService';
import { User, DollarSign, Tag, TrendingUp, MoreVertical, FileUp, Calendar, Clock, Sparkles, Loader, X, MessageCircle, FileText, Mail, Check, AlertTriangle, Filter, Plus, Package as PackageIcon, Search, Send } from './Icons';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { LoadingSpinner, LoadingState } from './LoadingState';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

// Firestore-backed data

const categoryStyles: { [key in ClientCategory]: string } = {
  [ClientCategory.VIP]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [ClientCategory.Fiel]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [ClientCategory.AtRisk]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [ClientCategory.New]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

// Card-level styles per category: left border + subtle background tint
const categoryCardStyles: { [key in ClientCategory]: string } = {
    [ClientCategory.VIP]: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    [ClientCategory.Fiel]: 'border-green-400 bg-green-50 dark:bg-green-900/20',
    [ClientCategory.AtRisk]: 'border-red-400 bg-red-50 dark:bg-red-900/20',
    [ClientCategory.New]: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
};

const clientCategoryTooltips: { [key in ClientCategory]: string } = {
  [ClientCategory.VIP]: "Cliente de alto valor, com histórico de muitos agendamentos e lealdade.",
  [ClientCategory.Fiel]: "Cliente com múltiplos agendamentos, demonstrando recorrência e potencial para se tornar VIP.",
  [ClientCategory.AtRisk]: "Cliente que não agenda há um tempo considerável. Requer uma ação de reengajamento.",
  [ClientCategory.New]: "Cliente novo, com poucos agendamentos. Ótima oportunidade para fidelização.",
};

const appointmentStatusTooltips: { [key in AppointmentStatus]: string } = {
  [AppointmentStatus.Scheduled]: "O horário foi reservado, mas ainda aguarda a confirmação do cliente.",
  [AppointmentStatus.Confirmed]: "O cliente confirmou que irá comparecer. A chance de 'no-show' é baixa.",
  [AppointmentStatus.Finished]: "A consulta foi concluída e o serviço prestado com sucesso.",
  [AppointmentStatus.Canceled]: "O agendamento foi cancelado e o horário está livre novamente.",
  [AppointmentStatus.Problem]: "Ocorreu um problema, como não comparecimento ('no-show') ou falha no pagamento. Requer atenção.",
};

const appointmentStatusStyles: { [key in AppointmentStatus]: string } = {
  [AppointmentStatus.Scheduled]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50',
  [AppointmentStatus.Confirmed]: 'bg-green-100 text-green-800 dark:bg-green-900/50',
  [AppointmentStatus.Finished]: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50',
  [AppointmentStatus.Canceled]: 'bg-red-100 text-red-800 dark:bg-red-900/50',
  [AppointmentStatus.Problem]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50',
};

// Simple hash function to generate a color from a string
const hashStringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
};

const Clients: React.FC = () => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const clientsOperation = useAsyncOperation({ isLoading: true });
    const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
    const [filters, setFilters] = useState({
        searchQuery: '',
        category: 'all',
        tag: 'all',
        lastVisit: 'all',
        appointments: 'all',
    });

    const handleOpenModal = (client: Client) => setSelectedClient(client);
    const handleCloseModal = () => setSelectedClient(null);

    const handleUpdateClient = async (updatedClient: Client) => {
        if (!user) return;
        try {
            const ref = doc(db, 'users', user.uid, 'clients', updatedClient.id);
            await updateDoc(ref, {
                // Persist only mutable fields for now
                notes: updatedClient.notes || '',
                tags: updatedClient.tags || [],
                updatedAt: serverTimestamp(),
            } as any);
            // Realtime listener will update local state
        } catch (e) {
            console.error('Falha ao salvar cliente', e);
            alert('Não foi possível salvar as alterações do cliente.');
        }
    };
    
    // Realtime load clients from Firestore
    useEffect(() => {
        if (!user) return;
        
        clientsOperation.execute(async () => {
            const colRef = collection(db, 'users', user.uid, 'clients');
            const q = query(colRef, orderBy('name', 'asc'));
            const unsub = onSnapshot(q, (snap) => {
                const items: Client[] = snap.docs.map((d) => {
                    const data: any = d.data();
                    const lastVisit = data.lastVisit instanceof Timestamp
                        ? data.lastVisit.toDate()
                        : (data.lastVisit ? new Date(data.lastVisit) : new Date());
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
                        lastVisit,
                        birthDate: data.birthDate || undefined,
                        notes: data.notes || '',
                        tags: data.tags || [],
                    } as Client;
                });
                setClients(items);
            }, (err) => {
                console.error('onSnapshot clients error', err);
                throw err;
            });
            return () => unsub();
        });
    }, [user?.uid]);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        clients.forEach(c => c.tags?.forEach(t => tagSet.add(t)));
        return ['all', ...Array.from(tagSet)];
    }, [clients]);

    const filteredClients = useMemo(() => {
        const today = new Date();
        return clients.filter(c => {
            // Search query match
            const query = filters.searchQuery.toLowerCase();
            const searchMatch = !query ||
                c.name.toLowerCase().includes(query) ||
                c.email.toLowerCase().includes(query) ||
                (c.tags && c.tags.some(tag => tag.toLowerCase().includes(query)));

            // Category match
            const categoryMatch = filters.category === 'all' || c.category === filters.category;

            // Tag match
            const tagMatch = filters.tag === 'all' || (c.tags && c.tags.includes(filters.tag));

            // Last visit match
            const daysSinceLastVisit = Math.floor((today.getTime() - new Date(c.lastVisit).getTime()) / (1000 * 3600 * 24));
            const lastVisitMatch = filters.lastVisit === 'all' ||
                (filters.lastVisit === '<30' && daysSinceLastVisit <= 30) ||
                (filters.lastVisit === '30-90' && daysSinceLastVisit > 30 && daysSinceLastVisit <= 90) ||
                (filters.lastVisit === '>90' && daysSinceLastVisit > 90);
            
            // Appointments match
            const appointmentsMatch = filters.appointments === 'all' ||
                (filters.appointments === '1-5' && c.totalAppointments >= 1 && c.totalAppointments <= 5) ||
                (filters.appointments === '6-15' && c.totalAppointments >= 6 && c.totalAppointments <= 15) ||
                (filters.appointments === '>15' && c.totalAppointments > 15);

            return searchMatch && categoryMatch && tagMatch && lastVisitMatch && appointmentsMatch;
        });
    }, [clients, filters]);

    return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestão de Clientes</h1>
                <button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2">
            <User className="h-5 w-5" />
            <span>Novo Cliente</span>
        </button>
      </div>
      
      <LoadingState 
        loading={clientsOperation.isLoading}
        loadingComponent={<LoadingSpinner text="Carregando clientes..." />}
        error={clientsOperation.error}
        errorComponent={
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-400">Erro ao carregar clientes. Tente novamente.</p>
          </div>
        }
      >
      
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="h-5 w-5 absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text"
                    name="searchQuery"
                    placeholder="Busca inteligente por nome, email, tags..."
                    value={filters.searchQuery}
                    onChange={handleFilterChange}
                    className="w-full pl-12 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category Filter */}
                <div>
                    <label htmlFor="category-filter" className="text-sm font-medium text-gray-600 dark:text-gray-400">Categoria</label>
                    <select id="category-filter" name="category" value={filters.category} onChange={handleFilterChange} className="w-full mt-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        <option value="all">Todas</option>
                        {Object.values(ClientCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                {/* Tag Filter */}
                <div>
                    <label htmlFor="tag-filter" className="text-sm font-medium text-gray-600 dark:text-gray-400">Tag</label>
                    <select id="tag-filter" name="tag" value={filters.tag} onChange={handleFilterChange} className="w-full mt-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        {allTags.map(tag => <option key={tag} value={tag}>{tag === 'all' ? 'Todas' : tag}</option>)}
                    </select>
                </div>
                {/* Last Visit Filter */}
                <div>
                    <label htmlFor="lastVisit-filter" className="text-sm font-medium text-gray-600 dark:text-gray-400">Última Visita</label>
                    <select id="lastVisit-filter" name="lastVisit" value={filters.lastVisit} onChange={handleFilterChange} className="w-full mt-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        <option value="all">Qualquer data</option>
                        <option value="<30">Últimos 30 dias</option>
                        <option value="30-90">30-90 dias</option>
                        <option value=">90">Mais de 90 dias</option>
                    </select>
                </div>
                {/* Appointments Filter */}
                <div>
                    <label htmlFor="appointments-filter" className="text-sm font-medium text-gray-600 dark:text-gray-400">Nº de Agendamentos</label>
                    <select id="appointments-filter" name="appointments" value={filters.appointments} onChange={handleFilterChange} className="w-full mt-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        <option value="all">Qualquer</option>
                        <option value="1-5">1-5</option>
                        <option value="6-15">6-15</option>
                        <option value=">15">Mais de 15</option>
                    </select>
                </div>
            </div>
        </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.length > 0 ? (
            filteredClients.map(client => (
                <ClientCard key={client.id} client={client} onOpen={() => handleOpenModal(client)} />
            ))
        ) : (
            <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 text-center py-16 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">Nenhum cliente encontrado com os filtros selecionados.</p>
            </div>
        )}
      </div>

      </LoadingState>
      
      {selectedClient && (
          <ClientDetailModal client={selectedClient} onUpdateClient={handleUpdateClient} onClose={handleCloseModal} />
      )}
      {isCreateOpen && (
          <CreateClientModal onClose={() => setIsCreateOpen(false)} />
      )}
    </div>
  );
};

const ClientCard: React.FC<{ client: Client, onOpen: () => void }> = ({ client, onOpen }) => (
    <div onClick={onOpen} className={`rounded-xl shadow-md p-5 flex flex-col hover:shadow-xl hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer border-l-4 ${categoryCardStyles[client.category]}`}>
        <div className="flex-grow">
            <div className="flex items-center space-x-4 mb-4">
                 <img src={client.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(client.name)}&backgroundType=gradientLinear&fontWeight=700`} alt={client.name} className="w-16 h-16 rounded-full ring-4 ring-gray-200 dark:ring-gray-700" />
                 <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{client.name}</h3>
                    <div className="relative group inline-block">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${categoryStyles[client.category]}`}>
                            {client.category}
                        </span>
                        <span className="absolute bottom-full mb-2 w-max max-w-xs scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100 z-20 origin-bottom">
                            {clientCategoryTooltips[client.category]}
                        </span>
                    </div>
                 </div>
            </div>
            
             <div className="flex flex-wrap gap-2 mb-4">
                {client.tags?.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs font-semibold rounded-full text-white" style={{ backgroundColor: hashStringToColor(tag) }}>
                        {tag}
                    </span>
                ))}
            </div>

            <div className="w-full border-t border-gray-200 dark:border-gray-700 my-2"></div>
            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-center"><DollarSign className="h-4 w-4 mr-2 text-gray-400"/>Total Gasto: <span className="font-mono ml-auto">R${client.totalSpent.toFixed(2)}</span></p>
                <p className="flex items-center"><Tag className="h-4 w-4 mr-2 text-gray-400"/>Ticket Médio: <span className="font-mono ml-auto">R${client.avgTicket.toFixed(2)}</span></p>
                <p className="flex items-center"><TrendingUp className="h-4 w-4 mr-2 text-gray-400"/>Agendamentos: <span className="font-mono ml-auto">{client.totalAppointments}</span></p>
                <p className="flex items-center"><Calendar className="h-4 w-4 mr-2 text-gray-400"/>Última Visita: <span className="font-mono ml-auto">{client.lastVisit.toLocaleDateString('pt-BR')}</span></p>
            </div>
        </div>
    </div>
);

const ClientDetailModal: React.FC<{ client: Client; onUpdateClient: (client: Client) => void; onClose: () => void;}> = ({ client, onUpdateClient, onClose }) => {
    const { user } = useAuth();
    type Tab = 'overview' | 'history' | 'communication' | 'notes';
    type CommModalType = 'Follow-up' | 'Pós-Atendimento' | 'Aniversário';
    
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [editableClient, setEditableClient] = useState<Client>(client);
    const [communications, setCommunications] = useState<CommunicationLog[]>([]);
    const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
    const [commModalState, setCommModalState] = useState<{isOpen: boolean, type: CommModalType | null}>({isOpen: false, type: null});

    // Load communications for this client
    useEffect(() => {
        if (!user || !client?.id) return;
        const colRef = collection(db, 'users', user.uid, 'clients', client.id, 'communications');
        const q = query(colRef, orderBy('date', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const items: CommunicationLog[] = snap.docs.map((d) => {
                const data: any = d.data();
                const date = data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : new Date());
                return {
                    id: d.id,
                    channel: data.channel,
                    type: data.type,
                    subject: data.subject,
                    content: data.content,
                    date,
                } as CommunicationLog;
            });
            setCommunications(items);
        });
        return () => unsub();
    }, [user?.uid, client?.id]);

    // Load appointments for this client
    useEffect(() => {
        if (!user || !client?.name) return;
        const colRef = collection(db, 'users', user.uid, 'appointments');
        const q = query(colRef, where('clientName', '==', client.name));
        const unsub = onSnapshot(q, (snap) => {
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
            }).sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
            setClientAppointments(items);
        });
        return () => unsub();
    }, [user?.uid, client?.name]);

    const handleSave = () => {
        onUpdateClient(editableClient);
        onClose();
    };

    const handleSendSuccess = async (log: Omit<CommunicationLog, 'id'>) => {
        if (!user || !client?.id) return;
        try {
            await addDoc(collection(db, 'users', user.uid, 'clients', client.id, 'communications'), {
                channel: log.channel,
                type: log.type,
                subject: log.subject || null,
                content: log.content,
                date: serverTimestamp(),
            } as any);
        } catch (e) {
            console.error('Falha ao salvar comunicação', e);
        }
    };

    const tabConfig: {id: Tab, label: string, icon: React.ReactNode}[] = [
        { id: 'overview', label: 'Visão Geral', icon: <User className="h-5 w-5"/> },
        { id: 'history', label: 'Histórico', icon: <Calendar className="h-5 w-5"/> },
        { id: 'communication', label: 'Comunicação', icon: <MessageCircle className="h-5 w-5"/> },
        { id: 'notes', label: 'Anotações', icon: <FileText className="h-5 w-5"/> },
    ]

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <header className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <img src={client.avatarUrl} alt={client.name} className="w-16 h-16 rounded-full ring-4 ring-indigo-500/50" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">{client.name}</h2>
                                <div className="relative group inline-block mt-1">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${categoryStyles[editableClient.category]}`}>{editableClient.category}</span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{client.email}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400">
                            <X className="h-6 w-6" />
                        </button>
                    </header>
                    
                    <nav className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
                        <div className="px-6 flex space-x-4">
                        {tabConfig.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                        </div>
                    </nav>

                    <main className="flex-grow p-6 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                        {activeTab === 'overview' && <OverviewTab client={editableClient} setClient={setEditableClient} appointments={clientAppointments} />}
                        {activeTab === 'history' && <HistoryTab appointments={clientAppointments} />}
                        {activeTab === 'communication' && <CommunicationTab communications={communications} onOpenModal={(type) => setCommModalState({ isOpen: true, type })} client={client} />}
                        {activeTab === 'notes' && <NotesTab client={editableClient} setClient={setEditableClient} />}
                    </main>
                    <footer className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        <button onClick={handleSave} className="py-2 px-6 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Salvar Alterações</button>
                    </footer>
                </div>
            </div>
            {commModalState.isOpen && commModalState.type && (
                <ClientCommunicationModal 
                    client={client}
                    type={commModalState.type}
                    lastAppointment={clientAppointments.find(a => a.status === AppointmentStatus.Finished)}
                    onClose={() => setCommModalState({ isOpen: false, type: null })}
                    onSendSuccess={handleSendSuccess}
                />
            )}
        </>
    )
};

// #region Tab Components
const OverviewTab: React.FC<{ client: Client; setClient: React.Dispatch<React.SetStateAction<Client>>; appointments: Appointment[] }> = ({ client, setClient, appointments }) => {
    const [newTag, setNewTag] = useState('');

    const handleAddTag = () => {
        if (newTag && !client.tags?.includes(newTag)) {
            setClient(prev => ({ ...prev, tags: [...(prev.tags || []), newTag]}));
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setClient(prev => ({ ...prev, tags: prev.tags?.filter(t => t !== tagToRemove)}));
    };
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Estatísticas do Cliente</h3>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Gasto Total</p>
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">R${client.totalSpent.toFixed(2)}</p>
                        </div>
                         <div className="text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Agendamentos</p>
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{client.totalAppointments}</p>
                        </div>
                    </div>
                     <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                         <p className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Ticket Médio:</span> <span className="font-semibold dark:text-white">R${client.avgTicket.toFixed(2)}</span></p>
                         <p className="flex justify-between text-sm mt-2"><span className="text-gray-500 dark:text-gray-400">Última Visita:</span> <span className="font-semibold dark:text-white">{client.lastVisit.toLocaleDateString('pt-BR')}</span></p>
                     </div>
                </div>
                <AISummary client={client} appointments={appointments} />
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Tags Personalizadas</h3>
                 <div className="flex flex-wrap gap-2 mb-4">
                    {client.tags?.map(tag => (
                        <span key={tag} className="flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded-full text-white" style={{ backgroundColor: hashStringToColor(tag) }}>
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="text-white/70 hover:text-white"><X className="h-3 w-3"/></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="Nova tag..." className="flex-grow p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"/>
                    <button onClick={handleAddTag} className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm"><Plus className="h-4 w-4"/> Adicionar</button>
                </div>
            </div>
        </div>
    )
};


const HistoryTab: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => (
    <div className="space-y-3">
        {appointments.length > 0 ? appointments.map(app => (
            <div key={app.id} className="bg-white dark:bg-gray-700/80 p-3 rounded-lg flex justify-between items-center shadow-sm">
                <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{app.service}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {app.dateTime.toLocaleDateString('pt-BR')} - <span className="font-mono">R${app.price.toFixed(2)}</span>
                    </p>
                </div>
                <div className="relative group">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${appointmentStatusStyles[app.status]}`}>{app.status}</span>
                    <span className="absolute bottom-full right-0 mb-2 w-max max-w-xs scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100 z-20 origin-bottom">
                        {appointmentStatusTooltips[app.status]}
                    </span>
                </div>
            </div>
        )) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum histórico de agendamento encontrado.</p>
        )}
    </div>
);

const CommunicationTab: React.FC<{ communications: CommunicationLog[], onOpenModal: (type: 'Follow-up' | 'Pós-Atendimento' | 'Aniversário') => void, client: Client }> = ({ communications, onOpenModal, client }) => (
    <div className="space-y-6">
        <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Ações Rápidas com IA</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={() => onOpenModal('Follow-up')} className="p-3 bg-white dark:bg-gray-700/80 rounded-lg shadow-sm text-center font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Gerar Follow-up</button>
                <button onClick={() => onOpenModal('Pós-Atendimento')} className="p-3 bg-white dark:bg-gray-700/80 rounded-lg shadow-sm text-center font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Gerar Pós-Atendimento</button>
                <button onClick={() => onOpenModal('Aniversário')} disabled={!client.birthDate} className="p-3 bg-white dark:bg-gray-700/80 rounded-lg shadow-sm text-center font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Gerar Aniversário
                    {!client.birthDate && <span className="block text-xs font-normal text-gray-400">(sem data)</span>}
                </button>
            </div>
        </div>
        <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Histórico de Comunicação</h3>
            <div className="space-y-3">
                {communications.length > 0 ? communications.map(comm => (
                    <div key={comm.id} className="bg-white dark:bg-gray-700/80 p-4 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                {comm.channel === 'Email' ? <Mail className="h-5 w-5 text-blue-500"/> : <MessageCircle className="h-5 w-5 text-green-500"/>}
                                <span className="font-bold text-gray-800 dark:text-white">{comm.channel} - {comm.type}</span>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{comm.date.toLocaleString('pt-BR')}</span>
                        </div>
                        {comm.subject && <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Assunto: {comm.subject}</p>}
                        <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">{comm.content}</p>
                    </div>
                )) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum histórico de comunicação encontrado.</p>
                )}
            </div>
        </div>
    </div>
);

const NotesTab: React.FC<{ client: Client, setClient: React.Dispatch<React.SetStateAction<Client>> }> = ({ client, setClient }) => {
    return (
        <div className="space-y-4">
             <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Anotações Confidenciais</h3>
             <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">Essas anotações são privadas e só podem ser vistas por você. Elas serão usadas pela IA para gerar resumos mais precisos.</p>
             <textarea 
                value={client.notes || ''} 
                onChange={e => setClient(prev => ({...prev, notes: e.target.value}))}
                rows={10}
                className="w-full p-3 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                placeholder="Adicione informações importantes, preferências ou qualquer detalhe que ajude a personalizar o atendimento..."
             />
        </div>
    );
};
// #endregion

const AISummary: React.FC<{client: Client; appointments: Appointment[]}> = ({ client, appointments }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        setIsLoading(true);
        setSummary('');
        setError('');
        try {
            const result = await generateClientSummary(client, appointments);
            setSummary(result);
        } catch (e) {
            setError('Ocorreu um erro ao gerar o resumo.');
            console.error(e);
        }
        setIsLoading(false);
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm h-full flex flex-col justify-between">
            <div>
                <h4 className="font-semibold text-gray-800 dark:text-white flex items-center mb-2">
                    <Sparkles className="h-5 w-5 mr-2 text-indigo-500"/>
                    Resumo Inteligente com IA
                </h4>
                <div className="min-h-[100px]">
                    {isLoading ? (
                         <div className="flex flex-col items-center justify-center h-24 text-gray-500 dark:text-gray-400">
                            <Loader className="h-6 w-6 animate-spin mb-2" />
                            <p className="text-sm">Analisando perfil...</p>
                        </div>
                    ) : error ? (
                        <p className="text-red-500 text-sm">{error}</p>
                    ) : summary ? (
                         <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">{summary}</p>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Clique para gerar um resumo do perfil e comportamento deste cliente.
                        </p>
                    )}
                </div>
            </div>
             <button onClick={handleGenerate} disabled={isLoading} className="w-full mt-3 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:bg-indigo-400 disabled:cursor-not-allowed">
                {isLoading ? 'Analisando...' : <><Sparkles className="h-5 w-5"/><span>Gerar Resumo</span></>}
            </button>
        </div>
    )
};

const ClientCommunicationModal: React.FC<{
    client: Client;
    type: 'Follow-up' | 'Pós-Atendimento' | 'Aniversário';
    lastAppointment?: Appointment;
    onClose: () => void;
    onSendSuccess: (log: Omit<CommunicationLog, 'id'>) => void;
}> = ({ client, type, lastAppointment, onClose, onSendSuccess }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState<'email' | 'whatsapp' | null>(null);
    const [comm, setComm] = useState({ subject: '', body: '' });
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const generateComm = async () => {
            setIsLoading(true);
            try {
                const commTypeMap = { 'Follow-up': 'follow-up', 'Pós-Atendimento': 'post-service', 'Aniversário': 'birthday' } as const;
                const resultString = await generateClientCommunication(client, commTypeMap[type], lastAppointment);
                const result = JSON.parse(resultString);
                setComm(result);
            } catch (e) {
                setStatusMessage({ type: 'error', text: 'Ocorreu um erro ao gerar a mensagem.' });
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        generateComm();
    }, [client, type, lastAppointment]);

    const handleSend = async (channel: 'email' | 'whatsapp') => {
        if (!comm.body) return;
        setIsSending(channel);
        setStatusMessage(null);

        if (channel === 'email') {
            try {
                const response = await sendEmail(client, comm.subject, comm.body);
                setStatusMessage({ type: 'success', text: response });
                onSendSuccess({
                    channel: 'Email',
                    type: type,
                    subject: comm.subject,
                    content: comm.body,
                    date: new Date(),
                });
                setTimeout(onClose, 2000);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Falha ao enviar a mensagem.';
                setStatusMessage({ type: 'error', text: errorMessage });
            } finally {
                setIsSending(null);
            }
        } else if (channel === 'whatsapp') {
            if (!client.phone) {
                setStatusMessage({ type: 'error', text: 'O número de telefone do cliente não foi encontrado.' });
                setIsSending(null);
                return;
            }
            
            const cleanedPhone = client.phone.replace(/\D/g, '');
            const message = encodeURIComponent(comm.body);
            const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${message}`;
            
            window.open(whatsappUrl, '_blank');
            setStatusMessage({ type: 'success', text: 'WhatsApp aberto para envio manual.' });
            
            onSendSuccess({
                channel: 'WhatsApp',
                type: type,
                content: comm.body,
                date: new Date(),
            });

            setTimeout(() => {
                setIsSending(null);
                onClose();
            }, 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center"><MessageCircle className="h-6 w-6 mr-2 text-indigo-500"/>Gerador de Comunicação - {type}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Para: <span className="font-semibold">{client.name}</span></p>
                
                <div className="relative space-y-2">
                    <input type="text" value={comm.subject} onChange={(e) => setComm(c => ({...c, subject: e.target.value}))} placeholder="Assunto do E-mail" className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    <textarea value={isLoading ? 'Gerando mensagem...' : comm.body} onChange={(e) => setComm(c => ({...c, body: e.target.value}))} rows={8} className="w-full p-3 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none resize-y focus:ring-2 focus:ring-indigo-500"/>
                </div>
                
                {statusMessage && (
                    <div className={`mt-4 p-3 text-sm rounded-lg ${statusMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                        {statusMessage.text}
                    </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 order-last sm:order-first">Fechar</button>
                    <button onClick={() => handleSend('whatsapp')} disabled={isLoading || isSending !== null} className="py-2 px-4 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                       {isSending === 'whatsapp' ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                       Enviar por WhatsApp
                    </button>
                    <button onClick={() => handleSend('email')} disabled={isLoading || isSending !== null} className="py-2 px-4 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                       {isSending === 'email' ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                       Enviar por E-mail
                    </button>
                </div>
            </div>
        </div>
    );
};


export default Clients;

// Modal to create a new client
const CreateClientModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useAuth();
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        birthDate: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'name':
                if (!value.trim()) return 'Nome é obrigatório';
                if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
                return '';
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email inválido';
                return '';
            case 'phone':
                if (value && !/^[\d\s\-\(\)\+]+$/.test(value)) return 'Telefone inválido';
                return '';
            case 'birthDate':
                if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Data inválida';
                return '';
            default:
                return '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        
        // Validate field if touched
        if (touched[name]) {
            const error = validateField(name, value);
            setErrors(prev => ({ ...prev, [name]: error }));
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        // Validate all fields
        const newErrors: Record<string, string> = {};
        Object.keys(form).forEach(key => {
            const error = validateField(key, form[key as keyof typeof form]);
            if (error) newErrors[key] = error;
        });

        setErrors(newErrors);
        setTouched(Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

        if (Object.values(newErrors).some(error => error !== '')) {
            return;
        }

        setIsSaving(true);
        try {
            await addDoc(collection(db, 'users', user.uid, 'clients'), {
                name: form.name,
                email: form.email,
                phone: form.phone,
                birthDate: form.birthDate || null,
                avatarUrl: '',
                category: ClientCategory.New,
                totalSpent: 0,
                avgTicket: 0,
                totalAppointments: 0,
                lastVisit: serverTimestamp(),
                notes: '',
                tags: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            } as any);
            onClose();
        } catch (e) {
            console.error('Falha ao criar cliente', e);
            alert('Não foi possível criar o cliente.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Novo Cliente</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-sm mb-1">
                            Nome <span className="text-red-500">*</span>
                        </label>
                        <input 
                            name="name" 
                            value={form.name} 
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required 
                            className={`w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border ${
                                errors.name && touched.name 
                                    ? 'border-red-500 dark:border-red-500' 
                                    : 'border-gray-300 dark:border-gray-600'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.name && touched.name && (
                            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Email</label>
                        <input 
                            type="email" 
                            name="email" 
                            value={form.email} 
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border ${
                                errors.email && touched.email 
                                    ? 'border-red-500 dark:border-red-500' 
                                    : 'border-gray-300 dark:border-gray-600'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.email && touched.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Telefone</label>
                        <input 
                            name="phone" 
                            value={form.phone} 
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border ${
                                errors.phone && touched.phone 
                                    ? 'border-red-500 dark:border-red-500' 
                                    : 'border-gray-300 dark:border-gray-600'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.phone && touched.phone && (
                            <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Data de Nascimento</label>
                        <input 
                            type="date" 
                            name="birthDate" 
                            value={form.birthDate} 
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={`w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border ${
                                errors.birthDate && touched.birthDate 
                                    ? 'border-red-500 dark:border-red-500' 
                                    : 'border-gray-300 dark:border-gray-600'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.birthDate && touched.birthDate && (
                            <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>
                        )}
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:bg-indigo-400">{isSaving ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};