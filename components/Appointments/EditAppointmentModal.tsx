import React, { useState, useEffect } from 'react';

// Interfaces (ajuste conforme seu modelo de dados)
interface Appointment {
  id: string;
  clientName: string;
  service: string;
  dateTime: string; // Formato ISO: "2025-08-27T17:00"
  status: 'Agendado' | 'Confirmado' | 'Cancelado' | 'Concluído';
}
interface Client { id: string; name: string; }
interface Service { id: string; name: string; }

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onSave: (updatedData: Partial<Appointment>) => void;
  clients: Client[]; // Você precisará passar a lista de clientes
  services: Service[]; // E a lista de serviços
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onSave,
  clients,
  services
}) => {
  const [clientName, setClientName] = useState('');
  const [service, setService] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [status, setStatus] = useState<'Agendado' | 'Confirmado' | 'Cancelado' | 'Concluído'>('Agendado');

  useEffect(() => {
    if (appointment) {
      setClientName(appointment.clientName);
      setService(appointment.service);
      setDateTime(appointment.dateTime ? appointment.dateTime.slice(0, 16) : '');
      setStatus(appointment.status);
    }
  }, [appointment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: appointment.id, clientName, service, dateTime, status });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container compact-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Editar Agendamento</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body compact-modal-body">
            <div className="compact-form-group">
              <label className="compact-label" htmlFor="clientName">Nome do Cliente</label>
              <select id="clientName" className="compact-select" value={clientName} onChange={(e) => setClientName(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="compact-form-group">
              <label className="compact-label" htmlFor="service">Serviço</label>
              <select id="service" className="compact-select" value={service} onChange={(e) => setService(e.target.value)}>
                {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div className="compact-form-group">
              <label className="compact-label" htmlFor="dateTime">Data e Hora</label>
              <input type="datetime-local" id="dateTime" className="compact-input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
            </div>

            <div className="compact-form-group">
              <label className="compact-label" htmlFor="status">Status</label>
              <select id="status" className="compact-select" value={status} onChange={(e) => setStatus(e.target.value as Appointment['status'])}>
                <option>Agendado</option>
                <option>Confirmado</option>
                <option>Concluído</option>
                <option>Cancelado</option>
              </select>
            </div>
          </div>

          <div className="modal-footer compact-footer">
            <button type="button" className="modal-button compact-button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="modal-button compact-button-primary">
              Salvar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const handleEditClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsEditModalOpen(true);
  };

  const handleSaveAppointment = (updatedAppointment: Appointment) => {
    // Lógica para salvar o agendamento atualizado
    console.log('Agendamento atualizado:', updatedAppointment);
  };

  return (
    <div>
      {/* Seu código existente para listar agendamentos */}

      {selectedAppointment && (
        <EditAppointmentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          appointment={selectedAppointment}
          onSave={handleSaveAppointment}
          clients={[{ id: '1', name: 'Cliente 1' }, { id: '2', name: 'Cliente 2' }]}
          services={[{ id: '1', name: 'Corte' }, { id: '2', name: 'Barba' }]}
        />
      )}
    </div>
  );
};

export default App;