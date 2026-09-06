import { lazy, Suspense } from 'react';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import { antdTheme } from '@/design/antdTheme';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from '@/hooks/useAuth';
import { ParticipantAuthProvider } from '@/hooks/useParticipantAuth';
import { EventLevelProvider } from '@/hooks/useEventLevel';
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary';
import ProtectedRoute from "@/components/ProtectedRoute";
import ParticipantProtectedRoute from "@/components/ParticipantProtectedRoute";
import JudgeProtectedRoute from "@/components/JudgeProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

import NotFound from "./pages/NotFound";

// Route level code splitting: the admin screens are the biggest part of the
// bundle and a public visitor never opens them.
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ParticipantManagement = lazy(() => import("./pages/admin/ParticipantManagement"));
const ParticipantDetails = lazy(() => import("./pages/admin/ParticipantDetails"));
const JudgeManagement = lazy(() => import("./pages/admin/JudgeManagement"));
const EventManagement = lazy(() => import("./pages/admin/EventManagement"));
const EventDetails = lazy(() => import("./pages/admin/EventDetails"));
const EventLevelManagement = lazy(() => import("./pages/admin/EventLevelManagement"));
const RealtimeScoreboard = lazy(() => import("./pages/admin/RealtimeScoreboard"));
const ResultsManagement = lazy(() => import("./pages/admin/ResultsManagement"));
const WinnersPresentation = lazy(() => import("./pages/admin/WinnersPresentation"));
const JudgeScoringInterface = lazy(() => import("./pages/judge/JudgeScoringInterface"));
const ParticipantDashboard = lazy(() => import("./pages/participant/ParticipantDashboard"));
const JudgeDashboard = lazy(() => import("./pages/judge/JudgeDashboard"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));

const PageFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ParticipantAuthProvider>
          <EventLevelProvider>
          <ConfigProvider theme={antdTheme}>
            <AntApp>
              <BrowserRouter>
          <ChunkErrorBoundary>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/participants" element={
              <ProtectedRoute requiredRole="admin">
                <ParticipantManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/participants/:participantId" element={
              <ProtectedRoute requiredRole="admin">
                <ParticipantDetails />
              </ProtectedRoute>
            } />
            <Route path="/admin/judges" element={
              <ProtectedRoute requiredRole="admin">
                <JudgeManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/event-levels" element={
              <ProtectedRoute requiredRole="admin">
                <EventLevelManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/events" element={
              <ProtectedRoute requiredRole="admin">
                <EventManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId" element={
              <ProtectedRoute requiredRole="admin">
                <EventDetails />
              </ProtectedRoute>
            } />

            <Route 
              path="/admin/scoreboard/:eventId" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <RealtimeScoreboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/results" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <ResultsManagement />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/admin/results/present"
              element={
                <ProtectedRoute requiredRole="admin">
                  <WinnersPresentation />
                </ProtectedRoute>
              }
            />
            
            {/* Judge Routes */}
            <Route path="/judge" element={
              <JudgeProtectedRoute>
                <JudgeDashboard />
              </JudgeProtectedRoute>
            } />
            <Route path="/judge/score/:eventId" element={
              <JudgeProtectedRoute>
                <JudgeScoringInterface />
              </JudgeProtectedRoute>
            } />
            
            {/* Participant Routes */}
            <Route path="/participant" element={
              <ParticipantProtectedRoute>
                <ParticipantDashboard />
              </ParticipantProtectedRoute>
            } />
            
            {/* Public Routes */}
            <Route path="/leaderboard" element={<Leaderboard />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ChunkErrorBoundary>
              </BrowserRouter>
            </AntApp>
          </ConfigProvider>
          </EventLevelProvider>
        </ParticipantAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
);

export default App;
