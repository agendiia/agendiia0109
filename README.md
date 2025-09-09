<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Meu Projeto no GitHub

Este projeto é parte do app de agendamentos.  
Visite: [Agendiia - Agendamento Online](https://agendiia.com.br/)

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1S8JJIy3jLeafzz11pZ7t5yKLjweIf0me

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase Setup

O projeto está pronto para Firebase (Auth/Firestore/Storage).

Passos:
- Copie `.env.example` para `.env.local` e preencha as chaves `VITE_FIREBASE_*` do seu projeto no Firebase Console (Configurações do projeto > Geral > Seus apps).
- Para IA (Gemini), adicione `VITE_GEMINI_API_KEY`.
- (Opcional dev) Para habilitar fallback de checkout no cliente do Mercado Pago, use `VITE_ALLOW_MP_CLIENT_FALLBACK=true` (não recomendado em produção).
- Os serviços são inicializados em `services/firebase.ts`. Você pode importar:
   - `auth` para autenticação
   - `db` para Firestore
   - `storage` para Storage

Exemplo:
```
import { auth, db } from '@/services/firebase';
```
