# 📧 Configuração SMTP no Firebase - Estrutura platform/settings

## 🎯 **Estrutura Atual Identificada:**
- **Collection:** `platform`
- **Document:** `settings`

## 📋 **Como Adicionar Configuração SMTP**

### **Passo 1: Acesse o Firebase Console**
1. Abra: https://console.firebase.google.com/
2. Projeto: `timevee-53a3c`

### **Passo 2: Vá para Firestore Database**
1. Menu lateral → **"Firestore Database"**

### **Passo 3: Encontre o Documento**
1. Procure a collection **`platform`**
2. Clique no document **`settings`**
3. Clique em **"Edit"** ou **"Editar"**

### **Passo 4: Adicionar Campo `smtp`**
1. Clique em **"Add field"** ou **"Adicionar campo"**
2. Nome do campo: `smtp`
3. Tipo: **Map** (objeto)
4. Clique para expandir o map `smtp`

### **Passo 5: Adicionar Subcampos do SMTP**
Dentro do map `smtp`, adicione estes subcampos:

| Subcampo | Tipo | Valor |
|----------|------|-------|
| `host` | string | `smtp.hostinger.com` |
| `port` | number | `587` |
| `secure` | boolean | `false` |
| `user` | string | `contato@agendiia.com.br` |
| `pass` | string | `SUA_SENHA_DO_EMAIL` |
| `fromName` | string | `Agendiia` |
| `fromEmail` | string | `contato@agendiia.com.br` |

### **📱 Estrutura Final no Firestore:**
```json
platform/settings {
  "smtp": {
    "host": "smtp.hostinger.com",
    "port": 587,
    "secure": false,
    "user": "contato@agendiia.com.br",
    "pass": "sua_senha_aqui",
    "fromName": "Agendiia",
    "fromEmail": "contato@agendiia.com.br"
  }
  // outros campos existentes...
}
```

## 🔧 **Informações do Hostinger que Você Precisa:**

### **Configurações SMTP Hostinger:**
- **Servidor SMTP:** `smtp.hostinger.com`
- **Porta:** `587` (STARTTLS) ou `465` (SSL)
- **Segurança:** STARTTLS para porta 587
- **Usuário:** Seu e-mail completo (ex: contato@agendiia.com.br)
- **Senha:** A senha do e-mail no painel Hostinger

### **🔍 Como Encontrar a Senha no Hostinger:**
1. Acesse o painel Hostinger
2. Vá em **"E-mails"**
3. Encontre o e-mail `contato@agendiia.com.br`
4. Se não souber a senha, pode criar uma nova

## ✅ **Código Já Atualizado Para:**
- ✅ Ler configurações de `platform/settings`
- ✅ Usar SMTP como método único
- ✅ Suporte a estrutura de map aninhado

## 🧪 **Para Testar Depois da Configuração:**
1. Deploy das functions: `firebase deploy --only functions`
2. Teste via Console: Functions → `sendTransactionalEmail`
3. Ou faça um agendamento teste

**Consegue acessar o documento `platform/settings` no Firestore e adicionar o campo `smtp`?**