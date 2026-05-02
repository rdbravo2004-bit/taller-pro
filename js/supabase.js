// ─── Configuración Supabase ───
// Reemplazar con las credenciales de tu proyecto en https://supabase.com
const SUPABASE_URL = 'https://glrveolwztjirwatdmyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscnZlb2x3enRqaXJ3YXRkbXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjgwNjIsImV4cCI6MjA5MzEwNDA2Mn0.mzliyZzOUTFx0p79VatSSTpID6xkofyUW3vzn8dB4HI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// ─── Helpers ───

function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.substring(0, 5);
}

function statusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    in_progress: 'En curso',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };
  return labels[status] || status;
}

// ─── Auth ───

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function register({ full_name, email, password }) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: window.location.origin + '/dashboard.html'
    }
  });
  if (error) throw error;
  return data;
}

async function logout() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

// ─── Verificar rol ───

async function isAdmin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return false;
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  return profile?.role === 'admin';
}
