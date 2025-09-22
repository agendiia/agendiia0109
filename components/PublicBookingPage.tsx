import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { db, firebaseApp } from '../services/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, getDocs, query, where, addDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Service, Package, ProfessionalProfile, WorkingDay, CalendarEvent, Appointment, AppointmentStatus, CalendarEventType, Testimonial, Credential, Address, PaymentGateway, PaymentGatewayStatus } from '../types';
import { User, Mail, Phone, Calendar, Clock, ArrowLeft, ArrowRight, CheckCircle, Loader, DollarSign, Wrench, Instagram, Linkedin, Facebook, LinkIcon, Award, Quote, MapPin, FileText, Star, PixLogo, CreditCard, ChevronDown, ChevronUp } from './Icons';
import { LoadingSpinner, LoadingState } from './LoadingState';
import { createStaticPix, hasError } from 'pix-utils';

// Sem dados mock: tudo é carregado do Firebase


// Small helpers
const isValidHttpUrl = (candidate?: string | null) => {
    if (!candidate) return false;
    try {
        const u = new URL(candidate);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
};

const isDataUrl = (candidate?: string | null) => !!candidate && candidate.startsWith('data:');

const normalizeUrl = (raw?: string | null) => {
    if (!raw) return '';
    if (isValidHttpUrl(raw) || raw.startsWith('mailto:') || raw.startsWith('tel:')) return raw;
    // If user typed without scheme, default to https
    return `https://${raw}`;
};

// --- SOCIAL LINKS COMPONENT ---
const SocialLinks: React.FC<{ links: ProfessionalProfile['socialLinks'] }> = ({ links }) => {
    if (!links || Object.values(links).every(link => !link)) {
        return null;
    }

    const socialPlatforms = [
        { key: 'instagram', icon: <Instagram className="h-5 w-5" />, label: 'Instagram' },
        { key: 'linkedin', icon: <Linkedin className="h-5 w-5" />, label: 'LinkedIn' },
        { key: 'facebook', icon: <Facebook className="h-5 w-5" />, label: 'Facebook' },
        { key: 'website', icon: <LinkIcon className="h-5 w-5" />, label: 'Website' },
    ];

    return (
        <div className="flex items-center justify-center sm:justify-start space-x-3 mt-2">
            {socialPlatforms.map(platform => {
                const urlRaw = links[platform.key as keyof typeof links];
                const url = normalizeUrl(urlRaw);
                if (url) {
                    return (
                        <a
                            key={platform.key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={platform.label}
                            className="text-gray-500 dark:text-gray-400 hover:text-[var(--theme-color)] dark:hover:text-[var(--theme-color)] transition-colors"
                        >
                            {platform.icon}
                        </a>
                    );
                }
                return null;
            })}
        </div>
    );
};

// --- NOVO COMPONENTE: Accordion ---
const Accordion: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Small palette per section to give the profile page distinct areas
    const colorMap: Record<string, string> = {
        'Sobre': '#7c3aed', // purple
        'Credenciais': '#059669', // green
        'Depoimentos': '#d97706', // amber
        'Endereço': '#2563eb', // blue
    };

    const accent = colorMap[title] || 'var(--theme-color)';
    const isVar = String(accent).startsWith('var(');
    const iconBg = !isVar ? `${accent}22` : undefined; // light alpha for icon bg when we have a hex

    return (
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ borderLeft: `4px solid ${accent}` }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-4 text-left text-lg font-semibold text-gray-800 dark:text-white"
            >
                <span className="flex items-center">
                    <span className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: iconBg || 'transparent', color: accent }}>
                        {icon}
                    </span>
                    <span className="ml-3">{title}</span>
                </span>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}
            >
                <div className="pb-4 text-gray-600 dark:text-gray-300">
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- NOVO COMPONENTE: BookingStepper ---
const BookingStepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = ['Serviço', 'Horário', 'Detalhes', 'Confirmação'];
    return (
        <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
                <React.Fragment key={index}>
                    <div className="flex items-center">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors duration-300 ${
                                index + 1 <= currentStep ? 'bg-[var(--theme-color)] text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                            }`}
                        >
                            {index + 1}
                        </div>
                        <span className={`ml-2 text-sm font-semibold ${index + 1 <= currentStep ? 'text-gray-800 dark:text-white' : 'text-gray-500'}`}>{step}</span>
                    </div>
                    {index < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 mx-4"></div>}
                </React.Fragment>
            ))}
        </div>
    );
};

// --- NOVO COMPONENTE: BookingSummary ---
const BookingSummary: React.FC<{ service: Service | null; date: Date | null; time: string | null; onReset: () => void }> = ({ service, date, time, onReset }) => {
    if (!service) return null;

    return (
        <div className="sticky top-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <h3 className="font-bold text-lg mb-3">Resumo do Agendamento</h3>
            <div className="space-y-2 text-sm">
                <p><strong className="font-semibold">Serviço:</strong> {service.name}</p>
                {date && <p><strong className="font-semibold">Data:</strong> {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>}
                {time && <p><strong className="font-semibold">Horário:</strong> {time}</p>}
                <p><strong className="font-semibold">Preço:</strong> R$ {service.price.toFixed(2)}</p>
            </div>
            <button onClick={onReset} className="text-sm text-red-500 hover:underline mt-4">
                Começar de novo
            </button>
        </div>
    );
};

// --- NOVO COMPONENTE: SkeletonLoader ---
const SkeletonLoader: React.FC = () => (
    <div className="animate-pulse">
        <div className="h-48 bg-gray-300 dark:bg-gray-700 rounded-t-lg"></div>
        <div className="p-6">
            <div className="flex items-center space-x-4 -mt-20">
                <div className="w-24 h-24 bg-gray-300 dark:bg-gray-700 rounded-full border-4 border-white"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
            </div>
            <div className="mt-6 space-y-3">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="space-y-4">
                <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
            </div>
        </div>
    </div>
);


// --- MAIN COMPONENT ---
const PublicBookingPage: React.FC = () => {
    const [step, setStep] = useState(1); // 1: service, 2: time, 3: details, 4: confirm, 5: success
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [clientDetails, setClientDetails] = useState({ name: '', email: '', phone: '' });

    const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    
    const [workingHoursDefault, setWorkingHoursDefault] = useState<WorkingDay[]>([]);
    const [serviceAvailabilities, setServiceAvailabilities] = useState<Record<string, WorkingDay[]>>({});
    const [gateways, setGateways] = useState<PaymentGateway[]>([]);
    const [advancedSettings, setAdvancedSettings] = useState<any>({ bufferBefore: 0, bufferAfter: 0, minNoticeHours: 0, maxNoticeDays: 365, maxAppointmentsPerDay: 100, reservationHoldMinutes: 15 });
    const [exceptions, setExceptions] = useState<CalendarEvent[]>([]);
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [reservations, setReservations] = useState<any[]>([]);
    const [bookingPolicy, setBookingPolicy] = useState<'temporary' | 'no_online_payment'>('temporary');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profId, setProfId] = useState<string>('');
    const [lastSelectedGateway, setLastSelectedGateway] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfessionalData = async () => {
            const segments = window.location.pathname.split('/').filter(Boolean);
            const id = segments[0] === 'booking' ? segments[1] : segments[segments.length - 1];
            if (!id) {
                setError("Profissional não encontrado.");
                setLoading(false);
                return;
            }
            // We'll try to resolve either by uid or by slug using direct lookup
            let resolvedUserId = id;
            try {
                // First try direct uid lookup
                let profileDoc = await getDoc(doc(db, 'users', id, 'profile', 'main'));
                
                if (!profileDoc.exists()) {
                    // Try slug lookup via public_slugs mapping
                    const slugDoc = await getDoc(doc(db, 'public_slugs', id));
                    if (slugDoc.exists()) {
                        const slugData = slugDoc.data();
                        resolvedUserId = slugData.userId;
                        profileDoc = await getDoc(doc(db, 'users', resolvedUserId, 'profile', 'main'));
                    }
                }

                if (!profileDoc.exists()) {
                    setError("Perfil do profissional não encontrado.");
                    setLoading(false);
                    return;
                }
                const profileData = profileDoc.data() as ProfessionalProfile;
                setProfile(profileData);
                setProfId(resolvedUserId);

                // Fetch services
                const servicesSnapshot = await getDocs(query(collection(db, 'users', resolvedUserId, 'services'), where('isActive', '==', true)));
                setServices(servicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Service)));

                // packages removed: we only use individual services on public page

                // Fetch default availability and advanced settings
                const defaultAvailDoc = await getDoc(doc(db, 'users', resolvedUserId, 'availability', 'default'));
                if (defaultAvailDoc.exists()) {
                    const data: any = defaultAvailDoc.data();
                    setWorkingHoursDefault(Array.isArray(data.workingHours) ? (data.workingHours as WorkingDay[]) : []);
                    if (data.advancedSettings) {
                        setAdvancedSettings({
                            bufferBefore: Number(data.advancedSettings.bufferBefore) || 0,
                            bufferAfter: Number(data.advancedSettings.bufferAfter) || 0,
                            minNoticeHours: Number(data.advancedSettings.minNoticeHours) || 0,
                            maxNoticeDays: Number(data.advancedSettings.maxNoticeDays) || 365,
                            maxAppointmentsPerDay: Number(data.advancedSettings.maxAppointmentsPerDay) || 100,
                            reservationHoldMinutes: Number(data.advancedSettings.reservationHoldMinutes) || (Number(data.reservationHoldMinutes) || 15),
                        });
                    }
                    // bookingPolicy: map legacy 'mandatory' to 'temporary'
                    if (data.bookingPolicy) {
                        const bp = data.bookingPolicy === 'mandatory' ? 'temporary' : data.bookingPolicy;
                        setBookingPolicy(bp as 'temporary' | 'no_online_payment');
                    }
                } else {
                    setWorkingHoursDefault([]);
                }

                // Fetch per-service availability
                const svcAvailSnap = await getDocs(collection(db, 'users', resolvedUserId, 'service_availability'));
                const svcMap: Record<string, WorkingDay[]> = {};
                svcAvailSnap.docs.forEach(d => {
                    const data: any = d.data();
                    if (Array.isArray(data.workingHours)) {
                        svcMap[d.id] = data.workingHours as WorkingDay[];
                    }
                });
                setServiceAvailabilities(svcMap);

                // Fetch exceptions (blocked/extra availability)
                const exceptionsSnap = await getDocs(collection(db, 'users', resolvedUserId, 'availability_exceptions'));
                const toDate = (v: any) => (v?.toDate ? v.toDate() : new Date(v));
                const exList: CalendarEvent[] = exceptionsSnap.docs.map(d => {
                    const data: any = d.data();
                    return {
                        id: d.id,
                        type: data.type as CalendarEventType,
                        title: data.title || '',
                        start: toDate(data.start),
                        end: toDate(data.end),
                        isAllDay: !!data.isAllDay,
                    } as CalendarEvent;
                });
                setExceptions(exList);

                // Fetch appointments to prevent overlaps
                const apptSnap = await getDocs(collection(db, 'users', resolvedUserId, 'appointments'));
                const appts: Appointment[] = apptSnap.docs.map(d => {
                    const data: any = d.data();
                    const dt = data.dateTime?.toDate ? data.dateTime.toDate() : new Date(data.dateTime);
                    return {
                        id: d.id,
                        clientName: data.clientName || '',
                        service: data.service || '',
                        dateTime: dt,
                        duration: Number(data.duration) || 0,
                        status: data.status as AppointmentStatus,
                        modality: data.modality || 'Online',
                        price: Number(data.price) || 0,
                    } as Appointment;
                });
                setAllAppointments(appts);

                // Fetch active reservations (temporary holds)
                try {
                    const resSnap = await getDocs(collection(db, 'users', resolvedUserId, 'reservations'));
                    const resList = resSnap.docs.map(d => {
                        const data: any = d.data();
                        return {
                            id: d.id,
                            clientName: data.clientName,
                            serviceId: data.serviceId,
                            dateTime: data.dateTime?.toDate ? data.dateTime.toDate() : new Date(data.dateTime),
                            duration: Number(data.duration) || 0,
                            expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : new Date(0)),
                            gateway: data.gateway,
                            paymentStatus: data.paymentStatus || null,
                            used: !!data.used,
                        };
                    });
                    setReservations(resList);
                } catch (rErr) {
                    console.warn('Falha ao carregar reservas temporárias', rErr);
                    setReservations([]);
                }

                // Fetch payment gateways
                const gatewaysSnapshot = await getDocs(query(collection(db, 'users', resolvedUserId, 'gateways'), where('status', '==', PaymentGatewayStatus.Active)));
                setGateways(gatewaysSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PaymentGateway)));

                // Fetch approved testimonials (kept in subcollection, not embedded in profile doc)
                try {
                    const approvedSnap = await getDocs(query(collection(db, 'users', resolvedUserId, 'testimonials'), where('status', '==', 'approved')));
                    const approvedList: Testimonial[] = approvedSnap.docs.map(d => {
                        const dt: any = d.data();
                        const date = dt.date?.toDate ? dt.date.toDate() : (dt.date ? new Date(dt.date) : new Date());
                        return { id: d.id, clientName: dt.clientName || 'Cliente', text: dt.text || '', date, rating: dt.rating || 0, status: 'approved' } as Testimonial;
                    });
                    setProfile(prev => ({ ...(prev || {} as any), testimonials: approvedList } as ProfessionalProfile));
                } catch (tErr) {
                    console.warn('Falha ao carregar depoimentos aprovados', tErr);
                }

            } catch (err) {
                console.error("Erro ao buscar dados do profissional:", err);
                setError("Ocorreu um erro ao carregar a página. Tente novamente mais tarde.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfessionalData();
    }, []);

    // package-related flows removed

    // Handle Mercado Pago return and update appointment payment status
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mp = params.get('mp');
        if (!mp || !profId) return;
        const appointmentId = params.get('appointmentId') || localStorage.getItem('lastAppointmentId') || '';
        const reservationId = params.get('reservationId') || localStorage.getItem('lastReservationId') || null;

        // If neither appointmentId nor reservationId is present, nothing to do here
        if (!appointmentId && !reservationId) return;

        const statusMap: Record<string, any> = { success: 'Pago', pending: 'Pendente', failure: 'Pendente' };
        const payStatus = statusMap[mp];
        if (!payStatus) return;

        const run = async () => {
            try {
                        if (reservationId) {
                            // Finalize reservation: cloud function should create the actual appointment and mark reservation used
                            try {
                                const functions = getFunctions(firebaseApp, 'us-central1');
                                const finalize = httpsCallable(functions, 'finalizeReservation');
                                await finalize({ professionalId: profId, reservationId, paymentStatus: payStatus });
                                localStorage.removeItem('lastReservationId');
                                // After finalizing, proceed to success
                                setStep(5);
                                return;
                            } catch (e) {
                                console.warn('Falha ao finalizar reserva via callable', e);
                                // Fallback: best-effort — read the reservation doc and create appointment client-side
                                try {
                                    const resDocRef = doc(db, 'users', profId, 'reservations', reservationId);
                                    const resSnap = await getDoc(resDocRef);
                                    if (resSnap.exists()) {
                                        const rd: any = resSnap.data();
                                        // Build appointment data similar to server helper
                                        const start = rd.dateTime?.toDate ? rd.dateTime.toDate() : new Date(rd.dateTime);
                                        const apptData: any = {
                                            clientName: rd.clientName || 'Cliente',
                                            clientEmail: rd.clientEmail || null,
                                            service: rd.serviceId || rd.service || '',
                                            dateTime: start,
                                            duration: Number(rd.duration) || 0,
                                            status: (payStatus && (payStatus === 'Pago' || payStatus === 'paid')) ? 'Confirmado' : 'Agendado',
                                            paymentStatus: payStatus || rd.paymentStatus || 'Pendente',
                                            createdAt: serverTimestamp(),
                                        };
                                        const apptRef = await addDoc(collection(db, 'users', profId, 'appointments'), apptData);
                                        // Mark reservation as used
                                        await updateDoc(resDocRef, { used: true, finalizedAt: serverTimestamp(), appointmentId: apptRef.id, paymentStatus: payStatus || rd.paymentStatus || 'pending' });
                                        localStorage.removeItem('lastReservationId');
                                        setStep(5);
                                        return;
                                    }
                                } catch (e2) {
                                    console.warn('Fallback ao criar agendamento a partir da reserva falhou', e2);
                                }
                                // fallthrough to try updating appointment if appointmentId exists
                            }
                        }

                if (appointmentId) {
                    await updateDoc(doc(db, 'users', profId, 'appointments', appointmentId), { paymentStatus: payStatus });
                    setStep(5);
                }
            } catch (e) {
                console.warn('Falha ao atualizar pagamento do agendamento/pacote', e);
            }
        };
        run();
    }, [profId]);
    
    // Define a theme color based on profile, with a fallback
    const themeColor = profile?.themeColor || '#4f46e5';

    const handleSelectService = (service: Service) => {
        setSelectedService(service);
        setStep(2);
    };


    const handleSelectDateTime = (date: Date, time: string) => {
        setSelectedDate(date);
        setSelectedTime(time);
        setStep(3);
    };

    const handleDetailsSubmit = (details: {name: string, email: string, phone: string}) => {
        setClientDetails(details);
        setStep(4);
    };
    
    const handleConfirmBooking = () => {
        // Here you would make an API call to save the appointment
        console.log("Booking Confirmed:", {
            service: selectedService?.name,
            date: selectedDate.toLocaleDateString(),
            time: selectedTime,
            client: clientDetails,
        });
        setStep(5);
    };

    const resetFlow = () => {
        setStep(1);
        setSelectedService(null);
        setSelectedDate(new Date());
        setSelectedTime(null);
        setClientDetails({ name: '', email: '', phone: '' });
    }

    const renderStep = () => {
        switch (step) {
            case 1:
                return <SelectService services={services.filter(s => s.isActive)} onSelectService={handleSelectService} />;
            case 2:
                return (
                    <SelectDateTime 
                        service={selectedService!} 
                        workingHours={serviceAvailabilities[selectedService!.id] || workingHoursDefault}
                        exceptions={exceptions}
                        appointments={allAppointments}
                        reservations={reservations}
                        advancedSettings={advancedSettings}
                        onSelectDateTime={handleSelectDateTime} 
                        onBack={() => setStep(1)} 
                    />
                );
            case 3:
                        return <EnterDetails onSubmit={handleDetailsSubmit} onBack={() => setStep(2)} />;
            case 4:
            return <ConfirmBooking 
                    service={selectedService!} 
                    date={selectedDate} 
                    time={selectedTime!} 
                    details={clientDetails}
                    onConfirm={handleConfirmBooking}
                    onBack={() => setStep(3)}
                    cancellationPolicy={profile?.cancellationPolicy}
                    paymentGateways={gateways}
                    merchantName={profile?.name}
                    merchantCity={profile?.address?.city}
                professionalId={profId}
                bookingPolicy={bookingPolicy}
                reservationHoldMinutes={advancedSettings?.reservationHoldMinutes || 15}
                onFinish={(gatewayId?: string) => setLastSelectedGateway(gatewayId || null)}
                />;
            case 5:
                return <BookingSuccess onBookAnother={resetFlow} lastSelectedGateway={lastSelectedGateway} professionalPhone={profile?.phone || profile?.contactPhone || ''} />;
            default:
                return <SelectService services={services} onSelectService={handleSelectService} />;
        }
    };

    if (loading) {
        return (
            <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
                <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
                    <SkeletonLoader />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-center text-red-500">
                <p>{error}</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-screen text-center">
                <p>Perfil não encontrado.</p>
            </div>
        );
    }

    // small helper to decide if we can display an image (http(s) or data URL)
    const canDisplayUrl = (candidate?: string | null) => isValidHttpUrl(candidate) || isDataUrl(candidate);

    return (
        <>
            <title>{profile ? `${profile.name} | Agendiia` : 'Agendamento | Agendiia'}</title>
            <meta name="description" content={profile ? `Agende seu horário com ${profile.name} - ${profile.specialty}.` : 'Página de agendamento online.'} />
            <div className="bg-gray-50 dark:bg-gray-900 min-h-screen font-sans text-gray-800 dark:text-gray-200">
                 {/* Style tag to inject the theme color as a CSS variable */}
                <style>{`:root { --theme-color: ${themeColor}; }`}</style>
                
                <header 
                    className="h-64 bg-gray-200 dark:bg-gray-700 bg-cover bg-center relative"
                    style={canDisplayUrl(profile.bannerUrl) ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </header>
                
                <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 -mt-32">
                    {/* Coluna da Esquerda (Info do Profissional e Resumo) */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="sticky top-4 space-y-6">
                            {/* Card Principal do Perfil (visually modernized) */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center ring-1 ring-gray-100 dark:ring-0">
                                <div className="mx-auto w-fit -mt-16">
                                    <div className="relative">
                                        <div className="rounded-full p-1" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.12))' }}>
                                            <img
                                                className="h-32 w-32 rounded-full object-cover border-4 border-white dark:border-gray-800"
                                                src={canDisplayUrl(profile.avatarUrl) ? (profile.avatarUrl as string) : ('https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(profile.name || 'P'))}
                                                alt="User avatar"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(profile.name || 'P'); }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">{profile.name}</h1>
                                <p className="text-md text-[var(--theme-color)] font-semibold">{profile.specialty}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{profile.registration}</p>
                                <div className="mt-4">
                                    <SocialLinks links={profile.socialLinks} />
                                </div>
                            </div>

                            {/* Resumo do Agendamento (agora fixo aqui) */}
                            <BookingSummary service={selectedService} date={selectedDate} time={selectedTime} onReset={resetFlow} />

                            {/* Card de Informações Adicionais com Accordions */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                 <Accordion title="Sobre" icon={<User className="h-5 w-5" />}>
                                    <p className="text-sm">{profile.bio}</p>
                                </Accordion>
                                
                                {profile.credentials && profile.credentials.length > 0 && (
                                    <Accordion title="Credenciais" icon={<Award className="h-5 w-5" />}>
                                        <CredentialsSection credentials={profile.credentials} />
                                    </Accordion>
                                )}

                                {profile.testimonials && profile.testimonials.filter(t => t.status === 'approved').length > 0 && (
                                    <Accordion title="Depoimentos" icon={<Quote className="h-5 w-5" />}>
                                        <TestimonialsSection testimonials={profile.testimonials.filter(t => t.status === 'approved')} />
                                    </Accordion>
                                )}

                                {profile.address && (
                                    <Accordion title="Endereço" icon={<MapPin className="h-5 w-5" />}>
                                        <AddressSection address={profile.address} />
                                    </Accordion>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Coluna da Direita (Fluxo de Agendamento) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
                            <BookingStepper currentStep={step} />
                            {renderStep()}
                        </div>
                    </div>
                </main>

                <footer className="text-center p-4 text-sm text-gray-500">
                    Powered by <a href="https://agendiia.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--theme-color)]">Agendiia</a>
                </footer>
            </div>
        </>
    );
};

// --- Seções de Informação (agora mais simples) ---
const AddressSection: React.FC<{ address: Address }> = ({ address }) => {
    const fullAddress = `${address.street}, ${address.city}, ${address.state} - ${address.zip}`;
    const mapQuery = encodeURIComponent(fullAddress);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center"><MapPin className="h-6 w-6 mr-3 text-[var(--theme-color)]" /> Endereço de Atendimento</h3>
            <p className="text-gray-600 dark:text-gray-300">{fullAddress}</p>
        </div>
    );
};

const CredentialsSection: React.FC<{ credentials: Credential[] }> = ({ credentials }) => (
    <ul className="space-y-3 text-sm">
        {credentials.map(cred => (
            <li key={cred.id}>
                <p className="font-semibold text-gray-800 dark:text-white">{cred.title}</p>
                <p className="text-gray-500 dark:text-gray-400">{cred.institution}, {cred.year}</p>
            </li>
        ))}
    </ul>
);

const StarRatingDisplay: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex text-yellow-400">
        {[...Array(5)].map((_, index) => (
            <Star key={index} className="h-5 w-5" fill={index < rating ? 'currentColor' : 'none'} />
        ))}
    </div>
);

const TestimonialsSection: React.FC<{ testimonials: Testimonial[] }> = ({ testimonials }) => (
    <div className="space-y-6">
        {testimonials.map(t => (
            <blockquote key={t.id} className="border-l-4 border-[var(--theme-color)] pl-4 text-sm">
                {t.rating && <StarRatingDisplay rating={t.rating} />}
                <p className="text-gray-600 dark:text-gray-300 italic mt-2">"{t.text}"</p>
                <footer className="mt-2 font-semibold text-gray-800 dark:text-white">- {t.clientName}</footer>
            </blockquote>
        ))}
    </div>
);

// --- NOVO COMPONENTE: ReservationStatus ---
const ReservationStatus: React.FC<{ reservations: any[], date: Date | null, reservationHoldMinutes?: number }> = ({ reservations, date, reservationHoldMinutes }) => {
    if (!date || !reservations.length) return null;

    const dayReservations = reservations.filter(r => {
        const rDate = new Date(r.dateTime);
        const now = new Date();
        return rDate.toDateString() === date.toDateString() && 
               !r.used && 
               new Date(r.expiresAt) > now;
    });

    if (!dayReservations.length) return null;

    return (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                <strong>Reservas Temporárias Ativas:</strong> {dayReservations.length} horário{dayReservations.length !== 1 ? 's' : ''} reservado{dayReservations.length !== 1 ? 's' : ''} por {reservationHoldMinutes || 15} minuto{(reservationHoldMinutes || 15) !== 1 ? 's' : ''}
            </p>
            <div className="mt-2 text-xs text-orange-600 dark:text-orange-300">
                {dayReservations.map(r => {
                    const expiry = new Date(r.expiresAt);
                    const timeStr = new Date(r.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const expiryStr = expiry.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                        <div key={r.id}>
                            {timeStr} - Expira às {expiryStr} (Cliente: {r.clientName})
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- STEP 1: SELECT SERVICE ---
const SelectService: React.FC<{services: Service[], onSelectService: (service: Service) => void}> = ({ services, onSelectService }) => {
    const serviceItems = services;

    const renderCard = (service: any) => {
        const cardBorder = 'border-gray-200 dark:border-gray-700';
        const hoverBg = 'hover:bg-[var(--theme-color)]/10 dark:hover:bg-[var(--theme-color)]/20';

        return (
            <div
                key={service.id}
                onClick={() => onSelectService(service)}
                className={`p-4 border ${cardBorder} rounded-lg ${hoverBg} cursor-pointer transition-all transform hover:scale-[1.02]`}
            >
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <p className={`font-bold text-lg text-[var(--theme-color)]`}>R$ {Number(service.price).toFixed(2)}</p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{service.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center"><Clock className="h-4 w-4 mr-2"/>{service.duration} minutos</p>
            </div>
        );
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-1">Escolha um Serviço</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Selecione o serviço que deseja agendar.</p>

            {serviceItems.length === 0 ? (
                <div className="p-6 text-center border border-dashed rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                    Nenhum serviço ativo no momento. Tente novamente mais tarde.
                </div>
            ) : (
                <div className="space-y-4">
                    {serviceItems.map(s => renderCard(s))}
                </div>
            )}
        </div>
    );
};

// --- STEP 2: SELECT DATE & TIME ---
const SelectDateTime: React.FC<{service: Service, workingHours: WorkingDay[], exceptions: CalendarEvent[], appointments: Appointment[], reservations: any[], advancedSettings: { bufferBefore: number; bufferAfter: number; minNoticeHours: number; maxNoticeDays: number; maxAppointmentsPerDay: number }, onSelectDateTime: (date: Date, time: string) => void, onBack: () => void}> = ({ service, workingHours, exceptions, appointments, reservations, advancedSettings, onSelectDateTime, onBack }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const generateAvailableSlots = useCallback((date: Date, serviceDuration: number) => {
        setIsLoading(true);

        // Use requestAnimationFrame to defer processing and allow UI to update
        requestAnimationFrame(() => {
            try {
                // Apply notice window constraints
                const now = new Date();
                const minTime = new Date(now.getTime() + advancedSettings.minNoticeHours * 60 * 60 * 1000);
                const maxDate = new Date(now.getTime() + advancedSettings.maxNoticeDays * 24 * 60 * 60 * 1000);
                if (date < new Date(minTime.getFullYear(), minTime.getMonth(), minTime.getDate()) || date > maxDate) {
                    setAvailableSlots([]);
                    setIsLoading(false);
                    return;
                }

                const dayOfWeekName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
                const dayOfWeekCapitalized = dayOfWeekName.charAt(0).toUpperCase() + dayOfWeekName.slice(1);
                
                const workDay = workingHours.find(d => d.dayOfWeek === dayOfWeekCapitalized);

                // Consolidate all unavailable times for the selected date
                const dayAppointments = appointments.filter(a => new Date(a.dateTime).toDateString() === date.toDateString() && a.status !== AppointmentStatus.Canceled);
                // include active reservations that haven't expired and aren't used
                const dayReservations = (reservations || []).filter(r => new Date(r.dateTime).toDateString() === date.toDateString() && !r.used && new Date(r.expiresAt) > now);

                const unavailableTimes = [
                    ...dayAppointments.map(a => ({ start: new Date(new Date(a.dateTime).getTime() - advancedSettings.bufferBefore * 60000), end: new Date(new Date(a.dateTime).getTime() + (a.duration + advancedSettings.bufferAfter) * 60000) })),
                    ...dayReservations.map(r => ({ start: new Date(new Date(r.dateTime).getTime() - advancedSettings.bufferBefore * 60000), end: new Date(new Date(r.dateTime).getTime() + (r.duration + advancedSettings.bufferAfter) * 60000) })),
                    ...exceptions
                        .filter(e => new Date(e.start).toDateString() === date.toDateString() && e.type === CalendarEventType.Blocked)
                        .map(e => ({ start: new Date(e.start), end: new Date(e.end) })),
                ];

                const slots: string[] = [];
                // Build base intervals (from working hours) and add extra availability intervals from exceptions
                const baseIntervals = (workDay && workDay.enabled) ? workDay.intervals : [];
                const extraIntervals = exceptions
                    .filter(e => new Date(e.start).toDateString() === date.toDateString() && e.type === CalendarEventType.ExtraAvailability)
                    .map(e => ({ start: new Date(e.start), end: new Date(e.end) }));

                const addSlotsFromRange = (rangeStart: Date, rangeEnd: Date) => {
                    let slotTime = new Date(rangeStart);
                    // round up to next 15-minute mark
                    const minutes = slotTime.getMinutes();
                    slotTime.setMinutes(minutes + (15 - (minutes % 15)) % 15, 0, 0);

                    while(slotTime.getTime() + serviceDuration * 60000 <= rangeEnd.getTime()) {
                        const slotStartWithBefore = new Date(slotTime.getTime() - advancedSettings.bufferBefore * 60000);
                        const slotEndWithAfter = new Date(slotTime.getTime() + (serviceDuration + advancedSettings.bufferAfter) * 60000);

                        const isOverlapping = unavailableTimes.some(unavail => 
                            slotStartWithBefore < unavail.end && slotEndWithAfter > unavail.start
                        );

                        const respectsMinNotice = slotTime >= minTime;

                        if(!isOverlapping && respectsMinNotice) {
                            slots.push(slotTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
                        }

                        slotTime.setMinutes(slotTime.getMinutes() + 15);
                    }
                };

                // Add slots from working hours intervals
                baseIntervals.forEach(interval => {
                    const [startHour, startMinute] = interval.startTime.split(':').map(Number);
                    const [endHour, endMinute] = interval.endTime.split(':').map(Number);
                    const intervalStart = new Date(date);
                    intervalStart.setHours(startHour, startMinute, 0, 0);
                    const intervalEnd = new Date(date);
                    intervalEnd.setHours(endHour, endMinute, 0, 0);
                    addSlotsFromRange(intervalStart, intervalEnd);
                });

                // Add slots from extra availability intervals
                extraIntervals.forEach(({ start, end }) => addSlotsFromRange(start, end));
                
                // Apply max appointments per day limit (include active reservations)
                const activeReservationsCount = dayReservations.length;
                const alreadyBookedCount = dayAppointments.length + activeReservationsCount;
                if (alreadyBookedCount >= advancedSettings.maxAppointmentsPerDay) {
                    setAvailableSlots([]);
                    setIsLoading(false);
                    return;
                }

                setAvailableSlots(slots);
                setIsLoading(false);
            } catch (error) {
                console.error('Error generating slots:', error);
                setAvailableSlots([]);
                setIsLoading(false);
            }
        });
    }, [advancedSettings, workingHours, appointments, exceptions, reservations]);

    useEffect(() => {
        if(selectedDate) {
             generateAvailableSlots(selectedDate, service.duration);
        }
    }, [selectedDate, service.duration, generateAvailableSlots]);

    return (
        <div>
            <button onClick={onBack} className="flex items-center text-sm text-[var(--theme-color)] dark:text-[var(--theme-color)]/90 font-semibold mb-4"><ArrowLeft className="h-4 w-4 mr-1"/> Voltar</button>
            <h2 className="text-2xl font-bold mb-1">Selecione a Data e Horário</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-2">Para o serviço: <strong className="text-gray-700 dark:text-gray-200">{service.name}</strong></p>
            
            {/* Booking time constraints info */}
            {(advancedSettings.minNoticeHours > 0 || advancedSettings.maxNoticeDays < 365) && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Janela de agendamento:</strong>
                        {advancedSettings.minNoticeHours > 0 && (
                            <span> Mínimo {advancedSettings.minNoticeHours} hora{advancedSettings.minNoticeHours !== 1 ? 's' : ''} de antecedência</span>
                        )}
                        {advancedSettings.minNoticeHours > 0 && advancedSettings.maxNoticeDays < 365 && <span> • </span>}
                        {advancedSettings.maxNoticeDays < 365 && (
                            <span> Máximo {advancedSettings.maxNoticeDays} dia{advancedSettings.maxNoticeDays !== 1 ? 's' : ''} de antecedência</span>
                        )}
                    </p>
                </div>
            )}
            
            {/* Reservation status indicator (hidden per UX request) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CalendarComponent 
                    currentDate={currentDate} 
                    setCurrentDate={setCurrentDate} 
                    selectedDate={selectedDate} 
                    onDateSelect={setSelectedDate}
                    advancedSettings={advancedSettings}
                />
                <div className="flex flex-col">
                     <h3 className="font-semibold text-center mb-2">{selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) || 'Selecione uma data'}</h3>
                     <div className="flex-grow border border-gray-200 dark:border-gray-700 rounded-lg p-2 max-h-80 overflow-y-auto">
                        <LoadingState 
                            loading={isLoading}
                            loadingComponent={<LoadingSpinner text="Verificando horários..." />}
                            isEmpty={availableSlots.length === 0}
                            emptyComponent={
                                <div className="text-center text-gray-500 py-8">
                                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum horário disponível para esta data</p>
                                </div>
                            }
                        >
                            <div className="grid grid-cols-3 gap-2">
                                {availableSlots.map(time => (
                                    <button key={time} onClick={() => onSelectDateTime(selectedDate!, time)} className="w-full text-center p-2 rounded-lg bg-[var(--theme-color)]/10 text-[var(--theme-color)] hover:bg-[var(--theme-color)] hover:text-white transition-colors">
                                        {time}
                                    </button>
                                ))}
                            </div>
                        </LoadingState>
                     </div>
                </div>
            </div>
        </div>
    );
};

const CalendarComponent: React.FC<{
    currentDate: Date, 
    setCurrentDate: (d: Date) => void, 
    selectedDate: Date | null, 
    onDateSelect: (d: Date) => void,
    advancedSettings: { minNoticeHours: number; maxNoticeDays: number }
}> = ({ currentDate, setCurrentDate, selectedDate, onDateSelect, advancedSettings }) => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(endOfMonth);
    if(endDate.getDay() !== 6) {
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    }
    
    const days = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const changeMonth = (amount: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1));
    }

    const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    
    // Calculate booking time constraints based on advanced settings
    const now = new Date();
    const minBookingDate = new Date(now.getTime() + advancedSettings.minNoticeHours * 60 * 60 * 1000);
    const maxBookingDate = new Date(now.getTime() + advancedSettings.maxNoticeDays * 24 * 60 * 60 * 1000);
    
    // Get today's date for comparison (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowLeft/></button>
                <h2 className="text-lg font-semibold">{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ArrowRight/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <div key={i} className="py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(d => {
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                    const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
                    const isToday = isSameDay(d, new Date());
                    
                    // Check if date is in the past (before today)
                    const dateForComparison = new Date(d);
                    dateForComparison.setHours(0, 0, 0, 0);
                    const isPastDate = dateForComparison < today;
                    
                    // Check if date is before minimum booking time
                    const minDateForComparison = new Date(minBookingDate);
                    minDateForComparison.setHours(0, 0, 0, 0);
                    const isBeforeMinBooking = dateForComparison < minDateForComparison;
                    
                    // Check if date is after maximum booking time
                    const maxDateForComparison = new Date(maxBookingDate);
                    maxDateForComparison.setHours(23, 59, 59, 999);
                    const isAfterMaxBooking = dateForComparison > maxDateForComparison;
                    
                    // Disable if not current month OR if it's a past date OR outside booking window
                    const isDisabled = !isCurrentMonth || isPastDate || isBeforeMinBooking || isAfterMaxBooking;
                    
                    return (
                        <button 
                            key={d.toISOString()} 
                            onClick={() => !isDisabled && onDateSelect(d)}
                            disabled={isDisabled}
                            className={`
                                h-10 w-10 flex items-center justify-center rounded-full transition-colors
                                ${isDisabled ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-[var(--theme-color)]/10 dark:hover:bg-gray-700 cursor-pointer'}
                                ${isSelected ? 'bg-[var(--theme-color)] text-white font-bold' : ''}
                                ${isToday && !isSelected && !isDisabled ? 'border-2 border-[var(--theme-color)]' : ''}
                            `}
                        >
                            {d.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- STEP 3: ENTER DETAILS ---
const EnterDetails: React.FC<{onSubmit: (details: any) => void, onBack: () => void}> = ({ onSubmit, onBack }) => {
    const [details, setDetails] = useState({ name: '', email: '', phone: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'name':
                if (!value.trim()) return 'Nome é obrigatório';
                if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
                return '';
            case 'email':
                if (!value.trim()) return 'Email é obrigatório';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email inválido';
                return '';
            case 'phone':
                if (!value.trim()) return 'Telefone é obrigatório';
                if (!/^[\d\s\-\(\)\+]+$/.test(value)) return 'Telefone inválido';
                return '';
            default:
                return '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDetails(prev => ({ ...prev, [name]: value }));
        
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate all fields
        const newErrors: Record<string, string> = {};
        Object.keys(details).forEach(key => {
            const error = validateField(key, details[key as keyof typeof details]);
            if (error) newErrors[key] = error;
        });

        setErrors(newErrors);
        setTouched(Object.keys(details).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

        if (Object.values(newErrors).some(error => error !== '')) {
            return;
        }

        onSubmit(details);
    };
    return (
        <div>
             <button onClick={onBack} className="flex items-center text-sm text-[var(--theme-color)] dark:text-[var(--theme-color)]/90 font-semibold mb-4"><ArrowLeft className="h-4 w-4 mr-1"/> Voltar</button>
            <h2 className="text-2xl font-bold mb-1">Seus Detalhes</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Preencha suas informações para concluir o agendamento.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <FormInput
                    label="Nome Completo"
                    name="name"
                    value={details.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.name}
                    icon={<User className="h-5 w-5" />}
                    required
                />
                <FormInput
                    label="Email"
                    name="email"
                    type="email"
                    value={details.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.email}
                    icon={<Mail className="h-5 w-5" />}
                    required
                />
                <FormInput
                    label="Telefone"
                    name="phone"
                    type="tel"
                    value={details.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.phone}
                    icon={<Phone className="h-5 w-5" />}
                    required
                />
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Voltar
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-6 py-3 bg-[var(--theme-color)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                        Continuar
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- NOVO COMPONENTE: BookingPolicyInfo ---
const BookingPolicyInfo: React.FC<{ selectedGateway: string | null, paymentGateways: PaymentGateway[], bookingPolicy: 'temporary' | 'no_online_payment', reservationHoldMinutes?: number }> = ({ selectedGateway, paymentGateways, bookingPolicy, reservationHoldMinutes }) => {
    // bookingPolicy: 'temporary' => Reserva temporária (15 minutos)
    // bookingPolicy: 'no_online_payment' => Sem pagamento online
    const isPix = selectedGateway === 'pix';
    const isMercado = selectedGateway === 'mercadopago';

    return (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-2 flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Política de Agendamento
            </h4>

            {bookingPolicy === 'temporary' && (
                <div className="text-sm text-blue-800 dark:text-blue-300">
                    <div className="text-lg">⏳ <strong>Reserva Temporária</strong></div>
                    <div className="mt-1">O horário escolhido ficará reservado por {reservationHoldMinutes || 15} minuto{(reservationHoldMinutes || 15) !== 1 ? 's' : ''} aguardando o pagamento. Caso o pagamento não seja realizado nesse período, ele será automaticamente liberado.</div>
                </div>
            )}

            {bookingPolicy === 'no_online_payment' && (
                <div className="text-sm text-green-800 dark:text-green-300">
                    <div className="text-lg">💳 <strong>Agendamento sem Pagamento Online</strong></div>
                    <div className="mt-1">Se preferir, você pode agendar normalmente e realizar o pagamento diretamente no dia do atendimento, com o profissional.</div>
                </div>
            )}

            {/* Small note about gateways when bookingPolicy is temporary and specific gateway was selected */}
            {bookingPolicy === 'temporary' && isPix && (
                <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">Pagamento via PIX: o horário também ficará reservado por {reservationHoldMinutes || 15} minuto{(reservationHoldMinutes || 15) !== 1 ? 's' : ''} enquanto você conclui o pagamento.</div>
            )}

            {bookingPolicy === 'temporary' && isMercado && (
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">Pagamento online: você será redirecionado para o checkout, o horário ficará reservado por {reservationHoldMinutes || 15} minuto{(reservationHoldMinutes || 15) !== 1 ? 's' : ''}.</div>
            )}

            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                ⚠️ Para evitar sobreposições, todos os horários respeitam os intervalos de segurança configurados pelo profissional.
            </div>
        </div>
    );
};

const ConfirmBooking: React.FC<{
    service: Service, 
    date: Date, 
    time: string, 
    details: any, 
    onConfirm: () => void, 
    onBack: () => void, 
    cancellationPolicy?: string,
    paymentGateways: PaymentGateway[],
    merchantName?: string,
    merchantCity?: string,
    professionalId?: string
    bookingPolicy?: 'temporary' | 'no_online_payment'
    reservationHoldMinutes?: number
    onFinish?: (gatewayId?: string) => void
}> = ({ service, date, time, details, onConfirm, onBack, cancellationPolicy, paymentGateways, merchantName, merchantCity, professionalId, bookingPolicy, reservationHoldMinutes = 15, onFinish }) => {
    const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
    const [pixQrDataUrl, setPixQrDataUrl] = useState<string | null>(null);
    const [pixPayload, setPixPayload] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedGatewayObj = useMemo(() => paymentGateways.find(g => g.id === selectedGateway) || null, [paymentGateways, selectedGateway]);

    const buildPixPayloadWithLibrary = useCallback((key: string, merchant: string, city: string, amount?: number, txid?: string) => {
        try {
            // Sanitiza e garante limites exigidos pelo padrão (merchantName <=25, merchantCity 1-15, txid <=25)
            const sanitize = (v: string, max: number, fallback: string) => {
                if (!v) v = fallback;
                // Remove acentos e caracteres não permitidos (mantém A-Z0-9 espaço e alguns símbolos básicos)
                v = v.normalize('NFD').replace(/[^\p{ASCII}]/gu, '').replace(/[^A-Za-z0-9 \-_.]/g, '');
                v = v.trim();
                if (!v) v = fallback;
                if (v.length > max) v = v.slice(0, max);
                return v.toUpperCase();
            };
            const mName = sanitize(merchant, 25, 'AGENDIIA');
            const mCity = sanitize(city, 15, 'BRASILIA');
            const tx = (txid || '***').toUpperCase().slice(0, 25);
            const value = typeof amount === 'number' && !isNaN(amount) ? Number(amount.toFixed(2)) : 0;

            const result: any = createStaticPix({
                merchantName: mName,
                merchantCity: mCity,
                pixKey: key,
                txid: tx,
                transactionAmount: value,
                isTransactionUnique: true,
            });

            if (hasError(result)) {
                console.error('PIX error object', result);
                return null;
            }

            if (result && typeof result.toBRCode === 'function') {
                return result.toBRCode();
            }
            // Log error only in development
            if (import.meta.env.DEV) {
                console.error('Objeto PIX retornado sem método toBRCode');
            }
            return null;
        } catch (error) {
            console.error('Erro ao gerar payload PIX (createStaticPix):', error);
            return null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: NodeJS.Timeout;

        if (selectedGatewayObj?.id !== 'pix') {
            setPixQrDataUrl(null);
            setPixPayload('');
            return;
        }

        const gen = async () => {
            const pixKey = selectedGatewayObj?.config?.key as string | undefined;
            if (!pixKey) {
                if (!cancelled) {
                    setPixQrDataUrl(null);
                    setPixPayload('');
                }
                return;
            }

            timeoutId = setTimeout(async () => {
                if (cancelled) return;

                const uniqueTxid = `AGD${Date.now()}${Math.random().toString(36).substring(2, 7)}`;
                const payload = buildPixPayloadWithLibrary(pixKey, merchantName || '', merchantCity || '', service.price, uniqueTxid);

                if (!payload) {
                    if (!cancelled) {
                        setPixQrDataUrl(null);
                        setPixPayload('Erro ao gerar PIX. Verifique os dados do gateway.');
                    }
                    return;
                }
                
                if (!cancelled) {
                    setPixPayload(payload);
                }

                try {
                    const QR = await import('qrcode');
                    const dataUrl = await QR.toDataURL(payload, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
                    if (!cancelled) {
                        setPixQrDataUrl(dataUrl);
                    }
                } catch (e) {
                    console.error('Falha ao renderizar o QR Code com a biblioteca qrcode:', e);
                    if (!cancelled) {
                        setPixQrDataUrl(null);
                    }
                }
            }, 300);
        };

        gen();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [selectedGatewayObj, service.price, merchantName, merchantCity, buildPixPayloadWithLibrary]);

    const copy = async (text: string) => {
        try { 
            await navigator.clipboard.writeText(text); 
            // You could add a toast notification here for better UX
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const buildDateTime = useCallback(() => {
        const d = new Date(date);
        const [hh, mm] = (time || '00:00').split(':').map(Number);
        d.setHours(hh || 0, mm || 0, 0, 0);
        return d;
    }, [date, time]);

    const createAppointment = useCallback(async (): Promise<string> => {
        if (!professionalId) throw new Error('Profissional não identificado');

            const apptData = {
            clientName: details?.name || '',
            clientEmail: details?.email || '',
            clientPhone: details?.phone || '',
            service: service.name,
            dateTime: buildDateTime(),
                duration: Number(service.duration) || 60,
            status: 'Agendado',
            modality: service.modality || 'Online',
            price: Number(service.price.toFixed(2)),
            // Offline bookings do not get a special "Pagamento no local" status anymore.
            // When no online payment is performed, paymentStatus should be 'Pendente'.
            paymentStatus: 'Pendente',
            gateway: selectedGatewayObj?.id || 'none',
            createdAt: serverTimestamp(),
        };

        const ref = await addDoc(collection(db, 'users', professionalId, 'appointments'), apptData);
        localStorage.setItem('lastAppointmentId', ref.id);
        
        // Fallback email for dev environment
        if (import.meta.env.DEV) {
            try {
                const functions = getFunctions(firebaseApp, 'us-central1');
                const callable = httpsCallable(functions, 'sendTransactionalEmail');
                await callable({
                    toEmail: apptData.clientEmail,
                    toName: apptData.clientName,
                    subject: `DEV: Agendamento Confirmado - ${apptData.service}`,
                    html: `<p>Olá ${apptData.clientName},</p><p>Seu agendamento para <strong>${apptData.service}</strong> em <strong>${apptData.dateTime.toLocaleString('pt-BR')}</strong> foi criado com sucesso.</p><p>ID do Agendamento: ${ref.id}</p>`,
                });
            } catch (e) {
                console.warn('Dev email fallback failed', e);
            }
        }

        return ref.id;
    }, [professionalId, details, service, buildDateTime, selectedGatewayObj, bookingPolicy]);

    // no in-component payment step: user is redirected to a dedicated payment page after appointment creation

    const handleConfirm = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            // If booking policy is "no online payment", create appointment immediately
            if (bookingPolicy === 'no_online_payment') {
                const appointmentId = await createAppointment();
                onConfirm();
                return;
            }

            // For online payment gateways we create a temporary reservation then redirect to payment
            if (selectedGatewayObj?.id === 'mercadopago') {
                if (!professionalId) throw new Error('ID do profissional não encontrado para o Mercado Pago.');
                // Two-stage: create appointment first (confirm)
                const appointmentId = await createAppointment();
                try { onFinish && onFinish(selectedGatewayObj?.id || null); } catch {}
                try { onConfirm && onConfirm(); } catch {}
                // Attempt to create MercadoPago preference immediately so the payment page can redirect faster
                try {
                    const functions = getFunctions(firebaseApp, 'us-central1');
                    const createPref = httpsCallable(functions, 'createMercadoPagoPreference');
                    const backBase = `${window.location.origin}/booking`;
                    const result: any = await createPref({
                        professionalId,
                        item: { title: service.name, unit_price: Number(service.price.toFixed(2)), currency_id: 'BRL', quantity: 1 },
                        payer: { name: details?.name, email: details?.email },
                        back_urls: {
                            success: `${backBase}?mp=success&appointmentId=${appointmentId}`,
                            failure: `${backBase}?mp=failure&appointmentId=${appointmentId}`,
                            pending: `${backBase}?mp=pending&appointmentId=${appointmentId}`,
                        },
                        statement_descriptor: (merchantName || 'Agendiia').substring(0, 22),
                        metadata: { serviceId: service.id, clientEmail: details?.email || '', appointmentId: appointmentId },
                    });
                    const url = result?.data?.init_point || result?.data?.sandbox_init_point || result?.data?.init_point;
                    if (url) {
                        // store checkout url keyed by appointment so payment page can redirect instantly
                        try { localStorage.setItem(`lastCheckoutUrl:${appointmentId}`, url); } catch {}
                    }
                } catch (e) {
                    // non-fatal: payment page will create preference if needed
                    console.warn('Falha ao criar preferência antecipada (não bloqueante):', e);
                }

                // persist last appointment id and redirect to payment page which will either redirect immediately or create the preference
                try { localStorage.setItem('lastAppointmentId', appointmentId); } catch {}
                const paymentPath = `/booking/payment?appointmentId=${encodeURIComponent(appointmentId)}&professionalId=${encodeURIComponent(professionalId)}`;
                window.location.href = `${window.location.origin}${paymentPath}`;
                return; // navigating away
            }

            // For PIX, manual payment, or no payment gateway: create appointment immediately
            const appointmentId = await createAppointment();
            onConfirm();
            try { onFinish && onFinish(selectedGatewayObj?.id || null); } catch {}

        } catch (e) {
            console.error("Erro ao confirmar agendamento:", e);
            const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
            alert(`Não foi possível concluir o agendamento: ${errorMessage}. Tente novamente.`);
        }

        setIsSubmitting(false);
    };

    return (
        <div>
            <button onClick={onBack} className="flex items-center text-sm text-[var(--theme-color)] dark:text-[var(--theme-color)]/90 font-semibold mb-4"><ArrowLeft className="h-4 w-4 mr-1"/> Voltar</button>
            <h2 className="text-2xl font-bold mb-1">Confirme seu Agendamento</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Por favor, revise os detalhes abaixo antes de confirmar.</p>
            <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <InfoItem icon={<Wrench/>} label="Serviço" value={service.name} />
                <InfoItem icon={<DollarSign/>} label="Preço" value={`R$ ${service.price.toFixed(2)}`} />
                <InfoItem icon={<Calendar/>} label="Data" value={date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
                <InfoItem icon={<Clock/>} label="Horário" value={time} />
                <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                <InfoItem icon={<User/>} label="Nome" value={details.name} />
                <InfoItem icon={<Mail/>} label="Email" value={details.email} />
                <InfoItem icon={<Phone/>} label="Telefone" value={details.phone} />
            </div>
            
            {/* Booking Policy Information */}
            <BookingPolicyInfo selectedGateway={selectedGateway} paymentGateways={paymentGateways} bookingPolicy={bookingPolicy} reservationHoldMinutes={reservationHoldMinutes} />

            {paymentGateways.length > 0 && bookingPolicy !== 'no_online_payment' && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Forma de Pagamento</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Selecione como deseja pagar pela sessão.</p>
                    <div className="space-y-3">
                        {paymentGateways.map(gateway => (
                            <label key={gateway.id} htmlFor={`gateway-${gateway.id}`} className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${selectedGateway === gateway.id ? 'border-[var(--theme-color)] bg-[var(--theme-color)]/10' : 'border-gray-200 dark:border-gray-700'}`}>
                                <input 
                                    type="radio" 
                                    id={`gateway-${gateway.id}`} 
                                    name="paymentGateway" 
                                    value={gateway.id} 
                                    checked={selectedGateway === gateway.id}
                                    onChange={() => setSelectedGateway(gateway.id)}
                                    className="h-4 w-4 text-[var(--theme-color)] focus:ring-[var(--theme-color)]"
                                />
                                <div className="ml-4 flex items-center">
                                    <GatewayIcon gatewayId={gateway.id} />
                                    <span className="ml-3 font-semibold text-gray-800 dark:text-gray-200">{gateway.id === 'mercadopago' ? 'Cartão de Crédito' : gateway.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                    {selectedGatewayObj?.id === 'pix' && (
                        <div className="mt-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Pagamento via Pix</h4>
                            {selectedGatewayObj?.config?.key ? (
                                <>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">Valor</p>
                                            <p className="text-lg font-bold text-[var(--theme-color)]">R$ {service.price.toFixed(2)}</p>
                                        </div>
                                        {/* Short Pix key removed: only the full "Pix Copia e Cola (código completo)" remains below */}
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                        <div className="flex items-center justify-center p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                            {pixQrDataUrl ? (
                                                <img src={pixQrDataUrl} alt="QR Code Pix" className="w-56 h-56" />
                                            ) : (
                                                <div className="w-56 h-56 flex items-center justify-center text-sm text-gray-500">Gerando QR Code...</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Pix Copia e Cola (código completo)</p>
                                            <textarea
                                                readOnly
                                                value={pixPayload || ''}
                                                placeholder="Gerando código..."
                                                className="w-full p-2 font-mono text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 h-40"
                                            />
                                            <div className="mt-2 flex gap-2">
                                                <button type="button" onClick={() => copy(pixPayload)} className="text-xs px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Copiar código</button>
                                                <a href={pixQrDataUrl || '#'} download={`pix-${service.id}.png`} className={`text-xs px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 ${!pixQrDataUrl ? 'opacity-50 pointer-events-none' : ''}`}>Baixar QR</a>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Escaneie o QR no app do seu banco ou cole o código acima no Pix Copia e Cola.</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-red-500">Este profissional ainda não configurou a chave Pix.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {cancellationPolicy && (
                <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="font-semibold flex items-center text-gray-800 dark:text-white"><FileText className="h-5 w-5 mr-2 text-gray-500"/> Política de Cancelamento</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{cancellationPolicy}</p>
                </div>
            )}

            <button onClick={handleConfirm} disabled={isSubmitting} className={`w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-6 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-green-600'}`}>
                {isSubmitting ? 'Processando...' : (selectedGatewayObj?.id === 'mercadopago' ? 'Pagar com Cartão' : 'Confirmar Agendamento')}
            </button>
            {/* Payment handled on dedicated page /booking/payment */}
        </div>
    );
};

// --- STEP 5: BOOKING SUCCESS ---
const BookingSuccess: React.FC<{onBookAnother: () => void, lastSelectedGateway?: string | null, professionalPhone?: string}> = ({ onBookAnother, lastSelectedGateway }) => {
    const showOtherButton = true;

    return (
        <div className="text-center py-10">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/>
            <h2 className="text-2xl font-bold mb-2">Agendamento Realizado com Sucesso!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Você receberá uma confirmação por e-mail com todos os detalhes. Obrigado!</p>
            <div className="flex items-center justify-center gap-4">
                {showOtherButton && (
                    <button onClick={onBookAnother} className="bg-[var(--theme-color)] text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity">
                        Fazer Outro Agendamento
                    </button>
                )}
            </div>
        </div>
    );
};


// --- HELPER COMPONENTS ---
const GatewayIcon: React.FC<{ gatewayId: string }> = ({ gatewayId }) => {
    const iconClass = "h-6 w-6";

    switch(gatewayId) {
        case 'pix':
            return <PixLogo className={`${iconClass} text-green-600 dark:text-green-300 w-6 h-6`} />;
        case 'mercadopago':
            // Show a generic credit-card icon for the "Cartão de Crédito" option
            return <CreditCard className={`${iconClass} text-gray-700 dark:text-gray-300`} />;
        default:
            return <DollarSign className={`${iconClass} text-gray-500`} />;
    }
};

const FormInput: React.FC<{
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    error?: string;
    icon?: React.ReactNode;
    type?: string;
    required?: boolean;
}> = ({ label, name, value, onChange, onBlur, error, icon, type = 'text', required }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
             {icon && <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">{icon}</div>}
            <input
                type={type}
                name={name}
                id={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                required={required}
                className={`w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700 border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} focus:ring-2 focus:ring-[var(--theme-color)] focus:outline-none ${icon ? 'pl-10' : ''}`}
            />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
);

const InfoItem: React.FC<{label: string; value: string; icon: React.ReactNode}> = ({ label, value, icon }) => (
    <div className="flex items-start">
        <span className="text-gray-400 mt-1 mr-3">{icon}</span>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="font-semibold text-gray-800 dark:text-gray-200">{value}</p>
        </div>
    </div>
);

export default PublicBookingPage;