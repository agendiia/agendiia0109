import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Appointment, AppointmentStatus, Client, Service, ClientCategory, BrevoSettings } from '../types';
import { parseScheduleRequest, analyzeNoShowRisk, generateAppointmentCommunication } from '../services/geminiService';
import { getBrevoConnectionStatus, sendEmail, sendWhatsApp } from '../services/brevoService';
import { doc as fsDoc, getDoc as fsGetDoc } from 'firebase/firestore';
import { Calendar, Tag, User, Clock, DollarSign, MoreVertical, Plus, Edit, Trash, List, X, Search, CheckSquare, ArrowLeft, ArrowRight, Sparkles, Loader, Brain, MessageCircle, Copy, Check, Send, AlertTriangle } from './Icons';
import { db } from '@/services/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, writeBatch, where, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import useSubscriptionState from '@/hooks/useSubscriptionState';
import LimitedAccountBanner from './LimitedAccountBanner';
import { LoadingSpinner, LoadingState } from './LoadingState';
import servicePalette, { getPaletteForService } from './ServicePalette';
import PaletteLegend from './PaletteLegend';
import useServicePaletteOverride from './useServicePaletteOverride';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { useErrorHandler } from './ErrorHandling';

// Firestore-backed data


const statusStyles: { [key in AppointmentStatus]: { bg: string, text: string, border: string, activeBg: string, activeText: string } } = {
    [AppointmentStatus.Scheduled]: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-500', activeBg: 'bg-blue-600 dark:bg-blue-500', activeText: 'text-white' },
    [AppointmentStatus.Confirmed]: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300', border: 'border-green-500', activeBg: 'bg-green-600 dark:bg-green-500', activeText: 'text-white' },
    [AppointmentStatus.Finished]: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300', border: 'border-gray-500', activeBg: 'bg-gray-600 dark:bg-gray-400', activeText: 'text-white' },
    [AppointmentStatus.Canceled]: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300', border: 'border-red-500', activeBg: 'bg-red-600 dark:bg-red-500', activeText: 'text-white' },
    [AppointmentStatus.Problem]: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300', border: 'border-yellow-500', activeBg: 'bg-yellow-500 dark:bg-yellow-400', activeText: 'text-white' },
};

// Weekday color palette (Sun..Sat)
const weekdayStyles: string[] = [
    'text-red-600',    // Dom
    'text-indigo-600', // Seg
    'text-teal-600',   // Ter
    'text-yellow-600', // Qua
    'text-pink-600',   // Qui
    'text-green-600',  // Sex
    'text-blue-600',   // Sáb
];

const appointmentStatusTooltips: { [key in AppointmentStatus]: string } = {
  [AppointmentStatus.Scheduled]: "O horário foi reservado, mas ainda aguarda a confirmação do cliente.",
  [AppointmentStatus.Confirmed]: "O cliente confirmou que irá comparecer. A chance de 'no-show' é baixa.",
  [AppointmentStatus.Finished]: "A consulta foi concluída e o serviço prestado com sucesso.",
  [AppointmentStatus.Canceled]: "O agendamento foi cancelado e o horário está livre novamente.",
  [AppointmentStatus.Problem]: "Ocorreu um problema, como não comparecimento ('no-show') ou falha no pagamento. Requer atenção.",
};


const Appointments: React.FC = () => {
    const { user } = useAuth();
    const subscriptionState = useSubscriptionState();
    const { showError, showSuccess } = useErrorHandler();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const appointmentsOperation = useAsyncOperation({ isLoading: true });
  const [filter, setFilter] = useState<AppointmentStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
    const [viewMode, setViewMode] = useState<'list' | 'day' | 'week' | 'month'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isBatchOperationRunning, setIsBatchOperationRunning] = useState(false);

    // AI Feature States
  const [quickScheduleText, setQuickScheduleText] = useState('');
  const [isQuickScheduleLoading, setIsQuickScheduleLoading] = useState(false);
  const [selectedApptForComm, setSelectedApptForComm] = useState<Appointment | null>(null);
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  type RiskAnalysis = { risk: 'Baixo' | 'Médio' | 'Alto'; justification: string; isLoading: boolean };
  const [riskAnalyses, setRiskAnalyses] = useState<Map<string, RiskAnalysis>>(new Map());
  const [error, setError] = useState('');

    // Load data from Firestore
    useEffect(() => {
        if (!user) return;
        
        appointmentsOperation.execute(async () => {
            const colRef = collection(db, 'users', user.uid, 'appointments');
            const q = query(colRef, orderBy('dateTime', 'asc'));
            const unsub = onSnapshot(
                q,
                (snap) => {
                    const items: Appointment[] = snap.docs.map((d) => {
                        const data: any = d.data();
                        const dt = data.dateTime instanceof Timestamp ? data.dateTime.toDate() : new Date(data.dateTime);
                        return {
                            id: d.id,
                            clientName: data.clientName || '',
                            clientEmail: data.clientEmail || '',
                            clientPhone: data.clientPhone || '',
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
                },
                (err) => {
                    console.error('onSnapshot appointments error', err);
                    throw err;
                }
            );
            return () => unsub();
        });
    }, [user?.uid]);

    useEffect(() => {
        if (!user) return;
        // Fetch clients and services once
        const load = async () => {
            try {
                const clientsSnap = await getDocs(collection(db, 'users', user.uid, 'clients'));
                const clientsData: Client[] = clientsSnap.docs.map((d) => {
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
                        notes: data.notes,
                        tags: data.tags || [],
                    } as Client;
                });
                setClients(clientsData);
            } catch (e) {
                console.warn('Falha ao carregar clientes (coleção vazia ou sem permissão).');
                setClients([]);
            }
            try {
                const servicesSnap = await getDocs(collection(db, 'users', user.uid, 'services'));
                const servicesData: Service[] = servicesSnap.docs.map((d) => {
                    const data: any = d.data();
                    return {
                        id: d.id,
                        name: data.name || '',
                        description: data.description || '',
                        duration: Number(data.duration) || 0,
                        price: Number(data.price) || 0,
                        modality: data.modality || 'Online',
                        isActive: data.isActive ?? true,
                        paymentPolicy: data.paymentPolicy,
                    } as Service;
                });
                setServices(servicesData);
            } catch (e) {
                console.warn('Falha ao carregar serviços (coleção vazia ou sem permissão).');
                setServices([]);
            }
        };
        load();
    }, [user?.uid]);


    const filteredAppointments = useMemo(() => {
    return appointments
      .filter(app => {
        if (filter === 'all') return true;
        return app.status === filter;
      })
      .filter(app => {
          if (viewMode !== 'list' || (!dateFilter.start && !dateFilter.end)) return true;
          const appDate = new Date(app.dateTime);
          appDate.setHours(0,0,0,0);
          const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
          const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
          if(startDate) startDate.setUTCHours(0,0,0,0);
          if(endDate) endDate.setUTCHours(0,0,0,0);

          if (startDate && appDate < startDate) return false;
          if (endDate && appDate > endDate) return false;
          return true;
      })
      .filter(app => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return (
            app.clientName.toLowerCase().includes(query) ||
            app.service.toLowerCase().includes(query) ||
            app.status.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
  }, [filter, appointments, dateFilter, searchQuery, viewMode]);
  
        const handleOpenModal = (app: Appointment | null) => {
    // If trying to create a new appointment (app === null) ensure user is not limited
    const { isLimited } = subscriptionState || { isLimited: false };
    if (!app && isLimited) {
        // Show a friendly alert and do not open the modal
        alert('Sua conta está no modo gratuito limitado. Por favor escolha um plano para criar novos agendamentos.');
        return;
    }
    setEditingAppointment(app);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
      setIsModalOpen(false);
      setEditingAppointment(null);
  }

    // ✨ NOVA FUNCIONALIDADE: Conversão automática de agendamento para cliente
    const createOrUpdateClientFromAppointment = async (appointment: Appointment) => {
        if (!user) return;
        
        // Só converte quando status é "Confirmado" ou "Finalizado"
        const shouldConvert = appointment.status === AppointmentStatus.Confirmed || 
                             appointment.status === AppointmentStatus.Finished;
        
        if (!shouldConvert) return;
        
        try {
            const clientsRef = collection(db, 'users', user.uid, 'clients');
            
            // Buscar cliente existente pelo nome
            const existingClientQuery = query(
                clientsRef, 
                where('name', '==', appointment.clientName)
            );
            const existingClientSnap = await getDocs(existingClientQuery);
            
            if (existingClientSnap.empty) {
                // CRIAR NOVO CLIENTE
                const newClient = {
                    name: appointment.clientName,
                    email: '', // Pode ser extraído do agendamento se disponível
                    phone: '', // Pode ser extraído do agendamento se disponível
                    avatarUrl: '',
                    category: ClientCategory.New,
                    totalSpent: appointment.status === AppointmentStatus.Finished ? appointment.price : 0,
                    avgTicket: appointment.status === AppointmentStatus.Finished ? appointment.price : 0,
                    totalAppointments: appointment.status === AppointmentStatus.Finished ? 1 : 0,
                    lastVisit: appointment.dateTime,
                    notes: `Cliente criado automaticamente do agendamento: ${appointment.service} (${appointment.status})`,
                    tags: [appointment.service],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                
                await addDoc(clientsRef, newClient);
                showSuccess(`✅ Novo cliente criado: ${appointment.clientName}`);
                
            } else {
                // ATUALIZAR CLIENTE EXISTENTE
                const clientDoc = existingClientSnap.docs[0];
                const clientData = clientDoc.data() as Client;
                
                // Só atualiza valores financeiros se o agendamento foi finalizado
                const updateData: any = {
                    lastVisit: appointment.dateTime,
                    updatedAt: serverTimestamp(),
                    tags: arrayUnion(appointment.service)
                };
                
                if (appointment.status === AppointmentStatus.Finished) {
                    const updatedTotalSpent = clientData.totalSpent + appointment.price;
                    const updatedTotalAppointments = clientData.totalAppointments + 1;
                    const updatedAvgTicket = updatedTotalSpent / updatedTotalAppointments;
                    
                    // Determinar nova categoria baseada no histórico
                    let newCategory = clientData.category;
                    if (updatedTotalAppointments >= 10 && updatedTotalSpent >= 2000) {
                        newCategory = ClientCategory.VIP;
                    } else if (updatedTotalAppointments >= 5) {
                        newCategory = ClientCategory.Fiel;
                    }
                    
                    updateData.totalSpent = updatedTotalSpent;
                    updateData.totalAppointments = updatedTotalAppointments;
                    updateData.avgTicket = updatedAvgTicket;
                    updateData.category = newCategory;
                }
                
                await updateDoc(clientDoc.ref, updateData);
                
                const action = appointment.status === AppointmentStatus.Finished ? 'atualizado' : 'registrado';
                showSuccess(`✅ Cliente ${action}: ${appointment.clientName}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao criar/atualizar cliente:', error);
            showError('Erro ao atualizar dados do cliente', 'Tente novamente.');
        }
    };

    const handleSaveAppointment = async (app: Appointment) => {
        if (!user) return;
        const colRef = collection(db, 'users', user.uid, 'appointments');
        try {
            const previousStatus = editingAppointment?.status;
            const newStatus = app.status;
            
                if (editingAppointment && editingAppointment.id) {
                const docRef = doc(db, 'users', user.uid, 'appointments', editingAppointment.id);
                // Build payload and preserve existing paymentStatus when modal doesn't provide it
                const updatePayload: any = {
                    clientName: app.clientName,
                    clientEmail: (app as any).clientEmail || '',
                    clientPhone: (app as any).clientPhone || '',
                    service: app.service,
                    dateTime: Timestamp.fromDate(new Date(app.dateTime)),
                    duration: app.duration,
                    status: app.status,
                    modality: app.modality,
                    price: app.price,
                    updatedAt: serverTimestamp(),
                } as any;
                // If the form explicitly provided a paymentStatus, use it. Otherwise keep the existing one.
                if ((app as any).paymentStatus !== undefined) {
                    updatePayload.paymentStatus = (app as any).paymentStatus;
                } else if (editingAppointment.paymentStatus !== undefined) {
                    updatePayload.paymentStatus = editingAppointment.paymentStatus;
                } else {
                    updatePayload.paymentStatus = null;
                }

                await updateDoc(docRef, updatePayload);

                // ✨ CONVERSÃO AUTOMÁTICA: Verificar se mudou para status que gera cliente
                const shouldCreateClient = (
                    (newStatus === AppointmentStatus.Confirmed && previousStatus !== AppointmentStatus.Confirmed) ||
                    (newStatus === AppointmentStatus.Finished && previousStatus !== AppointmentStatus.Finished)
                );
                
                if (shouldCreateClient) {
                    await createOrUpdateClientFromAppointment(app);
                }
                
                // transactional: on status changes send correspondents
                try { await maybeSendTransactional(app, 'update'); } catch {}
            } else {
                await addDoc(colRef, {
                    clientName: app.clientName,
                    clientEmail: (app as any).clientEmail || '',
                    clientPhone: (app as any).clientPhone || '',
                    service: app.service,
                    dateTime: Timestamp.fromDate(new Date(app.dateTime)),
                    duration: app.duration,
                    status: app.status,
                    modality: app.modality,
                    price: app.price,
                    paymentStatus: (app as any).paymentStatus || null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                } as any);

                // ✨ CONVERSÃO AUTOMÁTICA: Se criado como "Confirmado" ou "Finalizado"
                if (newStatus === AppointmentStatus.Confirmed || newStatus === AppointmentStatus.Finished) {
                    await createOrUpdateClientFromAppointment(app);
                }
                
                // transactional: on create send scheduling confirmation
                try { await maybeSendTransactional(app, 'create'); } catch {}
            }
            handleCloseModal();
        } catch (e) {
            console.error('Failed to save appointment', e);
            showError('Não foi possível salvar o agendamento.', 'Tente novamente.');
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (!user) return;
        if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'appointments', id));
            } catch (e) {
                console.error('Delete failed', e);
                alert('Falha ao excluir.');
            }
        }
    };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedAppointmentIds(filteredAppointments.map(a => a.id));
    } else {
        setSelectedAppointmentIds([]);
    }
  };

  const handleSelectionChange = (id: string) => {
    setSelectedAppointmentIds(prev =>
        prev.includes(id) ? prev.filter(appId => appId !== id) : [...prev, id]
    );
  };

    const handleBatchAction = async (status: AppointmentStatus) => {
        if (!user) return;
        if (selectedAppointmentIds.length === 0) return;
        if (isBatchOperationRunning) {
            alert('Aguarde a operação anterior finalizar.');
            return;
        }
        
        if (window.confirm(`Tem certeza que deseja alterar ${selectedAppointmentIds.length} agendamentos para "${status}"?`)) {
            setIsBatchOperationRunning(true);
            try {
                const batch = writeBatch(db);
                const targetIds = [...selectedAppointmentIds]; // Create snapshot of IDs
                
                targetIds.forEach((id) => {
                    const ref = doc(db, 'users', user.uid, 'appointments', id);
                    batch.update(ref, { status, updatedAt: serverTimestamp() } as any);
                });
                
                await batch.commit();
                setSelectedAppointmentIds([]);
                
                // ✨ CONVERSÃO AUTOMÁTICA EM LOTE: Se mudou para "Confirmado" ou "Finalizado"
                if (status === AppointmentStatus.Confirmed || status === AppointmentStatus.Finished) {
                    const affectedAppointments = appointments.filter(a => targetIds.includes(a.id));
                    let clientsUpdated = 0;
                    
                    for (const appointment of affectedAppointments) {
                        const previousStatus = appointment.status;
                        // Só converte se não estava já neste status
                        if (previousStatus !== status) {
                            await createOrUpdateClientFromAppointment({ ...appointment, status });
                            clientsUpdated++;
                        }
                        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
                    }
                    
                    if (clientsUpdated > 0) {
                        const statusText = status === AppointmentStatus.Confirmed ? 'confirmados' : 'finalizados';
                        showSuccess(`✅ ${clientsUpdated} agendamentos ${statusText} e clientes atualizados!`);
                    }
                }
                
                // transactional: fire a send for batch operations
                try {
                    const affected = appointments.filter(a => targetIds.includes(a.id));
                    // Process transactional emails sequentially to avoid rate limits
                    for (const ap of affected) { 
                        await maybeSendTransactional({ ...ap, status }, 'status'); 
                        // Small delay between emails to prevent rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (emailError) {
                    console.warn('Batch email sending failed:', emailError);
                }
            } catch (e) {
                console.error('Batch update failed', e);
                showError('Falha ao atualizar em lote.', 'Tente novamente.');
            } finally {
                setIsBatchOperationRunning(false);
            }
        }
    };

  // --- AI Feature Handlers ---
    const handleQuickSchedule = async () => {
      if (!quickScheduleText.trim()) return;
      setIsQuickScheduleLoading(true);
      setError('');
      try {
          const resultString = await parseScheduleRequest(quickScheduleText);
          const result = JSON.parse(resultString);

                    const client = clients.find(c => c.name?.toLowerCase?.() === result.clientName?.toLowerCase());
                    const service = services.find(s => s.name?.toLowerCase?.() === result.serviceName?.toLowerCase());

          const partialAppointment: Appointment = {
              id: '',
              clientName: client?.name || result.clientName || '',
              service: service?.name || result.serviceName || '',
              dateTime: result.dateTime ? new Date(result.dateTime) : new Date(),
              duration: service?.duration || 0,
              status: AppointmentStatus.Scheduled,
              modality: (service?.modality === 'Híbrido' ? 'Online' : service?.modality) || 'Online',
              price: service?.price || 0,
          };
          
          handleOpenModal(partialAppointment);
          setQuickScheduleText('');

      } catch (e) {
          console.error("Error parsing schedule request:", e);
          setError("Não foi possível entender o agendamento. Tente ser mais específico, por exemplo: 'Agendar [Nome do Cliente] para [Nome do Serviço] amanhã às 10h'.");
      } finally {
          setIsQuickScheduleLoading(false);
      }
  };
  
  const handleAnalyzeRisk = async (appointment: Appointment) => {
    const client = clients.find(c => c.name === appointment.clientName);
      if (!client) {
          alert("Cliente não encontrado para análise.");
          return;
      }

      setRiskAnalyses(prev => new Map(prev).set(appointment.id, { ...prev.get(appointment.id) as any, isLoading: true }));
      
      try {
          const clientAppointments = appointments.filter(a => a.clientName === client.name);
          const resultString = await analyzeNoShowRisk(client, clientAppointments);
          const result = JSON.parse(resultString);
          setRiskAnalyses(prev => new Map(prev).set(appointment.id, { risk: result.risk, justification: result.justification, isLoading: false }));
      } catch (e) {
          console.error("Error analyzing risk:", e);
          setRiskAnalyses(prev => new Map(prev).set(appointment.id, { ...prev.get(appointment.id) as any, isLoading: false }));
          alert("Ocorreu um erro ao analisar o risco.");
      }
  };
  
  const handleOpenCommModal = (app: Appointment) => {
      setSelectedApptForComm(app);
      setIsCommModalOpen(true);
  };

  const handleCloseCommModal = () => {
      setIsCommModalOpen(false);
      setSelectedApptForComm(null);
  };


    const [showLegend, setShowLegend] = useState(false);
    const { overrides, isLoading: overridesLoading } = useServicePaletteOverride();

    const renderView = () => {
    switch (viewMode) {
        case 'list':
            return <ListView appointments={filteredAppointments} onEdit={handleOpenModal} onDelete={handleDeleteAppointment} selectedIds={selectedAppointmentIds} onSelect={handleSelectionChange} riskAnalyses={riskAnalyses} onAnalyzeRisk={handleAnalyzeRisk} onOpenCommModal={handleOpenCommModal} services={services} overrides={overrides} currentUid={user?.uid || ''}/>;
        case 'day':
            return <DayView appointments={appointments} onEdit={handleOpenModal} currentDate={currentDate} setCurrentDate={setCurrentDate} services={services} overrides={overrides} />;
        case 'week':
            return <WeekView appointments={appointments} onEdit={handleOpenModal} currentDate={currentDate} setCurrentDate={setCurrentDate} services={services} overrides={overrides} />;
        case 'month':
            return <MonthView appointments={appointments} onEdit={handleOpenModal} currentDate={currentDate} setCurrentDate={setCurrentDate} services={services} overrides={overrides} />;
        default:
            return null;
    }
  };
  
  const isAllSelected = useMemo(() => {
    if (filteredAppointments.length === 0) return false;
    return selectedAppointmentIds.length === filteredAppointments.length;
  }, [selectedAppointmentIds, filteredAppointments]);

  return (
    <div className="space-y-6">
      <LoadingState 
        loading={appointmentsOperation.isLoading}
        loadingComponent={<LoadingSpinner text="Carregando agendamentos..." />}
        error={appointmentsOperation.error}
        errorComponent={
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-400">Erro ao carregar agendamentos. Tente novamente.</p>
          </div>
        }
      >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gestão de Agendamentos</h1>
                                        <div className="flex items-center gap-3">
                        <button onClick={() => handleOpenModal(null)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Novo Agendamento</span>
                        </button>
                        <button onClick={() => setShowLegend(s => !s)} className="border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 text-sm">{showLegend ? 'Ocultar Legenda' : 'Mostrar Legenda'}</button>
                        <button onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'settings' } }))} className="border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 text-sm">Abrir Configurações</button>
                    </div>
        </div>

    <div className="bg-indigo-50 dark:bg-gray-900/50 p-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-white flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-indigo-500" />
                Agendamento Rápido com IA
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    type="text"
                    value={quickScheduleText}
                    onChange={(e) => setQuickScheduleText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickSchedule()}
                    placeholder="Ex: Agendar Ana Clara para Sessão de Terapia amanhã às 15h"
                    className="flex-grow p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    onClick={handleQuickSchedule}
                    disabled={isQuickScheduleLoading}
                    className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center justify-center space-x-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                    {isQuickScheduleLoading ? <Loader className="h-5 w-5 animate-spin"/> : <Plus />}
                    <span>Agendar</span>
                </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-4">
        
        {/* Search & View Toggles */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-72">
                <Search className="h-5 w-5 absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text"
                    placeholder="Buscar cliente, serviço, status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-transparent focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
            </div>
            <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                {(['list', 'day', 'week', 'month'] as const).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all capitalize ${viewMode === mode ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        {mode === 'list' && 'Lista'}
                        {mode === 'day' && 'Dia'}
                        {mode === 'week' && 'Semana'}
                        {mode === 'month' && 'Mês'}
                    </button>
                ))}
            </div>
        </div>

        {/* Batch Action Bar */}
        {selectedAppointmentIds.length > 0 && viewMode === 'list' && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50">
                <span className="font-semibold text-indigo-800 dark:text-indigo-200">{selectedAppointmentIds.length} selecionado(s)</span>
                <div className="flex items-center space-x-2">
                    <button onClick={() => handleBatchAction(AppointmentStatus.Confirmed)} className="text-sm font-semibold text-green-700 bg-green-200 hover:bg-green-300 px-3 py-1 rounded-md">Confirmar</button>
                    <button onClick={() => handleBatchAction(AppointmentStatus.Canceled)} className="text-sm font-semibold text-red-700 bg-red-200 hover:bg-red-300 px-3 py-1 rounded-md">Cancelar</button>
                    <button onClick={() => setSelectedAppointmentIds([])} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><X className="h-4 w-4" /></button>
                </div>
            </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Todos</button>
            {Object.values(AppointmentStatus).map(status => {
                const s = statusStyles[status as AppointmentStatus];
                const isActive = filter === status;
                const base = isActive ? `${s.activeBg} ${s.activeText}` : `${s.bg} ${s.text}`;
                const outline = isActive ? '' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600';
                return (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${base} ${isActive ? '' : outline}`}
                    >
                        {status}
                    </button>
                )
            })}
        </div>
        
        {/* Date Filters for List View */}
        {viewMode === 'list' && (
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label htmlFor="startDate" className="text-sm font-medium text-gray-600 dark:text-gray-400">De</label>
                    <input type="date" id="startDate" value={dateFilter.start} onChange={(e) => setDateFilter(f => ({...f, start: e.target.value}))} className="w-full mt-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div className="flex-1">
                    <label htmlFor="endDate" className="text-sm font-medium text-gray-600 dark:text-gray-400">Até</label>
                    <input type="date" id="endDate" value={dateFilter.end} onChange={(e) => setDateFilter(f => ({...f, end: e.target.value}))} className="w-full mt-1 p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"/>
                </div>
            </div>
        )}
        
        {/* List Header for Select All */}
        {viewMode === 'list' && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
                <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label="Selecionar todos os agendamentos"
                />
            </div>
        )}

        <div className="mt-4">
            {showLegend && <div className="mb-4"><PaletteLegend services={services} /></div>}
            {renderView()}
        </div>

      </div>
      </LoadingState>
    {isModalOpen && <AppointmentModal appointment={editingAppointment} onSave={handleSaveAppointment} onClose={handleCloseModal} clients={clients} services={services} />}
    {isCommModalOpen && <CommunicationModal appointment={selectedApptForComm!} onClose={handleCloseCommModal} clients={clients} />}
    </div>
  );
};


// #region List View Components
const ListView: React.FC<{appointments: Appointment[], onEdit: (app: Appointment) => void, onDelete: (id: string) => void, selectedIds: string[], onSelect: (id: string) => void, riskAnalyses: Map<string, any>, onAnalyzeRisk: (app: Appointment) => void, onOpenCommModal: (app: Appointment) => void, services: Service[], overrides: Record<string, number>, currentUid: string}> = ({ appointments, onEdit, onDelete, selectedIds, onSelect, riskAnalyses, onAnalyzeRisk, onOpenCommModal, services, overrides, currentUid }) => (
    <div className="overflow-x-auto">
        <ul className="space-y-4">
        {appointments.map(app => (
            <AppointmentListItem key={app.id} appointment={app} onEdit={() => onEdit(app)} onDelete={() => onDelete(app.id)} isSelected={selectedIds.includes(app.id)} onSelect={() => onSelect(app.id)} riskAnalysis={riskAnalyses.get(app.id)} onAnalyzeRisk={() => onAnalyzeRisk(app)} onOpenCommModal={() => onOpenCommModal(app)} services={services} overrides={overrides} currentUid={currentUid} />
        ))}
        {appointments.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum agendamento encontrado para os filtros selecionados.</p>}
        </ul>
    </div>
);

const RiskIndicator: React.FC<{ analysis: { risk: string; justification: string } | null }> = ({ analysis }) => {
    if (!analysis) return null;

    const riskColor = {
        'Baixo': 'text-green-500',
        'Médio': 'text-yellow-500',
        'Alto': 'text-red-500',
    }[analysis.risk] || 'text-gray-500';

    return (
        <div className="relative group">
            <span className={`font-semibold text-xs flex items-center ${riskColor}`}>
                <Brain className="h-4 w-4 mr-1"/> Risco: {analysis.risk}
            </span>
            <div className="absolute bottom-full left-0 mb-2 w-max max-w-xs scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100 z-20 origin-bottom">
                {analysis.justification}
            </div>
        </div>
    );
};

const AppointmentListItem: React.FC<{appointment: Appointment, onEdit: () => void, onDelete: () => void, isSelected: boolean, onSelect: () => void, riskAnalysis?: any, onAnalyzeRisk: () => void, onOpenCommModal: () => void, services?: Service[], overrides?: Record<string, number>, currentUid?: string}> = ({appointment, onEdit, onDelete, isSelected, onSelect, riskAnalysis, onAnalyzeRisk, onOpenCommModal, services, overrides, currentUid}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const accent = statusStyles[appointment.status];
    const svcPal = getPaletteForService(appointment.service, services, overrides);
    return (
        <li className={`p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 border-l-4 ${accent.border} ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : accent.bg}`}>
            <input
                type="checkbox"
                checked={isSelected}
                onChange={onSelect}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                aria-label={`Selecionar agendamento de ${appointment.clientName}`}
            />
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-4 items-center relative w-full">
                <div className="col-span-2 md:col-span-2 lg:col-span-2">
                    <p className="font-bold text-gray-800 dark:text-white flex items-center"><User className="h-4 w-4 mr-2 text-gray-500" /> {appointment.clientName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center"><Tag className="h-4 w-4 mr-2 text-gray-500" /> 
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${svcPal.selectedBg}`} />
                        {appointment.service}
                    </p>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                    <p className="flex items-center"><Calendar className="h-4 w-4 mr-2 text-gray-500" />{appointment.dateTime.toLocaleDateString('pt-BR')}</p>
                    <p className="flex items-center"><Clock className="h-4 w-4 mr-2 text-gray-500" />{appointment.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex flex-col items-start space-y-1.5">
                    <div className="flex items-center relative group">
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusStyles[appointment.status].bg} ${statusStyles[appointment.status].text}`}>{appointment.status}</span>
                        <span className="absolute bottom-full mb-2 w-max max-w-xs scale-0 rounded bg-gray-800 p-2 text-xs text-white transition-all group-hover:scale-100 z-20 origin-bottom">
                            {appointmentStatusTooltips[appointment.status]}
                        </span>
                    </div>
                     {riskAnalysis?.isLoading 
                        ? <Loader className="h-4 w-4 animate-spin text-gray-400"/> 
                        : <RiskIndicator analysis={riskAnalysis || null} />
                    }
                </div>
                <div className="hidden lg:flex flex-col text-sm text-gray-600 dark:text-gray-300 items-start">
                    <span>{appointment.modality}</span>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-gray-500"/>R$ {appointment.price.toFixed(2)}</span>
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${appointment.paymentStatus === 'Pago' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'}`}>{appointment.paymentStatus || 'Pendente'}</span>
                    </div>
                </div>
                <div className="flex justify-end col-start-2 md:col-start-auto">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} onBlur={() => setTimeout(() => setIsMenuOpen(false), 150)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-10 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                            <button onClick={onEdit} className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"><Edit className="h-4 w-4 mr-2"/> Editar</button>
                            <button onClick={onAnalyzeRisk} className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"><Brain className="h-4 w-4 mr-2"/> Analisar Risco</button>
                            <button onClick={onOpenCommModal} className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"><MessageCircle className="h-4 w-4 mr-2"/> Comunicação</button>
                            <button onClick={async () => {
                                if (!window.confirm('Marcar este agendamento como pago e confirmar?')) return;
                                try {
                                    const uid = currentUid || (window as any).__CURRENT_USER_UID;
                                    if (!uid) throw new Error('Usuário não identificado');
                                    await updateDoc(doc(db, 'users', uid, 'appointments', appointment.id), { paymentStatus: 'Pago', status: 'Confirmado', updatedAt: serverTimestamp() } as any);
                                    const ev = new CustomEvent('appt:paid', { detail: { id: appointment.id }});
                                    window.dispatchEvent(ev);
                                } catch (e) {
                                    console.error('Erro ao marcar como pago', e);
                                    alert('Falha ao marcar como pago');
                                }
                            }} className="flex items-center w-full px-4 py-2 text-sm text-left text-green-700 dark:text-green-300 hover:bg-gray-100 dark:hover:bg-gray-600"><Check className="h-4 w-4 mr-2"/> Marcar como pago</button>
                             <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
                            <button onClick={onDelete} className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"><Trash className="h-4 w-4 mr-2"/> Excluir</button>
                        </div>
                    )}
                </div>
            </div>
        </li>
    )
};
// #endregion

// #region Calendar View Components

const CalendarHeader: React.FC<{currentDate: Date, viewMode: 'day'|'week'|'month', onNavigate: (amount: number) => void}> = ({ currentDate, viewMode, onNavigate }) => {
    const formatTitle = () => {
        switch(viewMode) {
            case 'day': return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            case 'week':
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                return `${startOfWeek.toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'})} - ${endOfWeek.toLocaleDateString('pt-BR', {day: 'numeric', month: 'short', year: 'numeric'})}`
            case 'month': return currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        }
    }
    return (
         <div className="flex justify-between items-center mb-4">
            <button onClick={() => onNavigate(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowLeft/></button>
            <h2 className="text-xl font-semibold text-center">{formatTitle()}</h2>
            <button onClick={() => onNavigate(1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowRight/></button>
        </div>
    );
};

const MonthView: React.FC<{ appointments: Appointment[], onEdit: (app: Appointment) => void, currentDate: Date, setCurrentDate: React.Dispatch<React.SetStateAction<Date>>, services?: Service[], overrides?: Record<string, number> }> = ({ appointments, onEdit, currentDate, setCurrentDate, services, overrides }) => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const appointmentsByDate = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        appointments.forEach(app => {
            const dateStr = app.dateTime.toISOString().split('T')[0];
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)!.push(app);
        });
        return map;
    }, [appointments]);

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    }

    return (
        <div className="p-2">
            <CalendarHeader currentDate={currentDate} viewMode="month" onNavigate={changeMonth} />
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => <div key={day} className={`py-2 ${weekdayStyles[idx]} dark:opacity-80`}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dailyAppointments = appointmentsByDate.get(dateStr) || [];
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                    return (
                        <div key={dateStr} className={`h-28 border border-gray-200 dark:border-gray-700 rounded-lg p-2 flex flex-col ${isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                            <span className={`font-semibold ${isCurrentMonth ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{d.getDate()}</span>
                            <div className="mt-1 space-y-1 overflow-y-auto">
                               {dailyAppointments.slice(0, 2).map(app => (
                                              <div 
                                                  key={app.id} 
                                                  onClick={() => onEdit(app)} 
                                                  className={`text-xs p-1 rounded text-white truncate cursor-pointer ${statusStyles[app.status].bg} ${statusStyles[app.status].text}`}
                                                  title={`${app.clientName} - ${app.status}: ${appointmentStatusTooltips[app.status]}`}
                                                >
                                                    {app.clientName}
                                              </div>
                               ))}
                                {dailyAppointments.length > 2 && <div className="text-xs text-gray-500 dark:text-gray-400">+ {dailyAppointments.length - 2} mais</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DayView: React.FC<{ appointments: Appointment[], onEdit: (app: Appointment) => void, currentDate: Date, setCurrentDate: React.Dispatch<React.SetStateAction<Date>>, services?: Service[], overrides?: Record<string, number> }> = ({ appointments, onEdit, currentDate, setCurrentDate, services, overrides }) => {
    const changeDay = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + amount);
        setCurrentDate(newDate);
    };

    const dayAppointments = appointments.filter(app => app.dateTime.toDateString() === currentDate.toDateString());

    return (
        <div>
            <CalendarHeader currentDate={currentDate} viewMode="day" onNavigate={changeDay} />
        <div className="flex" style={{height: '720px'}}> {/* 12 hours * 60px/hour */}
                <Timeline startHour={8} endHour={20} />
                <div className="flex-grow grid grid-cols-1 relative">
            <DayColumn date={currentDate} appointments={dayAppointments} onEdit={onEdit} services={services} overrides={overrides} />
                </div>
            </div>
        </div>
    );
};

const WeekView: React.FC<{ appointments: Appointment[], onEdit: (app: Appointment) => void, currentDate: Date, setCurrentDate: React.Dispatch<React.SetStateAction<Date>>, services?: Service[], overrides?: Record<string, number> }> = ({ appointments, onEdit, currentDate, setCurrentDate, services, overrides }) => {
    const changeWeek = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (amount * 7));
        setCurrentDate(newDate);
    };

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return Array.from({ length: 7 }).map((_, i) => {
            const day = new Date(startOfWeek);
            day.setDate(day.getDate() + i);
            return day;
        });
    }, [currentDate]);

    return (
        <div>
            <CalendarHeader currentDate={currentDate} viewMode="week" onNavigate={changeWeek} />
            <div className="flex" style={{height: '720px'}}> {/* 12 hours * 60px/hour */}
                <Timeline startHour={8} endHour={20} />
                <div className="flex-grow grid grid-cols-7">
                    {weekDays.map(day => (
                        <DayColumn 
                            key={day.toISOString()}
                            date={day}
                            appointments={appointments.filter(app => app.dateTime.toDateString() === day.toDateString())}
                            onEdit={onEdit}
                            isWeekView
                            services={services}
                            overrides={overrides}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Timeline: React.FC<{startHour: number, endHour: number}> = ({ startHour, endHour }) => {
    const hours = Array.from({length: endHour - startHour}, (_, i) => startHour + i);
    return (
        <div className="w-16 text-right pr-2 border-r border-gray-200 dark:border-gray-700">
            {hours.map(hour => (
                <div key={hour} className="h-[60px] text-xs text-gray-400 dark:text-gray-500 relative -top-2">
                    {`${hour}:00`}
                </div>
            ))}
        </div>
    );
};

const DayColumn: React.FC<{date: Date, appointments: Appointment[], onEdit: (app: Appointment) => void, isWeekView?: boolean, services?: Service[], overrides?: Record<string, number>}> = ({ date, appointments, onEdit, isWeekView, services, overrides }) => {
    const hourHeight = 60;
    const startHour = 8;
    const isToday = date.toDateString() === new Date().toDateString();

    const getPosition = (appointment: Appointment) => {
        const start = appointment.dateTime;
        const top = ((start.getHours() - startHour) * hourHeight) + (start.getMinutes() / 60 * hourHeight);
        const height = (appointment.duration / 60) * hourHeight;
        return { top, height };
    };

    return (
        <div className="relative border-r border-gray-200 dark:border-gray-700">
            {isWeekView && (
                <div className={`text-center py-2 border-b border-gray-200 dark:border-gray-700 ${isToday ? 'font-bold' : ''}`}>
                    <p className={`text-sm ${weekdayStyles[date.getDay()]}`}>{date.toLocaleDateString('pt-BR', {weekday: 'short'})}</p>
                    <p className={`text-lg ${weekdayStyles[date.getDay()]}`}>{date.getDate()}</p>
                </div>
            )}
            {/* Draw horizontal lines for hours */}
            {Array.from({length: 12}).map((_, i) => <div key={i} className="h-[60px] border-b border-gray-200 dark:border-gray-700"></div>)}

            {/* Render appointments */}
                {appointments.map(app => {
                    const { top, height } = getPosition(app);
                    const style = statusStyles[app.status];
                    const pal = getPaletteForService(app.service, services, overrides);
                return (
                    <div 
                        key={app.id} 
                        onClick={() => onEdit(app)}
                        className={`absolute left-1 right-1 p-2 rounded-lg cursor-pointer text-white flex flex-col justify-start overflow-hidden ${style.bg} border-l-4 ${style.border}`}
                        style={{ top: `${top}px`, height: `${height - 2}px` }} // -2 for small gap
                        title={`${app.clientName} - ${app.status}: ${appointmentStatusTooltips[app.status]}`}
                    >
                        <div className="flex items-center justify-between">
                            <p className={`font-bold text-sm ${style.text}`}>{app.clientName}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pal.selectedBg} ${pal.selectedText}`}>{app.service}</span>
                        </div>
                        <p className={`text-xs opacity-80 ${style.text}`}>{new Date(app.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                );
            })}
        </div>
    );
};

// #endregion


// #region Modal Components
interface AppointmentModalProps {
    appointment: Appointment | null;
    onSave: (appointment: Appointment) => void;
    onClose: () => void;
    clients: Client[];
    services: Service[];
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ appointment, onSave, onClose, clients, services }) => {
    const [formData, setFormData] = useState({
        clientName: appointment?.clientName || '',
        clientEmail: (appointment as any)?.clientEmail || '',
        clientPhone: (appointment as any)?.clientPhone || '',
        service: appointment?.service || '',
        dateTime: appointment ? new Date(appointment.dateTime.getTime() - (appointment.dateTime.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '',
        status: appointment?.status || AppointmentStatus.Scheduled,
        modality: appointment?.modality || 'Online',
        price: appointment?.price || 0,
        duration: appointment?.duration || 0,
    });
    
    const selectedService = services.find(s => s.name === formData.service);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'service') {
            const service = services.find(s => s.name === value);
            if (service) {
                setFormData(prev => ({
                    ...prev, 
                    service: value,
                    price: service.price,
                    duration: service.duration,
                    modality: service.modality === 'Híbrido' ? 'Online' : service.modality
                }));
            }
        } else {
             setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            id: appointment?.id || '',
            dateTime: new Date(formData.dateTime),
            price: Number(formData.price),
            duration: Number(formData.duration),
        } as Appointment);
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                        {appointment && appointment.id ? 'Editar Agendamento' : 'Novo Agendamento'}
                    </h2>
                    
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                                                {clients.length > 0 ? (
                                                    <select name="clientName" id="clientName" value={formData.clientName} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                                                        <option value="" disabled>Selecione um cliente</option>
                                                        {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    </select>
                                                ) : (
                                                    <input name="clientName" id="clientName" value={formData.clientName} onChange={handleChange} required placeholder="Digite o nome do cliente" className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                                                )}
                                            </div>

                                            <div>
                                                <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
                                                <input name="clientEmail" id="clientEmail" value={formData.clientEmail} onChange={handleChange} placeholder="exemplo@cliente.com" className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serviço</label>
                                                {services.length > 0 ? (
                                                    <select name="service" id="service" value={formData.service} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                                                        <option value="" disabled>Selecione um serviço</option>
                                                        {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                    </select>
                                                ) : (
                                                    <input name="service" id="service" value={formData.service} onChange={handleChange} required placeholder="Digite o serviço" className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                                                )}
                                            </div>

                                            <div>
                                                <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
                                                <input name="clientPhone" id="clientPhone" value={formData.clientPhone} onChange={handleChange} placeholder="(11) 9xxxx-xxxx" className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                                            </div>
                                        </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data e Hora</label>
                            <input type="datetime-local" name="dateTime" id="dateTime" value={formData.dateTime} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                        </div>

                        <div>
                            <label htmlFor="modality" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modalidade</label>
                            <select name="modality" id="modality" value={formData.modality} onChange={handleChange} className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                                <option value="Online">Online</option>
                                <option value="Presencial">Presencial</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                            <select name="status" id="status" value={formData.status} onChange={handleChange} className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                               {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {/* paymentStatus intentionally removed from modal per UX request */}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div>
                            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duração (min)</label>
                            <input type="number" name="duration" id="duration" value={formData.duration} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço (R$)</label>
                            <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CommunicationModal: React.FC<{ appointment: Appointment, onClose: () => void, clients: Client[] }> = ({ appointment, onClose, clients }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState<'email' | 'whatsapp' | null>(null);
    const [commType, setCommType] = useState<'confirmation' | 'reminder' | 'followup' | null>(null);
    const [generatedComm, setGeneratedComm] = useState<{ subject: string; body: string } | null>(null);
    const [isBrevoConnected, setIsBrevoConnected] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        // Simulating checking the connection status
        const checkConnection = async () => {
            const status = await getBrevoConnectionStatus();
            setIsBrevoConnected(status);
        };
        checkConnection();
    }, []);

    const handleGenerate = async (type: 'confirmation' | 'reminder' | 'followup') => {
        setIsLoading(true);
        setCommType(type);
        setGeneratedComm(null);
        setStatusMessage(null);
        try {
            const resultString = await generateAppointmentCommunication(appointment, type);
            const result = JSON.parse(resultString);
            setGeneratedComm(result);
        } catch (e) {
            setStatusMessage({ type: 'error', text: 'Ocorreu um erro ao gerar a mensagem.' });
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (channel: 'email' | 'whatsapp') => {
        if (!generatedComm) return;
        
        const client = clients.find(c => c.name === appointment.clientName);
        if (!client) {
            setStatusMessage({ type: 'error', text: 'Cliente não encontrado para envio.' });
            return;
        }

        setIsSending(channel);
        setStatusMessage(null);
        try {
            let response;
            if (channel === 'email') {
                response = await sendEmail(client, generatedComm.subject, generatedComm.body);
            } else {
                response = await sendWhatsApp(client, generatedComm.body);
            }
            setStatusMessage({ type: 'success', text: response });
            setTimeout(() => setStatusMessage(null), 4000);
        } catch (e) {
            setStatusMessage({ type: 'error', text: 'Falha ao enviar a mensagem.' });
            console.error(e);
        } finally {
            setIsSending(null);
        }
    };

    const getButtonClass = (type: 'confirmation' | 'reminder' | 'followup') => {
        const base = "w-full text-sm font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center space-x-2";
        if (commType === type) {
            return `${base} bg-indigo-600 text-white`;
        }
        return `${base} bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600`;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center"><MessageCircle className="h-6 w-6 mr-2 text-indigo-500"/>Gerador de Comunicação</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Para: <span className="font-semibold">{appointment.clientName}</span> | Serviço: <span className="font-semibold">{appointment.service}</span></p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    <button onClick={() => handleGenerate('confirmation')} disabled={isLoading} className={getButtonClass('confirmation')}>Confirmação</button>
                    <button onClick={() => handleGenerate('reminder')} disabled={isLoading} className={getButtonClass('reminder')}>Lembrete</button>
                    <button onClick={() => handleGenerate('followup')} disabled={isLoading} className={getButtonClass('followup')}>Follow-up</button>
                </div>
                
                <div className="relative space-y-2">
                    <input type="text" value={generatedComm?.subject || ''} readOnly placeholder="Assunto do E-mail" className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 focus:outline-none"/>
                    <textarea value={isLoading ? `Gerando mensagem de ${commType}...` : generatedComm?.body || ''} readOnly rows={6} className="w-full p-3 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none resize-y"/>
                </div>

                {!isBrevoConnected && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 text-sm rounded-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5"/>
                        <span>A conexão com o Brevo está inativa. Configure-a no painel de Automações para habilitar o envio.</span>
                    </div>
                )}
                
                {statusMessage && (
                    <div className={`mt-4 p-3 text-sm rounded-lg ${statusMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                        {statusMessage.text}
                    </div>
                )}

                 <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 order-last sm:order-first">Fechar</button>
                    <button onClick={() => handleSend('whatsapp')} disabled={!generatedComm || isSending !== null || !isBrevoConnected} className="py-2 px-4 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                       {isSending === 'whatsapp' ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                       Enviar por WhatsApp
                    </button>
                     <button onClick={() => handleSend('email')} disabled={!generatedComm || isSending !== null || !isBrevoConnected} className="py-2 px-4 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                       {isSending === 'email' ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                       Enviar por E-mail
                    </button>
                </div>
            </div>
        </div>
    );
};
// #endregion

export default Appointments;

// --- transactional helper ---
async function maybeSendTransactional(app: Appointment, reason: 'create' | 'update' | 'status') {
    try {
        const connected = await getBrevoConnectionStatus();
        if (!connected) return;
        // load templates from platform/automations
        const autoSnap = await fsGetDoc(fsDoc(db, 'platform', 'automations'));
        const templates = (autoSnap.exists() ? (autoSnap.data() as any).templates : null) as Array<{ id: string; event: string; subject: string; body: string }> | null;
        if (!templates) return;
        // choose template by status/reason
        let key: 't_sched' | 't_cancel' | null = null;
        if (reason === 'create') key = 't_sched';
        if (app.status === AppointmentStatus.Canceled) key = 't_cancel';
        if (!key) return;
        const tpl = templates.find(t => t.id === key);
        if (!tpl) return;
        // build payload (replace variables)
        const dateStr = app.dateTime.toLocaleString('pt-BR');
        const substitutions: Record<string, string> = {
            '{clientName}': app.clientName,
            '{serviceName}': app.service,
            '{dateTime}': dateStr,
            '{time}': app.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        const subject = Object.keys(substitutions).reduce((s, k) => s.replaceAll(k, substitutions[k]), tpl.subject || '');
        const body = Object.keys(substitutions).reduce((s, k) => s.replaceAll(k, substitutions[k]), tpl.body || '');
        // we only have client name; try to find email/phone is not available here; skip if missing
        // In this screen we don’t have the Client object; transactional here is best-effort and UI modal handles direct send.
        // If needed, fetch clients collection to map email; skipping to keep side effects minimal.
        console.log('[Transactional] Prepared email:', { subject, body });
        // To actually send, we’d need client’s email. You already have manual send in CommunicationModal.
        // Optional: integrate with Clients collection to lookup email by name.
    } catch (e) {
        console.warn('Transactional send skipped:', e);
    }
}