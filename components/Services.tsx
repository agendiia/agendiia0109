import React, { useEffect, useState, useMemo } from 'react';
import { Service, Package } from '../types';
import { Plus, Edit, Trash, MoreVertical, Clock, DollarSign, Wrench, Package as PackageIcon, FileCheck2, Tag, TrendingUp, Calendar } from './Icons';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { LoadingSpinner, LoadingState } from './LoadingState';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

// Firestore collections used:
// users/{uid}/services


// modality UI removed from Services page — modality is preserved in DB when present

type ActiveTab = 'services';

// Main Component
const Services: React.FC = () => {
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [activeTab, setActiveTab] = useState<ActiveTab>('services');
    const servicesOperation = useAsyncOperation({ isLoading: true });
    
    const [isServiceModalOpen, setServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    
    
    const [isSuggestingPackage, setIsSuggestingPackage] = useState(false);

    // Real-time listeners
    useEffect(() => {
        if (!user) return;
        
        servicesOperation.execute(async () => {
            const servicesRef = collection(db, 'users', user.uid, 'services');
            const servicesQ = query(servicesRef, orderBy('name'));
            const unsubServices = onSnapshot(servicesQ, (snap) => {
                const items: Service[] = snap.docs.map((d) => {
                    const data: any = d.data();
                    return {
                        id: d.id,
                        name: data.name || '',
                        description: data.description || '',
                        duration: Number(data.duration) || 0,
                        price: Number(data.price) || 0,
                        modality: data.modality || 'Online',
                        isActive: data.isActive ?? true,
                        paymentPolicy: data.paymentPolicy || undefined,
                    } as Service;
                });
                setServices(items);
            }, (err) => {
                console.error('onSnapshot services error', err);
                throw err;
            });

            return () => { unsubServices(); };
        });
    }, [user?.uid]);

    // Service handlers
    const openServiceModal = (service: Service | null) => {
        setEditingService(service);
        setServiceModalOpen(true);
    };
    const closeServiceModal = () => {
        setServiceModalOpen(false);
        setEditingService(null);
    };
    const handleSaveService = async (service: Service) => {
        if (!user) return;
        const colRef = collection(db, 'users', user.uid, 'services');
        try {
            if (editingService && editingService.id) {
                const ref = doc(db, 'users', user.uid, 'services', editingService.id);
                await updateDoc(ref, {
                    name: service.name,
                    description: service.description,
                    duration: service.duration,
                    price: service.price,
                    // preserve existing modality (modal form no longer provides modality)
                    modality: editingService?.modality || (service as any).modality || 'Online',
                    isActive: service.isActive,
                    paymentPolicy: service.paymentPolicy || '',
                    updatedAt: serverTimestamp(),
                } as any);
            } else {
                await addDoc(colRef, {
                    name: service.name,
                    description: service.description,
                    duration: service.duration,
                    price: service.price,
                    // default modality for new services when not specified in UI
                    modality: (service as any).modality || 'Online',
                    isActive: service.isActive ?? true,
                    paymentPolicy: service.paymentPolicy || '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                } as any);
            }
            closeServiceModal();
        } catch (e) {
            console.error('Falha ao salvar serviço', e);
            alert('Não foi possível salvar o serviço.');
        }
    };
    const handleDeleteService = async (serviceId: string) => {
        if (!user) return;
        if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'services', serviceId));
            } catch (e) {
                console.error('Falha ao excluir serviço', e);
                alert('Não foi possível excluir o serviço.');
            }
        }
    };
    
    // package features removed: only services are managed here now
    
    // Suggest package feature disabled
    const handleSuggestPackage = async () => {
        setIsSuggestingPackage(false);
        alert('Sugestão automática desativada temporariamente.');
    };


  return (
    <div className="space-y-6">
            <LoadingState 
                loading={servicesOperation.isLoading}
                loadingComponent={<LoadingSpinner text="Carregando serviços..." />}
        error={servicesOperation.error}
        errorComponent={
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-800 dark:text-red-400">Erro ao carregar serviços. Tente novamente.</p>
          </div>
        }
      >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Serviços</h1>
        <div className="flex items-center gap-2">
            {/* Sugestão com IA temporariamente removida para evitar congelamentos do navegador */}
                        <button onClick={() => openServiceModal(null)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2">
                            <Plus className="h-5 w-5" />
                            <span>Adicionar Serviço</span>
                        </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <TabButton 
                label="Serviços Individuais"
                icon={<Wrench className="h-5 w-5 mr-2"/>}
                isActive={activeTab === 'services'} 
                onClick={() => setActiveTab('services')}
            />
            {/* Packages removed */}
        </nav>
      </div>

      {/* Content */}
            {activeTab === 'services' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service, idx) => (
                                <ServiceCard key={service.id} index={idx} service={service} onEdit={() => openServiceModal(service)} onDelete={() => handleDeleteService(service.id)} />
                        ))}
                </div>
            )}

    {/* packages removed - only services shown */}

      </LoadingState>

    {isServiceModalOpen && <ServiceModal service={editingService} onSave={handleSaveService} onClose={closeServiceModal} />}
    </div>
  );
};

const TabButton: React.FC<{label: string, icon: React.ReactNode, isActive: boolean, onClick: () => void}> = ({label, icon, isActive, onClick}) => (
    <button
        onClick={onClick}
        className={`
            flex items-center whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition-colors
            ${isActive
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
            }
        `}
    >
       {icon} {label}
    </button>
);


// Service Card Component
const ServiceCard: React.FC<{ index?: number; service: Service; onEdit: () => void; onDelete: () => void; }> = ({ index = 0, service, onEdit, onDelete }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Small palette of accent colors (tailwind friendly)
    const accents = [
        { ring: 'ring-rose-300', border: 'border-rose-400', bg: 'bg-rose-50', text: 'text-rose-600' },
        { ring: 'ring-amber-300', border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-600' },
        { ring: 'ring-lime-300', border: 'border-lime-400', bg: 'bg-lime-50', text: 'text-lime-600' },
        { ring: 'ring-sky-300', border: 'border-sky-400', bg: 'bg-sky-50', text: 'text-sky-600' },
        { ring: 'ring-violet-300', border: 'border-violet-400', bg: 'bg-violet-50', text: 'text-violet-600' },
        { ring: 'ring-indigo-300', border: 'border-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    ];
    const accent = accents[index % accents.length];

    return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 flex flex-col justify-between hover:shadow-xl transition-all relative border-l-4 ${accent.border} ${accent.bg} dark:bg-gray-800`}>
            <div>
                 <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{service.name}</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 h-10 overflow-hidden">{service.description}</p>
                
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 py-3 my-3">
                    <p className="flex items-center"><Clock className="h-4 w-4 mr-2 text-gray-400"/> {service.duration} min</p>
                    <p className="flex items-center"><DollarSign className="h-4 w-4 mr-2 text-gray-400"/> R$ {service.price.toFixed(2)}</p>
                </div>
                
                 <div className="flex items-center justify-between text-sm mb-3">
                    <p className="text-gray-500 dark:text-gray-400">Status:</p>
                    <span className={`font-semibold ${service.isActive ? accent.text : 'text-red-500'}`}>
                        {service.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                {service.paymentPolicy && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="flex items-start text-sm text-gray-500 dark:text-gray-400">
                          <FileCheck2 className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"/>
                          <span><strong className="font-semibold text-gray-600 dark:text-gray-300">Política:</strong> {service.paymentPolicy}</span>
                      </p>
                  </div>
                )}
            </div>

            <div className="absolute top-2 right-2">
                 <button onClick={() => setIsMenuOpen(!isMenuOpen)} onBlur={() => setTimeout(() => setIsMenuOpen(false), 150)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <MoreVertical className="h-5 w-5"/>
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                        <button onClick={onEdit} className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                           <Edit className="h-4 w-4 mr-2"/> Editar
                        </button>
                        <button onClick={onDelete} className="flex items-center w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600">
                           <Trash className="h-4 w-4 mr-2"/> Excluir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Service Modal Component
const ServiceModal: React.FC<{ service: Service | null; onSave: (service: Service) => void; onClose: () => void;}> = ({ service, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: service?.name || '',
        description: service?.description || '',
        duration: service?.duration || 60,
        price: service?.price || 0,
        // modality removed from UI; keep it in DB when present
        isActive: service?.isActive !== undefined ? service.isActive : true,
        paymentPolicy: service?.paymentPolicy || '',
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
             const { checked } = e.target as HTMLInputElement;
             setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
             setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            id: service?.id || '',
            duration: Number(formData.duration) || 0,
            price: Number(formData.price) || 0,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
                        {service ? 'Editar Serviço' : 'Adicionar Novo Serviço'}
                    </h2>
                    
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Serviço</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duração (min)</label>
                            <input type="number" name="duration" id="duration" value={formData.duration} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço (R$)</label>
                            <input type="number" name="price" id="price" step="0.01" value={formData.price} onChange={handleChange} required className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                        </div>
                    </div>
                    {/* modality removed from the modal form */}
                    <div>
                        <label htmlFor="paymentPolicy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Política de Pagamento (Opcional)</label>
                        <input type="text" name="paymentPolicy" id="paymentPolicy" placeholder="Ex: 50% no agendamento" value={formData.paymentPolicy} onChange={handleChange} className="w-full p-2 rounded-md bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"/>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                         <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">Serviço Ativo</label>
                         <div className="relative inline-block w-10 mr-2 align-middle select-none">
                            <input type="checkbox" name="isActive" id="isActive" checked={formData.isActive} onChange={handleChange} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                            <label htmlFor="isActive" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Salvar</button>
                    </div>
                </form>
                 <style>{`.toggle-checkbox:checked{right:0;border-color:#4f46e5;transform:translateX(100%)}.toggle-checkbox{transition:all .2s ease-in-out;transform:translateX(0)}.toggle-checkbox:checked+.toggle-label{background-color:#4f46e5}`}</style>
            </div>
        </div>
    );
};


// Package UI removed

export default Services;