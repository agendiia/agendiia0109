import React, { useState, useEffect } from 'react';
import { generateBio, generateContentPlan, generateSocialMediaPost, generateEmailMarketing, generateAdsCopy, generateVideoScript } from '../services/geminiService';
import { useAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { User, Calendar, Hash, Mail, Megaphone, Video, Brain, Loader } from './Icons';

type Tone = 'professional' | 'friendly' | 'playful';

const MarketingAI: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [skills, setSkills] = useState('');
  const [audience, setAudience] = useState('clientes locais');
  const [tone, setTone] = useState<Tone>('professional');
  const [formalityLevel, setFormalityLevel] = useState(50); // 0-100: casual to formal
  const [seriousnessLevel, setSeriousnessLevel] = useState(50); // 0-100: playful to serious
  const [variations, setVariations] = useState(3);

  const [results, setResults] = useState<string[]>([]);
  const [expandedResults, setExpandedResults] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bio'|'plan'|'posts'|'email'|'ads'|'video'>('bio');

  // Content plan state
  const [planGoal, setPlanGoal] = useState('Aumentar alcance e agendamentos');
  const [planPlatform, setPlanPlatform] = useState('Instagram');
  const [planDuration, setPlanDuration] = useState<'5' | '14' | '30'>('5');
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<Array<{ day: number; theme: string; format: string; caption: string; hashtags: string[] }>>([]);
  const [planRaw, setPlanRaw] = useState<string | null>(null);

  // Post suggestions
  const [postTopic, setPostTopic] = useState('Dicas sobre cuidados pós-consulta');
  const [postCount, setPostCount] = useState(3);
  const [postLoading, setPostLoading] = useState(false);
  const [postResults, setPostResults] = useState<any[]>([]);

  // Email marketing
  const [emailObjective, setEmailObjective] = useState('Reengajar clientes inativos');
  const [emailTarget, setEmailTarget] = useState('Todos os clientes');
  const [emailOffer, setEmailOffer] = useState('10% de desconto na próxima consulta');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<{ subject?: string; body?: string } | null>(null);

  // Ads generator
  const [adServiceName, setAdServiceName] = useState('Consulta Inicial');
  const [adPlatform, setAdPlatform] = useState('Facebook');
  const [adKeyMessage, setAdKeyMessage] = useState('Resultados rápidos e acompanhamento personalizado');
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsResult, setAdsResult] = useState<any>(null);

  // Video scripts
  const [videoType, setVideoType] = useState('Reel');
  const [videoTopic, setVideoTopic] = useState('Dicas de cuidados pós-consulta');
  const [videoDuration, setVideoDuration] = useState('30');
  const [videoObjective, setVideoObjective] = useState('Educar e engajar seguidores');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoResult, setVideoResult] = useState<any>(null);

  // Function to generate tone description from sliders
  const getToneDescription = () => {
    const formalityDesc = formalityLevel < 30 ? 'casual e descontraído' : 
                         formalityLevel > 70 ? 'formal e polido' : 'moderadamente profissional';
    
    const seriousnessDesc = seriousnessLevel < 30 ? 'divertido e leve' : 
                           seriousnessLevel > 70 ? 'sério e focado' : 'equilibrado entre profissional e acessível';
    
    return `Tom ${formalityDesc}, com abordagem ${seriousnessDesc}`;
  };

  const handleGenerate = async () => {
    setError(null);
    setResults([]);
    setLoading(true);

    const details = {
      name: name || 'Seu Nome',
      specialty: specialty || 'Profissional',
      skills: skills || 'experiência relevante',
      targetAudience: audience || 'clientes locais',
      customTone: getToneDescription()
    };

    try {
      const out: string[] = [];
      // Call Gemini generateBio repeatedly to get variations
  const safeCount = Math.min(variations, 5);
  for (let i = 0; i < safeCount; i++) {
        // small variation: include index in skills to nudge different outputs
        const promptDetails = { ...details };
        // call service
        // Note: generateBio returns a string
        // We call sequentially to avoid rate issues; could parallelize with Promise.all
        // but simpler and safer to do sequential attempts
  // eslint-disable-next-line no-await-in-loop
  const text = await generateBio({
          name: promptDetails.name,
          specialty: promptDetails.specialty,
          skills: `${promptDetails.skills} (variante ${i + 1})`,
          targetAudience: promptDetails.targetAudience
        } as any);
  // yield briefly to keep UI responsive between sequential calls
  // (allows browser to repaint and process events)
  // eslint-disable-next-line no-await-in-loop
  await new Promise(r => setTimeout(r, 80));
        out.push(typeof text === 'string' ? text.trim() : String(text));
      }

      setResults(out);
    } catch (e: any) {
      console.error('generateBio error', e);
      setError(e?.message || 'Erro ao gerar biografias com a IA.');
    } finally {
      setLoading(false);
    }
  };

  const tryParsePlan = (text: string) => {
    // Try JSON first (Gemini is configured to return JSON when possible)
    try {
      const parsed = JSON.parse(text);
      // Accept either { plan: [...] } or an array directly
      const arr = parsed?.plan ?? parsed;
      if (Array.isArray(arr)) {
        const normalized = arr.map((it: any, i: number) => ({
          day: Number(it?.day ?? i + 1),
          theme: String(it?.theme ?? it?.title ?? ('Dia ' + (it?.day ?? i + 1))),
          format: String(it?.format ?? it?.type ?? ''),
          caption: String(it?.caption ?? it?.description ?? ''),
          hashtags: Array.isArray(it?.hashtags) ? it.hashtags : (typeof it?.hashtags === 'string' ? it.hashtags.split(/[ ,]+/).slice(0, 8) : []),
        }));
        return { items: normalized, raw: null };
      }
    } catch (e) {
      // ignore
    }

    // Fallback: return raw text as single item
    return { items: [], raw: text };
  };

  const handleGeneratePlan = async () => {
    if (!planGoal || planGoal.trim().length < 5) {
      setPlanError('Por favor, descreva um objetivo mais completo para o plano.');
      return;
    }
    setPlanError(null);
    setPlanItems([]);
    setPlanRaw(null);
    setPlanLoading(true);
    try {
      const goalWithDuration = `${planGoal} (Duração solicitada: ${planDuration} dias)`;
      const res = await generateContentPlan(goalWithDuration, planPlatform);
      const text = typeof res === 'string' ? res : String(res);
      const parsed = tryParsePlan(text);
      if (parsed.items.length) {
        setPlanItems(parsed.items);
      } else {
        setPlanRaw(text);
      }
    } catch (e: any) {
      console.error('generateContentPlan error', e);
      setPlanError(e?.message || 'Erro ao gerar o plano de conteúdo.');
    } finally {
      setPlanLoading(false);
    }
  };

  

  const exportCSV = () => {
    let csv = '';
    if (planItems.length) {
      csv += 'day,theme,format,caption,hashtags\n';
      planItems.forEach(p => {
        const row = [p.day, csvEscape(p.theme), csvEscape(p.format), csvEscape(p.caption), csvEscape(p.hashtags.join(' '))].join(',');
        csv += `${row}\n`;
      });
    } else if (planRaw) {
      csv = `raw\n"""\n${planRaw.replace(/"/g, '""')}\n"""`;
    } else {
      alert('Nenhum plano para exportar');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-plan-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const csvEscape = (s: any) => `"${String(s || '').replace(/"/g, '""')}"`;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  const toggleExpanded = (key: number) => {
    setExpandedResults(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGeneratePosts = async () => {
    setPostLoading(true);
    setPostResults([]);
    try {
      const res = await generateSocialMediaPost(postTopic, getToneDescription());
      const text = typeof res === 'string' ? res : String(res);
      // Try parse JSON, otherwise split by lines
      try {
        const parsed = JSON.parse(text);
        setPostResults(parsed);
      } catch {
        // fallback: put whole text as single item
        setPostResults([{ text }]);
      }
    } catch (e) {
      console.error('generateSocialMediaPost error', e);
      setPostResults([{ text: 'Erro ao gerar sugestões.' }]);
    } finally {
      setPostLoading(false);
    }
  };

  // Parsing helpers
  const extractHashtags = (text: string) => {
    const matches = text.match(/#\w+/g);
    return matches ? matches.map(h => h.trim()) : [];
  };

  const detectFormat = (text: string) => {
    const t = text.toLowerCase();
    if (/reel|vídeo curto|vídeo|video|clip|reels|tiktok/.test(t)) return 'Vídeo Curto';
    if (/carrossel|carrossel de imagens/.test(t)) return 'Carrossel';
    if (/story|stories|story interativo/.test(t)) return 'Story';
    if (/imagem única|imagem/.test(t)) return 'Imagem';
    return '';
  };

  const detectCTA = (text: string) => {
    const sentences = text.split(/[\.\n]+/).map(s => s.trim()).filter(Boolean);
    for (let s of sentences.reverse()) {
      if (/agend|marque|reserve|saiba mais|clique|compre|entre em contato|envie mensagem|confirme/i.test(s)) {
        return s;
      }
    }
    return '';
  };

  const normalizePost = (p: any) => {
    if (!p) return { text: '', format: '', hashtags: [], cta: '' };
    let text = typeof p === 'string' ? p : (p.text || JSON.stringify(p));
    const hashtags = extractHashtags(text);
    const format = detectFormat(text) || (p.format || '');
    const cta = detectCTA(text) || (p.cta || '');
    return { text, format, hashtags, cta };
  };

  // Ads parsing: try structured suggestions or fallback heuristics
  const normalizeAds = (raw: any) => {
    if (!raw) return [];
    if (raw.suggestions && Array.isArray(raw.suggestions)) {
      return raw.suggestions.map((s: any) => ({ headline: s.headline, body: s.body, cta: s.cta, targeting: s.targeting || [] }));
    }
    // if raw.raw or string, attempt simple split
    const text = typeof raw === 'string' ? raw : (raw.raw ? raw.raw : JSON.stringify(raw));
    const parts = text.split(/\n\s*\n/).slice(0,3);
    return parts.map(p => {
      const headline = (p.split('\n')[0]||'').slice(0,80);
      const body = p;
      const ctaMatch = p.match(/(Saiba mais|Agende|Reserve|Compre|Clique aqui|Inscreva-se)/i);
      const cta = ctaMatch ? ctaMatch[0] : detectCTA(p);
      // Suggest targeting from specialty/skills
      const targeting = [] as string[];
      if (specialty) targeting.push(specialty);
      if (skills) targeting.push(...skills.split(/[,;]+/).map(s=>s.trim()).filter(Boolean).slice(0,3));
      return { headline, body, cta, targeting };
    });
  };

  // Note: saving/exporting JSON from UI removed per user request

  

  const handleGenerateEmail = async () => {
    setEmailLoading(true);
    setEmailResult(null);
    try {
      const res = await generateEmailMarketing(emailObjective, emailTarget, emailOffer, getToneDescription());
      const text = typeof res === 'string' ? res : String(res);
      try {
        const parsed = JSON.parse(text);
        setEmailResult({ subject: parsed.subject, body: parsed.body });
      } catch {
        setEmailResult({ subject: 'Assunto gerado', body: text });
      }
    } catch (e) {
      console.error('generateEmailMarketing error', e);
      setEmailResult({ subject: 'Erro', body: 'Não foi possível gerar o e-mail.' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleGenerateAds = async () => {
    setAdsLoading(true);
    setAdsResult(null);
    try {
      const res = await generateAdsCopy(adServiceName, adPlatform, adKeyMessage);
      const text = typeof res === 'string' ? res : String(res);
      try {
        const parsed = JSON.parse(text);
        setAdsResult(parsed);
      } catch {
        setAdsResult({ raw: text });
      }
    } catch (e) {
      console.error('generateAdsCopy error', e);
      setAdsResult({ raw: 'Erro ao gerar anúncios.' });
    } finally {
      setAdsLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    setVideoLoading(true);
    setVideoResult(null);
    try {
      const res = await generateVideoScript(videoType, videoTopic, videoDuration, videoObjective);
      const text = typeof res === 'string' ? res : String(res);
      try {
        const parsed = JSON.parse(text);
        setVideoResult(parsed);
      } catch {
        setVideoResult({ raw: text });
      }
    } catch (e) {
      console.error('generateVideoScript error', e);
      setVideoResult({ raw: 'Erro ao gerar roteiros de vídeo.' });
    } finally {
      setVideoLoading(false);
    }
  };

  // Subscribe to professional profile and prefill inputs
  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, 'users', user.uid, 'profile', 'main');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      if (!data) return;
      if (data.name) setName((prev) => prev || data.name);
      if (data.specialty) setSpecialty((prev) => prev || data.specialty);
      // Build skills string from credentials if not already filled
      if ((!skills || skills.trim() === '') && Array.isArray(data.credentials)) {
        try {
          const credText = (data.credentials as any[]).map((c: any) => (c.title ? `${c.title}${c.institution ? ' — ' + c.institution : ''}` : '')).filter(Boolean).join(', ');
          if (credText) setSkills(credText);
        } catch {
          // ignore
        }
      }
      // Optionally set audience from a profile field if present
      if (!audience && data.targetAudience) setAudience(data.targetAudience);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Tab icons and badge counts
  const tabs = [
    { id: 'bio', label: 'Bio', Icon: User, activeClass: 'bg-indigo-600 text-white', badgeClass: 'bg-indigo-700' },
    { id: 'plan', label: 'Plano de Conteúdo', Icon: Calendar, activeClass: 'bg-emerald-600 text-white', badgeClass: 'bg-emerald-700' },
    { id: 'posts', label: 'Sugestões de Posts', Icon: Hash, activeClass: 'bg-amber-500 text-white', badgeClass: 'bg-amber-600' },
    { id: 'video', label: 'Roteiros de Vídeo', Icon: Video, activeClass: 'bg-purple-600 text-white', badgeClass: 'bg-purple-700' },
    { id: 'email', label: 'E-mail Marketing', Icon: Mail, activeClass: 'bg-violet-600 text-white', badgeClass: 'bg-violet-700' },
    { id: 'ads', label: 'Anúncios', Icon: Megaphone, activeClass: 'bg-rose-600 text-white', badgeClass: 'bg-rose-700' },
  ];

  const badgeCount = (id: string) => {
    switch (id) {
      case 'bio': return results.length || 0;
      case 'plan': return planItems.length || (planRaw ? 1 : 0);
      case 'posts': return postResults.length || 0;
      case 'video': return (videoResult && videoResult.scripts && videoResult.scripts.length) ? videoResult.scripts.length : (videoResult ? 1 : 0);
      case 'email': return emailResult ? 1 : 0;
      case 'ads': return (adsResult && adsResult.suggestions && adsResult.suggestions.length) ? adsResult.suggestions.length : (adsResult ? 1 : 0);
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Marketing com IA</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Ferramentas de marketing assistidas por IA — biografias, posts, e‑mails e anúncios para promover seu negócio.</p>
        </div>
      </div>

      {/* Horizontal menu tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm border border-gray-200 dark:border-gray-700">
        <nav className="flex gap-2 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = (t as any).Icon as React.FC<any>;
            const count = badgeCount(t.id as string);
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${activeTab === t.id ? (t as any).activeClass : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <Icon className="w-5 h-5" />
                <span>{t.label}</span>
                {count > 0 && (
                  <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full ${(t as any).badgeClass || 'bg-red-600'} text-white`}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${activeTab !== 'bio' ? 'hidden' : ''} lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
          <h2 className="text-lg font-semibold mb-3">Entradas</h2>

          <label className="block text-sm text-gray-600 mb-1">Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Ana Silva" className="w-full p-2 mb-3 rounded border bg-gray-50 dark:bg-gray-700" />

          <label className="block text-sm text-gray-600 mb-1">Especialidade</label>
          <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Ex: Fisioterapeuta" className="w-full p-2 mb-3 rounded border bg-gray-50 dark:bg-gray-700" />

          <label className="block text-sm text-gray-600 mb-1">Habilidades / Foco</label>
          <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Ex: Pilates clínico, reabilitação" className="w-full p-2 mb-3 rounded border bg-gray-50 dark:bg-gray-700" />

          <label className="block text-sm text-gray-600 mb-1">Público-alvo</label>
          <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Ex: mães ocupadas" className="w-full p-2 mb-4 rounded border bg-gray-50 dark:bg-gray-700" />

          {/* Tone Customization Sliders */}
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🎨 Personalização de Tom</h3>
            
            {/* Formality Slider */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Estilo</label>
                <span className="text-xs text-gray-500">
                  {formalityLevel < 30 ? 'Casual' : formalityLevel > 70 ? 'Formal' : 'Equilibrado'}
                </span>
              </div>
              <div className="relative">
                <input 
                  type="range" 
                  min={0} 
                  max={100} 
                  value={formalityLevel} 
                  onChange={e => setFormalityLevel(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider-formality"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Casual</span>
                  <span>Formal</span>
                </div>
              </div>
            </div>

            {/* Seriousness Slider */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Abordagem</label>
                <span className="text-xs text-gray-500">
                  {seriousnessLevel < 30 ? 'Divertido' : seriousnessLevel > 70 ? 'Sério' : 'Equilibrado'}
                </span>
              </div>
              <div className="relative">
                <input 
                  type="range" 
                  min={0} 
                  max={100} 
                  value={seriousnessLevel} 
                  onChange={e => setSeriousnessLevel(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider-seriousness"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Divertido</span>
                  <span>Sério</span>
                </div>
              </div>
            </div>

            {/* Preview of tone */}
            <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border">
              <div className="text-xs text-gray-500 mb-1">Tom resultante:</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                {getToneDescription()}
              </div>
            </div>
          </div>

          <label className="block text-sm text-gray-600 mb-1">Tom (modo clássico)</label>
          <select value={tone} onChange={e => setTone(e.target.value as Tone)} className="w-full p-2 mb-3 rounded border bg-gray-50 dark:bg-gray-700">
            <option value="professional">Profissional</option>
            <option value="friendly">Amigável</option>
            <option value="playful">Descontraído</option>
          </select>

          <label className="block text-sm text-gray-600 mb-1">Variações (2–5)</label>
          <input type="range" min={2} max={5} value={variations} onChange={e => setVariations(Number(e.target.value))} className="w-full mb-2" />
          <div className="text-sm text-gray-500 mb-4">Gerar: <strong className="text-gray-700 dark:text-gray-200">{variations}</strong> variações</div>

          <div className="flex gap-3">
            <button onClick={handleGenerate} disabled={loading} className="flex-1 bg-[var(--theme-color)] text-white px-4 py-2 rounded flex items-center justify-center gap-2">
              {loading ? (<><Loader className="w-4 h-4 animate-spin" /> Gerando...</>) : (<><Brain className="w-4 h-4" /> Gerar Biografias</>)}
            </button>
            <button onClick={() => { setResults([]); setError(null); }} className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700">Limpar</button>
          </div>

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>

  <div className={`${activeTab === 'bio' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}> 
          <div className={`${activeTab === 'bio' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <h2 className="text-lg font-semibold mb-4">Variações Geradas</h2>

            {loading && <div className="text-sm text-gray-500">A IA está gerando as variações. isto pode levar alguns segundos...</div>}

            {!loading && results.length === 0 && (
              <div className="text-sm text-gray-500">Nenhuma biografia gerada ainda. Preencha os campos e clique em Gerar.</div>
            )}

            <div className="space-y-4 mt-4">
              {results.map((r, idx) => (
                <div key={idx} className="border rounded p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div className="text-sm text-gray-600">Variação {idx + 1}</div>
                    <div className="flex gap-2">
                      <button onClick={() => handleCopy(r)} className="text-sm px-2 py-1 bg-white dark:bg-gray-700 border rounded">Copiar</button>
                      <button onClick={() => console.log('salvar', r)} className="text-sm px-2 py-1 bg-white dark:bg-gray-700 border rounded">Salvar</button>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm mt-2 text-gray-800 dark:text-gray-100">
                    {r.length > 800 && !expandedResults[idx] ? (
                      <>
                        {r.slice(0, 700)}... <button onClick={() => toggleExpanded(idx)} className="text-xs text-indigo-600">Mostrar mais</button>
                      </>
                    ) : (
                      <>
                        {r}
                        {r.length > 800 && <button onClick={() => toggleExpanded(idx)} className="block mt-2 text-xs text-indigo-600">Mostrar menos</button>}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>

          <div className={`${activeTab === 'bio' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-dashed border-gray-200 dark:border-gray-700`}>
            <h3 className="font-semibold mb-2">Dicas</h3>
            <ul className="list-disc ml-5 text-sm text-gray-600">
              <li>Use um tom consistente com sua marca.</li>
              <li>Peça 3 variações para comparar versões curta, média e longa.</li>
              <li>Revise e personalize o texto antes de publicar.</li>
            </ul>
          </div>

          {/* Content Plan Section */}
          <div className={`${activeTab === 'plan' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold mb-2">Gerador de Plano de Conteúdo</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Objetivo do Plano</label>
                <input className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" value={planGoal} onChange={e => setPlanGoal(e.target.value)} placeholder="Ex: aumentar agendamentos para novos clientes em 2 semanas" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Plataforma</label>
                <select value={planPlatform} onChange={e => setPlanPlatform(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700">
                  <option>Instagram</option>
                  <option>Facebook</option>
                  <option>LinkedIn</option>
                  <option>TikTok</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <label className="text-sm text-gray-600">Duração</label>
              <select value={planDuration} onChange={e => setPlanDuration(e.target.value as any)} className="p-2 rounded border bg-gray-50 dark:bg-gray-700">
                <option value="5">5 dias</option>
                <option value="14">2 semanas</option>
                <option value="30">1 mês</option>
              </select>
              <div className="flex-1" />
              <button onClick={handleGeneratePlan} disabled={planLoading} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2">
                {planLoading ? (<><Loader className="w-4 h-4 animate-spin" /> Gerando...</>) : (<><Calendar className="w-4 h-4" /> Gerar Plano</>)}
              </button>
              <button onClick={() => { setPlanItems([]); setPlanRaw(null); setPlanError(null); }} className="ml-2 px-3 py-2 rounded bg-gray-100 dark:bg-gray-700">Limpar</button>
            </div>

            {planError && <div className="mt-3 text-sm text-red-600">{planError}</div>}

            <div className="mt-4 space-y-3">
              {planLoading && <div className="text-sm text-gray-500">A IA está gerando seu plano. Aguarde...</div>}

              {!planLoading && planItems.length === 0 && !planRaw && (
                <div className="text-sm text-gray-500">Nenhum plano gerado ainda. Insira o objetivo e clique em Gerar Plano.</div>
              )}

              {planItems.length > 0 && (
                <div className="space-y-2">
                  {planItems.map((p) => (
                    <div key={p.day} className="p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-start justify-between">
                        <div className="font-semibold">Dia {p.day} — {p.theme}</div>
                        <div className="text-sm text-gray-500">{p.format}</div>
                      </div>
                      <div className="text-sm mt-2 text-gray-700 dark:text-gray-200">{p.caption}</div>
                      <div className="text-xs text-gray-500 mt-2">{p.hashtags.join(' ')}</div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <button onClick={exportCSV} className="px-3 py-2 rounded bg-green-50 text-green-700">Exportar CSV</button>
                  </div>
                </div>
              )}

              {planRaw && (
                <div className="p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                  <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                    {planRaw.length > 1000 ? (
                      <>
                        {planRaw.slice(0, 900)}... <button onClick={() => toggleExpanded(-1)} className="text-xs text-indigo-600">Mostrar mais</button>
                      </>
                    ) : planRaw}
                    {planRaw.length > 1000 && expandedResults[-1] && (
                      <div className="mt-2">{planRaw} <button onClick={() => toggleExpanded(-1)} className="block mt-2 text-xs text-indigo-600">Mostrar menos</button></div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={exportCSV} className="px-3 py-2 rounded bg-green-50 text-green-700">Exportar CSV</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Post Suggestions Section */}
          <div className={`${activeTab === 'posts' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <h3 className="font-semibold mb-3">Sugestões de Posts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Tema / Serviço</label>
                <input value={postTopic} onChange={e => setPostTopic(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Sugestões</label>
                <input type="number" min={1} max={10} value={postCount} onChange={e => setPostCount(Number(e.target.value))} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleGeneratePosts} disabled={postLoading} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2">{postLoading ? (<><Loader className="w-4 h-4 animate-spin" /> Gerando...</>) : (<><Hash className="w-4 h-4" /> Gerar Sugestões</>)}</button>
              <button onClick={() => setPostResults([])} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700">Limpar</button>
            </div>

            <div className="mt-4 space-y-2">
              {postResults.length === 0 && <div className="text-sm text-gray-500">Nenhuma sugestão ainda.</div>}
              {postResults.map((p, i) => (
                <div key={i} className="p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Sugestão {i + 1}</div>
                    <div className="flex gap-2">
                      <button onClick={() => handleCopy(typeof p === 'string' ? p : JSON.stringify(p))} className="text-sm px-2 py-1 bg-white dark:bg-gray-700 border rounded">Copiar</button>
                    </div>
                  </div>
                  <div className="text-sm mt-2 text-gray-700 dark:text-gray-200">
                    {(() => {
                      const txt = typeof p === 'string' ? p : (p.text || JSON.stringify(p));
                      if (txt.length > 800 && !expandedResults[100 + i]) {
                        return (<>{txt.slice(0,700)}... <button onClick={() => toggleExpanded(100 + i)} className="text-xs text-indigo-600">Mostrar mais</button></>);
                      }
                      return (<>{txt}{txt.length > 800 && <button onClick={() => toggleExpanded(100 + i)} className="block mt-2 text-xs text-indigo-600">Mostrar menos</button>}</>);
                    })()}
                  </div>
                </div>
              ))}
            </div>
              {/* removed export/save buttons per request */}
            </div>

          {/* Email Marketing Section */}
          <div className={`${activeTab === 'email' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <h3 className="font-semibold mb-3">E-mail Marketing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm text-gray-600 mb-1">Objetivo</label>
                <input value={emailObjective} onChange={e => setEmailObjective(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm text-gray-600 mb-1">Público-alvo</label>
                <input value={emailTarget} onChange={e => setEmailTarget(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm text-gray-600 mb-1">Oferta</label>
                <input value={emailOffer} onChange={e => setEmailOffer(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleGenerateEmail} disabled={emailLoading} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2">{emailLoading ? (<><Loader className="w-4 h-4 animate-spin" /> Gerando...</>) : (<><Mail className="w-4 h-4" /> Gerar E-mail</>)}</button>
              <button onClick={() => setEmailResult(null)} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700">Limpar</button>
            </div>

            {emailResult && (
                <div className="mt-4 p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                <div className="font-semibold">Assunto</div>
                <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">{emailResult.subject}</div>
                <div className="font-semibold mt-3">Corpo (use {`{clientName}`})</div>
                <div className="whitespace-pre-wrap text-sm mt-1 text-gray-700 dark:text-gray-200">
                  {emailResult.body && emailResult.body.length > 1000 && !expandedResults[200] ? (
                    <>{emailResult.body.slice(0,900)}... <button onClick={() => toggleExpanded(200)} className="text-xs text-indigo-600">Mostrar mais</button></>
                  ) : (
                    <>{emailResult.body}{emailResult.body && emailResult.body.length > 1000 && <button onClick={() => toggleExpanded(200)} className="block mt-2 text-xs text-indigo-600">Mostrar menos</button>}</>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleCopy(emailResult.subject || '')} className="px-3 py-2 rounded bg-white dark:bg-gray-700">Copiar Assunto</button>
                  <button onClick={() => handleCopy(emailResult.body || '')} className="px-3 py-2 rounded bg-white dark:bg-gray-700">Copiar Corpo</button>
                </div>
              </div>
            )}
          </div>

          {/* Ads Generator Section */}
          <div className={`${activeTab === 'ads' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <h3 className="font-semibold mb-3">Gerador de Anúncios</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Serviço</label>
                <input value={adServiceName} onChange={e => setAdServiceName(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Plataforma</label>
                <input value={adPlatform} onChange={e => setAdPlatform(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mensagem-chave</label>
                <input value={adKeyMessage} onChange={e => setAdKeyMessage(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleGenerateAds} disabled={adsLoading} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2">{adsLoading ? (<><Loader className="w-4 h-4 animate-spin" /> Gerando...</>) : (<><Megaphone className="w-4 h-4" /> Gerar Anúncios</>)}</button>
              <button onClick={() => setAdsResult(null)} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700">Limpar</button>
            </div>

            <div className="mt-4 space-y-2">
              {adsResult && adsResult.suggestions && Array.isArray(adsResult.suggestions) ? (
                <div className="space-y-2">
                  {adsResult.suggestions.map((s: any, i: number) => (
                    <div key={i} className="p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                      <div className="font-semibold">Variação {i + 1}</div>
                      <div className="text-sm mt-1">{s.headline}</div>
                      <div className="text-sm mt-1">{s.body}</div>
                      <div className="text-sm mt-1 font-medium">CTA: {s.cta}</div>
                    </div>
                  ))}
                </div>
              ) : adsResult ? (
                <div className="p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                  <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                    {typeof adsResult === 'string' ? (
                      adsResult.length > 800 && !expandedResults[300] ? (
                        <>{adsResult.slice(0,700)}... <button onClick={() => toggleExpanded(300)} className="text-xs text-indigo-600">Mostrar mais</button></>
                      ) : (
                        <>{adsResult}{adsResult.length > 800 && <button onClick={() => toggleExpanded(300)} className="block mt-2 text-xs text-indigo-600">Mostrar menos</button>}</>
                      )
                    ) : (
                      JSON.stringify(adsResult, null, 2)
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Nenhum anúncio gerado ainda.</div>
              )}
            </div>
          </div>

          {/* Video Scripts Generator */}
          <div className={`${activeTab === 'video' ? '' : 'hidden'} bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700`}>
            <h3 className="font-semibold mb-3">Gerador de Roteiros para Vídeo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Tipo de Vídeo</label>
                <select value={videoType} onChange={e => setVideoType(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="Reel">Reel (Instagram)</option>
                  <option value="Story">Story</option>
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube Shorts">YouTube Shorts</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Duração (segundos)</label>
                <select value={videoDuration} onChange={e => setVideoDuration(e.target.value)} className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="15">15 segundos</option>
                  <option value="30">30 segundos</option>
                  <option value="60">60 segundos</option>
                  <option value="90">90 segundos</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Tópico/Tema</label>
                <input 
                  value={videoTopic} 
                  onChange={e => setVideoTopic(e.target.value)} 
                  placeholder="Ex: Dicas de cuidados pós-consulta, Como se preparar para a consulta..."
                  className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" 
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Objetivo do Vídeo</label>
                <input 
                  value={videoObjective} 
                  onChange={e => setVideoObjective(e.target.value)} 
                  placeholder="Ex: Educar e engajar, Promover serviço, Aumentar agendamentos..."
                  className="w-full p-2 rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button 
                onClick={handleGenerateVideo} 
                disabled={videoLoading} 
                className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700 transition-colors"
              >
                {videoLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> 
                    Gerando...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" /> 
                    Gerar Roteiros
                  </>
                )}
              </button>
              <button 
                onClick={() => setVideoResult(null)} 
                className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Limpar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {videoResult && videoResult.scripts && Array.isArray(videoResult.scripts) ? (
                <div className="space-y-4">
                  {videoResult.scripts.map((script: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-900/50">
                      <div className="font-semibold text-purple-600 dark:text-purple-400 mb-2">
                        🎬 Roteiro {i + 1}: {script.title}
                      </div>
                      
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-medium text-green-600 dark:text-green-400">🎯 Hook Inicial (0-3s):</span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{script.hook}</p>
                        </div>
                        
                        <div>
                          <span className="font-medium text-blue-600 dark:text-blue-400">📝 Desenvolvimento:</span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{script.development}</p>
                        </div>
                        
                        <div>
                          <span className="font-medium text-orange-600 dark:text-orange-400">📞 Call-to-Action:</span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{script.cta}</p>
                        </div>
                        
                        <div>
                          <span className="font-medium text-purple-600 dark:text-purple-400">🎥 Sugestões Visuais:</span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{script.visualSuggestions}</p>
                        </div>
                        
                        <div>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">📱 Texto na Tela:</span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{script.textOverlay}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : videoResult ? (
                <div className="p-3 rounded border bg-gray-50 dark:bg-gray-900/50">
                  <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                    {typeof videoResult === 'string' ? (
                      videoResult.length > 800 && !expandedResults[400] ? (
                        <>
                          {videoResult.slice(0,700)}... 
                          <button onClick={() => toggleExpanded(400)} className="text-xs text-purple-600 ml-1">
                            Mostrar mais
                          </button>
                        </>
                      ) : (
                        <>
                          {videoResult}
                          {videoResult.length > 800 && (
                            <button onClick={() => toggleExpanded(400)} className="block mt-2 text-xs text-purple-600">
                              Mostrar menos
                            </button>
                          )}
                        </>
                      )
                    ) : (
                      JSON.stringify(videoResult, null, 2)
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Nenhum roteiro gerado ainda.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingAI;
