import React, { useState } from 'react';
import { Calendar, Clock, User, Mail, Phone, Heart, Palette, Sparkles, Camera, Video, Users, CheckCircle2, Instagram, Facebook, Youtube } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  color: string;
  emoji: string;
}

const CreativeBookingPage: React.FC = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'services' | 'booking'>('services');

  const services: Service[] = [
    {
      id: '1',
      name: 'Sessão Individual',
      duration: 50,
      price: 120,
      description: 'Um espaço só seu para cuidar da sua mente e coração',
      color: 'from-pink-400 to-purple-500',
      emoji: '🌸'
    },
    {
      id: '2',
      name: 'Terapia de Casal',
      duration: 80,
      price: 180,
      description: 'Reconectem-se e fortaleçam o amor que os une',
      color: 'from-red-400 to-pink-500',
      emoji: '💕'
    },
    {
      id: '3',
      name: 'Sessão Online',
      duration: 45,
      price: 100,
      description: 'Cuidado psicológico no conforto do seu lar',
      color: 'from-blue-400 to-cyan-500',
      emoji: '💻'
    },
    {
      id: '4',
      name: 'Consulta Teen',
      duration: 45,
      price: 110,
      description: 'Especializada em adolescentes e jovens adultos',
      color: 'from-green-400 to-teal-500',
      emoji: '🌱'
    }
  ];

  const timeSlots = [
    { time: '08:00', available: true, mood: 'Energia matinal ☀️' },
    { time: '09:30', available: true, mood: 'Foco total 🎯' },
    { time: '11:00', available: false, mood: 'Ocupado' },
    { time: '14:00', available: true, mood: 'Pós-almoço 🌻' },
    { time: '15:30', available: true, mood: 'Tarde produtiva ⚡' },
    { time: '17:00', available: true, mood: 'Final do dia 🌅' },
    { time: '18:30', available: false, mood: 'Ocupado' }
  ];

  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    howFoundUs: '',
    expectations: '',
    preferredPronoun: ''
  });

  const generateCalendarDays = () => {
    const today = new Date();
    const days = [];
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) { // Excluir domingos
        days.push(date);
      }
    }
    
    return days;
  };

  const getWeekdayEmoji = (date: Date) => {
    const emojis = ['🌙', '🌟', '✨', '💫', '🌈', '🌸', '🍃'];
    return emojis[date.getDay()];
  };

  const handleBooking = () => {
    console.log('Creative Booking:', { selectedService, selectedDate, selectedTime, clientInfo });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-yellow-100">
      
      {/* Floating Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl">
                🦋
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Luna Terapias
                </h1>
                <p className="text-sm text-gray-600">Psicóloga Júlia Campos | CRP 06/54321</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-pink-600" />
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Facebook className="w-4 h-4 text-blue-600" />
                </div>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <Youtube className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="inline-block mb-6">
            <div className="text-6xl mb-4">🌟</div>
            <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-4">
              Seu bem-estar em primeiro lugar
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Um espaço acolhedor e seguro para sua jornada de autoconhecimento e cuidado mental ✨
            </p>
          </div>

          <div className="flex justify-center space-x-8 text-center mb-12">
            <div className="bg-white/60 rounded-2xl p-4 backdrop-blur-sm">
              <div className="text-2xl mb-2">🏆</div>
              <div className="text-sm font-semibold text-gray-700">500+ vidas transformadas</div>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 backdrop-blur-sm">
              <div className="text-2xl mb-2">💝</div>
              <div className="text-sm font-semibold text-gray-700">Abordagem humanizada</div>
            </div>
            <div className="bg-white/60 rounded-2xl p-4 backdrop-blur-sm">
              <div className="text-2xl mb-2">🌈</div>
              <div className="text-sm font-semibold text-gray-700">Espaço LGBTQIA+ friendly</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        
        {/* Section Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white/80 backdrop-blur-md rounded-full p-2 border border-purple-200">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveSection('services')}
                className={`px-6 py-3 rounded-full font-semibold transition-all ${
                  activeSection === 'services'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'text-gray-600 hover:text-purple-600'
                }`}
              >
                ✨ Escolher Serviço
              </button>
              {selectedService && (
                <button
                  onClick={() => setActiveSection('booking')}
                  className={`px-6 py-3 rounded-full font-semibold transition-all ${
                    activeSection === 'booking'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  📅 Agendar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Services Section */}
        {activeSection === 'services' && (
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => setSelectedService(service)}
                className={`group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-500 hover:scale-105 ${
                  selectedService?.id === service.id
                    ? 'ring-4 ring-purple-300 shadow-2xl'
                    : 'hover:shadow-xl'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-90`}></div>
                <div className="relative bg-white/90 backdrop-blur-sm m-4 rounded-2xl p-8 h-64">
                  
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-3">{service.emoji}</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{service.name}</h3>
                    <p className="text-gray-600">{service.description}</p>
                  </div>

                  <div className="absolute bottom-6 left-8 right-8">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        <span className="text-sm">{service.duration} min</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        R$ {service.price}
                      </div>
                    </div>
                    
                    {selectedService?.id === service.id && (
                      <div className="mt-4 text-center">
                        <div className="inline-flex items-center text-green-600 font-semibold">
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Selecionado ✨
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Booking Section */}
        {activeSection === 'booking' && selectedService && (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-purple-200">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Vamos agendar sua {selectedService.name}? {selectedService.emoji}
              </h3>
              <p className="text-gray-600">Escolha o melhor dia e horário para você</p>
            </div>

            {/* Calendar */}
            <div className="mb-8">
              <h4 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                🗓️ Escolha uma data especial
              </h4>
              <div className="grid grid-cols-7 gap-3">
                {generateCalendarDays().map((date, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={`group relative p-4 rounded-2xl text-center transition-all duration-300 ${
                      selectedDate?.toDateString() === date.toDateString()
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl scale-110'
                        : 'bg-white/60 hover:bg-white/80 text-gray-800 hover:scale-105'
                    }`}
                  >
                    <div className="text-xs font-medium mb-1">
                      {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold">{date.getDate()}</div>
                    <div className="text-xs mt-1">{getWeekdayEmoji(date)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="mb-8">
                <h4 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                  ⏰ Qual horário combina com você?
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`group p-4 rounded-2xl text-center transition-all duration-300 ${
                        selectedTime === slot.time
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-xl scale-105'
                          : slot.available
                          ? 'bg-white/60 hover:bg-white/80 text-gray-800 hover:scale-105'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="font-bold text-lg">{slot.time}</div>
                      <div className="text-xs mt-1">{slot.mood}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Client Form */}
            {selectedDate && selectedTime && (
              <div className="bg-white/60 rounded-2xl p-8">
                <h4 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                  💫 Vamos nos conhecer melhor
                </h4>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🌟 Seu nome
                    </label>
                    <input
                      type="text"
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                      placeholder="Como posso te chamar?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📧 Email
                    </label>
                    <input
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📱 Telefone
                    </label>
                    <input
                      type="tel"
                      value={clientInfo.phone}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🎂 Idade
                    </label>
                    <input
                      type="number"
                      value={clientInfo.age}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, age: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                      placeholder="Quantos anos você tem?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🏳️‍🌈 Pronomes (opcional)
                    </label>
                    <select
                      value={clientInfo.preferredPronoun}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, preferredPronoun: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    >
                      <option value="">Prefiro não informar</option>
                      <option value="ela/dela">Ela/dela</option>
                      <option value="ele/dele">Ele/dele</option>
                      <option value="elu/delu">Elu/delu</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🔍 Como me encontrou?
                    </label>
                    <select
                      value={clientInfo.howFoundUs}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, howFoundUs: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      <option value="instagram">Instagram</option>
                      <option value="google">Google</option>
                      <option value="indicacao">Indicação</option>
                      <option value="facebook">Facebook</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💭 O que te trouxe até aqui?
                  </label>
                  <textarea
                    value={clientInfo.expectations}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, expectations: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 bg-white/80 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    placeholder="Compartilhe um pouco sobre suas expectativas e o que gostaria de trabalhar... (opcional)"
                  />
                </div>

                {clientInfo.name && clientInfo.email && clientInfo.phone && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={handleBooking}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center mx-auto"
                    >
                      <Heart className="w-6 h-6 mr-3" />
                      Confirmar meu agendamento ✨
                    </button>
                    
                    <p className="text-sm text-gray-600 mt-4">
                      Você receberá uma confirmação por email e WhatsApp 💌
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Info */}
        <div className="mt-16 text-center">
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border border-purple-200">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              🌸 Um pouco sobre mim
            </h3>
            <p className="text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Olá! Sou a Júlia, psicóloga clínica formada pela USP com especialização em terapia cognitivo-comportamental. 
              Acredito que cada pessoa tem seu próprio ritmo e forma única de florescer. Meu consultório é um espaço seguro, 
              acolhedor e livre de julgamentos, onde você pode ser autenticamente você. ✨
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="text-3xl mb-3">🎓</div>
                <h4 className="font-semibold text-gray-800 mb-2">Formação</h4>
                <p className="text-sm text-gray-600">Psicologia USP<br/>Especialização TCC</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">💖</div>
                <h4 className="font-semibold text-gray-800 mb-2">Abordagem</h4>
                <p className="text-sm text-gray-600">Humanizada e<br/>acolhedora</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">🏠</div>
                <h4 className="font-semibold text-gray-800 mb-2">Local</h4>
                <p className="text-sm text-gray-600">Vila Madalena<br/>São Paulo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreativeBookingPage;
