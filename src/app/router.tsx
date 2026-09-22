import { createBrowserRouter } from 'react-router-dom'

import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from '@/features/auth/route-guards'
import { VerifyEmailPage } from '@/features/auth/verify-email-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { LabPage } from '@/features/lab/lab-page'
import { LandingPage } from '@/features/landing/landing-page'
import { NotFoundPage } from '@/features/landing/not-found-page'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
import { SettingsPage } from '@/features/profile/settings-page'
import { ResultsPage } from '@/features/results/results-page'
import { SandboxPage } from '@/features/sandbox/sandbox-page'
import { StyleguidePage } from '@/features/styleguide/styleguide-page'
import { CapturePage } from '@/features/teach/capture-page'
import { ExerciseEditorPage } from '@/features/teach/exercise-editor-page'
import { SubmissionsPage } from '@/features/teach/submissions-page'
import { TeachPage } from '@/features/teach/teach-page'

/**
 * Only the routes that have real screens behind them are registered. The full
 * map in section 1.3 of the build plan gets filled in as each phase lands —
 * registering a route that renders nothing makes the app look further along than
 * it is.
 *
 * ---------------------------------------------------------------------------
 * THREE KINDS OF ROUTE, AND WHY /reset-password IS NOT ONE OF THEM
 *
 *   PublicOnlyRoute  sign-in and register. Someone already signed in who lands
 *                    here has hit a stale bookmark, and a form that would sign
 *                    them in as themselves is a dead end.
 *
 *   ProtectedRoute   needs a session, and — unless it opts out — a finished
 *                    onboarding. `/onboarding` is the one that opts out, or it
 *                    would redirect to itself forever.
 *
 *   RoleRoute        needs a particular role, and renders a designed 403 rather
 *                    than redirecting. This is a *second* copy of a check the
 *                    API already makes; `/api/teach/*` refuses a student session
 *                    called directly with curl, and that is the one that counts.
 *
 * `/reset-password` and `/verify-email` are bare on purpose. Both are reached
 * from an email link, and a signed-in person following a reset link is precisely
 * the case where bouncing them to a dashboard is wrong.
 * ---------------------------------------------------------------------------
 */
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/styleguide', element: <StyleguidePage /> },

  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <RegisterPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicOnlyRoute>
        <ForgotPasswordPage />
      </PublicOnlyRoute>
    ),
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },

  {
    path: '/onboarding',
    element: (
      // The opt-out. Everything else redirects *here* when onboarding is unfinished.
      <ProtectedRoute allowUnonboarded>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/lab/:exerciseId',
    element: (
      <ProtectedRoute>
        <LabPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/sandbox',
    element: (
      <ProtectedRoute>
        <SandboxPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/teach',
    element: (
      <ProtectedRoute>
        <RoleRoute role="instructor">
          <TeachPage />
        </RoleRoute>
      </ProtectedRoute>
    ),
  },

  {
    path: '/teach/exercises/new',
    element: (
      <ProtectedRoute>
        <RoleRoute role="instructor">
          <ExerciseEditorPage />
        </RoleRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/teach/exercises/:exerciseId',
    element: (
      <ProtectedRoute>
        <RoleRoute role="instructor">
          <ExerciseEditorPage />
        </RoleRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/teach/exercises/:exerciseId/capture',
    element: (
      <ProtectedRoute>
        <RoleRoute role="instructor">
          <CapturePage />
        </RoleRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/teach/exercises/:exerciseId/submissions',
    element: (
      <ProtectedRoute>
        <RoleRoute role="instructor">
          <SubmissionsPage />
        </RoleRoute>
      </ProtectedRoute>
    ),
  },
  {
    // The student reads their own; the instructor who teaches the exercise
    // reads it from the scores list. The API decides which, per attempt.
    path: '/results/:attemptId',
    element: (
      <ProtectedRoute>
        <ResultsPage />
      </ProtectedRoute>
    ),
  },

  { path: '*', element: <NotFoundPage /> },
])
