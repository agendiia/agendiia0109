import React, { useState } from 'react';
import MinimalBookingPage from './MinimalBookingPage';
import PremiumBookingPage from './PremiumBookingPage';
import CorporateBookingPage from './CorporateBookingPage';
import CreativeBookingPage from './CreativeBookingPage';
import { Eye, Palette, Briefcase, Sparkles, Minimize2 } from 'lucide-react';

const BookingTemplateShowcase: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templates = [
    {
      id: 'minimal',
      name: 'Minimal & Clean',
      description: 'Design minimalista e elegante com foco na funcionalidade',
      color: 'bg-gradient-to-br from-blue-50 to-indigo-100',
      icon: Minimize2,
      component: MinimalBookingPage,
      features: [
        'Interface limpa e intuitiva',
        'Processo step-by-step',
        'Design responsivo',
        'Foco na conversão'
      ]
    },
    {
      id: 'premium',
      name: 'Premium Luxury',
      description: 'Design sofisticado para profissionais premium',
      color: 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900',
      icon: Palette,
      component: PremiumBookingPage,
      features: [
        'Visual impactante',
        'Gradientes modernos',
        'Depoimentos integrados',
        'Informações detalhadas'
      ]
    },
    {
      id: 'corporate',
      name: 'Corporate Business',
      description: 'Ideal para consultoria empresarial e B2B',
      color: 'bg-gray-50',
      icon: Briefcase,
      component: CorporateBookingPage,
      features: [
        'Profissional e confiável',
        'Formulários empresariais',
        'Casos de sucesso',
        'Credibilidade'
      ]
    },
    {
      id: 'creative',
      name: 'Creative & Friendly',
      description: 'Design jovem e criativo com personalidade única',
      color: 'bg-gradient-to-br from-purple-100 via-pink-50 to-yellow-100',
      icon: Sparkles,
      component: CreativeBookingPage,
      features: [
        'Visual criativo e único',
        'Emojis e personalidade',
        'Inclusivo e acolhedor',
        'Experiência divertida'
      ]
    }
  ];

  if (selectedTemplate) {
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      const TemplateComponent = template.component;
      return (
        <div className="relative">
          <div className="fixed top-4 left-4 z-50">
            <button
              onClick={() => setSelectedTemplate(null)}
              className="bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 transition-colors"
            >
              ← Voltar aos Templates
            </button>
          </div>
          <TemplateComponent />
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Templates de Agendamento
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Modelos elegantes, modernos e intuitivos para páginas públicas de agendamento. 
            Cada template foi criado com foco na experiência do usuário e conversão.
          </p>
        </div>

        {/* Templates Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {templates.map((template) => {
            const IconComponent = template.icon;
            return (
              <div
                key={template.id}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                {/* Template Preview */}
                <div className={`h-80 ${template.color} flex items-center justify-center relative`}>
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative text-center z-10">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{template.name}</h3>
                    <p className="text-white/80 px-4">{template.description}</p>
                  </div>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button
                      onClick={() => setSelectedTemplate(template.id)}
                      className="bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center space-x-2"
                    >
                      <Eye className="w-5 h-5" />
                      <span>Ver Template</span>
                    </button>
                  </div>
                </div>

                {/* Template Info */}
                <div className="bg-white p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Características</h4>
                  <ul className="space-y-2">
                    {template.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => setSelectedTemplate(template.id)}
                    className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Visualizar Template
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Features Comparison */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Comparação de Recursos
          </h2>
          
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-6 font-semibold text-gray-900">Recurso</th>
                    <th className="text-center p-6 font-semibold text-gray-900">Minimal</th>
                    <th className="text-center p-6 font-semibold text-gray-900">Premium</th>
                    <th className="text-center p-6 font-semibold text-gray-900">Corporate</th>
                    <th className="text-center p-6 font-semibold text-gray-900">Creative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="p-6 font-medium text-gray-900">Design Responsivo</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-6 font-medium text-gray-900">Processo Step-by-step</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-gray-900">Depoimentos</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-6 font-medium text-gray-900">Formulário Empresarial</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-gray-900">Visual Criativo</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-6 font-medium text-gray-900">Redes Sociais</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-gray-400">—</td>
                    <td className="p-6 text-center text-green-600">✓</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Usage Recommendations */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Quando Usar Cada Template
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <Minimize2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Minimal</h3>
              <p className="text-sm text-gray-600">
                Profissionais que valorizam simplicidade e foco na conversão
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <Palette className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium</h3>
              <p className="text-sm text-gray-600">
                Profissionais de alto padrão que querem transmitir exclusividade
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Corporate</h3>
              <p className="text-sm text-gray-600">
                Consultores empresariais e atendimento B2B
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <Sparkles className="w-12 h-12 text-pink-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Creative</h3>
              <p className="text-sm text-gray-600">
                Profissionais jovens que querem personalidade única
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingTemplateShowcase;
