-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default templates
INSERT INTO public.email_templates (name, subject, body) VALUES
('Purchase Confirmation', 'Purchase Confirmation - We have received your order', 'Thank you for your purchase. We will process your application and you will receive an update within 48 working hours.'),
('Application Received', 'Application & Documents Received', 'We are writing to confirm that we have successfully received your application and the attached documents. Our team is now reviewing them.'),
('Application Completed', 'Application Completed', 'Great news! Your application has been successfully completed. If physical documents were part of your order, they will be dispatched shortly.')
ON CONFLICT DO NOTHING;
