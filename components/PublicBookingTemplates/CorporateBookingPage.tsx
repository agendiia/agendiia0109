import React, { useState } from 'react';
import { Calendar, Clock, User, Mail, Phone, Briefcase, GraduationCap, Award, MapPin, Star, ChevronDown, ChevronUp, Play } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  benefits: string[];
}

const CorporateBookingPage: React.FC = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  const services: Service[] = [
    {
      id: '1',
      name: 'Consultoria Empresarial',
      duration: 120,
      price: 500,
      description: 'Análise organizacional e desenvolvimento de estratégias de gestão de pessoas',
      benefits: [
        'Diagnóstico completo do clima organizacional',
        'Relatório detalhado com recomendações',
        'Plano de ação personalizado',
        'Acompanhamento por 30 dias'
      ]
    },
    {
      id: '2',
      name: 'Treinamento em Liderança',
      duration: 180,
      price: 800,
      description: 'Workshop intensivo para desenvolvimento de competências de liderança',
      benefits: [
        'Técnicas avançadas de comunicação',
        'Gestão de conflitos e negociação',
        'Material didático exclusivo',
        'Certificado de participação'
      ]
    },
    {
      id: '3',
      name: 'Avaliação Psicológica Ocupacional',
      duration: 90,
      price: 300,
      description: 'Avaliação especializada para processos seletivos e promoções',
      benefits: [
        'Testes psicológicos validados',
        'Entrevista comportamental estruturada',
        'Relatório técnico detalhado',
        'Feedback personalizado'
      ]
    },
    {
      id: '4',
      name: 'Programa Wellness Corporativo',
      duration: 240,
      price: 1200,
      description: 'Programa completo de bem-estar e saúde mental para equipes',
      benefits: [
        'Workshop sobre stress e burnout',
        'Técnicas de mindfulness corporativo',
        'Kit de ferramentas para gestores',
        'Plano de implementação contínua'
      ]
    }
  ];

  const timeSlots = [
    { time: '08:00', available: true },
    { time: '09:00', available: true },
    { time: '10:00', available: false },
    { time: '13:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: true },
    { time: '16:00', available: false }
  ];

  const [clientInfo, setClientInfo] = useState({
    companyName: '',
    contactName: '',
    position: '',
    email: '',
    phone: '',
    teamSize: '',
    objectives: ''
  });

  const generateCalendarDays = () => {
    const today = new Date();
    const days = [];
    
    for (let i = 1; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0 && date.getDay() !== 6) { // Apenas dias úteis
        days.push(date);
      }
    }
    
    return days;
  };

  const handleBooking = () => {
    console.log('Corporate Booking:', { selectedService, selectedDate, selectedTime, clientInfo });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dr. Carlos Mendes</h1>
                <p className="text-gray-600">Psicólogo Organizacional | Consultor Empresarial</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center">
                <GraduationCap className="w-4 h-4 mr-2" />
                PhD em Psicologia Organizacional
              </div>
              <div className="flex items-center">
                <Award className="w-4 h-4 mr-2" />
                +200 Empresas Atendidas
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Transforme sua Organização
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Soluções especializadas em psicologia organizacional para empresas que buscam 
            excelência em gestão de pessoas e desenvolvimento humano.
          </p>
          
          <div className="flex justify-center space-x-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">15+</div>
              <div className="text-gray-600">Anos de Experiência</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">200+</div>
              <div className="text-gray-600">Empresas Atendidas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">98%</div>
              <div className="text-gray-600">Satisfação Cliente</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          
          {/* Services */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold text-gray-900 mb-8">Nossos Serviços</h3>
            
            <div className="space-y-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`bg-white rounded-lg border-2 transition-all duration-300 ${
                    selectedService?.id === service.id
                      ? 'border-blue-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    onClick={() => setSelectedService(service)}
                    className="p-6 cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h4>
                        <p className="text-gray-600 mb-4">{service.description}</p>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {service.duration} minutos
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedService(
                                expandedService === service.id ? null : service.id
                              );
                            }}
                            className="flex items-center text-blue-600 hover:text-blue-700"
                          >
                            Ver benefícios
                            {expandedService === service.id ? (
                              <ChevronUp className="w-4 h-4 ml-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 ml-1" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-right ml-6">
                        <div className="text-2xl font-bold text-blue-600">
                          R$ {service.price.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">por sessão</div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Benefits */}
                  {expandedService === service.id && (
                    <div className="px-6 pb-6 border-t border-gray-100">
                      <h5 className="font-semibold text-gray-900 mb-3 mt-4">O que está incluído:</h5>
                      <ul className="space-y-2">
                        {service.benefits.map((benefit, index) => (
                          <li key={index} className="flex items-start text-sm text-gray-600">
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedService?.id === service.id && !showForm && (
                    <div className="px-6 pb-6 border-t border-gray-100">
                      <button
                        onClick={() => setShowForm(true)}
                        className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Agendar Consulta
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Booking Form */}
            {showForm && selectedService && (
              <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Agendamento - {selectedService.name}
                </h3>

                {/* Calendar */}
                <div className="mb-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Escolha uma Data</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {generateCalendarDays().slice(0, 14).map((date, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedDate(date)}
                        className={`p-3 rounded-lg text-center transition-colors ${
                          selectedDate?.toDateString() === date.toDateString()
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="text-xs font-medium">
                          {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                        </div>
                        <div className="text-lg font-bold">{date.getDate()}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Horários Disponíveis</h4>
                    <div className="grid grid-cols-4 gap-3">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={`p-3 rounded-lg text-center transition-colors ${
                            selectedTime === slot.time
                              ? 'bg-blue-600 text-white'
                              : slot.available
                              ? 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Company Info Form */}
                {selectedDate && selectedTime && (
                  <div className="space-y-6">
                    <h4 className="text-lg font-semibold text-gray-900">Informações da Empresa</h4>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nome da Empresa *
                        </label>
                        <input
                          type="text"
                          value={clientInfo.companyName}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, companyName: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Nome da sua empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tamanho da Equipe
                        </label>
                        <select
                          value={clientInfo.teamSize}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, teamSize: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Selecione</option>
                          <option value="1-10">1-10 funcionários</option>
                          <option value="11-50">11-50 funcionários</option>
                          <option value="51-200">51-200 funcionários</option>
                          <option value="200+">Mais de 200 funcionários</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nome do Contato *
                        </label>
                        <input
                          type="text"
                          value={clientInfo.contactName}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, contactName: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Seu nome completo"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Cargo/Função *
                        </label>
                        <input
                          type="text"
                          value={clientInfo.position}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, position: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Seu cargo na empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Corporativo *
                        </label>
                        <input
                          type="email"
                          value={clientInfo.email}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="email@empresa.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Telefone *
                        </label>
                        <input
                          type="tel"
                          value={clientInfo.phone}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Objetivos e Expectativas
                      </label>
                      <textarea
                        value={clientInfo.objectives}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, objectives: e.target.value }))}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Descreva os principais desafios da sua empresa e o que espera alcançar com nossa consultoria..."
                      />
                    </div>

                    {clientInfo.companyName && clientInfo.contactName && clientInfo.email && clientInfo.phone && (
                      <button
                        onClick={handleBooking}
                        className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
                      >
                        Solicitar Agendamento
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            
            {/* Professional Profile */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Dr. Carlos Mendes</h3>
                <p className="text-gray-600">CRP 06/98765</p>
              </div>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Especialidades</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Psicologia Organizacional</li>
                    <li>• Desenvolvimento de Liderança</li>
                    <li>• Gestão de Mudanças</li>
                    <li>• Clima Organizacional</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Formação</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• PhD em Psicologia - USP</li>
                    <li>• MBA em Gestão Empresarial</li>
                    <li>• Certificação em Coaching</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Client Logos */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Empresas que Confiam</h3>
              <div className="grid grid-cols-2 gap-4 text-center text-sm text-gray-600">
                <div className="p-3 bg-gray-50 rounded">Empresa A</div>
                <div className="p-3 bg-gray-50 rounded">Empresa B</div>
                <div className="p-3 bg-gray-50 rounded">Empresa C</div>
                <div className="p-3 bg-gray-50 rounded">Empresa D</div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Contato</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-3 text-blue-600" />
                  <div>
                    <p>Av. Paulista, 1000 - Conj. 1501</p>
                    <p>Bela Vista - São Paulo/SP</p>
                  </div>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-3 text-blue-600" />
                  <span>(11) 3000-0000</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-3 text-blue-600" />
                  <span>contato@carlosmendes.com.br</span>
                </div>
              </div>
            </div>

            {/* Testimonial */}
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-center mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-sm text-gray-700 italic mb-3">
                "A consultoria do Dr. Carlos transformou nossa empresa. Metodologia excepcional e resultados mensuráveis."
              </p>
              <p className="text-xs text-gray-600">
                — Maria Silva, RH Manager, TechCorp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorporateBookingPage;
