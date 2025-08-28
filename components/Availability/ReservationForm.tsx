```tsx
import React from 'react';

const MyFormComponent = () => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // handle form submission
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="w-full max-w-full overflow-hidden">
        <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
          <div className="flex items-start space-x-2">
            <input
              type="radio"
              id="temporary"
              name="reservationType"
              value="temporary"
              className="mt-1 flex-shrink-0"
            />
            <div className="flex-1 min-w-0 max-w-full">
              <label htmlFor="temporary" className="text-sm font-medium text-gray-900">
                Reserva Temporária
              </label>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                O horário fica reservado temporariamente enquanto aguarda o pagamento. Se não for pago, o horário é liberado.
              </p>

              {/* Mobile portrait: força quebra de linha */}
              <div className="mt-3 w-full">
                <div className="flex flex-col space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-2">
                  <span className="text-sm text-gray-700 flex-shrink-0">
                    Duração da reserva (minutos):
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    defaultValue={30}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm flex-shrink-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* restante do form */}
    </form>
  );
};

export default MyFormComponent;
```