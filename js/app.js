// ─── Utilidades compartidas ───

// Cargar sidebar en todas las páginas
async function loadSidebar() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const { data: profile } = await db
    .from('profiles')
    .select('full_name, role')
    .eq('id', session.user.id)
    .single();

  const currentPage = window.location.pathname.split('/').pop();

  sidebar.innerHTML = `
    <h1>Taller Pro</h1>
    <a href="dashboard.html" class="${currentPage === 'dashboard.html' ? 'active' : ''}">
      📋 Dashboard
    </a>
    <a href="appointments.html" class="${currentPage === 'appointments.html' ? 'active' : ''}">
      📅 Citas
    </a>
    <a href="clients.html" class="${currentPage === 'clients.html' ? 'active' : ''}">
      👥 Clientes
    </a>
    <a href="services.html" class="${currentPage === 'services.html' ? 'active' : ''}">
      🔧 Servicios
    </a>
    <a href="parts.html" class="${currentPage === 'parts.html' ? 'active' : ''}">
      🔩 Repuestos
    </a>
    <div class="sidebar-footer">
      <div style="font-weight:500;color:var(--text)">${escapeHTML(profile?.full_name || 'Usuario')}</div>
      <div>${profile?.role === 'admin' ? 'Administrador' : 'Operario'}</div>
      <button onclick="logout()" class="btn btn-sm btn-danger" style="margin-top:.5rem">Salir</button>
    </div>
  `;
}

// Inicializar en todas las páginas
document.addEventListener('DOMContentLoaded', loadSidebar);
