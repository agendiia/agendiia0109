import React from 'react';

const ReservationForm: React.FC = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="w-full">
        <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
          <div className="flex items-start space-x-2">
            <input type="radio" id="temporary" name="reservationType" value="temporary" className="mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <label htmlFor="temporary" className="text-sm font-medium text-gray-900">Reserva Temporária</label>
              <p className="text-sm text-gray-600 mt-1">O horário fica reservado temporariamente enquanto aguarda o pagamento. Se não for pago, o horário é liberado.</p>
              <div className="mt-3 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Duração (min):</span>
                  <input type="number" min={5} max={180} defaultValue={30} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export default ReservationForm;