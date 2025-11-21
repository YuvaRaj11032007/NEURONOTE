
import { createClient } from '@supabase/supabase-js';

// Credentials provided by user
const supabaseUrl = 'https://kzdcodlawbywqjybcoou.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZGNvZGxhd2J5d3FqeWJjb291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTc4MjksImV4cCI6MjA3OTE5MzgyOX0.IB5-rnlPZUswDWKMaFnFacFj7RQlBoUT6PEHUnhoVhI';

export const supabase = createClient(supabaseUrl, supabaseKey);
