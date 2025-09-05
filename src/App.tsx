import { ConfigProvider, App as AntApp } from 'antd';
import { message } from 'antd';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from '@/hooks/useAuth';
import { ParticipantAuthProvider } from '@/hooks/useParticipantAuth';
import ProtectedRoute from "@/components/ProtectedRoute";
import ParticipantProtectedRoute from "@/components/ParticipantProtectedRoute";
import JudgeProtectedRoute from "@/components/JudgeProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ParticipantManagement from "./pages/admin/ParticipantManagement";
import JudgeManagement from "./pages/admin/JudgeManagement";
import EventManagement from "./pages/admin/EventManagement";
import EventDetails from "./pages/admin/EventDetails";
import EventLevelManagement from "./pages/admin/EventLevelManagement";

import RealtimeScoreboard from "./pages/admin/RealtimeScoreboard";
import ResultsManagement from "./pages/admin/ResultsManagement";
import JudgeScoringInterface from "./pages/judge/JudgeScoringInterface";
import ParticipantDashboard from "./pages/participant/ParticipantDashboard";
import JudgeDashboard from "./pages/judge/JudgeDashboard";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ParticipantAuthProvider>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#8b5cf6',
                borderRadius: 8,
              },
            }}
          >
            <AntApp>
              <BrowserRouter>
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
              </BrowserRouter>
            </AntApp>
          </ConfigProvider>
        </ParticipantAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
);

export default App;
