import React from 'react';
import { Appointment, AppointmentStatus, Service } from '../types';
import { Clock, User, DollarSign } from './Icons';

const getStatusLabel = (appt: Appointment) => {
    const now = new Date();
    const apptTime = new Date(appt.dateTime);
    // Consider check-in if appointment is Confirmed and within ±15 minutes of now
    const minutesDiff = (now.getTime() - apptTime.getTime()) / 60000;
    if (appt.status === AppointmentStatus.Confirmed && Math.abs(minutesDiff) <= 15) return 'Check‑in';
    // If appointment time passed and not finished/canceled, show 'Pendente' (payment pending) instead of 'Atrasado'
    if (apptTime.getTime() < now.getTime() && appt.status !== AppointmentStatus.Finished && appt.status !== AppointmentStatus.Canceled) return 'Pendente';
    return appt.status;
}

const UpcomingPanel: React.FC<{ appointments: Appointment[]; services?: Service[] }> = ({ appointments, services }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" /> Próximos 3
            </h3>
            <div className="mt-3 space-y-3">
                {appointments.length === 0 && <div className="text-sm text-gray-500">Sem agendamentos próximos.</div>}
                {appointments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-900/40">
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-gray-500" />
                            <div>
                                <div className="font-semibold text-sm text-gray-800 dark:text-white">{a.clientName}</div>
                                <div className="text-xs text-gray-500">{a.service} • {new Date(a.dateTime).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status === AppointmentStatus.Canceled ? 'bg-red-100 text-red-700' : a.status === AppointmentStatus.Finished ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                                {getStatusLabel(a)}
                            </div>
                            <div className="flex items-center text-sm text-gray-700 dark:text-gray-200"><DollarSign className="h-4 w-4 mr-1 text-gray-500" />R$ {Number(a.price || 0).toFixed(2)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default UpcomingPanel;
