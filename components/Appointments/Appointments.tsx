import React, { useState, useEffect } from 'react';
import EditAppointmentModal from './EditAppointmentModal'; // <-- Garante que está importando o modal correto

// --- Interfaces (ajuste se os nomes dos seus campos forem diferentes) ---
interface Appointment {
  id: string;
  clientName: string;
  service: string;
  dateTime: string; // Formato ISO: "2025-08-27T17:00"
  status: 'Agendado' | 'Confirmado' | 'Cancelado' | 'Concluído';
}
interface Client { id: string; name: string; }
interface Service { id:string; name: string; }

const AppointmentsPage: React.FC = () => {
  // --- Estados para controlar o modal e os dados ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // --- Dados de Exemplo (substitua pelo carregamento do seu Firebase) ---
  const [clients, setClients] = useState<Client[]>([
    { id: 'client1', name: 'Bruno Costa' },
    { id: 'client2', name: 'Ana Maria' },
    { id: 'client3', name: 'Carlos Souza' }
  ]);
  const [services, setServices] = useState<Service[]>([
    { id: 'service1', name: 'Consulta de Fisioterapia' },
    { id: 'service2', name: 'Sessão de Acupuntura' },
    { id: 'service3', name: 'Avaliação Postural' }
  ]);
  const [appointments, setAppointments] = useState<Appointment[]>([
      { id: 'appt1', clientName: 'Bruno Costa', service: 'Consulta de Fisioterapia', dateTime: '2025-08-27T17:00', status: 'Agendado' }
  ]);
  
  // --- Funções para manipular o modal ---
  const handleEditClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleSaveChanges = (updatedData: Partial<Appointment>) => {
    console.log("Salvando alterações:", updatedData);
    // Lógica para atualizar o agendamento no seu banco de dados
    // Ex: updateAppointmentInFirebase(updatedData.id, updatedData);
    
    // Atualiza a lista local para refletir a mudança imediatamente
    setAppointments(prev => 
      prev.map(appt => appt.id === updatedData.id ? { ...appt, ...updatedData } : appt)
    );
    
    setIsModalOpen(false);
  };

  return (
    <div data-page="appointments" className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Agendamentos</h1>
      
      <div className="space-y-4">
        {/* Mapeia os agendamentos para exibição */}
        {appointments.map(appt => (
          <div key={appt.id} className="bg-white p-4 border rounded-lg shadow-sm flex justify-between items-center">
            <div>
              <p className="font-semibold">{appt.clientName}</p>
              <p className="text-sm text-gray-600">{appt.service}</p>
              <p className="text-sm text-gray-500">{new Date(appt.dateTime).toLocaleString('pt-BR')}</p>
            </div>
            <button 
              onClick={() => handleEditClick(appt)} 
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
            >
              Editar
            </button>
          </div>
        ))}
      </div>

      {/* --- Renderização do Modal --- */}
      {/* O modal só é renderizado quando um agendamento é selecionado */}
      {selectedAppointment && (
        <EditAppointmentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          appointment={selectedAppointment}
          onSave={handleSaveChanges}
          clients={clients}
          services={services}
        />
      )}
    </div>
  );
};

export default AppointmentsPage;