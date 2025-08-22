-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'judge', 'participant');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'participant',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create participants table
CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  chest_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  church TEXT NOT NULL,
  district TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create judges table
CREATE TABLE public.judges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  church TEXT NOT NULL,
  contact TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('writing', 'stage')),
  rules TEXT,
  time_limit INTEGER, -- in minutes, null means no time limit
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  results_published BOOLEAN NOT NULL DEFAULT FALSE,
  event_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create event criteria table (scoring parameters)
CREATE TABLE public.event_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 10,
  weight DECIMAL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create event judges table (judge assignments)
CREATE TABLE public.event_judges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, judge_id)
);

-- Create event participants table
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, participant_id)
);

-- Create scores table
CREATE TABLE public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES public.event_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, participant_id, judge_id, criteria_id)
);

-- Create results table (calculated final results)
CREATE TABLE public.results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  total_score DECIMAL NOT NULL,
  average_score DECIMAL NOT NULL,
  rank INTEGER,
  tie_breaker_reason TEXT,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, participant_id)
);

-- Create audit log table for transparency
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE profiles.user_id = get_user_role.user_id;
$$;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for participants
CREATE POLICY "Admins can manage participants" ON public.participants FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Participants can view themselves" ON public.participants FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Others can view participants" ON public.participants FOR SELECT USING (true);

-- Create RLS policies for judges
CREATE POLICY "Admins can manage judges" ON public.judges FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Judges can view themselves" ON public.judges FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Others can view judges" ON public.judges FOR SELECT USING (true);

-- Create RLS policies for events
CREATE POLICY "Admins can manage events" ON public.events FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view events" ON public.events FOR SELECT USING (true);

-- Create RLS policies for event criteria
CREATE POLICY "Admins can manage criteria" ON public.event_criteria FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view criteria" ON public.event_criteria FOR SELECT USING (true);

-- Create RLS policies for event judges
CREATE POLICY "Admins can manage event judges" ON public.event_judges FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view event judges" ON public.event_judges FOR SELECT USING (true);

-- Create RLS policies for event participants
CREATE POLICY "Admins can manage event participants" ON public.event_participants FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view event participants" ON public.event_participants FOR SELECT USING (true);

-- Create RLS policies for scores
CREATE POLICY "Admins can manage all scores" ON public.scores FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Judges can manage their own scores" ON public.scores FOR ALL USING (
  judge_id IN (SELECT id FROM public.judges WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "Others can view scores when results are published" ON public.scores FOR SELECT USING (
  event_id IN (SELECT id FROM public.events WHERE results_published = true)
);

-- Create RLS policies for results
CREATE POLICY "Admins can manage results" ON public.results FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view results when published" ON public.results FOR SELECT USING (
  event_id IN (SELECT id FROM public.events WHERE results_published = true)
);

-- Create RLS policies for audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_judges_updated_at BEFORE UPDATE ON public.judges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'participant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();