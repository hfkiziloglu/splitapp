# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "ev-arkadasi" - a React Native Expo app built with TypeScript for expense management and group household tracking. The app uses Supabase for backend services and follows Expo Router for navigation.

## Development Commands

```bash
# Start development server
expo start

# Run on specific platforms
expo start --android
expo start --ios
expo start --web
```

## Architecture

### Core Structure
- **Expo Router**: File-based routing with nested layouts
- **Authentication**: Context-based auth state management via `state/auth-context.tsx`
- **Database**: Supabase client configured in `lib/supabase.ts`
- **UI Components**: Reusable components in `components/ui/`
- **Services**: Business logic in `services/` directory
- **Path Aliases**: `@/*` maps to project root

### Navigation Structure
```
app/
├── _layout.tsx              # Root layout with AuthProvider and GestureHandler
├── (auth)/                  # Authentication routes (login, register)
├── (home)/                  # Main app routes (protected)
│   ├── index.tsx           # Home/dashboard
│   ├── settings.tsx        # User settings
│   ├── join-group.tsx      # Group joining
│   ├── group/[id].tsx      # Group details
│   ├── group/[id]/notifications.tsx
│   └── expense/            # Expense management
└── join/[token].tsx        # Group invitation handling
```

### Key Dependencies
- **State Management**: React Context + react-hook-form for forms
- **Data Validation**: Zod schemas
- **Animations**: react-native-reanimated + react-native-gesture-handler
- **Charts**: Custom neon donut charts with d3-shape + react-native-svg
- **Storage**: AsyncStorage for local persistence
- **Notifications**: expo-notifications

### Services Architecture
- `NotificationService.ts`: Push notification handling
- `UserHouseholdPreferencesService.ts`: User preference management

### TypeScript Configuration
- Strict mode enabled
- Bundler module resolution
- Path aliases configured for clean imports

### Supabase Integration
- Configuration via expo constants from app.json extra field
- Session persistence enabled with auto-refresh
- Anonymous key exposed in app.json (public anon key, safe for client-side)