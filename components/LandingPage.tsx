import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ id, className, children }) => (
  <section id={id} className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className || ''}`}>
    {children}
  </section>
);

export const LandingHeader: React.FC = () => {
  const [open, setOpen] = useState(false);

  const MenuLinks = () => (
    <>
      <a href="/#recursos" className="text-sm font-medium text-gray-700 hover:text-gray-900">Recursos</a>
      <a href="/#como-funciona" className="text-sm font-medium text-gray-700 hover:text-gray-900">Como funciona</a>
      <a href="/#planos" className="text-sm font-medium text-gray-700 hover:text-gray-900">Planos</a>
      <a href="/#depoimentos" className="text-sm font-medium text-gray-700 hover:text-gray-900">Depoimentos</a>
      <a href="/#faq" className="text-sm font-medium text-gray-700 hover:text-gray-900">FAQ</a>
      <a href="/#contato" className="text-sm font-medium text-gray-700 hover:text-gray-900">Contato</a>
      <a href="/login" className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Login</a>
    </>
  );

  return (
    <header className="w-full bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Agendiia" className="h-10 sm:h-12 md:h-16 w-auto" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-6">
          <MenuLinks />
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100"
          >
            {open ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu content */}
      {open && (
        <div className="md:hidden px-4 pb-4">
          <nav className="flex flex-col space-y-2">
            <MenuLinks />
          </nav>
        </div>
      )}
    </header>
  );
};

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button {...props} className={`px-5 py-3 rounded-lg btn-theme font-semibold hover:opacity-95 transition ${className || ''}`}>{children}</button>
);

const SecondaryLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({ className, children, ...props }) => (
  <a {...props} className={`px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 ${className || ''}`}>{children}</a>
);

const FeatureCard: React.FC<{ title: string; desc: string; icon?: React.ReactNode; iconClass?: string; cardClass?: string }> = ({ title, desc, icon, iconClass, cardClass }) => (
  <motion.div className={`${cardClass || 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'} rounded-xl p-6 shadow-sm`}
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.45 }}
  >
    <div className="flex items-start gap-3">
      <div className={`${iconClass || 'bg-theme-light text-theme'} h-10 w-10 rounded-lg flex items-center justify-center`}>{icon || '★'}</div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{desc}</p>
      </div>
    </div>
  </motion.div>
);

const Testimonial: React.FC<{ quote: string; author: string }> = ({ quote, author }) => (
  <motion.blockquote className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.45 }}
  >
    <p className="text-gray-700 dark:text-gray-200 italic">“{quote}”</p>
    <footer className="mt-3 text-sm text-gray-500">— {author}</footer>
  </motion.blockquote>
);

const PricingCard: React.FC<{ name: string; price: string; features: string[]; ctaHref: string; best?: boolean }> = ({ name, price, features, ctaHref, best }) => (
  <motion.div className={`rounded-2xl p-6 border shadow-sm ${best ? 'border-theme ring-2 ring-theme-light' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 flex flex-col`}
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.45 }}
  >
    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h3>
    <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{price}<span className="text-base font-medium text-gray-500">/mês</span></p>
    <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
      {features.map((f, i) => (<li key={i} className="flex items-start gap-2"><span className="text-green-600">✓</span><span>{f}</span></li>))}
    </ul>
    <a href={ctaHref} className={`mt-6 text-center px-5 py-3 rounded-lg ${best ? 'btn-theme' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100'} font-semibold transition-colors`}>
      Começar agora
    </a>
  </motion.div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      {/* NAVBAR */}
      <LandingHeader />

      {/* HERO */}
      <Section className="py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-theme-light text-theme-light">Sua agenda, seu crescimento, sua IA</div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold leading-tight text-gray-900 dark:text-white">
              <span className="gradient-theme bg-clip-text text-transparent">
                A Agenda com IA para profissionais que querem mais tempo, clientes e resultados.
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">O assistente digital que trabalha por você. Agende, lembre, analise e encante – tudo em um só lugar, com IA.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryButton onClick={() => { window.location.href = '/login?signup=1'; }}>Comece agora – 14 dias grátis</PrimaryButton>
            </div>
            <p className="mt-3 text-xs text-gray-500">Não precisa de cartão de crédito</p>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-theme-light bg-white/90 dark:bg-gray-800 p-4 shadow-lg">
              <img src="/agendamentos.avif" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} alt="Demonstração do Agendiia" className="rounded-xl w-full" />
            </div>
          </div>
        </div>
      </Section>

      {/* SHOWCASE: Image + Text blocks (sales oriented) */}
      <Section className="py-8 sm:py-12">
        <div className="space-y-10 sm:space-y-14">
          {/* 1 - Dashboard Inteligente */}
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="rounded-2xl border border-theme-light bg-white/90 dark:bg-gray-800 p-4 shadow-lg">
              <img
                src="/lp-dashboard.avif"
                alt="Dashboard Inteligente"
                className="rounded-xl w-full"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-theme">Dashboard Inteligente</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Tenha uma visão completa do seu negócio: faturamento, agendamentos, ticket médio, evolução e agenda do dia em um só lugar.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Métricas em tempo real</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Gráficos de evolução</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Agenda do dia e próximos compromissos</li>
              </ul>
              <div className="mt-4 text-sm bg-theme-light text-theme-light rounded-lg p-3">Mais clientes, menos tarefas repetitivas. A plataforma de agendamento que pensa, aprende e impulsiona seu sucesso.</div>
            </div>
          </div>

          {/* 2 - Gestão de Clientes (CRM) */}
          <div className="grid md:grid-cols-2 gap-6 items-center md:[&>div:first-child]:order-2">
            <div className="rounded-2xl border border-theme-light bg-white/90 dark:bg-gray-800 p-4 shadow-lg">
              <img
                src="/clientes.avif"
                alt="Gestão de Clientes"
                className="rounded-xl w-full"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-theme">Gestão de Clientes (CRM)</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Visualize todos os seus clientes em cards, acesse histórico, anotações e comunique-se de forma inteligente com IA.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Perfil 360º do cliente</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Resumo inteligente com IA</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Mensagens automáticas e personalizadas</li>
              </ul>
            </div>
          </div>

          {/* 3 - Agenda e Serviços */}
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="rounded-2xl border border-theme-light bg-white/90 dark:bg-gray-800 p-4 shadow-lg">
              <img
                src="/minha agenda.avif"
                alt="Agenda e Serviços"
                className="rounded-xl w-full"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-theme">Agenda e Serviços Inteligentes</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Controle disponibilidade por serviço, buffers, limites por dia e exceções. Sua agenda sempre organizada — 24/7.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Regras por serviço e duração</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Bloqueios e períodos especiais</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Link público de agendamento 24/7</li>
              </ul>
            </div>
          </div>

          {/* 4 - Pagamentos e Automação */}
          <div className="grid md:grid-cols-2 gap-6 items-center md:[&>div:first-child]:order-2">
            <div className="rounded-2xl border border-theme-light bg-white/90 dark:bg-gray-800 p-4 shadow-lg">
              <img
                src="/forma pagamento.avif"
                alt="Pagamentos e Automação"
                className="rounded-xl w-full"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-theme">Pagamentos e E-mails Automáticos</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Receba por Pix ou Cartão de Crédito e reduza faltas com confirmações e lembretes por e-mail enviados automaticamente.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Pix estático e checkout Cartão de Crédito</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Confirmação no agendamento</li>
                <li className="flex gap-2"><span className="text-theme font-bold">•</span> Lembrete ~24h antes do atendimento</li>
              </ul>
            </div>
          </div>
          
            {/* 5 - Gestão Financeira */}
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="rounded-2xl border border-theme-light bg-white/90 dark:bg-gray-800 p-4 shadow-lg">
                <img
                  src="/financeiro.avif"
                  alt="Gestão Financeira"
                  className="rounded-xl w-full"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-theme">Gestão Financeira</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">Centralize receitas, controle recebimentos, concilie vendas e acompanhe o fluxo de caixa com relatórios claros em um só lugar.</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex gap-2"><span className="text-theme font-bold">•</span> Controle de recebimentos por agendamento</li>
                  <li className="flex gap-2"><span className="text-theme font-bold">•</span> Relatórios financeiros e exportação</li>
                  <li className="flex gap-2"><span className="text-theme font-bold">•</span> Integração com pagamentos e conciliação automática</li>
                </ul>
              </div>
            </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section id="recursos" className="py-12">
        <h2 className="text-3xl font-bold text-center">Tudo que você precisa para vender seu tempo</h2>
        <p className="text-center text-gray-600 dark:text-gray-300 mt-2">Construído para profissionais independentes e clínicas.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          <FeatureCard
            title="Página Pública de Agendamento"
            desc="Seu link personalizado (/booking/<slug>) para clientes agendarem 24/7."
            icon="📅"
            iconClass="bg-emerald-100 text-emerald-600"
            cardClass="bg-emerald-50 text-emerald-900 border-emerald-100 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-800"
          />
          <FeatureCard
            title="Perfil Profissional"
            desc="Bio, especialidade, redes sociais, fotos e depoimentos aprovados."
            icon="👤"
            iconClass="bg-indigo-100 text-indigo-600"
            cardClass="bg-indigo-50 text-indigo-900 border-indigo-100 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-800"
          />
          <FeatureCard
            title="Agenda Inteligente"
            desc="Disponibilidade por serviço, bloqueios/extra, buffers e limites por dia."
            icon="⚙️"
            iconClass="bg-sky-100 text-sky-600"
            cardClass="bg-sky-50 text-sky-900 border-sky-100 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-800"
          />
          <FeatureCard
            title="Pagamentos Integrados"
            desc="Pix estático e link de checkout por Cartão de Crédito. Status no agendamento."
            icon="💳"
            iconClass="bg-amber-100 text-amber-700"
            cardClass="bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-800"
          />
          <FeatureCard
            title="E-mails Automáticos"
            desc="Confirmação no agendamento e lembrete ~24h antes — via Brevo."
            icon="📧"
            iconClass="bg-pink-100 text-pink-600"
            cardClass="bg-pink-50 text-pink-900 border-pink-100 dark:bg-pink-900 dark:text-pink-100 dark:border-pink-800"
          />
          <FeatureCard
            title="Marketing com IA"
            desc="Gere biografias, descrições e ideias de conteúdo com Gemini."
            icon="✨"
            iconClass="bg-purple-100 text-purple-600"
            cardClass="bg-purple-50 text-purple-900 border-purple-100 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-800"
          />
          <FeatureCard
            title="Financeiro e Relatórios"
            desc="Acompanhe recebimentos e métricas para decisões melhores."
            icon="📊"
            iconClass="bg-lime-100 text-lime-700"
            cardClass="bg-lime-50 text-lime-900 border-lime-100 dark:bg-lime-900 dark:text-lime-100 dark:border-lime-800"
          />
          <FeatureCard
            title="Gestão de Depoimentos"
            desc="Colete depoimentos por link público e aprove o que vai ao ar."
            icon="⭐"
            iconClass="bg-rose-100 text-rose-600"
            cardClass="bg-rose-50 text-rose-900 border-rose-100 dark:bg-rose-900 dark:text-rose-100 dark:border-rose-800"
          />
          <FeatureCard
            title="Personalização"
            desc="Cores do tema, banner e avatar — sua marca em primeiro plano."
            icon="🎨"
            iconClass="bg-amber-50 text-amber-600"
            cardClass="bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-800"
          />
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section id="como-funciona" className="py-16">
        <h2 className="text-3xl font-bold text-center">Como funciona</h2>
        <div className="grid md:grid-cols-4 gap-5 mt-8">
          {(() => {
            const howColors = [
              { card: 'bg-emerald-50 text-emerald-900 border-emerald-100 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-800', icon: 'bg-emerald-500 text-white' },
              { card: 'bg-indigo-50 text-indigo-900 border-indigo-100 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-800', icon: 'bg-indigo-500 text-white' },
              { card: 'bg-sky-50 text-sky-900 border-sky-100 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-800', icon: 'bg-sky-500 text-white' },
              { card: 'bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-800', icon: 'bg-amber-600 text-white' },
            ];
            return [
              { t:'Crie sua conta', d:'Cadastre-se em minutos e verifique seu e-mail.' },
              { t:'Configure sua agenda', d:'Adicione serviços, horários, exceções e políticas.' },
              { t:'Compartilhe seu link', d:'Divulgue sua página pública de agendamentos.' },
              { t:'Receba pagamentos', d:'Pix e Cartão de Crédito integrados ao fluxo de reserva.' },
            ].map((s,i)=> {
              const cls = howColors[i % howColors.length];
              return (
                <div key={i} className={`${cls.card} rounded-xl p-6 shadow-sm border`}>
                  <div className={`h-9 w-9 rounded-full ${cls.icon} flex items-center justify-center font-bold`}>{i+1}</div>
                  <h3 className="mt-3 font-semibold">{s.t}</h3>
                  <p className="text-sm mt-1">{s.d}</p>
                </div>
              );
            });
          })()}
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section id="depoimentos" className="py-12">
        <h2 className="text-3xl font-bold text-center">Histórias de sucesso</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-8">
          <Testimonial quote="Passei a fechar horários mesmo fora do expediente. O link público é perfeito." author="Mariana, Psicóloga" />
          <Testimonial quote="O lembrete 24h reduziu faltas. E ainda recebo por cartão de crédito sem dor de cabeça." author="Rafael, Nutricionista" />
          <Testimonial quote="Montei minha página em 20 minutos. A IA ajudou até a escrever minha bio." author="Clara, Coach" />
        </div>
      </Section>

      {/* PRICING */}
      <Section id="planos" className="py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold">Planos simples e transparentes</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Comece grátis e faça upgrade quando estiver pronto.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 mt-10">
          <PricingCard
            name="Profissional"
            price="R$ 49"
            features={[
              'Página pública de agendamentos',
              'Perfil personalizado para profissionais',
              'Agenda por serviço e exceções',
              'Receba por Pix e Cartão de Crédito',
              'E-mails de confirmação',
            ]}
            ctaHref="/login?signup=1"
          />
          <PricingCard
            name="Avançado"
            price="R$ 79"
            features={[
              'Tudo do Profissional',
              'Análises inteligentes com IA',
              'Sugestões Financeiras com IA',
              'Recursos de marketing com IA',
              'Relatórios avançados',
            ]}
            ctaHref="/login?signup=1"
            best
          />
        </div>
        <p className="text-center text-xs text-gray-500 mt-4">Preços de referência. A cobrança real pode ser configurada no painel.</p>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center">Perguntas frequentes</h2>
          <div className="mt-8 space-y-5">
            {[
              {q:'Preciso de cartão de crédito para começar?', a:'Não. Você pode testar por 14 dias sem cartão. Depois do teste, escolha um plano dentro do painel.'},
              {q:'Consigo usar meu próprio domínio?', a:'Sim. Sua página pública funciona no domínio da plataforma e também pode ser apontada para um domínio próprio.'},
              {q:'Como funcionam os pagamentos?', a:'Você pode receber por Pix estático diretamente e/ou criar um checkout com cartão de crédito. O status aparece no agendamento.'},
              {q:'A plataforma envia e-mails automáticos?', a:'Sim. Enviamos confirmação no agendamento e lembrete ~24h antes do atendimento (via Brevo).'},
            ].map((item, i)=> (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5">
                <div className="font-semibold text-gray-900 dark:text-white">{item.q}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CONTACT */}
      <Section id="contato" className="py-12">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold">Fale com a gente</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Tem dúvidas sobre planos, recursos ou migração? Estamos aqui para ajudar.</p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <a href="mailto:suporte@agendiia.com.br" className="px-5 py-3 rounded-lg bg-theme text-white font-semibold hover:opacity-90">Enviar e-mail</a>
            <SecondaryLink href="/login?signup=1">Começar grátis</SecondaryLink>
          </div>
        </div>
      </Section>

      {/* CTA FOOTER */}
      <Section className="py-12">
        <div className="gradient-theme text-white rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold">Pronto para lotar sua agenda?</h3>
            <p className="opacity-90">Crie sua conta agora. Em poucos minutos você estará recebendo agendamentos.</p>
          </div>
          <div className="flex gap-3">
            <a href="/login?signup=1" className="px-5 py-3 rounded-lg bg-white text-theme font-semibold hover:bg-indigo-50">Criar conta</a>
            <a href="/login" className="px-5 py-3 rounded-lg bg-white/20 text-white font-semibold hover:bg-white/30">Entrar</a>
          </div>
        </div>
      </Section>

      <footer className="py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Agendiia. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default LandingPage;
