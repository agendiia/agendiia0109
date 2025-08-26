import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ProfessionalProfile, PaymentGateway, PaymentGatewayStatus, Testimonial, Credential, Address } from '../types';
import { generateBio } from '../services/geminiService';
import { 
    Sparkles, Loader, IdCard, User, Mail, Phone, DollarSign, Edit, 
    PixLogo, MercadoPagoLogo, Eye, Camera, Info, 
    Instagram, Linkedin, Facebook, LinkIcon, FileText, MapPin, 
    Award, Quote, Trash, Plus, Check, Archive, Star, Copy 
} from './Icons';
import type { IconProps } from './Icons';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/services/firebase';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FormInput } from './FormInput';

// Base URL for public pages (booking/testimonial). Override via VITE_PUBLIC_BASE_URL to force hosted domain.
const PUBLIC_BASE_URL: string = (import.meta as any).env?.VITE_PUBLIC_BASE_URL || 
    (import.meta.env.DEV ? 'http://localhost:5173' : 'https://timevee-53a3c.web.app');

const defaultGateways: PaymentGateway[] = [
    {
        id: 'pix',
        name: 'Pix',
        status: PaymentGatewayStatus.Inactive,
        description: 'Receba pagamentos instantâneos a qualquer hora.',
        // Inicia vazio, sem dados fictícios
        config: { keyType: '', key: '' }
    },
    {
        id: 'mercadopago',
        name: 'Mercado Pago',
        status: PaymentGatewayStatus.Inactive,
        description: 'Aceite cartões de crédito, débito e mais.',
        config: { publicKey: '', accessToken: '' }
    }
];

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState<boolean>(true);
    const [profile, setProfile] = useState<ProfessionalProfile>({
        name: '',
        email: '',
        phone: '',
        registration: '',
        specialty: '',
        bio: '',
        avatarUrl: '',
        bannerUrl: '',
        socialLinks: { instagram: '', linkedin: '', facebook: '', website: '' },
        themeColor: '#1c12d6ff',
        cancellationPolicy: '',
    address: { street: '', city: '', state: '', zip: '' } as any,
        credentials: [],
        testimonials: [],
    });
    const [gateways, setGateways] = useState<PaymentGateway[]>(defaultGateways);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Base64 fallback thresholds (to respect Firestore 1MB doc size limit with margin)
    const AVATAR_BASE64_MAX = 200 * 1024; // 200KB
    const BANNER_BASE64_MAX = 600 * 1024; // 600KB
    const USE_BASE64_UPLOADS = String((import.meta as any).env?.VITE_USE_BASE64_UPLOADS || '').toLowerCase() === 'true';
    const MAX_BASE64_BYTES = 1024 * 1024; // 1MB target for Base64 as solicitado

    const fileToDataURL = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const blobToDataURL = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const loadImageFromFile = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    }).then(img => { URL.revokeObjectURL(img.src); return img; });

    const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });

    // Compress image to fit within maxBytes, preferring WebP, with adaptive quality and scale.
    const compressImage = async (file: File, opts: { maxWidth: number; maxHeight: number; maxBytes: number; preferWebp?: boolean }): Promise<{ blob: Blob; dataUrl: string; mime: string }> => {
        const { maxWidth, maxHeight, maxBytes, preferWebp = true } = opts;
        const img = await loadImageFromFile(file);
        let targetType = preferWebp ? 'image/webp' : 'image/jpeg';
        let scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        let quality = 0.85;
        let attempt = 0;

        while (attempt < 12) {
            const canvas = document.createElement('canvas');
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas não suportado');
            ctx.drawImage(img, 0, 0, w, h);

            let blob = await canvasToBlob(canvas, targetType, quality);
            if (!blob || blob.size === 0) {
                // Fallback to JPEG se WebP falhar
                if (targetType !== 'image/jpeg') {
                    targetType = 'image/jpeg';
                    continue;
                }
                throw new Error('Falha ao comprimir imagem');
            }

            if (blob.size <= maxBytes) {
                const dataUrl = await blobToDataURL(blob);
                return { blob, dataUrl, mime: targetType };
            }

            // Ajuste qualidade até 0.5, depois reduza escala
            if (quality > 0.5) {
                quality = Math.max(0.5, quality - 0.1);
            } else {
                scale = scale * 0.85; // reduzir dimensões
                quality = Math.min(0.85, quality + 0.05); // recuperar um pouco de qualidade após reduzir dimensão
                if (scale < 0.25) {
                    break; // evitar degradar demais
                }
            }
            attempt++;
        }
        throw new Error('Não foi possível comprimir a imagem para o limite desejado.');
    };
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const profDoc = doc(db, 'users', user.uid, 'profile', 'main');
        const unsubProfile = onSnapshot(profDoc, (snap) => {
            const data = snap.data() as any;
            if (data) {
                setProfile((prev) => ({
                    ...prev,
                    name: data.name || '',
                        slug: data.slug || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    registration: data.registration || '',
                    specialty: data.specialty || '',
                    bio: data.bio || '',
                    avatarUrl: data.avatarUrl || '',
                    bannerUrl: data.bannerUrl || '',
                    socialLinks: data.socialLinks || { instagram: '', linkedin: '', facebook: '', website: '' },
                    themeColor: data.themeColor || '#4f46e5',
                    cancellationPolicy: data.cancellationPolicy || '',
                    // keep address but drop showMap from profile UI
                    address: data.address || { street: '', city: '', state: '', zip: '' },
                    credentials: data.credentials || [],
                }));
            }
            setLoading(false);
        });

        const unsubTestimonials = onSnapshot(query(collection(db, 'users', user.uid, 'testimonials'), orderBy('date', 'desc')), (snap) => {
            const items: Testimonial[] = snap.docs.map((d) => {
                const dt = d.data() as any;
                return {
                    id: d.id,
                    clientName: dt.clientName || 'Cliente',
                    text: dt.text || '',
                    date: dt.date?.toDate ? dt.date.toDate() : new Date(),
                    status: dt.status || 'pending',
                    rating: dt.rating || 0,
                } as Testimonial;
            });
            setProfile((prev) => ({ ...prev, testimonials: items }));
        });

        const unsubGateways = onSnapshot(collection(db, 'users', user.uid, 'gateways'), (snap) => {
            if (snap.empty) { setGateways(defaultGateways); return; }
            const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentGateway[];
            const withMeta = arr.map((gw) => {
                const meta = defaultGateways.find((m) => m.id === gw.id);
                return meta ? { ...meta, ...gw } : gw;
            });
            setGateways(withMeta);
        });

        return () => { unsubProfile(); unsubTestimonials(); unsubGateways(); };
    }, [user?.uid]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setProfile(prev => ({...prev, [e.target.name]: e.target.value}));
    };

    // Limit for public biography
    const BIO_MAX = 400;

    const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const v = e.target.value.slice(0, BIO_MAX);
        setProfile(prev => ({ ...prev, bio: v }));
    };
    
    const handleSocialLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({
            ...prev,
            socialLinks: {
                ...prev.socialLinks,
                [name]: value,
            }
        }));
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setProfile(prev => ({
            ...prev,
            address: {
                ...prev.address,
                [name]: value,
            }
        }));
    };

    const handleCredentialChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const updatedCredentials = [...(profile.credentials || [])];
        updatedCredentials[index] = { ...updatedCredentials[index], [name]: value };
        setProfile(prev => ({ ...prev, credentials: updatedCredentials }));
    };

    const addCredential = () => {
        const newCredential = { id: `cred-${Date.now()}`, title: '', institution: '', year: new Date().getFullYear() };
        setProfile(prev => ({ ...prev, credentials: [...(prev.credentials || []), newCredential] }));
    };

    const removeCredential = (id: string) => {
        setProfile(prev => ({ ...prev, credentials: prev.credentials?.filter(c => c.id !== id) }));
    };

    const handleTestimonialStatusChange = async (id: string, status: 'pending' | 'approved' | 'archived') => {
        if (!user) return;
        await updateDoc(doc(db, 'users', user.uid, 'testimonials', id), { status });
    };


    // Image validation utilities
    const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type.toLowerCase())) {
            return {
                isValid: false,
                error: 'Formato não suportado. Use apenas: JPEG, PNG, WebP ou GIF.'
            };
        }

        // Check file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 10MB.`
            };
        }

        // Check minimum size (prevent tiny/corrupted images)
        if (file.size < 1024) { // 1KB minimum
            return {
                isValid: false,
                error: 'Arquivo muito pequeno. Selecione uma imagem válida.'
            };
        }

        return { isValid: true };
    };

    const getOptimizedImageDimensions = (imageType: 'avatar' | 'banner') => {
        return imageType === 'avatar'
            ? { maxWidth: 512, maxHeight: 512, maxBytes: MAX_BASE64_BYTES, quality: 0.8 }
            : { maxWidth: 1600, maxHeight: 600, maxBytes: MAX_BASE64_BYTES, quality: 0.85 };
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageType: 'avatar' | 'banner') => {
        if (!user || !e.target.files || e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        
        // Pre-upload validation
        const validation = validateImageFile(file);
        if (!validation.isValid) {
            alert(validation.error);
            // Reset input
            e.target.value = '';
            return;
        }
        
        // Set loading state
        if (imageType === 'avatar') {
            setIsUploadingAvatar(true);
        } else {
            setIsUploadingBanner(true);
        }
        
        // If configured, store as Base64 directly (skip Firebase Storage)
        if (USE_BASE64_UPLOADS) {
            try {
                // Get optimized dimensions for image type
                const opts = getOptimizedImageDimensions(imageType);
                let dataUrl: string;
                
                try {
                    const { dataUrl: compressedUrl } = await compressImage(file, opts);
                    dataUrl = compressedUrl;
                    console.log(`Image compressed: ${file.size} -> ${dataUrl.length} bytes`);
                } catch (compressionError) {
                    console.warn('Image compression failed:', compressionError);
                    // Fallback: only if file is already small enough
                    if (file.size <= MAX_BASE64_BYTES) {
                        dataUrl = await fileToDataURL(file);
                        console.log('Using uncompressed image as fallback');
                    } else {
                        alert(`Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). A compressão falhou. Tente um arquivo menor.`);
                        return;
                    }
                }
                
                // Validate final data URL size
                if (dataUrl.length > MAX_BASE64_BYTES * 1.5) { // Allow some overhead for base64 encoding
                    alert('Imagem ainda muito grande após compressão. Tente um arquivo menor.');
                    return;
                }
                
                setProfile(prev => ({ ...prev, [`${imageType}Url`]: dataUrl }));
                await updateDoc(doc(db, 'users', user.uid, 'profile', 'main'), {
                    [`${imageType}Url`]: dataUrl,
                    updatedAt: serverTimestamp(),
                });
                
                const sizeReduction = ((file.size - dataUrl.length) / file.size * 100).toFixed(1);
                alert(`${imageType === 'avatar' ? 'Foto de perfil' : 'Banner'} salvo com sucesso! Redução: ${sizeReduction}%.`);
            } catch (base64Error) {
                console.error('Base64 upload failed:', base64Error);
                alert('Falha ao processar imagem. Verifique o formato e tente novamente.');
            } finally {
                if (imageType === 'avatar') setIsUploadingAvatar(false); else setIsUploadingBanner(false);
                // Reset input for next upload
                e.target.value = '';
            }
            return;
        }

        // Firebase Storage upload path
        try {
            console.log(`Uploading ${imageType} image:`, file.name, 'Size:', file.size);
            
            // Create unique filename with timestamp
            const timestamp = new Date().getTime();
            const fileExtension = file.name.split('.').pop();
            const fileName = `${imageType}_${timestamp}.${fileExtension}`;
            const path = `users/${user.uid}/profile/${imageType}/${fileName}`;
            
            console.log('Storage path:', path);
            
            const sRef = storageRef(storage, path);
            
            // Upload file
            const snapshot = await uploadBytes(sRef, file);
            console.log('Upload completed:', snapshot);
            
            // Get download URL
            const url = await getDownloadURL(sRef);
            console.log('Download URL obtained:', url);
            
            // Update local state
            setProfile(prev => ({ ...prev, [`${imageType}Url`]: url }));
            
            // Update Firestore
            await updateDoc(doc(db, 'users', user.uid, 'profile', 'main'), { 
                [`${imageType}Url`]: url,
                updatedAt: serverTimestamp()
            });
            
            console.log('Firestore updated successfully');
            alert(`${imageType === 'avatar' ? 'Foto de perfil' : 'Banner'} carregado com sucesso!`);

        } catch (outerErr) {
            console.error(`Error uploading ${imageType}:`, outerErr);
            // Try Base64 fallback while CORS is being configured
            try {
                // Compress to fit within ~1MB for fallback
                const opts = imageType === 'avatar'
                    ? { maxWidth: 512, maxHeight: 512, maxBytes: MAX_BASE64_BYTES }
                    : { maxWidth: 1600, maxHeight: 600, maxBytes: MAX_BASE64_BYTES };
                let dataUrl: string;
                try {
                    const { dataUrl: compressedUrl } = await compressImage(file, opts);
                    dataUrl = compressedUrl;
                } catch {
                    if (file.size <= MAX_BASE64_BYTES) {
                        dataUrl = await fileToDataURL(file);
                    } else {
                        alert('Imagem excede 1MB e a compressão falhou. Configure o CORS do Storage ou tente um arquivo menor.');
                        return;
                    }
                }
                setProfile(prev => ({ ...prev, [`${imageType}Url`]: dataUrl }));
                await updateDoc(doc(db, 'users', user.uid, 'profile', 'main'), { 
                    [`${imageType}Url`]: dataUrl,
                    updatedAt: serverTimestamp()
                });
                alert(`${imageType === 'avatar' ? 'Foto de perfil' : 'Banner'} salvo temporariamente como Base64 (com compressão). Recomendado configurar CORS do Storage para upload definitivo.`);
            } catch (fallbackErr) {
                console.error('Base64 fallback also failed:', fallbackErr);
                // Mensagens específicas com base no erro original (quando possível)
                if (outerErr instanceof Error) {
                    if (outerErr.message.includes('storage/unauthorized')) {
                        alert('Erro de autorização. Verifique se você está logado.');
                    } else if (outerErr.message.includes('storage/unknown')) {
                        alert('Erro no Storage (possível CORS). Não foi possível usar o fallback Base64.');
                    } else {
                        alert(`Falha no upload e também no fallback Base64: ${outerErr.message}`);
                    }
                } else {
                    alert('Falha no upload e também no fallback Base64. Verifique o CORS do Storage.');
                }
            }
        } finally {
            // Reset loading state
            if (imageType === 'avatar') {
                setIsUploadingAvatar(false);
            } else {
                setIsUploadingBanner(false);
            }
        }
    };

    const handleGenerateBio = async () => {
        setIsGeneratingBio(true);
        try {
            const { name, specialty, credentials } = profile;
            const credentialText = credentials?.map(c => `${c.title} em ${c.institution}`).join(', ');
            const result = await generateBio({ name, specialty, skills: credentialText, targetAudience: '' });
            // Ensure generated bio respects the max length
            setProfile(prev => ({ ...prev, bio: result ? result.slice(0, BIO_MAX) : '' }));
        } catch (error) {
            console.error("Error generating bio:", error);
            alert("Falha ao gerar a biografia com IA.");
        } finally {
            setIsGeneratingBio(false);
        }
    };

    const handleToggleGatewayStatus = (gatewayId: string, isActive: boolean) => {
        setGateways(gateways.map(gw => 
            gw.id === gatewayId 
            ? { ...gw, status: isActive ? PaymentGatewayStatus.Active : PaymentGatewayStatus.Inactive }
            : gw
        ));
    };

    const handleGatewayConfigChange = (gatewayId: string, field: string, value: string) => {
        setGateways(prevGateways => prevGateways.map(gw => {
            if (gw.id === gatewayId) {
                return {
                    ...gw,
                    config: {
                        ...gw.config,
                        [field]: value
                    }
                };
            }
            return gw;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            const { testimonials, ...profileToSave } = profile;
            
            // Save main profile
            await setDoc(doc(db, 'users', user.uid, 'profile', 'main'), { ...profileToSave, updatedAt: serverTimestamp() } as any, { merge: true });
            
            // Handle slug mapping
            const newSlug = (profile as any).slug?.trim();
            if (newSlug) {
                // Check if slug is already taken by another user
                const slugDoc = await getDoc(doc(db, 'public_slugs', newSlug));
                if (slugDoc.exists() && slugDoc.data().userId !== user.uid) {
                    alert(`O slug "${newSlug}" já está sendo usado por outro profissional. Escolha um slug diferente.`);
                    return;
                }
                
                // Save slug mapping
                await setDoc(doc(db, 'public_slugs', newSlug), {
                    userId: user.uid,
                    updatedAt: serverTimestamp()
                });
            }
            
            await Promise.all(
                gateways.map((gw) => setDoc(doc(db, 'users', user.uid, 'gateways', gw.id), { ...gw, updatedAt: serverTimestamp() } as any, { merge: true }))
            );
            alert('Perfil e gateways salvos com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar perfil', err);
            alert('Falha ao salvar perfil.');
        }
    };
    
    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Perfil Profissional</h1>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border-l-4 border-indigo-500">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">Sua Página Pública de Agendamento está Ativa!</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Visualize e compartilhe seu link com clientes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a 
                            href={`${PUBLIC_BASE_URL}/booking/${(profile as any).slug ? (profile as any).slug : (user?.uid ?? '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 transition-colors"
                            title="Abrir página pública"
                        >
                            <Eye className="h-6 w-6" />
                        </a>
                        <button
                            type="button"
                            onClick={(e) => {
                                const link = `${PUBLIC_BASE_URL}/booking/${(profile as any).slug ? (profile as any).slug : (user?.uid ?? '')}`;
                                navigator.clipboard.writeText(link);
                                const btn = (e?.target as HTMLButtonElement) || null;
                                if (btn) {
                                    const original = btn.innerText;
                                    btn.innerText = 'Copiado!';
                                    setTimeout(() => { btn.innerText = original; }, 2000);
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-md border border-indigo-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            title="Copiar link de agendamento"
                        >
                            <Copy className="h-4 w-4" />
                            Copiar Link
                        </button>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <Card.Header
                        title="Imagem do Banner"
                        description="Esta imagem aparecerá no topo da sua página de agendamento. Recomendado: 1200x300px."
                    />
                    <Card.Content>
                        <div className="col-span-full">
                            <div
                                className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 dark:border-gray-100/25 px-6 py-10 bg-gray-50 dark:bg-gray-900/50"
                                style={{
                                    backgroundImage: `url(${profile.bannerUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            >
                                <div className="text-center" style={{ textShadow: '0 0 8px rgba(0,0,0,0.7)' }}>
                                    {isUploadingBanner ? (
                                        <Loader className="mx-auto h-12 w-12 text-indigo-600 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Camera className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                                    )}
                                    <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                        <label
                                            htmlFor="banner-upload"
                                            className={`relative cursor-pointer rounded-md bg-white/80 dark:bg-black/80 px-2 font-semibold text-indigo-600 dark:text-indigo-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500 ${isUploadingBanner ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <span>{isUploadingBanner ? 'Carregando...' : 'Carregar um arquivo'}</span>
                                            <input 
                                                ref={bannerInputRef} 
                                                id="banner-upload" 
                                                name="banner-upload" 
                                                type="file" 
                                                className="sr-only" 
                                                onChange={(e) => handleImageUpload(e, 'banner')} 
                                                accept="image/*" 
                                                disabled={isUploadingBanner}
                                            />
                                        </label>
                                        {!isUploadingBanner && <p className="pl-1">ou arraste e solte</p>}
                                    </div>
                                    {!isUploadingBanner && <p className="text-xs leading-5 text-gray-400">PNG, JPG ou WebP até 1MB (compressão automática aplicada)</p>}
                                </div>
                            </div>
                        </div>
                    </Card.Content>
                </Card>

                <Card>
                    <Card.Header
                        title="Informações de Contato"
                        description="Dados básicos que podem ser exibidos em sua página pública."
                    />
                    <Card.Content>
                        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            <div className="col-span-full">
                                <label htmlFor="photo" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                                    Foto de Perfil
                                </label>
                                <div className="mt-2 flex items-center gap-x-3">
                                    <img src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${profile.name}&background=random`} className="h-24 w-24 rounded-full object-cover" alt="Avatar" />
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={isUploadingAvatar}
                                        className="rounded-md bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isUploadingAvatar ? (
                                            <>
                                                <Loader className="h-4 w-4 animate-spin" />
                                                Carregando...
                                            </>
                                        ) : (
                                            'Alterar'
                                        )}
                                    </button>
                                    <input ref={avatarInputRef} type="file" className="sr-only" onChange={(e) => handleImageUpload(e, 'avatar')} accept="image/*" disabled={isUploadingAvatar} />
                                    {!isUploadingAvatar && <p className="text-xs leading-5 text-gray-400 ml-2">PNG, JPG ou WebP até 1MB (compressão automática aplicada)</p>}
                                </div>
                            </div>

                            <div className="sm:col-span-3">
                                <FormInput label="Nome Completo" name="name" value={profile.name} onChange={handleChange} Icon={User} placeholder="Seu nome" />
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="E-mail de Contato" name="email" type="email" value={profile.email} onChange={handleChange} Icon={Mail} placeholder="seu@email.com" />
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="Slug público (URL)" name="slug" value={(profile as any).slug || ''} onChange={(e) => setProfile(prev => ({ ...prev, slug: e.target.value }))} Icon={LinkIcon} placeholder="seu-nome-ou-clinica" />
                                <p className="text-xs text-gray-500 mt-1">O slug será usado na URL pública: <code className="bg-gray-100 px-1 rounded">/booking/&lt;slug&gt;</code>. Pode ser alterado a qualquer momento.</p>
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="Telefone / WhatsApp" name="phone" value={profile.phone} onChange={handleChange} Icon={Phone} placeholder="(11) 98765-4321" />
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="Registro Profissional" name="registration" value={profile.registration} onChange={handleChange} Icon={IdCard} placeholder="CRP 06/123456" />
                            </div>
                        </div>
                    </Card.Content>
                </Card>

                <Card>
                    <Card.Header
                        title="Detalhes Profissionais"
                        description="Informações que ajudam os clientes a conhecerem seu trabalho."
                    />
                    <Card.Content>
                        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            <div className="sm:col-span-full">
                                <FormInput label="Especialidade Principal" name="specialty" value={profile.specialty} onChange={handleChange} Icon={Sparkles} placeholder="Psicologia Clínica" />
                            </div>
                            <div className="col-span-full">
                                <label htmlFor="bio" className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
                                    Biografia (Perfil Público)
                                </label>
                                <div className="mt-2">
                                    <textarea
                                        id="bio"
                                        name="bio"
                                        rows={6}
                                        maxLength={BIO_MAX}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-gray-900/50"
                                        value={profile.bio}
                                        onChange={handleBioChange}
                                    />
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">{profile.bio.length}/{BIO_MAX} caracteres</div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleGenerateBio}
                                        disabled={isGeneratingBio}
                                        className="flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900"
                                    >
                                        {isGeneratingBio ? (
                                            <>
                                                <Loader className="h-4 w-4 animate-spin" />
                                                Gerando...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4" />
                                                Sugerir com IA
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card.Content>
                </Card>

                <Card>
                    <Card.Header
                        title="Presença Online e Marca"
                        description="Personalize sua página e conecte suas redes sociais."
                    />
                    <Card.Content>
                        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            <div className="sm:col-span-3">
                                <FormInput label="Instagram" name="instagram" value={profile.socialLinks?.instagram} onChange={handleSocialLinkChange} Icon={Instagram} placeholder="https://instagram.com/seu_usuario" />
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="LinkedIn" name="linkedin" value={profile.socialLinks?.linkedin} onChange={handleSocialLinkChange} Icon={Linkedin} placeholder="https://linkedin.com/in/seu_usuario" />
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="Facebook" name="facebook" value={profile.socialLinks?.facebook} onChange={handleSocialLinkChange} Icon={Facebook} placeholder="https://facebook.com/sua_pagina" />
                            </div>
                            <div className="sm:col-span-3">
                                <FormInput label="Website ou Outro Link" name="website" value={profile.socialLinks?.website} onChange={handleSocialLinkChange} Icon={LinkIcon} placeholder="https://seuwebsite.com" />
                            </div>
                        </div>
                    </Card.Content>
                </Card>

                <div className="space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Credibilidade e Confiança</h2>
                        <p className="text-md text-gray-500 dark:text-gray-400 mt-1">Adicione informações que aumentam a confiança dos seus clientes.</p>
                    </div>

                    <Card>
                        <Card.Header title="Endereço Físico" description="Seu endereço de atendimento presencial." />
                        <Card.Content>
                            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                                <div className="sm:col-span-4">
                                    <FormInput label="Rua e Número" name="street" value={profile.address?.street} onChange={handleAddressChange} Icon={MapPin} placeholder="Av. Paulista, 1000" />
                                </div>
                                <div className="sm:col-span-2">
                                    <FormInput label="CEP" name="zip" value={profile.address?.zip} onChange={handleAddressChange} placeholder="01310-100" />
                                </div>
                                <div className="sm:col-span-3">
                                    <FormInput label="Cidade" name="city" value={profile.address?.city} onChange={handleAddressChange} placeholder="São Paulo" />
                                </div>
                                <div className="sm:col-span-3">
                                    <FormInput label="Estado" name="state" value={profile.address?.state} onChange={handleAddressChange} placeholder="SP" />
                                </div>
                                {/* Map display option removed: maps are no longer embedded on the public page */}
                            </div>
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header title="Credenciais e Certificações" description="Liste suas formações e especializações." />
                        <Card.Content>
                            <div className="space-y-4">
                                {profile.credentials?.map((cred, index) => (
                                    <div key={cred.id} className="grid grid-cols-1 sm:grid-cols-8 gap-4 items-end p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                                        <div className="sm:col-span-4">
                                            <FormInput label="Título" name="title" value={cred.title} onChange={(e) => handleCredentialChange(index, e)} placeholder="Ex: Pós-graduação em TCC" />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <FormInput label="Instituição" name="institution" value={cred.institution} onChange={(e) => handleCredentialChange(index, e)} placeholder="Ex: USP" />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <FormInput label="Ano" name="year" type="number" value={cred.year} onChange={(e) => handleCredentialChange(index, e)} placeholder="2022" />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <button type="button" onClick={() => removeCredential(cred.id)} className="w-full flex justify-center items-center p-2.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900 rounded-md text-red-600 dark:text-red-300">
                                                <Trash className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={addCredential} className="flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900">
                                    <Plus className="h-4 w-4" />
                                    Adicionar Credencial
                                </button>
                            </div>
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header title="Depoimentos de Clientes" description="Gerencie os depoimentos que aparecem na sua página." />
                        <Card.Content>
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-md">
                                    <div className="text-sm text-indigo-800 dark:text-indigo-200">
                                        Link público para coletar depoimentos
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={`${PUBLIC_BASE_URL}/testimonial/${(profile as any).slug ? (profile as any).slug : (user?.uid ?? '')}`}
                                            className="w-full sm:w-[28rem] p-2 rounded-md bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-sm"
                                        />
                                        <button
                                            type="button"
                                            className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                                            onClick={() => navigator.clipboard.writeText(`${PUBLIC_BASE_URL}/testimonial/${(profile as any).slug ? (profile as any).slug : (user?.uid ?? '')}`)}
                                        >
                                            Copiar
                                        </button>
                                        <a
                                            className="px-3 py-2 rounded-md bg-white dark:bg-gray-700 border border-indigo-200 dark:border-indigo-800 text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-600"
                                            href={`${PUBLIC_BASE_URL}/testimonial/${(profile as any).slug ? (profile as any).slug : (user?.uid ?? '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Abrir
                                        </a>
                                    </div>
                                </div>

                                {profile.testimonials?.length > 0 ? profile.testimonials.map(t => (
                                    <div key={t.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-white">{t.clientName}</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 italic mt-1">"{t.text}"</p>
                                                <div className="flex items-center mt-1">
                                                    {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < (t.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`} />)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                <button type="button" onClick={() => handleTestimonialStatusChange(t.id, 'approved')} className={`p-2 rounded-full ${t.status === 'approved' ? 'bg-green-100 text-green-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="Aprovar"><Check className="h-5 w-5" /></button>
                                                <button type="button" onClick={() => handleTestimonialStatusChange(t.id, 'archived')} className={`p-2 rounded-full ${t.status === 'archived' ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="Arquivar"><Archive className="h-5 w-5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhum depoimento recebido ainda.</p>
                                )}
                            </div>
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header title="Política de Cancelamento" description="Defina as regras para cancelamento de agendamentos." />
                        <Card.Content>
                            <textarea
                                name="cancellationPolicy"
                                rows={5}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-gray-900/50"
                                value={profile.cancellationPolicy}
                                onChange={handleChange}
                                placeholder="Ex: Cancelamentos devem ser feitos com no mínimo 24 horas de antecedência..."
                            />
                        </Card.Content>
                    </Card>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-md space-y-8">
                    {/* Section: Payment Gateways */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-8">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Gateways de Pagamento</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Conecte suas contas para receber pagamentos online através da sua página de agendamento.</p>
                        <div className="mt-6 space-y-6">
                            {gateways.map(gateway => (
                                <PaymentGatewayCard 
                                    key={gateway.id} 
                                    gateway={gateway} 
                                    onToggleStatus={handleToggleGatewayStatus}
                                    onConfigChange={handleGatewayConfigChange}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button type="submit" className="bg-indigo-600 text-white font-semibold py-2.5 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

const Card: React.FC<{ children: React.ReactNode }> & {
    Header: React.FC<{ title: string; description: string }>;
    Content: React.FC<{ children: React.ReactNode }>;
} = ({ children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">{children}</div>
);

Card.Header = ({ title, description }) => {
    // Small palette per admin section to give visual separation
    const colorMap: Record<string, string> = {
        'Imagem do Banner': '#7c3aed',
        'Informações de Contato': '#059669',
        'Detalhes Profissionais': '#2563eb',
        'Presença Online e Marca': '#0ea5a4',
        'Endereço Físico': '#f97316',
        'Credenciais e Certificações': '#059669',
        'Depoimentos de Clientes': '#d97706',
        'Política de Cancelamento': '#ef4444',
        'Gateways de Pagamento': '#06b6d4',
    };

    const accent = colorMap[title] || '#4f46e5';
    const isHex = /^#([0-9A-F]{3}){1,2}$/i.test(accent);
    const bg = isHex ? `${accent}18` : 'transparent';

    return (
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700" style={{ borderLeft: `4px solid ${accent}`, background: bg }}>
            <h2 className="text-lg font-semibold" style={{ color: accent }}>{title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        </div>
    );
};

Card.Content = ({ children }) => (
    <div className="p-6">{children}</div>
);

// Helper Components

const GatewayIcon: React.FC<{ gatewayId: string }> = ({ gatewayId }) => {
    const wrapperClass = "h-12 w-12 rounded-full flex items-center justify-center";
    const iconClass = "h-6 w-6";

    switch(gatewayId) {
        case 'pix':
            return (
                <div className={`${wrapperClass} bg-green-100 dark:bg-green-900/50`}>
                     <PixLogo className={`${iconClass} text-green-600 dark:text-green-300 w-6 h-6`} />
                </div>
            );
        case 'mercadopago':
             return (
                <div className={`${wrapperClass} bg-blue-100 dark:bg-blue-900/50`}>
                     <MercadoPagoLogo className={`${iconClass} text-blue-600 dark:text-blue-300`} />
                </div>
            );
        default:
             return (
                <div className={`${wrapperClass} bg-gray-100 dark:bg-gray-700`}>
                    <DollarSign className={`${iconClass} text-gray-500`} />
                </div>
            );
    }
};

const Instruction: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-start p-3 rounded-md bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/60">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mr-3 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">{text}</p>
    </div>
);

const PaymentGatewayCard: React.FC<{ 
    gateway: PaymentGateway, 
    onToggleStatus: (id: string, isActive: boolean) => void,
    onConfigChange: (id: string, field: string, value: string) => void
}> = ({ gateway, onToggleStatus, onConfigChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isActive = gateway.status === PaymentGatewayStatus.Active;

    const renderFields = () => {
        switch(gateway.id) {
            case 'pix':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         <div className="sm:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Chave</label>
                            <select value={gateway.config?.keyType || ''} onChange={(e) => onConfigChange(gateway.id, 'keyType', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                                <option>CPF/CNPJ</option>
                                <option>Email</option>
                                <option>Celular</option>
                                <option>Aleatória</option>
                            </select>
                         </div>
                         <div className="sm:col-span-2">
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave Pix</label>
                             <input type="text" value={gateway.config?.key || ''} onChange={(e) => onConfigChange(gateway.id, 'key', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" />
                         </div>
                    </div>
                );
            case 'mercadopago':
                return (
                     <div className="space-y-4">
                        <Instruction text="Acesse o painel do provedor de pagamentos (ex.: Mercado Pago) e copie as credenciais (Public Key / Access Token) para configurar recepção por cartão de crédito." />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Key</label>
                            <input type="text" value={gateway.config?.publicKey || ''} onChange={(e) => onConfigChange(gateway.id, 'publicKey', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Token</label>
                            <input type="password" value={gateway.config?.accessToken || ''} onChange={(e) => onConfigChange(gateway.id, 'accessToken', e.target.value)} className="w-full p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" />
                        </div>
                    </div>
                );
            default: return null;
        }
    }
    
    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-5 border border-gray-200 dark:border-gray-700/50 transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <GatewayIcon gatewayId={gateway.id} />
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{gateway.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{gateway.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400" aria-label="Configurar">
                        <Edit className="h-5 w-5" />
                     </button>
                    <div className="relative inline-block w-10 align-middle select-none">
                        <input type="checkbox" checked={isActive} onChange={(e) => onToggleStatus(gateway.id, e.target.checked)} id={`toggle-${gateway.id}`} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                        <label htmlFor={`toggle-${gateway.id}`} className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
                    </div>
                </div>
            </div>
             {isExpanded && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {renderFields()}
                </div>
            )}
            <style>{`.toggle-checkbox:checked{right:0;border-color:#4f46e5;transform:translateX(100%)}.toggle-checkbox{transition:all .2s ease-in-out;transform:translateX(0)}.toggle-checkbox:checked+.toggle-label{background-color:#4f46e5}`}</style>
        </div>
    );
};

export { Profile };
export default Profile;