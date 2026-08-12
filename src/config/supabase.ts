import { createClient } from '@supabase/supabase-js';
import { Request } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Standard client for public/anonymous operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// NEW: Generates a scoped client passing the user's JWT so PostgreSQL RLS applies correctly
export const getAuthClient = (req: Request) => {
  const token = req.headers.authorization?.split(' ')[1] || '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
};