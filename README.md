# L'OPJ - Agent IA pour le Droit Pénal Camerounais

## 🎯 Vue d'ensemble

**L'OPJ** est une application web pour maîtriser le **Code Pénal** et le **Code de Procédure Pénale** du Cameroun via des cas pratiques générés par IA.

### ✨ Fonctionnalités

✅ Cas pratiques aléatoires générés par IA  
✅ Corrections avec méthode socratique  
✅ Lexique juridique complet  
✅ Statistiques et suivi de progression  
✅ Clé API personnelle (Mistral ou Anthropic)  
✅ Stockage local du navigateur  

---

## 🚀 Déploiement Vercel

### 1️⃣ Allez sur Vercel
https://vercel.com/dashboard

### 2️⃣ Créer un nouveau projet
- Cliquez **Add New** → **Project**
- Sélectionnez **GitHub**
- Cherchez `lejuriste237/lopj-ia`
- Cliquez **Import**

### 3️⃣ Vercel déploie automatiquement 🎉
L'application est en ligne en quelques secondes !

### 4️⃣ (Optionnel) Ajouter des variables d'environnement
- Dans Vercel : **Settings** → **Environment Variables**
- Ajoutez vos clés API si souhaitées

---

## 💻 Installation locale

```bash
git clone https://github.com/lejuriste237/lopj-ia.git
cd lopj-ia
npm install
npm run dev
```

L'app sera à `http://localhost:3000`

---

## 📝 Utilisation

1. **Paramètres** : Ajoutez votre clé API Mistral ou Anthropic
2. **Générer** : Créez un cas pratique
3. **Répondre** : Rédigez votre analyse juridique
4. **Soumettre** : Recevez une correction
5. **Lexique** : Consultez les définitions

---

## 🔐 Sécurité

⚠️ Les clés API sont stockées localement dans votre navigateur (localStorage)  
⚠️ Ne commitez jamais vos clés API  
⚠️ Utilisez `.env.local` pour le développement  

---

## 🛠️ Stack technique

- **Framework** : Next.js 14
- **UI** : React 18 + CSS-in-JS
- **IA** : Mistral AI / Anthropic Claude
- **Hosting** : Vercel

---

## 📄 Licence

MIT © 2024 L'OPJ

---

**Maîtrisez le droit pénal camerounais par la pratique** ⚖️
