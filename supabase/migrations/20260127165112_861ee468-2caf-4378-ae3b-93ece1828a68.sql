-- Create suggestions table for portal feedback
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'implemented', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Users can view all suggestions
CREATE POLICY "Anyone can view suggestions"
ON public.suggestions
FOR SELECT
USING (true);

-- Users can create their own suggestions
CREATE POLICY "Users can create suggestions"
ON public.suggestions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own suggestions
CREATE POLICY "Users can update own suggestions"
ON public.suggestions
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own suggestions
CREATE POLICY "Users can delete own suggestions"
ON public.suggestions
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_suggestions_updated_at
BEFORE UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();