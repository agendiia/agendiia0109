import React, { useState, useMemo } from 'react';
import { Task, TaskPriority, TaskSource, Client, Appointment, ClientCategory, AppointmentStatus } from '../types';
import { generateTaskSuggestions } from '../services/geminiService';
import { Plus, Sparkles, Loader, Trash, Flag, CheckSquare, Tag, Calendar } from './Icons';

// Mock data to be passed to the AI
const mockClients: Client[] = [
  { id: '1', name: 'Ana Clara', email: 'ana.clara@example.com', phone: '(11) 99999-0001', avatarUrl: 'https://picsum.photos/seed/anna/100', category: ClientCategory.VIP, totalSpent: 3240, avgTicket: 180, totalAppointments: 18, lastVisit: new Date(2024, 6, 27) },
  { id: '3', name: 'Carla Dias', email: 'carla.dias@example.com', phone: '(31) 97777-0003', avatarUrl: 'https://picsum.photos/seed/carla/100', category: ClientCategory.AtRisk, totalSpent: 1500, avgTicket: 150, totalAppointments: 10, lastVisit: new Date(2024, 4, 10) },
];
const mockAppointments: Appointment[] = [
  { id: '1', clientName: 'Ana Clara', service: 'Sessão de Terapia', dateTime: new Date(new Date().setDate(new Date().getDate() + 1)), duration: 50, status: AppointmentStatus.Confirmed, modality: 'Online', price: 180 },
  { id: '2', clientName: 'Bruno Costa', service: 'Consulta de Fisioterapia', dateTime: new Date(new Date().setDate(new Date().getDate() + 2)), duration: 60, status: AppointmentStatus.Scheduled, modality: 'Presencial', price: 220 },
];

// Initial tasks for demonstration
const initialTasks: Task[] = [
    { id: '1', title: 'Confirmar agendamento de Bruno Costa', isCompleted: false, priority: TaskPriority.High, source: TaskSource.IA, dueDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
    { id: '2', title: 'Preparar material para a consulta de Ana Clara', isCompleted: false, priority: TaskPriority.Medium, source: TaskSource.Manual },
    { id: '3', title: 'Enviar e-mail de feliz aniversário para um cliente VIP', isCompleted: true, priority: TaskPriority.Low, source: TaskSource.Manual },
    { id: '4', title: 'Fazer post sobre "Dicas de Saúde Mental"', isCompleted: false, priority: TaskPriority.Low, source: TaskSource.Manual },
];

const priorityStyles = {
    [TaskPriority.High]: { icon: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    [TaskPriority.Medium]: { icon: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    [TaskPriority.Low]: { icon: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
};

const sourceStyles = {
    [TaskSource.Manual]: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
    [TaskSource.IA]: 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
};


const ActionCenter: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState('');

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        const newTask: Task = {
            id: String(Date.now()),
            title: newTaskTitle,
            isCompleted: false,
            priority: TaskPriority.Medium,
            source: TaskSource.Manual,
        };
        setTasks([newTask, ...tasks]);
        setNewTaskTitle('');
    };

    const handleToggleTask = (id: string) => {
        setTasks(tasks.map(task => task.id === id ? { ...task, isCompleted: !task.isCompleted } : task));
    };

    const handleDeleteTask = (id: string) => {
        setTasks(tasks.filter(task => task.id !== id));
    };
    
    const handleGenerateSuggestions = async () => {
        setIsLoadingAI(true);
        setAiError('');
        try {
            const resultString = await generateTaskSuggestions(mockClients, mockAppointments);
            if (resultString && resultString.trim().startsWith('{')) {
                const result = JSON.parse(resultString);
                if (result.tasks && Array.isArray(result.tasks)) {
                    const newAiTasks: Task[] = result.tasks.map((t: any) => ({
                        id: `ai_${Date.now()}_${Math.random()}`,
                        title: t.title,
                        priority: t.priority || TaskPriority.Medium,
                        isCompleted: false,
                        source: TaskSource.IA,
                        dueDate: t.dueDate ? new Date(t.dueDate) : undefined
                    }));

                    // Avoid adding duplicate titles
                    const existingTitles = new Set(tasks.map(t => t.title));
                    const uniqueNewTasks = newAiTasks.filter(t => !existingTitles.has(t.title));

                    setTasks(prev => [...uniqueNewTasks, ...prev]);
                } else {
                    setAiError("A IA retornou um formato de dados inesperado.");
                }
            } else {
                 setAiError(resultString || "A IA retornou uma resposta vazia ou inválida.");
            }
        } catch(e) {
            console.error("Failed to parse AI suggestions:", e);
            setAiError("A IA retornou uma resposta inesperada ou mal formatada. Por favor, tente novamente.");
        }
        setIsLoadingAI(false);
    };

    const { todoTasks, completedTasks } = useMemo(() => {
        return tasks.reduce((acc, task) => {
            if (task.isCompleted) {
                acc.completedTasks.push(task);
            } else {
                acc.todoTasks.push(task);
            }
            return acc;
        }, { todoTasks: [] as Task[], completedTasks: [] as Task[] });
    }, [tasks]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center">
                    <CheckSquare className="h-8 w-8 mr-3 text-indigo-500"/>
                    Central de Ações Inteligentes
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                    Organize seu dia, adicione tarefas ou deixe que a nossa IA sugira os próximos passos para o seu negócio.
                </p>
            </header>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 mb-4">
                    <input
                        type="text"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Adicionar uma nova tarefa..."
                        className="flex-grow p-2.5 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button type="submit" className="bg-gray-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors flex items-center justify-center space-x-2">
                        <Plus className="h-5 w-5"/>
                        <span>Adicionar</span>
                    </button>
                </form>
                
                 <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                     <button onClick={handleGenerateSuggestions} disabled={isLoadingAI} className="w-full bg-indigo-600 text-white font-semibold py-3 px-5 rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:bg-indigo-400 disabled:cursor-not-allowed">
                        {isLoadingAI ? (<><Loader className="h-5 w-5 animate-spin" /><span>Analisando e gerando sugestões...</span></>) : (<><Sparkles className="h-5 w-5" /><span>Gerar Sugestões com IA</span></>)}
                    </button>
                    {aiError && <p className="text-red-500 text-sm text-center mt-2">{aiError}</p>}
                </div>
            </div>

            <TaskList title="Tarefas a Fazer" tasks={todoTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
            {completedTasks.length > 0 && <TaskList title="Concluídas" tasks={completedTasks} onToggle={handleToggleTask} onDelete={handleDeleteTask} />}

        </div>
    );
};

const TaskList: React.FC<{title: string, tasks: Task[], onToggle: (id: string) => void, onDelete: (id: string) => void}> = ({ title, tasks, onToggle, onDelete }) => (
    <div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">{title} ({tasks.length})</h2>
        {tasks.length > 0 ? (
            <ul className="space-y-3">
                {tasks.map(task => (
                    <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
                ))}
            </ul>
        ) : (
             <div className="text-center py-8 px-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <p className="text-gray-500 dark:text-gray-400">
                    {title === "Concluídas" ? "Nenhuma tarefa concluída ainda." : "Você está em dia! Nenhuma tarefa pendente."}
                </p>
            </div>
        )}
    </div>
);

const TaskItem: React.FC<{task: Task, onToggle: (id: string) => void, onDelete: (id: string) => void}> = ({ task, onToggle, onDelete }) => {
    return (
        <li className={`flex items-center p-4 rounded-lg shadow-sm transition-all duration-300 ${priorityStyles[task.priority].bg} ${task.isCompleted ? 'opacity-60' : ''}`}>
            <input
                type="checkbox"
                checked={task.isCompleted}
                onChange={() => onToggle(task.id)}
                className="h-5 w-5 rounded-full border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                aria-label={`Marcar como ${task.isCompleted ? 'não concluída' : 'concluída'}`}
            />
            <div className="ml-4 flex-grow">
                <p className={`text-gray-800 dark:text-gray-100 ${task.isCompleted ? 'line-through' : ''}`}>{task.title}</p>
                <div className="flex items-center space-x-3 text-xs mt-1">
                    <span className="flex items-center font-semibold text-gray-500 dark:text-gray-400">
                        <Flag className={`h-3 w-3 mr-1.5 ${priorityStyles[task.priority].icon}`} />
                        {task.priority}
                    </span>
                    <span className={`px-2 py-0.5 font-semibold rounded-full ${sourceStyles[task.source]}`}>
                        <Tag className="h-3 w-3 mr-1 inline"/> {task.source}
                    </span>
                    {task.dueDate && (
                        <span className="flex items-center text-gray-500 dark:text-gray-400">
                           <Calendar className="h-3 w-3 mr-1" /> {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                    )}
                </div>
            </div>
            <button onClick={() => onDelete(task.id)} className="ml-4 p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400 transition-colors" aria-label="Excluir tarefa">
                <Trash className="h-4 w-4"/>
            </button>
        </li>
    )
}


export default ActionCenter;