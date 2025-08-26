# 🎨 Templates de Página Pública de Agendamento

Este conjunto contém 4 modelos elegantes, modernos e intuitivos de páginas públicas de agendamento, cada um com design e funcionalidades específicas para diferentes tipos de profissionais.

## 📋 Templates Disponíveis

### 1. **Minimal & Clean** (`MinimalBookingPage.tsx`)
![Badge](https://img.shields.io/badge/Estilo-Minimalista-blue)
![Badge](https://img.shields.io/badge/Complexidade-Baixa-green)

**Ideal para:** Profissionais que valorizam simplicidade e foco na conversão

**Características:**
- ✅ Interface limpa e intuitiva
- ✅ Processo step-by-step (4 etapas)
- ✅ Design responsivo
- ✅ Cores suaves (azul/índigo)
- ✅ Foco na conversão
- ✅ Progress indicator visual

**Paleta de cores:** Gradiente azul-índigo
**Público-alvo:** Psicólogos, terapeutas, profissionais liberais

---

### 2. **Premium Luxury** (`PremiumBookingPage.tsx`)
![Badge](https://img.shields.io/badge/Estilo-Luxuoso-purple)
![Badge](https://img.shields.io/badge/Complexidade-Alta-red)

**Ideal para:** Profissionais de alto padrão que querem transmitir exclusividade

**Características:**
- ✅ Visual impactante com gradientes
- ✅ Hero section com destaques profissionais
- ✅ Sidebar com informações detalhadas
- ✅ Depoimentos integrados
- ✅ Sistema de categorização de serviços
- ✅ Localização e contato destacados

**Paleta de cores:** Gradiente roxo-rosa-azul
**Público-alvo:** Psicólogos especializados, profissionais premium

---

### 3. **Corporate Business** (`CorporateBookingPage.tsx`)
![Badge](https://img.shields.io/badge/Estilo-Corporativo-gray)
![Badge](https://img.shields.io/badge/Complexidade-Média-yellow)

**Ideal para:** Consultoria empresarial e atendimento B2B

**Características:**
- ✅ Design profissional e confiável
- ✅ Formulários específicos para empresas
- ✅ Informações corporativas (tamanho da equipe, etc.)
- ✅ Seção de cases e credenciais
- ✅ Foco em dias úteis
- ✅ Preços empresariais

**Paleta de cores:** Cinza e azul corporativo
**Público-alvo:** Consultores empresariais, psicólogos organizacionais

---

### 4. **Creative & Friendly** (`CreativeBookingPage.tsx`)
![Badge](https://img.shields.io/badge/Estilo-Criativo-pink)
![Badge](https://img.shields.io/badge/Complexidade-Média-yellow)

**Ideal para:** Profissionais jovens que querem personalidade única

**Características:**
- ✅ Visual criativo com emojis
- ✅ Header fixo com redes sociais
- ✅ Design inclusivo (pronomes, LGBTQIA+ friendly)
- ✅ Experiência divertida e acolhedora
- ✅ Toggle entre seções
- ✅ Cores vibrantes e gradientes

**Paleta de cores:** Gradiente roxo-rosa-amarelo
**Público-alvo:** Psicólogos jovens, terapeutas alternativos

## 🚀 Como Usar

### Método 1: Showcase Completo
```jsx
import BookingTemplateShowcase from './components/PublicBookingTemplates';

function App() {
  return <BookingTemplateShowcase />;
}
```

### Método 2: Template Individual
```jsx
import MinimalBookingPage from './components/PublicBookingTemplates/MinimalBookingPage';

function App() {
  return <MinimalBookingPage />;
}
```

## 🛠️ Estrutura dos Templates

Todos os templates seguem a mesma estrutura básica:

```typescript
interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  // ... propriedades específicas
}

interface ClientInfo {
  name: string;
  email: string;
  phone: string;
  // ... campos específicos do template
}
```

## 📱 Responsividade

Todos os templates são totalmente responsivos e funcionam perfeitamente em:
- 📱 Mobile (320px+)
- 📟 Tablet (768px+)  
- 💻 Desktop (1024px+)
- 🖥️ Large screens (1440px+)

## 🎨 Customização

### Cores
Cada template pode ser facilmente customizado alterando as classes do Tailwind CSS:

```jsx
// Exemplo: mudar cor principal do Minimal
className="bg-blue-600" // Original
className="bg-green-600" // Customizado
```

### Serviços
Modifique o array `services` em cada template:

```typescript
const services: Service[] = [
  {
    id: '1',
    name: 'Seu Serviço',
    duration: 60,
    price: 150,
    description: 'Descrição do serviço'
  }
];
```

### Horários
Personalize os slots de tempo disponíveis:

```typescript
const timeSlots = [
  { time: '09:00', available: true },
  { time: '10:00', available: false },
  // ...
];
```

## 🔧 Funcionalidades Implementadas

### ✅ Funcionalidades Básicas
- [x] Seleção de serviços
- [x] Calendário interativo
- [x] Seleção de horários
- [x] Formulário de contato
- [x] Validação de campos

### ✅ Funcionalidades Avançadas
- [x] Design responsivo
- [x] Animações suaves
- [x] Estados de hover/focus
- [x] Feedback visual
- [x] Acessibilidade básica

### 🔄 Para Implementar (Integração com Backend)
- [ ] Conexão com Firebase/API
- [ ] Validação de disponibilidade real
- [ ] Envio de confirmação por email
- [ ] Integração com calendário
- [ ] Sistema de pagamento

## 📊 Comparação de Recursos

| Recurso | Minimal | Premium | Corporate | Creative |
|---------|---------|---------|-----------|----------|
| Design Responsivo | ✅ | ✅ | ✅ | ✅ |
| Processo Step-by-step | ✅ | ❌ | ❌ | ✅ |
| Depoimentos | ❌ | ✅ | ✅ | ❌ |
| Formulário Empresarial | ❌ | ❌ | ✅ | ❌ |
| Visual Criativo | ❌ | ✅ | ❌ | ✅ |
| Redes Sociais | ❌ | ❌ | ❌ | ✅ |

## 🎯 Recomendações de Uso

### 🏥 **Minimal** 
**Quando usar:** Você quer máxima conversão com mínima distração
**Perfil:** Psicólogo clínico tradicional, foco na funcionalidade

### 💎 **Premium**
**Quando usar:** Você cobra valores altos e quer transmitir exclusividade  
**Perfil:** Especialista renomado, atendimento VIP

### 🏢 **Corporate**
**Quando usar:** Você atende empresas e organizações
**Perfil:** Psicólogo organizacional, consultor empresarial

### 🌈 **Creative**
**Quando usar:** Você quer se destacar com personalidade única
**Perfil:** Terapeuta jovem, atendimento alternativo, público LGBTQIA+

## 📝 Notas de Implementação

- Todos os templates usam **Tailwind CSS** para estilização
- Compatível com **React 18+** e **TypeScript**
- Ícones da biblioteca **Lucide React**
- Não possui dependências externas além das mencionadas
- Código totalmente modular e reutilizável

## 🤝 Contribuições

Sinta-se à vontade para:
- Criar novos templates
- Melhorar os existentes  
- Adicionar novas funcionalidades
- Reportar bugs ou sugestões

---

**Desenvolvido com ❤️ para a comunidade de profissionais da saúde mental**
