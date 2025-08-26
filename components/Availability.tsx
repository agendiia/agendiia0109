import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { WorkingDay, TimeInterval, CalendarEvent, CalendarEventType, Service } from '../types';
import { Plus, Trash, Clock, ArrowLeft, ArrowRight, X, Wrench, Copy, FileCheck2 } from './Icons';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

// Firestore-backed data

const initialDefaultWorkingHours: WorkingDay[] = [
    { dayOfWeek: 'Domingo', enabled: false, intervals: [] },
    { dayOfWeek: 'Segunda-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '13:00', endTime: '18:00' }] },
    { dayOfWeek: 'Terça-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '18:00' }] },
    { dayOfWeek: 'Quarta-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '13:00' }] },
    { dayOfWeek: 'Quinta-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '18:00' }] },
    { dayOfWeek: 'Sexta-feira', enabled: true, intervals: [{ startTime: '13:00', endTime: '17:00' }] },
    { dayOfWeek: 'Sábado', enabled: false, intervals: [] },
];

// Events (exceptions) will be loaded from Firestore

const eventStyles: { [key in CalendarEventType]: { bg: string, text: string } } = {
    [CalendarEventType.Available]: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200' },
    [CalendarEventType.Booked]: { bg: 'bg-indigo-200 dark:bg-indigo-900/60', text: 'text-indigo-800 dark:text-indigo-200' },
    [CalendarEventType.Blocked]: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-200' },
    [CalendarEventType.ExtraAvailability]: { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-800 dark:text-teal-200' },
};

const DAYS_OF_WEEK: WorkingDay['dayOfWeek'][] = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Weekday color classes (Dom..Sáb)
const weekdayStyles: string[] = [
    'text-red-600',    // Dom
    'text-indigo-600', // Seg
    'text-teal-600',   // Ter
    'text-yellow-600', // Qua
    'text-pink-600',   // Qui
    'text-green-600',  // Sex
    'text-blue-600',   // Sáb
];

import servicePalette, { getPaletteForService } from './ServicePalette';

// Section accents
const sectionAccent = {
    config: 'border-l-4 border-indigo-400',
    policy: 'border-l-4 border-teal-400',
};

interface AdvancedSettings {
    bufferBefore: number;
    bufferAfter: number;
    minNoticeHours: number;
    maxNoticeDays: number;
    maxAppointmentsPerDay: number;
}

type BookingPolicy = 'temporary' | 'no_online_payment';


// #region Slots Preview Component
const SlotsPreview: React.FC<{ intervals: TimeInterval[], duration: number, bufferBefore: number, bufferAfter: number }> = ({ intervals, duration, bufferBefore, bufferAfter }) => {
    const timeStringToMinutes = useCallback((time: string): number => {
        if (!time || !time.includes(':')) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }, []);

    const minutesToTimeString = useCallback((totalMinutes: number): string => {
        const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const minutes = (totalMinutes % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }, []);

    const slots = useMemo(() => {
        if (!duration || duration <= 0) return [];

        const totalBuffer = bufferBefore + bufferAfter;
        const increment = 15; // check every 15 minutes for a potential start time
        const generatedSlots: string[] = [];

        intervals.forEach(interval => {
            let cursor = timeStringToMinutes(interval.startTime);
            const limit = timeStringToMinutes(interval.endTime);

            while (cursor + duration <= limit) {
                generatedSlots.push(minutesToTimeString(cursor));
                // A better approach for real apps would be to use the increment defined by duration + buffer
                // but for a simple preview, checking every 15 mins is fine.
                cursor += duration + totalBuffer > 0 ? (duration + totalBuffer) : 15;
            }
        });
        
        return generatedSlots;
    }, [intervals, duration, bufferBefore, bufferAfter, timeStringToMinutes, minutesToTimeString]);

    return (
        <div className="flex flex-wrap gap-2">
            {slots.length > 0 ? (
                slots.map(slot => (
                    <span key={slot} className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                        {slot}
                    </span>
                ))
            ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum horário gerado com a duração e regras atuais.</p>
            )}
        </div>
    );
};
// #endregion

// #region Main Component
const Availability: React.FC = () => {
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [serviceAvailabilities, setServiceAvailabilities] = useState<Map<string, WorkingDay[]>>(new Map());
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');

    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDateForModal, setSelectedDateForModal] = useState<Date | null>(null);
    
    const [minNoticeHours, setMinNoticeHours] = useState<number>(24);
    const [maxNoticeDays, setMaxNoticeDays] = useState<number>(30);
    const [reservationHoldMinutes, setReservationHoldMinutes] = useState<number>(15);
    
    const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy>('temporary');

    // --- Load data from Firestore ---
    useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        // Services - auto-select first service when loaded
        const servicesUnsub = onSnapshot(
            query(collection(db, 'users', user.uid, 'services'), orderBy('name', 'asc')),
            (snap) => {
                const items: Service[] = snap.docs.map((d) => ({
                    id: d.id,
                    ...(d.data() as any),
                })) as Service[];
                setServices(items);
                // Auto-select first service if none selected
                if (items.length > 0 && !selectedServiceId) {
                    setSelectedServiceId(items[0].id);
                }
            },
            () => {}
        );

        // Default availability and booking policy
        const defaultDocRef = doc(db, 'users', user.uid, 'availability', 'default');
        const defaultUnsub = onSnapshot(defaultDocRef, (snap) => {
            const data: any = snap.data() || {};
            if (data.bookingPolicy) {
                // Legacy value 'mandatory' should now map to 'temporary'
                const bp = data.bookingPolicy === 'mandatory' ? 'temporary' : data.bookingPolicy;
                setBookingPolicy(bp as BookingPolicy);
            }
            if (data.minNoticeHours !== undefined) {
                setMinNoticeHours(data.minNoticeHours);
            }
            if (data.maxNoticeDays !== undefined) {
                setMaxNoticeDays(data.maxNoticeDays);
            }
            // load reservation hold minutes from advancedSettings (preferred) or legacy field
            if (data.advancedSettings && data.advancedSettings.reservationHoldMinutes !== undefined) {
                setReservationHoldMinutes(Number(data.advancedSettings.reservationHoldMinutes) || 15);
            } else if (data.reservationHoldMinutes !== undefined) {
                setReservationHoldMinutes(Number(data.reservationHoldMinutes) || 15);
            }
            setIsLoading(false);
        }, () => setIsLoading(false));

        // Per-service availability
        const svcAvailCol = collection(db, 'users', user.uid, 'service_availability');
        const svcAvailUnsub = onSnapshot(svcAvailCol, (snap) => {
            const map = new Map<string, WorkingDay[]>();
            snap.docs.forEach((d) => {
                const data: any = d.data();
                if (Array.isArray(data.workingHours)) {
                    map.set(d.id, data.workingHours as WorkingDay[]);
                }
            });
            setServiceAvailabilities(map);
        });

        // Exceptions
        const exceptionsUnsub = onSnapshot(
            query(collection(db, 'users', user.uid, 'availability_exceptions'), orderBy('start', 'asc')),
            (snap) => {
                const items: CalendarEvent[] = snap.docs.map((d) => {
                    const data: any = d.data();
                    const start = data.start instanceof Timestamp ? data.start.toDate() : new Date(data.start);
                    const end = data.end instanceof Timestamp ? data.end.toDate() : new Date(data.end);
                    return {
                        id: d.id,
                        type: data.type as CalendarEventType,
                        title: data.title || '',
                        start,
                        end,
                        isAllDay: !!data.isAllDay,
                    } as CalendarEvent;
                });
                setEvents(items);
            }
        );

        return () => {
            servicesUnsub();
            defaultUnsub();
            svcAvailUnsub();
            exceptionsUnsub();
        };
    }, [user?.uid]);


    const isDefaultSelected = false; // Remove default option

    const currentAvailabilityData = useMemo(() => {
        return serviceAvailabilities.get(selectedServiceId);
    }, [selectedServiceId, serviceAvailabilities]);

    const handleAvailabilityChange = useCallback((newAvailabilityData: WorkingDay[]) => {
        const newMap = new Map(serviceAvailabilities);
        newMap.set(selectedServiceId, newAvailabilityData);
        setServiceAvailabilities(newMap);
    }, [selectedServiceId, serviceAvailabilities]);

    const handleCopyFromDefault = useCallback(() => {
        // Create a default working schedule if copying from default
        const defaultSchedule: WorkingDay[] = [
            { dayOfWeek: 'Domingo', enabled: false, intervals: [] },
            { dayOfWeek: 'Segunda-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '12:00' }, { startTime: '13:00', endTime: '18:00' }] },
            { dayOfWeek: 'Terça-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '18:00' }] },
            { dayOfWeek: 'Quarta-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '13:00' }] },
            { dayOfWeek: 'Quinta-feira', enabled: true, intervals: [{ startTime: '09:00', endTime: '18:00' }] },
            { dayOfWeek: 'Sexta-feira', enabled: true, intervals: [{ startTime: '13:00', endTime: '17:00' }] },
            { dayOfWeek: 'Sábado', enabled: false, intervals: [] },
        ];
        const newMap = new Map(serviceAvailabilities);
        newMap.set(selectedServiceId, defaultSchedule);
        setServiceAvailabilities(newMap);
    }, [selectedServiceId, serviceAvailabilities]);

    const openModalForDate = (date: Date) => {
        setSelectedDateForModal(date);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedDateForModal(null);
    };

    const addEvent = async (event: Omit<CalendarEvent, 'id'>) => {
        if (!user) return;
        try {
            await addDoc(collection(db, 'users', user.uid, 'availability_exceptions'), {
                type: event.type,
                title: event.title,
                start: Timestamp.fromDate(new Date(event.start)),
                end: Timestamp.fromDate(new Date(event.end)),
                isAllDay: !!event.isAllDay,
                createdAt: serverTimestamp(),
            } as any);
            closeModal();
        } catch (e) {
            alert('Não foi possível salvar a exceção.');
        }
    };

    const removeEvent = async (eventId: string) => {
        if (!user) return;
        if (window.confirm('Tem certeza que deseja remover esta exceção?')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'availability_exceptions', eventId));
            } catch (e) {
                alert('Falha ao remover exceção.');
            }
        }
    };

    const handleSaveAll = async () => {
        if (!user || !selectedServiceId) return;
        try {
            // Save service availability
            await setDoc(doc(db, 'users', user.uid, 'service_availability', selectedServiceId), {
                workingHours: serviceAvailabilities.get(selectedServiceId) || initialDefaultWorkingHours,
                updatedAt: serverTimestamp(),
            } as any, { merge: true });

            // Calculate default working hours from the first available service or use initial default
            let defaultWorkingHours = initialDefaultWorkingHours;
            if (serviceAvailabilities.size > 0) {
                // Use the first service's working hours as default, or the currently selected service
                const firstServiceHours = serviceAvailabilities.get(selectedServiceId) || 
                                         Array.from(serviceAvailabilities.values())[0];
                if (firstServiceHours) {
                    defaultWorkingHours = firstServiceHours;
                }
            }

            // Save scheduling settings, booking policy, and default working hours
            await setDoc(doc(db, 'users', user.uid, 'availability', 'default'), {
                minNoticeHours,
                maxNoticeDays,
                bookingPolicy,
                workingHours: defaultWorkingHours,
                updatedAt: serverTimestamp(),
            } as any, { merge: true });

            // Persist nested advancedSettings.reservationHoldMinutes without overwriting other advancedSettings
            try {
                await updateDoc(doc(db, 'users', user.uid, 'availability', 'default'), { ['advancedSettings.reservationHoldMinutes']: Number(reservationHoldMinutes) });
            } catch (e) {
                // If update fails (doc missing or permission), ignore and continue
                console.warn('Falha ao salvar reservationHoldMinutes', e);
            }

            alert('Todas as configurações foram salvas com sucesso!');
        } catch (e) {
            alert('Erro ao salvar as configurações.');
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Minha Agenda</h1>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Disponibilidade por Serviço</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Selecione um serviço para definir seus horários específicos de atendimento.</p>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-6">
                    <div className="lg:col-span-1 lg:border-r lg:pr-6 border-gray-200 dark:border-gray-700">
                        <ServiceSelector 
                            services={services}
                            selectedServiceId={selectedServiceId}
                            onSelect={setSelectedServiceId}
                        />
                    </div>
                    <div className="lg:col-span-3">
                        <AvailabilityEditor
                            key={selectedServiceId}
                            availabilityData={currentAvailabilityData}
                            onDataChange={handleAvailabilityChange}
                            onCopyFromDefault={handleCopyFromDefault}
                            isServiceSpecific={!isDefaultSelected}
                            selectedServiceId={selectedServiceId}
                            services={services}
                        />
                    </div>
                </div>
            </div>

            <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md ${sectionAccent.config}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações de Agendamento</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Defina os limites de tempo para agendamentos.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="minNoticeHours" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Antecedência mínima (horas)</label>
                        <input 
                            id="minNoticeHours" 
                            type="number" 
                            value={minNoticeHours} 
                            onChange={(e) => setMinNoticeHours(Number(e.target.value))} 
                            min="0" 
                            className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tempo mínimo que o cliente deve agendar com antecedência</p>
                    </div>
                    <div>
                        <label htmlFor="maxNoticeDays" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Antecedência máxima (dias)</label>
                        <input 
                            id="maxNoticeDays" 
                            type="number" 
                            value={maxNoticeDays} 
                            onChange={(e) => setMaxNoticeDays(Number(e.target.value))} 
                            min="1" 
                            className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quantos dias no futuro o cliente pode agendar</p>
                    </div>
                </div>
            </div>

            <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md ${sectionAccent.policy}`}>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
                    <FileCheck2 className="h-6 w-6 mr-3 text-indigo-500"/>
                    Política de Agendamento
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
                    Escolha como seus clientes podem agendar um horário através da sua página pública.
                </p>

                <div className="space-y-4" role="radiogroup" aria-labelledby="booking-policy-label">
                    {/* 'Pagamento Obrigatório' option removed per request; legacy values are mapped to 'temporary' when loading. */}

                     <label htmlFor="temporary" className={`p-4 border-2 rounded-lg flex items-start cursor-pointer transition-all ${bookingPolicy === 'temporary' ? 'border-indigo-500 bg-indigo-50 dark:bg-gray-700/80' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                        <input type="radio" name="booking-policy" id="temporary" value="temporary" checked={bookingPolicy === 'temporary'} onChange={(e) => setBookingPolicy(e.target.value as BookingPolicy)} className="h-5 w-5 mt-0.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 flex-shrink-0"/>
                        <div className="ml-4">
                            <span className="font-semibold text-gray-800 dark:text-white">Reserva Temporária</span>
                            <p className="text-sm text-gray-600 dark:text-gray-400">O horário fica reservado temporariamente aguardando o pagamento. Se não for pago, o horário é liberado.</p>
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-3">
                                <label htmlFor="reservationHoldMinutes" className="whitespace-nowrap">Duração da reserva (minutos):</label>
                                <input id="reservationHoldMinutes" type="number" min={1} max={1440} value={reservationHoldMinutes} onChange={(e) => setReservationHoldMinutes(Number(e.target.value || 15))} className="w-24 p-1 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm" />
                                <span className="text-xs text-gray-500">Padrão: 15</span>
                            </div>
                        </div>
                    </label>

                    <label htmlFor="no_online_payment" className={`p-4 border-2 rounded-lg flex items-start cursor-pointer transition-all ${bookingPolicy === 'no_online_payment' ? 'border-indigo-500 bg-indigo-50 dark:bg-gray-700/80' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                        <input type="radio" name="booking-policy" id="no_online_payment" value="no_online_payment" checked={bookingPolicy === 'no_online_payment'} onChange={(e) => setBookingPolicy(e.target.value as BookingPolicy)} className="h-5 w-5 mt-0.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 flex-shrink-0"/>
                        <div className="ml-4">
                            <span className="font-semibold text-gray-800 dark:text-white">Sem Pagamento Online</span>
                            <p className="text-sm text-gray-600 dark:text-gray-400">O cliente agenda e o pagamento é realizado diretamente com você no dia do atendimento.</p>
                        </div>
                    </label>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Gerenciamento de Exceções</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Clique em um dia para adicionar um bloqueio de horário ou uma disponibilidade extra na sua agenda.</p>
                <ExceptionCalendar events={events} onDayClick={openModalForDate} onRemoveEvent={removeEvent} />
            </div>

            {isModalOpen && selectedDateForModal && (
                <ExceptionModal 
                    onClose={closeModal} 
                    onAddEvent={addEvent}
                    selectedDate={selectedDateForModal}
                />
            )}

            {/* Botão único para salvar tudo */}
            <div className="flex justify-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button 
                    onClick={handleSaveAll}
                    className="bg-indigo-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-indigo-700 transition-colors text-lg"
                >
                    Salvar Tudo
                </button>
            </div>
        </div>
    );
};
// #endregion

// #region Sub-Components
const ServiceSelector: React.FC<{
    services: Service[];
    selectedServiceId: string;
    onSelect: (id: string) => void;
}> = ({ services, selectedServiceId, onSelect }) => (
    <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Selecionar Serviço:</h3>
        {services.map((service, idx) => {
            const pal = getPaletteForService(service.id, services);
            const isSel = selectedServiceId === service.id;
            const btnClass = isSel ? `${pal.selectedBg} ${pal.selectedText}` : `${pal.bg} ${pal.text} hover:brightness-95`;
            return (
                <button
                    key={service.id}
                    onClick={() => onSelect(service.id)}
                    className={`w-full text-left p-3 rounded-lg font-medium transition-colors flex items-center ${btnClass}`}
                    aria-current={isSel}
                >
                    <Wrench className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="truncate" title={service.name}>{service.name}</span>
                </button>
            )
        })}
    </div>
);

const AvailabilityEditor: React.FC<{
    availabilityData: WorkingDay[] | undefined;
    onDataChange: (data: WorkingDay[]) => void;
    onCopyFromDefault: () => void;
    isServiceSpecific: boolean;
    selectedServiceId: string;
    services?: Service[];
}> = ({ availabilityData, onDataChange, onCopyFromDefault, isServiceSpecific, selectedServiceId, services }) => {
    
    const [referenceDuration, setReferenceDuration] = useState<number>(60);
    const [copyFromDay, setCopyFromDay] = useState<string>('');
    const [copyToDay, setCopyToDay] = useState<string>('');

    const handleDayToggle = (dayIndex: number) => {
        const newData = JSON.parse(JSON.stringify(availabilityData || initialDefaultWorkingHours));
        newData[dayIndex].enabled = !newData[dayIndex].enabled;
        onDataChange(newData);
    };

    const handleIntervalChange = (dayIndex: number, intervalIndex: number, field: keyof TimeInterval, value: string) => {
        const newData = JSON.parse(JSON.stringify(availabilityData || initialDefaultWorkingHours));
        newData[dayIndex].intervals[intervalIndex][field] = value;
        onDataChange(newData);
    };

    const addInterval = (dayIndex: number) => {
        const newData = JSON.parse(JSON.stringify(availabilityData || initialDefaultWorkingHours));
        newData[dayIndex].intervals.push({ startTime: '09:00', endTime: '17:00' });
        onDataChange(newData);
    };

    const removeInterval = (dayIndex: number, intervalIndex: number) => {
        const newData = JSON.parse(JSON.stringify(availabilityData || initialDefaultWorkingHours));
        newData[dayIndex].intervals.splice(intervalIndex, 1);
        onDataChange(newData);
    };

    const handleCopyDaySchedule = () => {
        if (!copyFromDay || !copyToDay || copyFromDay === copyToDay || !availabilityData) return;
        
        const newData = JSON.parse(JSON.stringify(availabilityData));
        const fromDayIndex = DAYS_OF_WEEK.indexOf(copyFromDay as WorkingDay['dayOfWeek']);
        const toDayIndex = DAYS_OF_WEEK.indexOf(copyToDay as WorkingDay['dayOfWeek']);
        
        if (fromDayIndex !== -1 && toDayIndex !== -1) {
            newData[toDayIndex] = {
                ...newData[toDayIndex],
                enabled: newData[fromDayIndex].enabled,
                intervals: JSON.parse(JSON.stringify(newData[fromDayIndex].intervals))
            };
            onDataChange(newData);
            setCopyFromDay('');
            setCopyToDay('');
            alert(`Horários copiados de ${copyFromDay} para ${copyToDay}!`);
        }
    };

    if (!availabilityData) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center bg-gray-50 dark:bg-gray-700/50 p-8 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Configurar Horários</h4>
                <p className="text-gray-600 dark:text-gray-300 my-4">Este serviço ainda não tem horários configurados. Crie uma agenda personalizada para este serviço.</p>
                <button
                    onClick={onCopyFromDefault}
                    className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
                >
                    <Copy className="h-5 w-5" />
                    <span>Criar Agenda Padrão</span>
                </button>
            </div>
        );
    }
    
    const dataToRender = availabilityData || initialDefaultWorkingHours;
    const selectedService = (services || []).find(s => s.id === selectedServiceId);
    const durationForSlots = selectedService ? selectedService.duration : referenceDuration;

    return (
        <div className="space-y-4">
            {/* Copy Schedule Tool */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Copiar Horários Entre Dias</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                        <label htmlFor="copyFromDay" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Copiar de:</label>
                        <select 
                            id="copyFromDay"
                            value={copyFromDay} 
                            onChange={(e) => setCopyFromDay(e.target.value)}
                            className="w-full p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                        >
                            <option value="">Selecione o dia</option>
                            {DAYS_OF_WEEK.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="copyToDay" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Copiar para:</label>
                        <select 
                            id="copyToDay"
                            value={copyToDay} 
                            onChange={(e) => setCopyToDay(e.target.value)}
                            className="w-full p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                        >
                            <option value="">Selecione o dia</option>
                            {DAYS_OF_WEEK.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <button
                            onClick={handleCopyDaySchedule}
                            disabled={!copyFromDay || !copyToDay || copyFromDay === copyToDay}
                            className="w-full bg-indigo-600 text-white font-semibold py-2 px-3 rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                        >
                            <Copy className="h-4 w-4" />
                            Copiar
                        </button>
                    </div>
                </div>
            </div>

            {DAYS_OF_WEEK.map((dayName, index) => {
                const dayData = dataToRender.find(d => d.dayOfWeek === dayName) || { dayOfWeek: dayName, enabled: false, intervals: [] };
                return (
                    <div key={dayName} className={`p-4 rounded-lg border transition-all ${dayData.enabled ? 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-700' : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 opacity-70'}`}>
                        <div className="flex items-center justify-between">
                            <label htmlFor={`toggle-${dayName}`} className="font-bold text-lg text-gray-700 dark:text-gray-200 cursor-pointer">{dayName}</label>
                            <div className="relative inline-block w-10 mr-2 align-middle select-none">
                                <input type="checkbox" id={`toggle-${dayName}`} checked={dayData.enabled} onChange={() => handleDayToggle(index)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                                <label htmlFor={`toggle-${dayName}`} className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
                            </div>
                        </div>
                        {dayData.enabled && (
                            <div className="mt-4 space-y-3">
                                {dayData.intervals.map((interval, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input type="time" value={interval.startTime} onChange={e => handleIntervalChange(index, i, 'startTime', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                                        <span className="font-semibold text-gray-500 dark:text-gray-400">-</span>
                                        <input type="time" value={interval.endTime} onChange={e => handleIntervalChange(index, i, 'endTime', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                                        <button onClick={() => removeInterval(index, i)} className="p-2 rounded-full text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400" aria-label="Remover intervalo">
                                            <Trash className="h-5 w-5"/>
                                        </button>
                                    </div>
                                ))}
                                <button onClick={() => addInterval(index)} className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm flex items-center gap-1 hover:underline">
                                    <Plus className="h-4 w-4"/> Adicionar Horário
                                </button>
                                
                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Visualização de Horários Disponíveis</h4>
                                    <SlotsPreview
                                        intervals={dayData.intervals}
                                        duration={durationForSlots}
                                        bufferBefore={0}
                                        bufferAfter={0}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
             <style>{`.toggle-checkbox:checked{right:0;border-color:#4f46e5;transform:translateX(100%)}.toggle-checkbox{transition:all .2s ease-in-out;transform:translateX(0)}.toggle-checkbox:checked+.toggle-label{background-color:#4f46e5}`}</style>
        </div>
    );
};

const ExceptionCalendar: React.FC<{
    events: CalendarEvent[];
    onDayClick: (date: Date) => void;
    onRemoveEvent: (eventId: string) => void;
}> = ({ events, onDayClick, onRemoveEvent }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const { days, startOfMonth } = useMemo(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const startDate = new Date(startOfMonth);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        
        const endDate = new Date(endOfMonth);
        if (endDate.getDay() !== 6) {
            endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
        }
        
        const days = [];
        let day = new Date(startDate);
        while (day <= endDate) {
            days.push(new Date(day));
            day.setDate(day.getDate() + 1);
        }
        return { days, startOfMonth };
    }, [currentDate]);
    
    const changeMonth = (amount: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1));
    }
    
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach(event => {
            const dateStr = event.start.toISOString().split('T')[0];
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)!.push(event);
        });
        return map;
    }, [events]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowLeft/></button>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{startOfMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowRight/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, idx) => <div key={d} className={`${weekdayStyles[idx]} dark:opacity-80`}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-1">
                {days.map(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dailyEvents = eventsByDate.get(dateStr) || [];
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                    const isToday = d.toDateString() === new Date().toDateString();

                    return (
                        <div 
                            key={dateStr}
                            onClick={() => onDayClick(d)}
                            className={`
                                h-28 border border-gray-200 dark:border-gray-700 rounded-md p-1.5 flex flex-col cursor-pointer transition-colors
                                ${isCurrentMonth ? 'bg-white dark:bg-gray-800/60 hover:bg-indigo-50 dark:hover:bg-gray-700' : 'bg-gray-50 dark:bg-gray-800/20 text-gray-400 dark:text-gray-600'}
                            `}
                            role="button"
                            aria-label={`Adicionar exceção para ${d.toLocaleDateString()}`}
                        >
                            <span className={`font-semibold text-sm ${isToday ? 'bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : weekdayStyles[d.getDay()]}` }>
                                    {d.getDate()}
                                </span>
                            <div className="mt-1 space-y-1 overflow-y-auto text-xs">
                                {dailyEvents.map(event => {
                                    if (event.type === CalendarEventType.Booked) return null;
                                    const style = eventStyles[event.type];
                                    return (
                                        <div 
                                            key={event.id}
                                            className={`p-1 rounded-md flex items-center justify-between ${style.bg} ${style.text}`}
                                        >
                                            <span className="truncate flex-grow" title={event.title}>{event.title}</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onRemoveEvent(event.id); }} 
                                                className={`ml-1 rounded-full hover:bg-black/20 ${style.text}`}
                                                aria-label={`Remover exceção ${event.title}`}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const ExceptionModal: React.FC<{ 
    onClose: () => void;
    onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
    selectedDate: Date;
}> = ({ onClose, onAddEvent, selectedDate }) => {
    const [type, setType] = useState<CalendarEventType.Blocked | CalendarEventType.ExtraAvailability>(CalendarEventType.Blocked);
    const [title, setTitle] = useState('');
    const [date] = useState(selectedDate.toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('18:00');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    
    const validateField = (field: string, value: string) => {
        const newErrors = { ...errors };
        
        switch (field) {
            case 'title':
                if (!value.trim()) {
                    newErrors.title = 'Descrição é obrigatória';
                } else if (value.trim().length < 3) {
                    newErrors.title = 'Descrição deve ter pelo menos 3 caracteres';
                } else if (value.trim().length > 100) {
                    newErrors.title = 'Descrição não pode exceder 100 caracteres';
                } else {
                    delete newErrors.title;
                }
                break;
            case 'startTime':
                if (!value) {
                    newErrors.startTime = 'Horário de início é obrigatório';
                } else {
                    delete newErrors.startTime;
                }
                break;
            case 'endTime':
                if (!value) {
                    newErrors.endTime = 'Horário de fim é obrigatório';
                } else if (startTime && value <= startTime) {
                    newErrors.endTime = 'Horário de fim deve ser posterior ao início';
                } else {
                    delete newErrors.endTime;
                }
                break;
        }
        
        setErrors(newErrors);
    };

    const handleFieldChange = (field: string, value: string) => {
        switch (field) {
            case 'title':
                setTitle(value);
                break;
            case 'startTime':
                setStartTime(value);
                // Re-validate end time when start time changes
                if (touched.endTime) {
                    validateField('endTime', endTime);
                }
                break;
            case 'endTime':
                setEndTime(value);
                break;
        }
        
        if (touched[field]) {
            validateField(field, value);
        }
    };

    const handleFieldBlur = (field: string, value: string) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        validateField(field, value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Mark all fields as touched
        const allFields = ['title', 'startTime', 'endTime'];
        setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));
        
        // Validate all fields
        allFields.forEach(field => {
            const value = field === 'title' ? title : field === 'startTime' ? startTime : endTime;
            validateField(field, value);
        });
        
        // Check if there are any errors
        if (Object.keys(errors).length > 0) {
            return;
        }
        
        const start = new Date(`${date}T${startTime}`);
        const end = new Date(`${date}T${endTime}`);
        
        // Additional validation for time logic
        if (start >= end) {
            setErrors(prev => ({ ...prev, endTime: 'Horário de fim deve ser posterior ao início' }));
            return;
        }
        
        onAddEvent({
            type: type,
            title: title.trim() || (type === CalendarEventType.Blocked ? 'Bloqueado' : 'Disponibilidade Extra'),
            start,
            end,
            isAllDay: false,
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Adicionar Exceção na Agenda</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="exception-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Exceção</label>
                        <select id="exception-type" value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                            <option value={CalendarEventType.Blocked}>Bloqueio (Ausência)</option>
                            <option value={CalendarEventType.ExtraAvailability}>Disponibilidade Extra</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="exception-title" className={`block text-sm font-medium mb-1 ${errors.title ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            Descrição <span className="text-red-500">*</span>
                        </label>
                        <input 
                            id="exception-title" 
                            type="text" 
                            value={title} 
                            onChange={e => handleFieldChange('title', e.target.value)}
                            onBlur={e => handleFieldBlur('title', e.target.value)}
                            placeholder="Ex: Consulta médica" 
                            className={`w-full p-2 rounded-md border transition-colors ${
                                errors.title 
                                    ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                                    : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500'
                            } focus:ring-2 focus:outline-none`}
                        />
                        {errors.title && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="exception-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                        <input id="exception-date" type="date" value={date} readOnly disabled className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 cursor-not-allowed"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="start-time" className={`block text-sm font-medium mb-1 ${errors.startTime ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                Início <span className="text-red-500">*</span>
                            </label>
                            <input 
                                id="start-time" 
                                type="time" 
                                value={startTime} 
                                onChange={e => handleFieldChange('startTime', e.target.value)}
                                onBlur={e => handleFieldBlur('startTime', e.target.value)}
                                className={`w-full p-2 rounded-md border transition-colors ${
                                    errors.startTime 
                                        ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                                        : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500'
                                } focus:ring-2 focus:outline-none`}
                            />
                            {errors.startTime && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startTime}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="end-time" className={`block text-sm font-medium mb-1 ${errors.endTime ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                Fim <span className="text-red-500">*</span>
                            </label>
                            <input 
                                id="end-time" 
                                type="time" 
                                value={endTime} 
                                onChange={e => handleFieldChange('endTime', e.target.value)}
                                onBlur={e => handleFieldBlur('endTime', e.target.value)}
                                className={`w-full p-2 rounded-md border transition-colors ${
                                    errors.endTime 
                                        ? 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                                        : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500'
                                } focus:ring-2 focus:outline-none`}
                            />
                            {errors.endTime && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endTime}</p>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Salvar Exceção</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
// #endregion

export default Availability;
