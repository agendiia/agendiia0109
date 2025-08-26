import React, { useEffect, useMemo, useState } from 'react';
import { SupportTicket, TicketCategory, TicketStatus, TaskPriority, TicketResponse, KnowledgeBaseArticle, ArticleCategory, FAQItem } from '../types';
import { Plus, LifeBuoy, X, Flag, Send, Paperclip, Search, BookOpen, HelpCircle, ChevronRight, Wrench, DollarSign, Megaphone, Calendar as CalendarIcon, ArrowLeft } from './Icons';
import { db } from '@/services/firebase';
import { collection, doc, onSnapshot, orderBy, query, addDoc, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

// --- CATEGORY ICONS/META (static UI helpers) ---

const categoryIcons: { [key: string]: React.ReactNode } = {
    'Primeiros Passos': <BookOpen className="h-8 w-8 text-indigo-500" />,
    'Agendamentos': <CalendarIcon className="h-8 w-8 text-blue-500" />,
    'Financeiro': <DollarSign className="h-8 w-8 text-green-500" />,
    'Marketing': <Megaphone className="h-8 w-8 text-pink-500" />,
};

const CATEGORY_DESCRIPTIONS: Record<'Primeiros Passos' | 'Agendamentos' | 'Financeiro' | 'Marketing', string> = {
    'Primeiros Passos': 'Configure sua conta e comece a usar a plataforma.',
    'Agendamentos': 'Tudo sobre gestão de horários, clientes e serviços.',
    'Financeiro': 'Controle suas receitas, despesas e pagamentos.',
    'Marketing': 'Use as ferramentas de IA para promover seu negócio.',
};

// Utility: convert Firestore Timestamp/Date-like to Date
const toDate = (v: any): Date => {
    if (!v) return new Date();
    // Firestore Timestamp
    if (typeof v?.toDate === 'function') return v.toDate();
    // ISO string or millis
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
};

// --- KNOWLEDGE BASE COMPONENTS ---
const FAQItemComponent: React.FC<{ faq: FAQItem; isOpen: boolean; onToggle: () => void; }> = ({ faq, isOpen, onToggle }) => (
    <div className="border-b border-gray-200 dark:border-gray-700">
        <button onClick={onToggle} className="w-full flex justify-between items-center p-4 text-left">
            <span className="font-semibold text-gray-800 dark:text-white">{faq.question}</span>
            <ChevronRight className={`h-5 w-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen && (
            <div className="p-4 pt-0">
                <p className="text-gray-600 dark:text-gray-300">{faq.answer}</p>
            </div>
        )}
    </div>
);

const ArticleView: React.FC<{ article: KnowledgeBaseArticle; onBack: () => void }> = ({ article, onBack }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md animate-fade-in">
        <button onClick={onBack} className="flex items-center text-sm text-indigo-600 dark:text-indigo-400 font-semibold mb-6">
            <ArrowLeft className="h-4 w-4 mr-1"/> Voltar para a Central de Ajuda
        </button>
        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">{article.category}</span>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">{article.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Última atualização: {article.lastUpdated.toLocaleDateString('pt-BR')}</p>
        <div className="prose dark:prose-invert max-w-none mt-8 text-gray-700 dark:text-gray-300">
            <p>{article.content}</p>
        </div>
    </div>
);


const KnowledgeBaseView: React.FC<{ onArticleSelect: (article: KnowledgeBaseArticle) => void; articles: KnowledgeBaseArticle[]; faqs: FAQItem[]; loading?: boolean; }> = ({ onArticleSelect, articles, faqs, loading }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [openFAQ, setOpenFAQ] = useState<string | null>(null);

    const categories: ArticleCategory[] = useMemo(() => {
        const ALL = ['Primeiros Passos','Agendamentos','Financeiro','Marketing'] as const;
        return ALL
            .filter(cat => articles.some(a => a.category === cat))
            .map((cat, idx) => ({
                id: `cat_${idx}`,
                name: cat,
                description: CATEGORY_DESCRIPTIONS[cat],
                icon: categoryIcons[cat],
            }));
    }, [articles]);

    const filteredContent = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) {
            return { articles, faqs, categories };
        }
        const filteredArticles = articles.filter(
            art => art.title.toLowerCase().includes(query) || art.content.toLowerCase().includes(query)
        );
        const filteredFaqs = faqs.filter(
            faq => faq.question.toLowerCase().includes(query) || faq.answer.toLowerCase().includes(query)
        );
        return { articles: filteredArticles, faqs: filteredFaqs, categories: [] }; // Hide categories on search
    }, [searchQuery, articles, faqs, categories]);
    
    return (
        <div className="space-y-10">
            {/* Search */}
            <div className="relative">
                <Search className="h-6 w-6 absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Olá! Como podemos ajudar?"
                    className="w-full pl-14 pr-4 py-4 text-lg rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-gray-500 dark:text-gray-400">Carregando conteúdo…</div>
            ) : (
                <>
                    {searchQuery.trim() === '' ? (
                        <>
                            {/* Categories */}
                            <section>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Categorias</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                    {filteredContent.categories.map(cat => (
                                        <div key={cat.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-lg hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer">
                                            <div className="flex items-start gap-4">
                                                {cat.icon}
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cat.name}</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{cat.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Popular Articles */}
                            <section>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Artigos Populares</h2>
                                <div className="space-y-3">
                                    {filteredContent.articles.slice(0, 3).map(art => (
                                        <div key={art.id} onClick={() => onArticleSelect(art)} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div>
                                                <h3 className="font-semibold text-gray-800 dark:text-white">{art.title}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{art.summary}</p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-400" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* FAQ */}
                            <section>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                                    <HelpCircle className="h-7 w-7 mr-3 text-indigo-500" />
                                    Perguntas Frequentes
                                </h2>
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                    {filteredContent.faqs.map(faq => (
                                        <FAQItemComponent key={faq.id} faq={faq} isOpen={openFAQ === faq.id} onToggle={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)} />
                                    ))}
                                </div>
                            </section>
                        </>
                    ) : (
                        <section className="animate-fade-in">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Resultados da Busca por "{searchQuery}"</h2>
                            {filteredContent.articles.length === 0 && filteredContent.faqs.length === 0 ? (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-10">Nenhum resultado encontrado.</p>
                            ) : (
                                <div className="space-y-6">
                                    {filteredContent.articles.length > 0 && (
                                        <div className="space-y-3">
                                            {filteredContent.articles.map(art => (
                                                <div key={art.id} onClick={() => onArticleSelect(art)} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                    <div>
                                                        <h3 className="font-semibold text-indigo-600 dark:text-indigo-400">{art.title}</h3>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">{art.summary}</p>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 text-gray-400" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {filteredContent.faqs.length > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                            {filteredContent.faqs.map(faq => (
                                                <FAQItemComponent key={faq.id} faq={faq} isOpen={true} onToggle={() => {}} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

// --- TICKETS (Firestore-backed, minimal UI) ---
const NewTicketModal: React.FC<{ onClose: () => void; onCreate: (data: { subject: string; category: TicketCategory; priority: TaskPriority; description: string; }) => Promise<void>; creating: boolean; }> = ({ onClose, onCreate, creating }) => {
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<TicketCategory>(TicketCategory.Duvida);
    const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Medium);
    const [description, setDescription] = useState('');
    const canSave = subject.trim() && description.trim();
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Abrir Novo Ticket</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                <div className="space-y-3">
                    <input className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" placeholder="Assunto" value={subject} onChange={e => setSubject(e.target.value)} />
                    <div className="flex gap-3">
                        <select className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" value={category} onChange={e => setCategory(e.target.value as TicketCategory)}>
                            {Object.values(TicketCategory).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <select className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                            {Object.values(TaskPriority).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <textarea className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 h-28" placeholder="Descreva seu problema ou dúvida" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancelar</button>
                    <button disabled={!canSave || creating} onClick={() => onCreate({ subject, category, priority, description })} className={`px-4 py-2 rounded-md bg-indigo-600 text-white ${(!canSave||creating)?'opacity-60 cursor-not-allowed':''}`}>{creating ? 'Enviando…' : 'Enviar'}</button>
                </div>
            </div>
        </div>
    );
};

const TicketsView: React.FC = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOpen, setNewOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!user) { setTickets([]); setLoading(false); return; }
        const ref = collection(db, 'users', user.uid, 'tickets');
        const q = query(ref, orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const list: SupportTicket[] = snap.docs.map(d => {
                const data: any = d.data();
                return {
                    id: d.id,
                    subject: data.subject ?? '',
                    category: (data.category as TicketCategory) ?? TicketCategory.Duvida,
                    priority: (data.priority as TaskPriority) ?? TaskPriority.Medium,
                    status: (data.status as TicketStatus) ?? TicketStatus.Aberto,
                    description: data.description ?? '',
                    createdAt: toDate(data.createdAt),
                    updatedAt: toDate(data.updatedAt ?? data.createdAt),
                    responses: Array.isArray(data.responses) ? data.responses.map((r: any) => ({
                        id: r.id ?? String(Math.random()),
                        author: r.author as TicketResponse['author'],
                        content: r.content ?? '',
                        date: toDate(r.date),
                        avatarUrl: r.avatarUrl ?? '',
                    })) : [],
                };
            });
            setTickets(list);
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, [user]);

    const createTicket = async (data: { subject: string; category: TicketCategory; priority: TaskPriority; description: string; }) => {
        if (!user) return;
        setCreating(true);
        try {
            const ref = collection(db, 'users', user.uid, 'tickets');
            await addDoc(ref, {
                subject: data.subject,
                category: data.category,
                priority: data.priority,
                status: TicketStatus.Aberto,
                description: data.description,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                responses: [],
            });
            setNewOpen(false);
        } finally {
            setCreating(false);
        }
    };

    const chip = (text: string, cls: string) => (<span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{text}</span>);
    const statusChip = (s: TicketStatus) => {
        switch (s) {
            case TicketStatus.Aberto: return chip('Aberto', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300');
            case TicketStatus.EmAndamento: return chip('Em Andamento', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300');
            case TicketStatus.Fechado: return chip('Fechado', 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300');
        }
    };

    if (!user) {
        return <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-gray-600 dark:text-gray-300">Entre na sua conta para ver seus tickets.</div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Seus Tickets de Suporte</h2>
                <button onClick={() => setNewOpen(true)} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 flex items-center space-x-2">
                    <Plus className="h-5 w-5" /><span>Abrir Novo Ticket</span>
                </button>
            </div>
            {loading ? (
                <div className="text-gray-500 dark:text-gray-400">Carregando…</div>
            ) : tickets.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">Nenhum ticket ainda. Abra o primeiro.</div>
            ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tickets.map(t => (
                        <div key={t.id} className="py-3 flex items-center justify-between">
                            <div className="min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">{t.subject}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{t.category} • Prioridade {t.priority} • {t.createdAt.toLocaleDateString('pt-BR')}</div>
                            </div>
                            <div>{statusChip(t.status)}</div>
                        </div>
                    ))}
                </div>
            )}
            {newOpen && <NewTicketModal creating={creating} onClose={() => setNewOpen(false)} onCreate={createTicket} />}
        </div>
    );
};

// --- FINAL HELP CENTER ---

const HelpCenter: React.FC = () => {
    type Tab = 'knowledgeBase' | 'tickets';
    const [activeTab, setActiveTab] = useState<Tab>('knowledgeBase');
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
    const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
    const [faqs, setFaqs] = useState<FAQItem[]>([]);
    const [kbLoading, setKbLoading] = useState(true);
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [seeding, setSeeding] = useState(false);

    // Load Knowledge Base (platform-wide): platform/helpCenter/{articles|faqs}
    useEffect(() => {
        const helpDoc = doc(db, 'platform', 'helpCenter');
        const unsubArticles = onSnapshot(collection(helpDoc, 'articles'), (snap) => {
            setArticles(snap.docs.map(d => {
                const data: any = d.data();
                return {
                    id: d.id,
                    title: data.title ?? '',
                    category: data.category ?? 'Primeiros Passos',
                    summary: data.summary ?? '',
                    content: data.content ?? '',
                    lastUpdated: toDate(data.lastUpdated ?? data.updatedAt ?? data.createdAt),
                } as KnowledgeBaseArticle;
            }));
            setKbLoading(false);
        }, () => setKbLoading(false));
        const unsubFaqs = onSnapshot(collection(helpDoc, 'faqs'), (snap) => {
            setFaqs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FAQItem[]);
            setKbLoading(false);
        }, () => setKbLoading(false));
        return () => { unsubArticles(); unsubFaqs(); };
    }, []);

    // Check admin
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const settingsSnap = await getDoc(doc(db, 'platform', 'settings'));
                const emails: string[] = (settingsSnap.exists() ? (settingsSnap.data() as any).adminEmails : []) || [];
                if (mounted) setIsAdmin(!!user?.email && emails.includes(user.email!));
            } catch {
                if (mounted) setIsAdmin(false);
            }
        })();
        return () => { mounted = false; };
    }, [user?.email]);

    const defaultFaqs: FAQItem[] = [
        { id: 'faq_calendar_sync', question: 'Como sincronizar minha agenda com o Google/Apple?', answer: 'A sincronização direta de calendário está em desenvolvimento. Enquanto isso, gerencie seus horários pela plataforma e ative notificações para reduzir conflitos.' },
        { id: 'faq_create_service', question: 'Como cadastrar um novo serviço?', answer: 'Acesse Serviços > Adicionar Serviço. Defina nome, duração, preço e modalidade (Online/Presencial/Híbrido) e ative para aparecer na página pública.' },
        { id: 'faq_public_page', question: 'Como funciona minha página pública de agendamentos?', answer: 'Ao ativar serviços e disponibilidade, sua página pública exibe opções para que clientes escolham um horário. Compartilhe o link no Instagram, WhatsApp e site.' },
    { id: 'faq_payments', question: 'Posso receber pagamentos online?', answer: 'Sim. Conecte um gateway compatível (ex.: provedor de cartão de crédito ou Pix) em Perfil > Gateways. Depois, ative “Pagamento online” nos serviços desejados.' },
        { id: 'faq_notifications', question: 'O cliente recebe e‑mail/WhatsApp de confirmação?', answer: 'Sim. A plataforma envia confirmações e lembretes por e‑mail (e WhatsApp quando disponível). Confira os logs em Comunicações do cliente.' },
        { id: 'faq_availability', question: 'Como ajusto minha disponibilidade e bloqueios?', answer: 'Em Disponibilidade, defina dias/intervalos de atendimento e crie exceções (férias, eventos) para impedir novos agendamentos nesses períodos.' },
        { id: 'faq_reschedule', question: 'Como remarcar ou cancelar um agendamento?', answer: 'Abra o agendamento na Agenda e use “Remarcar” ou “Cancelar”. O cliente é notificado automaticamente e o horário volta a ficar disponível.' },
        { id: 'faq_reports', question: 'Onde vejo meus relatórios?', answer: 'Acesse Relatórios Avançados para métricas de serviços, horários de pico e tendências mensais, baseados nos seus atendimentos reais.' },
        { id: 'faq_profile_brand', question: 'Como melhorar meu perfil e credibilidade?', answer: 'Adicione foto, banner, bio, redes sociais, credenciais e depoimentos aprovados. Isso aumenta conversão e confiança na página pública.' },
        { id: 'faq_testimonials', question: 'Como coletar depoimentos de clientes?', answer: 'Na página Perfil, copie o link público de depoimentos e compartilhe com seus clientes. Aprove/apague comentários na seção Depoimentos.' },
        { id: 'faq_cancel_policy', question: 'Onde defino política de cancelamento?', answer: 'Em Perfil > Política de Cancelamento. Ela aparece na página pública e nas comunicações para alinhar expectativas dos clientes.' },
        { id: 'faq_support', question: 'Como falar com o suporte?', answer: 'Use a aba “Meus Tickets” na Central de Ajuda para abrir um ticket. Descreva o problema e acompanhe as respostas da equipe.' },
    ];

    const seedDefaultFaqs = async () => {
        if (!isAdmin || seeding) return;
        setSeeding(true);
        try {
            const helpDoc = doc(db, 'platform', 'helpCenter');
            const faqsCol = collection(helpDoc, 'faqs');
            const batch = writeBatch(db);
            defaultFaqs.forEach(f => {
                const ref = doc(faqsCol); // auto-id
                batch.set(ref, { question: f.question, answer: f.answer, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            });
            await batch.commit();
        } finally {
            setSeeding(false);
        }
    };

    // If an article is selected, show only the article view
    if (selectedArticle) {
        return <ArticleView article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center">
                    <LifeBuoy className="h-8 w-8 mr-3 text-indigo-500"/>
                    Central de Ajuda
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                    Encontre respostas rápidas na nossa base de conhecimento ou abra um ticket de suporte.
                </p>
            </header>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('knowledgeBase')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === 'knowledgeBase' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <BookOpen className="h-5 w-5" /> Base de Conhecimento
                    </button>
                     <button
                        onClick={() => setActiveTab('tickets')}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === 'tickets' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <LifeBuoy className="h-5 w-5" /> Meus Tickets
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="animate-fade-in">
                {activeTab === 'knowledgeBase' && (
                    <div className="space-y-4">
                        {isAdmin && !kbLoading && faqs.length === 0 && (
                            <div className="p-3 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                                <span>Nenhuma FAQ encontrada. Você pode criar um conjunto padrão.</span>
                                <button disabled={seeding} onClick={seedDefaultFaqs} className={`px-3 py-1.5 rounded-md bg-indigo-600 text-white ${seeding? 'opacity-60 cursor-not-allowed':''}`}>{seeding ? 'Criando…' : 'Criar FAQs padrão'}</button>
                            </div>
                        )}
                        <KnowledgeBaseView loading={kbLoading} onArticleSelect={setSelectedArticle} articles={articles} faqs={faqs} />
                    </div>
                )}
                {activeTab === 'tickets' && <TicketsView />}
            </div>
        </div>
    );
};

export default HelpCenter;