import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ParticipantManagement from "./pages/admin/ParticipantManagement";
import JudgeManagement from "./pages/admin/JudgeManagement";
import EventManagement from "./pages/admin/EventManagement";
import SeasonManagement from "./pages/admin/SeasonManagement";
import JudgeAssignment from "./pages/admin/JudgeAssignment";
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
            <Route path="/admin/seasons" element={
              <ProtectedRoute requiredRole="admin">
                <SeasonManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/events" element={
              <ProtectedRoute requiredRole="admin">
                <EventManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/assignments" element={
              <ProtectedRoute requiredRole="admin">
                <JudgeAssignment />
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
              <ProtectedRoute requiredRole="judge">
                <JudgeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/judge/score/:eventId" element={
              <ProtectedRoute requiredRole="judge">
                <JudgeScoringInterface />
              </ProtectedRoute>
            } />
            
            {/* Participant Routes */}
            <Route path="/participant" element={
              <ProtectedRoute requiredRole="participant">
                <ParticipantDashboard />
              </ProtectedRoute>
            } />
            
            {/* Public Routes */}
            <Route path="/leaderboard" element={<Leaderboard />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
