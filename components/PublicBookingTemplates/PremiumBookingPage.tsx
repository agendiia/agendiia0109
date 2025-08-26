import React, { useState } from 'react';
import { Calendar, Clock, User, Mail, Phone, Heart, Star, Shield, Award, ChevronRight, MapPin, CheckCircle2 } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  category: string;
}

const PremiumBookingPage: React.FC = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showBookingForm, setShowBookingForm] = useState(false);

  const services: Service[] = [
    {
      id: '1',
      name: 'Consulta Psicológica Individual',
      duration: 50,
      price: 180,
      description: 'Atendimento personalizado com abordagem cognitivo-comportamental',
      category: 'Individual'
    },
    {
      id: '2',
      name: 'Terapia de Casal',
      duration: 90,
      price: 280,
      description: 'Sessão especializada para relacionamentos e conflitos conjugais',
      category: 'Casal'
    },
    {
      id: '3',
      name: 'Avaliação Neuropsicológica',
      duration: 120,
      price: 350,
      description: 'Avaliação completa das funções cognitivas e neurológicas',
      category: 'Avaliação'
    },
    {
      id: '4',
      name: 'Terapia Familiar',
      duration: 90,
      price: 320,
      description: 'Atendimento sistêmico para dinâmicas familiares',
      category: 'Família'
    }
  ];

  const timeSlots = [
    { time: '08:00', available: true },
    { time: '09:00', available: true },
    { time: '10:00', available: false },
    { time: '11:00', available: true },
    { time: '13:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: false },
    { time: '16:00', available: true },
    { time: '17:00', available: true },
    { time: '18:00', available: true }
  ];

  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    notes: ''
  });

  const generateCalendarDays = () => {
    const today = new Date();
    const days = [];
    
    for (let i = 0; i < 21; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) { // Excluir domingos
        days.push(date);
      }
    }
    
    return days;
  };

  const handleBooking = () => {
    console.log('Premium Booking:', { selectedService, selectedDate, selectedTime, clientInfo });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="text-center text-white">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <Heart className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-4">Dra. Marina Costa</h1>
            <p className="text-xl text-purple-200 mb-2">Psicóloga Clínica & Neuropsicóloga</p>
            <p className="text-lg text-purple-300 mb-8">CRP 06/123456 | 15 anos de experiência</p>
            
            <div className="flex justify-center space-x-8 mb-8">
              <div className="flex items-center text-purple-200">
                <Shield className="w-5 h-5 mr-2" />
                <span>Especialista Certificada</span>
              </div>
              <div className="flex items-center text-purple-200">
                <Award className="w-5 h-5 mr-2" />
                <span>+500 Atendimentos</span>
              </div>
              <div className="flex items-center text-purple-200">
                <Star className="w-5 h-5 mr-2" />
                <span>4.9/5 Avaliação</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Services Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Escolha seu Atendimento
              </h2>
              
              <div className="grid gap-6">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`group relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                      selectedService?.id === service.id
                        ? 'border-purple-500 bg-purple-50 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mr-3">
                            {service.category}
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                        <p className="text-gray-600 mb-4">{service.description}</p>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {service.duration} minutos
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right ml-6">
                        <div className="text-3xl font-bold text-purple-600 mb-1">
                          R$ {service.price}
                        </div>
                        <div className="text-sm text-gray-500">por sessão</div>
                        
                        {selectedService?.id === service.id && (
                          <div className="mt-4">
                            <CheckCircle2 className="w-8 h-8 text-purple-500 mx-auto" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedService && !showBookingForm && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setShowBookingForm(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center mx-auto"
                  >
                    Agendar Agora
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </button>
                </div>
              )}
            </div>

            {/* Booking Form */}
            {showBookingForm && selectedService && (
              <div className="mt-8 bg-white rounded-3xl shadow-2xl p-8">
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
                        className={`p-3 rounded-xl text-center transition-all duration-200 ${
                          selectedDate?.toDateString() === date.toDateString()
                            ? 'bg-purple-600 text-white shadow-lg scale-105'
                            : 'bg-gray-50 hover:bg-purple-50 text-gray-900 hover:text-purple-700'
                        }`}
                      >
                        <div className="text-xs font-medium mb-1">
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
                    <div className="grid grid-cols-5 gap-3">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={`p-3 rounded-xl text-center transition-all duration-200 ${
                            selectedTime === slot.time
                              ? 'bg-purple-600 text-white shadow-lg scale-105'
                              : slot.available
                              ? 'bg-gray-50 hover:bg-purple-50 text-gray-900 hover:text-purple-700'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client Info Form */}
                {selectedDate && selectedTime && (
                  <div className="space-y-6">
                    <h4 className="text-lg font-semibold text-gray-900">Seus Dados</h4>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nome Completo *
                        </label>
                        <input
                          type="text"
                          value={clientInfo.name}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Seu nome completo"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Idade
                        </label>
                        <input
                          type="number"
                          value={clientInfo.age}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, age: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Sua idade"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={clientInfo.email}
                          onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="seu@email.com"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo da consulta / Observações
                      </label>
                      <textarea
                        value={clientInfo.notes}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, notes: e.target.value }))}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Descreva brevemente o que te traz aqui ou observações importantes..."
                      />
                    </div>

                    {clientInfo.name && clientInfo.email && clientInfo.phone && (
                      <button
                        onClick={handleBooking}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-6 h-6 mr-3" />
                        Confirmar Agendamento
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            
            {/* Professional Info */}
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Sobre a Profissional</h3>
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Especialista em Terapia Cognitivo-Comportamental com mestrado em Neuropsicologia. 
                  Experiência em atendimento clínico, avaliação neuropsicológica e terapia de casais.
                </p>
                
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Formação</h4>
                  <ul className="space-y-1">
                    <li>• Psicologia - USP</li>
                    <li>• Mestrado em Neuropsicologia</li>
                    <li>• Especialização em TCC</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-purple-600" />
                Localização
              </h3>
              <div className="text-sm text-gray-600">
                <p className="mb-2">Rua das Flores, 123 - Sala 45</p>
                <p className="mb-2">Vila Madalena - São Paulo/SP</p>
                <p className="text-purple-600 font-medium">Próximo ao metrô Faria Lima</p>
              </div>
            </div>

            {/* Testimonials */}
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Depoimentos</h3>
              <div className="space-y-4">
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 italic">
                    "Excelente profissional, muito empática e competente. Recomendo!"
                  </p>
                  <p className="text-xs text-gray-500 mt-2">- Ana M.</p>
                </div>
                
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 italic">
                    "Ambiente acolhedor e atendimento de qualidade. Muito satisfeito!"
                  </p>
                  <p className="text-xs text-gray-500 mt-2">- João P.</p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-3xl shadow-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Contato</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-3 text-purple-600" />
                  <span>(11) 99999-9999</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-3 text-purple-600" />
                  <span>contato@dramarina.com.br</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumBookingPage;
