# Lucide

Application React + Vite pour suivre ses paris avec une interface sobre, data-first et une authentification par email et mot de passe.

## Stack

- React 18 + Vite
- Tailwind CSS
- Composants style Shadcn/ui
- Supabase pour l'auth et la base de donnees
- React Router
- Zustand

## Demarrage

1. Installer les dependances avec `npm install` ou `pnpm install`
2. Copier `.env.example` vers `.env`
3. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
4. Executer le SQL de `supabase/schema.sql` dans Supabase
5. Lancer `npm run dev`

## Notes Supabase

- L'interface client propose une connexion et une inscription par email/mot de passe
- Dans Supabase > Authentication > Providers > Email, active Email provider et Email + Password
- Si tu veux eviter tout email de confirmation pendant le dev, desactive la confirmation email dans Supabase
- Le schema SQL active les policies RLS et cree automatiquement un profil lors de la creation d'un utilisateur
- `VITE_SUPPORT_LINK` est optionnel pour activer le bouton de soutien dans le profil
- `ANTHROPIC_API_KEY` est requis seulement pour activer Radar
