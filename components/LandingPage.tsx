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
      <a href="/#para-quem" className="text-sm font-medium text-gray-700 hover:text-gray-900">Para Quem</a>
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
  <motion.div className={`relative rounded-2xl p-6 border shadow-sm ${best ? 'border-theme ring-2 ring-theme-light' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 flex flex-col`}
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: 0.45 }}
  >
    {best ? (
      <span className="absolute -top-3 right-3 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">Recomendado</span>
    ) : null}
    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h3>
    <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{price}<span className="text-base font-medium text-gray-500">/mês</span></p>
    <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
      {features.map((f, i) => (<li key={i} className="flex items-start gap-2"><span className="text-green-600">✓</span><span>{f}</span></li>))}
    </ul>
    <a href={ctaHref} className={`mt-6 text-center px-5 py-3 rounded-lg ${best ? 'btn-theme' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100'} font-semibold transition-colors`}>
      Experimente Grátis
    </a>
  </motion.div>
);

// novos constantes de preço
const PROFESSIONAL_PRICE = "R$ 39,00";
const ADVANCED_PRICE = "R$ 59,00";

const STRIPE_PROF_LINK = process.env.VITE_STRIPE_PROF_MONTHLY_LINK || "https://buy.stripe.com/28E3cw4xJ8ja4xKcHZ2VG04";
const STRIPE_ADV_LINK = process.env.VITE_STRIPE_ADV_MONTHLY_LINK || "https://buy.stripe.com/7sYfZifcndDu5BO6jB2VG05";

const LandingPage: React.FC = () => {
  return (
    <>
      <title>Agendiia | Agenda com IA para Profissionais</title>
      <meta name="description" content="Otimize seu tempo e profissionalize seu negócio com a Agendiia. Gestão de agendamentos, clientes e finanças em um só lugar, com o poder da inteligência artificial (IA)." />
      <div className="bg-gray-50 text-gray-800">
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

        {/* FOR WHOM SECTION */}
        <Section id="para-quem" className="py-16 text-center bg-white dark:bg-gray-900">
          <h2 className="text-3xl font-bold">A escolha certa para profissionais modernos</h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mt-2 max-w-2xl mx-auto">
            Organize sua agenda, reduza faltas e melhore a experiência dos seus clientes. Agenda com IA criada especialmente para profissionais de saúde, bem-estar e serviços que querem ganhar tempo e produtividade.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            { [
              'Psicólogos', 'Nutricionistas', 'Fisioterapeutas', 'Esteticistas',
              'Terapeutas', 'Coaches', 'Consultores', 'Personal Trainers', 'e muito mais...'
            ].map((prof, index) => (
              <motion.div
                key={index}
                className="bg-indigo-100 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full shadow-sm"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                {prof}
              </motion.div>
            )) }
          </div>
          
          {/* CTA destacado - Experimente grátis */}
          <motion.div 
            className="mt-10 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6 max-w-lg mx-auto shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-xl font-bold mb-2">🚀 Experimente 14 dias GRÁTIS</h3>
            <p className="text-indigo-100 text-sm mb-4">Teste todos os recursos sem compromisso</p>
            <PrimaryButton 
              onClick={() => { window.location.href = '/login?signup=1'; }}
              className="bg-white text-indigo-600 hover:bg-gray-50 hover:text-black w-full"
            >
              Começar agora - É grátis!
            </PrimaryButton>
            <p className="text-xs text-indigo-200 mt-2">✅ Sem cartão de crédito • ✅ Ativação imediata</p>
          </motion.div>
        </Section>

        {/* FEATURES */}
        <Section id="recursos" className="py-12">
          <h2 className="text-3xl font-bold text-center">Mais tempo para você, mais valor para seus clientes</h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mt-2">Construído para profissionais independentes e clínicas.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            <FeatureCard
              title="Página Pública de Agendamento"
              desc="Seu link personalizado para agendamento de clientes 24/7."
              icon="📅"
              iconClass="bg-emerald-100 text-emerald-600"
              cardClass="bg-emerald-50 text-emerald-900 border-emerald-100 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-800"
            />
            <FeatureCard
              title="Perfil Profissional"
              desc="Personalize o seu perfil profissional, redes sociais, fotos e depoimentos e muito mais."
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
              desc="Pix e link de checkout por Cartão de Crédito. Status no agendamento."
              icon="💳"
              iconClass="bg-amber-100 text-amber-700"
              cardClass="bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-800"
            />
            <FeatureCard
              title="E-mails Automáticos"
              desc="Confirmação no agendamento e lembrete ~24h antes e 3 hs antes."
              icon="📧"
              iconClass="bg-pink-100 text-pink-600"
              cardClass="bg-pink-50 text-pink-900 border-pink-100 dark:bg-pink-900 dark:text-pink-100 dark:border-pink-800"
            />
            <FeatureCard
              title="Marketing com IA"
              desc="Gere biografias, roteiros para vídeo, ideias de conteúdo com IA."
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
              title="Agendamentos e Clientes"
              desc="Tenha controle sobre seus agendamentos e clientes de modo fácil."
              icon="🎨"
              iconClass="bg-amber-50 text-amber-600"
              cardClass="bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-800"
            />
          </div>
          
          {/* CTA destacado após recursos - Experimente grátis */}
          <motion.div 
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              💡 Viu como é completo? Teste agora mesmo!
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-700 rounded-2xl p-8 max-w-md mx-auto shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                ⏰ 14 dias para testar TUDO
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Acesso completo a todos os recursos sem pagar nada
              </p>
              <PrimaryButton 
                onClick={() => { window.location.href = '/login?signup=1'; }}
                className="w-full py-4 text-lg"
              >
                Quero testar grátis agora!
              </PrimaryButton>
              <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
                <span>✅ Sem cartão</span>
                <span>✅ Sem compromisso</span>
                <span>✅ Acesso total</span>
              </div>
            </div>
          </motion.div>
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
          {/* Exemplo de PricingCards (substitua/alinhe onde já existirem) */}
          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            <PricingCard
              name="Profissional"
              price={PROFESSIONAL_PRICE}
              features={[
                "Página pública de agendamentos",
                "Perfil personalizado para profissionais",
                "Agenda por serviço e exceções",
                "Receba por Pix e Cartão de Crédito",
                "E-mails de confirmação",
              ]}
              ctaHref="/login?signup=1"
            />
            <PricingCard
              name="Avançado"
              price={ADVANCED_PRICE}
              features={[
                "Tudo do Profissional",
                "Análises inteligentes com IA",
                "Sugestões Financeiras com IA",
                "Recursos de marketing com IA",
                "Relatórios avançados",
              ]}
              ctaHref="/login?signup=1"
              best
            />
          </div>
          <p className="text-center text-xs text-gray-500 mt-4">Não é necessário cartão de crédito.</p>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center">Perguntas frequentes</h2>
            <div className="mt-8 space-y-5">
              {/*
                {q:'Preciso de cartão de crédito para começar?', a:'Não. Você pode testar por 14 dias sem cartão. Depois do teste, escolha um plano dentro do painel.'},
                {q:'Consigo usar meu próprio domínio?', a:'Sim. Sua página pública funciona no domínio da plataforma e também pode ser apontada para um domínio próprio.'},
              */}
              {[
                {q:'Como funcionam os pagamentos?', a:'Você pode receber por Pix ou com cartão de crédito. O status aparece no agendamento.'},
                {q:'A plataforma envia e-mails automáticos?', a:'Sim. Enviamos confirmação no agendamento e lembrete 24h antes e 3 hs antes do atendimento.'},
                {q:'Posso personalizar minha página de agendamento?', a:'Sim! Você pode personalizar, adicionar sua logo, suas informações de contato, seus horários, suas redes sociais, suas certificações e configurar suasm formas de recebimento.'},
                {q:'Como meus clientes fazem agendamentos?', a:'Seus clientes acessam sua página pública personalizada, escolhem o serviço, data e horário disponível, preenchem os dados e confirmam o agendamento.'},
                {q:'Posso gerenciar múltiplos serviços?', a:'Sim. Você pode cadastrar quantos serviços quiser, definir durações diferentes, preços e disponibilidades específicas para cada um.'},
                {q:'A plataforma funciona no celular?', a:'Perfeitamente! Tanto o painel administrativo quanto a página de agendamentos são totalmente responsivos e otimizados para mobile.'},
                {q:'Como cancelo ou remarco agendamentos?', a:'Você pode cancelar ou remarcar agendamentos diretamente no painel de forma fácil e intuitiva.'},
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
            <p className="mt-2 text-gray-600 dark:text-gray-300">Tem dúvidas sobre planos ou recursos? Estamos aqui para ajudar.</p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <a href="mailto:contato@agendiia.com.br" className="px-5 py-3 rounded-lg bg-theme text-white font-semibold hover:opacity-90">Enviar e-mail</a>
              <a href="https://wa.me/5551981304994" target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-lg bg-emerald-500 text-white font-semibold hover:opacity-90">WhatsApp</a>
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

        {/* WhatsApp Floating Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <a
            href="https://wa.me/5551981066051?text=Olá! Gostaria de saber mais informações sobre o Agendiia."
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-float flex items-center justify-center w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg transition-all duration-300 group"
            aria-label="Conversar no WhatsApp"
          >
            <svg 
              className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
          </a>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
