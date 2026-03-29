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
4. Renseigner `GROQ_API_KEY` pour activer Radar
5. Optionnel: garder `ANTHROPIC_API_KEY` comme secours si tu veux un fallback fournisseur
6. Pour les jetons Radar et l'admin cache, ajouter `SUPABASE_SERVICE_ROLE_KEY`, `RADAR_ADMIN_PASSWORD` et `RADAR_ADMIN_SESSION_SECRET`
7. Executer le SQL de `supabase/schema.sql` dans Supabase
8. Lancer `npm run dev`

## Notes Supabase

- L'interface client propose une connexion et une inscription par email/mot de passe
- Dans Supabase > Authentication > Providers > Email, active Email provider et Email + Password
- Si tu veux eviter tout email de confirmation pendant le dev, desactive la confirmation email dans Supabase
- Le schema SQL active les policies RLS et cree automatiquement un profil lors de la creation d'un utilisateur
- `VITE_SUPPORT_LINK` est optionnel pour activer le bouton de soutien dans le profil
- `GROQ_API_KEY` est la cle privilegiee pour activer Radar
- `ANTHROPIC_API_KEY` reste optionnel comme fallback si `GROQ_API_KEY` n'est pas disponible
- `SUPABASE_SERVICE_ROLE_KEY` est requis pour generer les codes jetons Radar depuis l'admin cache
- L'acces admin Radar est declenche par un appui long de 5 secondes sur le bouton de theme `Clair`, puis verification du mot de passe cote serveur
