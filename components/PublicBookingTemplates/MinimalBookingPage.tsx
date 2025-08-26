import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, Phone, MapPin, Star, CheckCircle, ArrowRight } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const MinimalBookingPage: React.FC = () => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(1);

  const services: Service[] = [
    {
      id: '1',
      name: 'Consulta Inicial',
      duration: 60,
      price: 150,
      description: 'Primeira consulta para avaliação e diagnóstico'
    },
    {
      id: '2', 
      name: 'Sessão de Terapia',
      duration: 50,
      price: 120,
      description: 'Sessão individual de psicoterapia'
    },
    {
      id: '3',
      name: 'Terapia de Casal',
      duration: 90,
      price: 200,
      description: 'Sessão para casais e relacionamentos'
    }
  ];

  const timeSlots: TimeSlot[] = [
    { time: '09:00', available: true },
    { time: '10:00', available: false },
    { time: '11:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: true },
    { time: '16:00', available: false },
    { time: '17:00', available: true }
  ];

  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  const generateCalendarDays = () => {
    const today = new Date();
    const days = [];
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const handleBooking = () => {
    // Implementar lógica de agendamento
    console.log('Booking:', { selectedService, selectedDate, selectedTime, clientInfo });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Dr. Ana Silva</h1>
              <p className="text-sm text-gray-600">Psicóloga Clínica</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center space-x-8 mb-8">
          {[
            { step: 1, label: 'Serviço', icon: Star },
            { step: 2, label: 'Data & Hora', icon: Calendar },
            { step: 3, label: 'Dados', icon: User },
            { step: 4, label: 'Confirmação', icon: CheckCircle }
          ].map(({ step, label, icon: Icon }) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStep >= step 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${
                currentStep >= step ? 'text-indigo-600' : 'text-gray-500'
              }`}>
                {label}
              </span>
              {step < 4 && (
                <ArrowRight className="w-4 h-4 text-gray-300 ml-4" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Escolha o Serviço</h2>
              <div className="grid gap-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedService?.id === service.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                        <p className="text-gray-600 mt-1">{service.description}</p>
                        <div className="flex items-center space-x-4 mt-3">
                          <span className="flex items-center text-sm text-gray-500">
                            <Clock className="w-4 h-4 mr-1" />
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-indigo-600">
                          R$ {service.price}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedService && (
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Continuar
                </button>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Escolha Data e Horário</h2>
              
              {/* Calendar */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Selecione uma Data</h3>
                <div className="grid grid-cols-7 gap-2">
                  {generateCalendarDays().map((date, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(date)}
                      className={`p-3 rounded-lg text-center transition-colors ${
                        selectedDate?.toDateString() === date.toDateString()
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="text-xs font-medium">{formatDate(date).split(' ')[0]}</div>
                      <div className="text-lg font-bold">{date.getDate()}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Horários Disponíveis</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedTime(slot.time)}
                        disabled={!slot.available}
                        className={`p-3 rounded-lg text-center transition-colors ${
                          selectedTime === slot.time
                            ? 'bg-indigo-600 text-white'
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

              <div className="flex space-x-4 mt-8">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Voltar
                </button>
                {selectedDate && selectedTime && (
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700"
                  >
                    Continuar
                  </button>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Seus Dados</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={clientInfo.name}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Seu nome completo"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={clientInfo.notes}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Alguma informação adicional..."
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-8">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Voltar
                </button>
                {clientInfo.name && clientInfo.email && clientInfo.phone && (
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700"
                  >
                    Revisar
                  </button>
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Confirmar Agendamento</h2>
              
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Agendamento</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Serviço:</span>
                    <span className="font-semibold">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data:</span>
                    <span className="font-semibold">
                      {selectedDate?.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Horário:</span>
                    <span className="font-semibold">{selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duração:</span>
                    <span className="font-semibold">{selectedService?.duration} minutos</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-xl font-bold text-indigo-600">
                      R$ {selectedService?.price}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">Dados do Cliente</h4>
                <div className="text-sm text-blue-800">
                  <p><strong>Nome:</strong> {clientInfo.name}</p>
                  <p><strong>Email:</strong> {clientInfo.email}</p>
                  <p><strong>Telefone:</strong> {clientInfo.phone}</p>
                  {clientInfo.notes && <p><strong>Observações:</strong> {clientInfo.notes}</p>}
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleBooking}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Confirmar Agendamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinimalBookingPage;
