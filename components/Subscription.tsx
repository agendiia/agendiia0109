import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Clock, Download, AlertTriangle, Award, BarChart4 } from './Icons';
import { doc, getDoc, collection, query, orderBy, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { redirectToStripePayment } from '../services/stripeService';

// --- Tipos e Dados Mockados ---
// Em um projeto real, os tipos viriam de 'types.ts' e os dados do backend.

const plans = {
  professional: {
    id: 'price_prof_123', // ID do Preço no Stripe
    name: 'Profissional',
    price: 49.00,
    features: [
      'Agenda e Agendamentos Ilimitados',
      'Página de Agendamento Pública',
      'Gestão de Clientes',
      'Notificações por E-mail',
      'Suporte via Chat',
    ],
  },
  advanced: {
    id: 'price_adv_123', // ID do Preço no Stripe
    name: 'Avançado',
    price: 79.00,
    features: [
      'Todos os recursos do Profissional',
      'Marketing com IA',
      'Relatórios Avançados',
      'Financeiro Completo',
      'Suporte Prioritário',
    ],
  },
};

type PlanKey = keyof typeof plans;

interface SubscriptionData {
  planId: PlanKey | null;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'unpaid';
  trialEndsAt: Date | null;
  nextBillingAt: Date | null;
  endsAt: Date | null;
  paymentMethod: {
    brand: string;
    last4: string;
  } | null;
}

interface Invoice {
  id: string;
  date: Date;
  amount: number;
  status: 'paid' | 'open' | 'void';
  url: string;
}

// --- Componente Principal ---

const SubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

  useEffect(() => {
            if (!user) {
                // Usuário não autenticado: não ficar preso no loading
                setLoading(false);
                setSubscription(null);
                setInvoices([]);
                return;
            }

        // Busca dados reais do Firestore
        // Assunções (adapte ao seu esquema):
        // - O documento do usuário está em `users/{uid}` e pode conter um campo `subscription` com dados da assinatura.
        // - As faturas estão em `users/{uid}/invoices` como subcollection, cada doc com campos { date: Timestamp, amount: number, status: string, url: string }
        // Ajuste os caminhos/nomes de campos conforme seu esquema se necessário.
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                // Ler documento do usuário
                const userDocRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userDocRef);

                if (!mounted) return;

                if (userSnap.exists()) {
                    const data = userSnap.data() as any;
                    if (data.subscription) {
                        const s = data.subscription;
                        setSubscription({
                            planId: s.planId ?? null,
                            status: s.status ?? 'active',
                            trialEndsAt: s.trialEndsAt ? (s.trialEndsAt.toDate ? s.trialEndsAt.toDate() : new Date(s.trialEndsAt)) : null,
                            nextBillingAt: s.nextBillingAt ? (s.nextBillingAt.toDate ? s.nextBillingAt.toDate() : new Date(s.nextBillingAt)) : null,
                            endsAt: s.endsAt ? (s.endsAt.toDate ? s.endsAt.toDate() : new Date(s.endsAt)) : null,
                            paymentMethod: s.paymentMethod ?? null,
                        });
                    } else {
                        // No explicit subscription: check for trial eligibility
                        const createdAtRaw = (data.createdAt as any) || null;
                        const trialEndsRaw = (data.trialEndsAt as any) || null;
                        const createdAt = createdAtRaw ? (createdAtRaw.toDate ? createdAtRaw.toDate() : new Date(createdAtRaw)) : null;
                        let trialEndsAt = trialEndsRaw ? (trialEndsRaw.toDate ? trialEndsRaw.toDate() : new Date(trialEndsRaw)) : null;
                        // If no explicit trialEndsAt but we have createdAt, grant 14 days from creation
                        if (!trialEndsAt && createdAt) {
                            trialEndsAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
                        }
                        // If still no trial end or trial expired, treat as no subscription
                        if (trialEndsAt && trialEndsAt > new Date()) {
                            setSubscription({
                                planId: 'professional',
                                status: 'trialing',
                                trialEndsAt,
                                nextBillingAt: null,
                                endsAt: null,
                                paymentMethod: null,
                            });
                            // Persist trialEndsAt if it wasn't present in Firestore
                            try {
                                if (!trialEndsRaw) {
                                    await setDoc(userDocRef, { trialEndsAt: Timestamp.fromDate(trialEndsAt) }, { merge: true });
                                }
                            } catch (e) {
                                console.warn('Falha ao persistir trialEndsAt no Firestore:', e);
                            }
                        } else {
                            setSubscription(null);
                        }
                    }
                } else {
                    setSubscription(null);
                }

                // Ler faturas da subcollection `invoices`
                const invoicesCol = collection(db, 'users', user.uid, 'invoices');
                const q = query(invoicesCol, orderBy('date', 'desc'));
                const invoicesSnap = await getDocs(q);
                const fetched: Invoice[] = invoicesSnap.docs.map(d => {
                    const iv = d.data() as any;
                    return {
                        id: d.id,
                        date: iv.date && iv.date.toDate ? iv.date.toDate() : (iv.date ? new Date(iv.date) : new Date()),
                        amount: iv.amount ?? 0,
                        status: iv.status ?? 'open',
                        url: iv.url ?? '#',
                    };
                });
                if (mounted) setInvoices(fetched);
            } catch (err) {
                console.error('Erro ao buscar dados de assinatura/faturas:', err);
                // Em caso de erro, mantemos estados nulos e o UI poderá indicar ausência de dados
                if (mounted) {
                    setSubscription(null);
                    setInvoices([]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => { mounted = false; };

    }, [user]);

    const handleCheckout = async (planId: string) => {
        if (planId === 'professional') redirectToStripePayment('prof_monthly', user?.uid);
        else if (planId === 'advanced') redirectToStripePayment('adv_monthly', user?.uid);
  };

  if (loading) {
    return <div className="text-center p-10">Carregando informações da sua assinatura...</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Planos e Assinatura</h1>

      {subscription?.status === 'past_due' && <SmartAlert type="danger" message="Não conseguimos processar seu pagamento. Atualize seu cartão para evitar a suspensão do acesso." />}
      {subscription?.status === 'trialing' && subscription.trialEndsAt && getDaysRemaining(subscription.trialEndsAt) <= 2 && <SmartAlert type="warning" message={`Seu período gratuito termina em ${getDaysRemaining(subscription.trialEndsAt)} dias. Escolha seu plano para continuar.`} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <PlanSelection subscription={subscription} onSelectPlan={handleCheckout} />
          <PaymentHistory invoices={invoices} />
        </div>
        <div className="space-y-6">
          {subscription?.status === 'trialing' && <TrialStatusCard trialEndsAt={subscription.trialEndsAt} />}
          <CurrentSubscriptionCard subscription={subscription} />
        </div>
      </div>
    </div>
  );
};

// --- Subcomponentes ---

const SmartAlert: React.FC<{ type: 'warning' | 'danger'; message: string }> = ({ type, message }) => {
    const styles = {
        warning: "bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        danger: "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    }
    return (
        <div className={`flex items-center p-4 rounded-lg border-l-4 ${styles[type]}`}>
            <AlertTriangle className="h-6 w-6 mr-3"/>
            <p>{message}</p>
        </div>
    )
}

const TrialStatusCard: React.FC<{ trialEndsAt: Date | null }> = ({ trialEndsAt }) => {
    const daysRemaining = getDaysRemaining(trialEndsAt);
    const progress = Math.max(0, (14 - daysRemaining) / 14 * 100);

    return (
        <Card>
            <Card.Header icon={<Award />} title="Período de Teste (14 dias)" />
            <Card.Content>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    Você tem <strong>{daysRemaining} dias restantes</strong> para explorar todos os recursos.
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
                <button
                    onClick={() => redirectToStripePayment('prof_monthly')}
                    className="w-full mt-4 bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                    Ativar Plano Agora
                </button>
            </Card.Content>
        </Card>
    )
}

const CurrentSubscriptionCard: React.FC<{ subscription: SubscriptionData | null }> = ({ subscription }) => {
  if (!subscription || !subscription.planId) {
    return (
        <Card>
            <Card.Header icon={<XCircle />} title="Nenhum plano ativo" />
            <Card.Content>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">Escolha um dos planos ao lado para começar.</p>
            </Card.Content>
        </Card>
    );
  }

  const { status, planId, nextBillingAt, endsAt, paymentMethod } = subscription;
  const plan = plans[planId];

  const statusInfo = {
    active: { text: 'Ativa', icon: <CheckCircle className="text-green-500" />, color: 'text-green-500' },
    trialing: { text: 'Período de Teste', icon: <Clock className="text-blue-500" />, color: 'text-blue-500' },
    canceled: { text: 'Cancelada', icon: <XCircle className="text-red-500" />, color: 'text-red-500' },
    past_due: { text: 'Pagamento Pendente', icon: <AlertTriangle className="text-yellow-500" />, color: 'text-yellow-500' },
    unpaid: { text: 'Pagamento Falhou', icon: <XCircle className="text-red-500" />, color: 'text-red-500' },
  };

  return (
    <Card>
      <Card.Header icon={<BarChart4 />} title="Sua Assinatura" />
      <Card.Content className="space-y-4">
        <InfoRow label="Plano Atual" value={plan.name} />
        <InfoRow label="Status">
            <div className={`flex items-center gap-2 font-semibold ${statusInfo[status].color}`}>
                {statusInfo[status].icon}
                <span>{statusInfo[status].text}</span>
            </div>
        </InfoRow>
        {status === 'active' && nextBillingAt && <InfoRow label="Próxima Cobrança" value={formatDate(nextBillingAt)} />}
        {status === 'canceled' && endsAt && <InfoRow label="Acesso até" value={formatDate(endsAt)} />}
        <InfoRow label="Valor Mensal" value={`R$ ${plan.price.toFixed(2)}`} />
                {/* Botões de gerenciar assinatura */}
                <div className="pt-4">
                    {status === 'active' && (
                        <div className="space-y-2">
                            <button
                                onClick={async () => {
                                    const ok = confirm('Tem certeza de que deseja cancelar sua assinatura? Após o término do período já pago, sua conta será limitada e você perderá os benefícios do plano.');
                                    if (!ok) return;
                                    try {
                                        const functions = getFunctions();
                                        const callable = httpsCallable(functions, 'cancelStripeSubscription');
                                        const resp: any = await callable({});
                                        if (resp?.data?.ok) {
                                            alert('Pedido de cancelamento realizado. A assinatura será encerrada ao fim do período já pago.');
                                            // optional: refresh page or subscription data
                                            window.location.reload();
                                        } else {
                                            alert('Nenhuma assinatura ativa encontrada ou falha ao solicitar cancelamento.');
                                        }
                                    } catch (e) {
                                        console.error('Erro ao solicitar cancelamento:', e);
                                        alert('Falha ao solicitar cancelamento. Tente novamente mais tarde.');
                                    }
                                }}
                                className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                            >
                                Cancelar Assinatura
                            </button>
                        </div>
                    )}
                </div>
        {status === 'canceled' && <p className="text-xs text-center text-gray-500 pt-2">Para reativar, basta escolher um plano novamente.</p>}
      </Card.Content>
    </Card>
  );
};

const PlanSelection: React.FC<{ subscription: SubscriptionData | null, onSelectPlan: (planId: string) => void }> = ({ subscription, onSelectPlan }) => {
    return (
        <Card>
            <Card.Header title="Escolha o Melhor Plano para Você" />
            <Card.Content className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(plans).map(([key, plan]) => (
                    <PlanCard 
                        key={key}
                        plan={plan}
                        isCurrent={subscription?.planId === key}
                        isUpgrade={subscription?.planId === 'professional' && key === 'advanced'}
                        isDowngrade={subscription?.planId === 'advanced' && key === 'professional'}
                        onSelect={() => onSelectPlan(key)}
                    />
                ))}
            </Card.Content>
        </Card>
    )
}

const PlanCard: React.FC<{ plan: typeof plans[PlanKey], isCurrent: boolean, isUpgrade: boolean, isDowngrade?: boolean, onSelect: () => void }> = ({ plan, isCurrent, isUpgrade, isDowngrade, onSelect }) => {
    return (
        <div className={`p-6 rounded-lg border-2 ${isCurrent ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
            <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{plan.name}</h3>
            <p className="text-3xl font-extrabold my-2">R$ {plan.price.toFixed(2)}<span className="text-base font-medium text-gray-500">/mês</span></p>
            <ul className="space-y-2 my-6 text-sm">
                {plan.features.map(feature => (
                    <li key={feature} className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                ))}
            </ul>
            <button 
                onClick={onSelect}
                disabled={isCurrent}
                className="w-full py-2.5 rounded-lg font-semibold text-white transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
            >
                {isCurrent ? 'Seu Plano Atual' : (isUpgrade ? 'Fazer Upgrade' : (isDowngrade ? 'Fazer Downgrade' : 'Assinar Agora'))}
            </button>
        </div>
    )
}

const PaymentHistory: React.FC<{ invoices: Invoice[] }> = ({ invoices }) => {
    return (
        <Card>
            <Card.Header title="Histórico de Pagamentos" />
            <Card.Content>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Data</th>
                                <th scope="col" className="px-6 py-3">Valor</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Recibo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr className="bg-white dark:bg-gray-800">
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Nenhuma fatura encontrada.</td>
                                </tr>
                            ) : (
                                invoices.map(invoice => (
                                    <tr key={invoice.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                        <td className="px-6 py-4">{formatDate(invoice.date)}</td>
                                        <td className="px-6 py-4">R$ {invoice.amount.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {invoice.status === 'paid' ? 'Pago' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <a href={invoice.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                <Download className="h-5 w-5" />
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card.Content>
        </Card>
    )
}

const Card: React.FC<{ children: React.ReactNode }> & {
    Header: React.FC<{ title: string; icon?: React.ReactNode }>;
    Content: React.FC<{ children: React.ReactNode, className?: string }>;
} = ({ children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">{children}</div>
);

Card.Header = ({ title, icon }) => (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        {icon && <div className="text-indigo-500">{icon}</div>}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
    </div>
);

Card.Content = ({ children, className }) => (
    <div className={`p-6 ${className || ''}`}>{children}</div>
);

const InfoRow: React.FC<{ label: string, value?: string, children?: React.ReactNode }> = ({ label, value, children }) => (
    <div className="flex justify-between items-center text-sm">
        <p className="text-gray-500 dark:text-gray-400">{label}</p>
        {value ? <p className="font-semibold text-gray-800 dark:text-gray-200">{value}</p> : children}
    </div>
);

const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('pt-BR').format(date);
}

const getDaysRemaining = (date: Date | null) => {
    if (!date) return 0;
    const diff = date.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default SubscriptionPage;