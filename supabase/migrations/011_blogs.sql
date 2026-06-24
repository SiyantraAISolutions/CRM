-- Create blogs table
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    author TEXT,
    image_url TEXT,
    date TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(brand_id, slug)
);

-- Enable RLS
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view published blogs
CREATE POLICY "Public can view published blogs" ON public.blogs 
    FOR SELECT USING (is_published = true);

-- Authenticated CRM users can manage all blogs
CREATE POLICY "Authenticated users can view all blogs" ON public.blogs 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert blogs" ON public.blogs 
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update blogs" ON public.blogs 
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete blogs" ON public.blogs 
    FOR DELETE TO authenticated USING (true);
