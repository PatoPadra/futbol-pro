# App Fútbol - PRD

## Problem Statement
Full-stack web application for organizing amateur football matches and generating balanced teams automatically using player information, history, and peer evaluations.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI (port 3000)
- **Backend**: FastAPI (port 8001)
- **Database**: MongoDB
- **Auth**: JWT custom (email/password)
- **Photo Storage**: Local file storage via FastAPI StaticFiles

## User Personas
1. **Admin**: Full system access, user management, role assignment
2. **Organizador**: Create/manage matches, generate teams, finalize matches
3. **Jugador Frecuente**: Register for matches, evaluate peers, view history
4. **Jugador Invitado**: Created by others, auto-promotes to frecuente after 4 matches

## Core Requirements
- Player registration with photo, positions, birth date
- Match creation (Fútbol 5-11) with deadlines and location
- Player sign-up (titular/suplente system)
- Automatic team balancing (snake draft for 5-10, formation-based for 11)
- Post-match peer evaluations (1-10 rating)
- Match statistics with community voting confirmation
- Player rating system (general, recent, by position, confidence index, stats bonus)
- Formation visualization on football pitch (7 formations for 11v11)

## What's Been Implemented (March 15, 2026)

### Backend (15 files)
- Auth: register, login, JWT middleware
- Profile: CRUD, photo upload
- Matches: CRUD, registration (titular/suplente), close registrations
- Teams: generate balanced teams, adjust manually, confirm
- Post-match: peer ratings (batch), self-evaluation, stats proposals, stats voting, finalize
- Players: list, detail, history, metrics, create guest
- Admin: users, roles, matches, system stats
- Team Balancer: snake draft (5-10), formation-based (11v11), 7 formations
- Rating Calculator: general, recent (recency-weighted), per-position, confidence index, stats bonus

### Frontend (16 pages + components)
- Landing, Login, Register, CompleteProfile
- Dashboard, MatchesList, CreateMatch, MatchDetail
- GeneratedTeams (with pitch visualization), PostMatch, StatsConfirmation
- PlayerProfile, PlayerHistory, CreateGuest
- OrganizerPanel, AdminPanel
- Layout (responsive top/bottom nav), FootballPitch component

## Testing Results
- Backend: 94.1% pass rate
- Frontend: 85% pass rate
- Overall: 90%

## Prioritized Backlog

### P0 (Next)
- Mobile navigation polish
- Error handling edge cases

### P1
- Recurring matches (create weekly matches from template)
- Manual team adjustment UI (drag-and-drop players between teams/positions)
- Photo upload for guest players
- Stats confirmation UX improvements

### P2
- Rating evolution charts (line graph over time)
- Push notifications for match reminders
- WhatsApp/Telegram share integration for match invites
- Export match report (PDF)
- Password reset flow
- Advanced filtering on matches list (by modality, date range)
