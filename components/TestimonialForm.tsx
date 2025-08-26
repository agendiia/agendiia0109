import React, { useEffect, useState } from 'react';
import { ProfessionalProfile } from '../types';
import { Star, CheckCircle } from './Icons';
import { db } from '../services/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const StarRating: React.FC<{ rating: number, setRating: (rating: number) => void }> = ({ rating, setRating }) => {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex justify-center space-x-2">
            {[...Array(5)].map((_, index) => {
                const ratingValue = index + 1;
                return (
                    <button
                        type="button"
                        key={ratingValue}
                        className={`transition-colors duration-200 ${ratingValue <= (hover || rating) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                        onClick={() => setRating(ratingValue)}
                        onMouseEnter={() => setHover(ratingValue)}
                        onMouseLeave={() => setHover(0)}
                        aria-label={`Avaliação ${ratingValue} de 5`}
                    >
                        <Star className="w-10 h-10" fill={ratingValue <= (hover || rating) ? 'currentColor' : 'none'} />
                    </button>
                );
            })}
        </div>
    );
};

const TestimonialForm: React.FC = () => {
    const [formData, setFormData] = useState({ name: '', text: '' });
    const [rating, setRating] = useState(0);
    const [consent, setConsent] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uid, setUid] = useState<string | null>(null);
    const [professional, setProfessional] = useState<Pick<ProfessionalProfile, 'name' | 'avatarUrl' | 'themeColor'>>({ name: 'Profissional', avatarUrl: '', themeColor: '#4f46e5' });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const id = parts.length >= 2 ? parts[1] : null; // /testimonial/{slugOrUid}
        if (!id) {
            setError('Link inválido. ID do profissional não encontrado.');
            setLoading(false);
            return;
        }

        const resolveAndLoad = async () => {
            try {
                // Try direct UID first
                let resolvedId = id;
                let snap = await getDoc(doc(db, 'users', id, 'profile', 'main'));
                if (!snap.exists()) {
                    const slug = await getDoc(doc(db, 'public_slugs', id));
                    if (slug.exists()) {
                        const data: any = slug.data();
                        resolvedId = data.userId;
                        snap = await getDoc(doc(db, 'users', resolvedId, 'profile', 'main'));
                    }
                }
                if (!snap.exists()) {
                    setError('Profissional não encontrado.');
                    return;
                }
                setUid(resolvedId);
                const data = snap.data() as any;
                setProfessional({
                    name: data.name || 'Profissional',
                    avatarUrl: data.avatarUrl || '',
                    themeColor: data.themeColor || '#4f46e5',
                });
            } catch (e) {
                console.error(e);
                setError('Não foi possível carregar o perfil do profissional.');
            } finally {
                setLoading(false);
            }
        };
        resolveAndLoad();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uid) return;
        if (rating === 0 || !consent) {
            alert('Por favor, selecione uma avaliação e concorde com os termos.');
            return;
        }
        try {
            await addDoc(collection(db, 'users', uid, 'testimonials'), {
                clientName: formData.name,
                text: formData.text,
                rating,
                status: 'pending',
                date: serverTimestamp(),
            });
            setIsSubmitted(true);
        } catch (err) {
            console.error(err);
            alert('Falha ao enviar o depoimento. Tente novamente mais tarde.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    if (loading) {
        return (
            <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4">
                <div className="text-gray-500">Carregando...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                    <p className="text-red-500">{error}</p>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4">
                 <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Depoimento Enviado!</h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        Obrigado por compartilhar sua experiência. Seu feedback é muito valioso.
                    </p>
                 </div>
            </div>
        )
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4">
            <style>{`:root { --theme-color: ${professional.themeColor}; }`}</style>
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <img
                        src={(professional.avatarUrl && (professional.avatarUrl.startsWith('http') || professional.avatarUrl.startsWith('data:'))) ? professional.avatarUrl : ('https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(professional.name))}
                        alt={professional.name}
                        className="w-24 h-24 rounded-full mx-auto mb-4 ring-4 ring-white dark:ring-gray-800 object-cover"
                    />
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Deixe um depoimento para {professional.name}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Sua opinião é muito importante!</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seu nome</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-[var(--theme-color)] focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-center text-gray-700 dark:text-gray-300 mb-2">Qual sua avaliação?</label>
                            <StarRating rating={rating} setRating={setRating} />
                        </div>
                        
                        <div>
                            <label htmlFor="text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seu depoimento</label>
                            <textarea
                                id="text"
                                name="text"
                                value={formData.text}
                                onChange={handleChange}
                                required
                                rows={5}
                                className="mt-1 w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-[var(--theme-color)] focus:outline-none resize-y"
                            />
                        </div>

                        <div>
                             <div className="flex items-start">
                                <input
                                    id="consent"
                                    name="consent"
                                    type="checkbox"
                                    checked={consent}
                                    onChange={(e) => setConsent(e.target.checked)}
                                    className="h-4 w-4 mt-1 rounded border-gray-300 text-[var(--theme-color)] focus:ring-[var(--theme-color)]"
                                />
                                <div className="ml-3 text-sm">
                                    <label htmlFor="consent" className="text-gray-600 dark:text-gray-300">
                                        Eu concordo que meu depoimento e nome sejam exibidos publicamente na página do profissional.
                                    </label>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!consent || rating === 0}
                            className="w-full bg-[var(--theme-color)] text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Enviar Depoimento
                        </button>
                    </form>
                </div>
                 <footer className="text-center p-4 mt-4 text-sm text-gray-500">
                    Powered by <a href="#" className="font-semibold text-[var(--theme-color)]">Agendiia</a>
                </footer>
            </div>
        </div>
    );
};

export default TestimonialForm;
