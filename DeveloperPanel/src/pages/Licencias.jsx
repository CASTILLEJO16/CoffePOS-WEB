import { useState, useEffect } from 'react';
import {
  Coffee,
  Building2,
  Key,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Laptop,
  Trash2,
  Lock,
  Unlock,
  User,
  Mail,
  Phone,
  MapPin,
  X,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  AlertCircle,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useTheme } from '../context/ThemeContext.jsx';
import { useDevAuth } from '../context/DevAuthContext.jsx';
import licenseService from '../services/licenseService.js';
import './Licencias.css';

const Licencias = () => {
  const { theme, toggleTheme } = useTheme();
  const { logout: devLogout } = useDevAuth();
  const [activeTab, setActiveTab] = useState('clientes');
  const [clients, setClients] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Form states
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    businessName: '',
    address: '',
    notes: ''
  });

  const [licenseForm, setLicenseForm] = useState({
    clientId: '',
    type: 'trial',
    durationDays: 30,
    maxDevices: 1
  });

  useEffect(() => {
    if (activeTab === 'clientes') {
      fetchClients();
    } else {
      fetchLicenses();
    }
  }, [activeTab]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await licenseService.getClients();
      setClients(response.data.data || []);
    } catch (error) {
      console.error('Error al obtener clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const response = await licenseService.getLicenses();
      setLicenses(response.data.data || []);
    } catch (error) {
      console.error('Error al obtener licencias:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await licenseService.createClient(clientForm);
      setShowClientModal(false);
      setClientForm({
        name: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        businessName: '',
        address: '',
        notes: ''
      });
      Swal.fire({
        icon: 'success',
        title: 'Cafetería Registrada',
        text: 'La cafetería y su usuario administrador han sido creados correctamente.',
        confirmButtonColor: '#5c4033'
      });
      fetchClients();
    } catch (error) {
      console.error('Error al crear cliente:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al crear la cafetería',
        confirmButtonColor: '#5c4033'
      });
    }
  };

  const handleGenerateLicense = async (e) => {
    e.preventDefault();
    try {
      const response = await licenseService.generateLicense(licenseForm);
      setShowLicenseModal(false);
      setLicenseForm({
        clientId: '',
        type: 'trial',
        durationDays: 30,
        maxDevices: 1
      });
      const generatedKey = response.data?.data?.licenseKey;
      Swal.fire({
        icon: 'success',
        title: 'Licencia Generada',
        html: `<p>Se ha generado la clave de licencia:</p><strong style="font-family: monospace; font-size: 1.1rem; color: #5c4033;">${generatedKey}</strong>`,
        confirmButtonText: 'Copiar Clave y Cerrar',
        confirmButtonColor: '#5c4033'
      }).then(() => {
        if (generatedKey) {
          navigator.clipboard.writeText(generatedKey);
        }
      });
      fetchLicenses();
    } catch (error) {
      console.error('Error al generar licencia:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error al generar licencia',
        confirmButtonColor: '#5c4033'
      });
    }
  };

  const handleBlockLicense = async (licenseId) => {
    const confirm = await Swal.fire({
      title: '¿Bloquear Licencia?',
      text: 'Los dispositivos asociados ya no podrán acceder al sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, bloquear',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      await licenseService.blockLicense(licenseId);
      Swal.fire({ icon: 'success', title: 'Licencia Bloqueada', timer: 1500, showConfirmButton: false });
      fetchLicenses();
    } catch (error) {
      console.error('Error al bloquear licencia:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo bloquear la licencia' });
    }
  };

  const handleActivateLicense = async (licenseId) => {
    try {
      await licenseService.activateLicense(licenseId);
      Swal.fire({ icon: 'success', title: 'Licencia Activada', timer: 1500, showConfirmButton: false });
      fetchLicenses();
    } catch (error) {
      console.error('Error al activar licencia:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo activar la licencia' });
    }
  };

  const handleExtendLicense = async (licenseId) => {
    const { value: days } = await Swal.fire({
      title: 'Extender Licencia',
      input: 'number',
      inputLabel: 'Cantidad de días adicionales',
      inputValue: 30,
      showCancelButton: true,
      confirmButtonColor: '#5c4033',
      inputValidator: (value) => {
        if (!value || parseInt(value) <= 0) {
          return 'Ingresa un número de días válido';
        }
      }
    });

    if (!days) return;

    try {
      await licenseService.extendLicense({ licenseId, additionalDays: parseInt(days) });
      Swal.fire({ icon: 'success', title: 'Licencia Extendida', timer: 1500, showConfirmButton: false });
      fetchLicenses();
    } catch (error) {
      console.error('Error al extender licencia:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo extender la licencia' });
    }
  };

  const handleViewDevices = async (licenseId) => {
    try {
      const response = await licenseService.getLicenseDevices(licenseId);
      setDevices(response.data.data || []);
      setSelectedLicense(licenseId);
      setShowDevicesModal(true);
    } catch (error) {
      console.error('Error al obtener dispositivos:', error);
    }
  };

  const handleBlockDevice = async (deviceId) => {
    const confirm = await Swal.fire({
      title: '¿Bloquear Dispositivo?',
      text: 'Este dispositivo perderá el acceso a la licencia.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Bloquear'
    });

    if (!confirm.isConfirmed) return;

    try {
      await licenseService.blockDevice({ deviceId });
      const response = await licenseService.getLicenseDevices(selectedLicense);
      setDevices(response.data.data || []);
    } catch (error) {
      console.error('Error al bloquear dispositivo:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo bloquear el dispositivo' });
    }
  };

  const handleReleaseDevice = async (deviceId) => {
    const confirm = await Swal.fire({
      title: '¿Liberar Dispositivo?',
      text: 'Liberará un cupo de dispositivo en la licencia.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d97706',
      confirmButtonText: 'Liberar'
    });

    if (!confirm.isConfirmed) return;

    try {
      await licenseService.releaseDevice({ deviceId });
      const response = await licenseService.getLicenseDevices(selectedLicense);
      setDevices(response.data.data || []);
    } catch (error) {
      console.error('Error al liberar dispositivo:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo liberar el dispositivo' });
    }
  };

  const handleDeleteClient = async (clientId) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar Cafetería?',
      text: 'Esta acción eliminará permanentemente la cafetería y todas sus licencias asociadas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      await licenseService.deleteClient(clientId);
      Swal.fire({ icon: 'success', title: 'Cafetería Eliminada', timer: 1500, showConfirmButton: false });
      fetchClients();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar la cafetería' });
    }
  };

  const copyToClipboard = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLogout = () => {
    devLogout();
  };

  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.businessName && client.businessName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredLicenses = licenses.filter(license =>
    license.licenseKey?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (license.client && license.client.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeLicensesCount = licenses.filter(l => l.status === 'active').length;

  return (
    <div className="licencias-page">
      <div className="licencias-container">
        {/* Header / Navbar Banner */}
        <header className="licencias-nav">
          <div className="licencias-brand">
            <div className="brand-icon-wrapper">
              <Coffee size={28} />
            </div>
            <div>
              <h1 className="brand-title">Coffee POS</h1>
              <p className="brand-subtitle">Panel de Desarrollador - Gestión de Licencias & Cafeterías</p>
            </div>
          </div>

          <div className="stats-pills">
            <div className="stat-pill">
              <Building2 size={16} />
              <span>Cafeterías: <strong>{clients.length}</strong></span>
            </div>
            <div className="stat-pill">
              <ShieldCheck size={16} />
              <span>Licencias Activas: <strong>{activeLicensesCount}</strong></span>
            </div>
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              type="button"
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout} title="Cerrar Sesión">
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </header>

        {/* Content Section */}
        <main className="licencias-content-card">
          <div className="licencias-tabs-header">
            <div className="licencias-tabs">
              <button
                className={`licencias-tab ${activeTab === 'clientes' ? 'active' : ''}`}
                onClick={() => setActiveTab('clientes')}
              >
                <Building2 size={18} />
                Cafeterías ({clients.length})
              </button>
              <button
                className={`licencias-tab ${activeTab === 'licencias' ? 'active' : ''}`}
                onClick={() => setActiveTab('licencias')}
              >
                <Key size={18} />
                Licencias ({licenses.length})
              </button>
            </div>

            <div className="search-and-actions">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {activeTab === 'clientes' && (
                <button className="btn btn-primary" onClick={() => setShowClientModal(true)}>
                  <Plus size={18} />
                  Registrar Cafetería
                </button>
              )}

              {activeTab === 'licencias' && (
                <button className="btn btn-primary" onClick={() => setShowLicenseModal(true)}>
                  <Plus size={18} />
                  Generar Licencia
                </button>
              )}
            </div>
          </div>

          {/* Table: Cafeterías */}
          {activeTab === 'clientes' && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre Propietario</th>
                    <th>Usuario (POS)</th>
                    <th>Email</th>
                    <th>Cafetería</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => (
                    <tr key={client._id}>
                      <td>
                        <div className="client-name-cell">
                          <div className="client-avatar">
                            {client.name?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <strong>{client.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="username-pill">
                          {client.username || client.email?.split('@')[0] || '-'}
                        </span>
                      </td>
                      <td>{client.email}</td>
                      <td><strong>{client.businessName || '-'}</strong></td>
                      <td>{client.phone || '-'}</td>
                      <td>
                        <span className={`status-badge ${client.status}`}>
                          {client.status === 'active' ? 'Activo' : client.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setSelectedClient(client);
                              setSearchTerm(client.name);
                              setActiveTab('licencias');
                            }}
                          >
                            <Key size={14} />
                            Ver Licencias
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteClient(client._id)}
                          >
                            <Trash2 size={14} />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table: Licencias */}
          {activeTab === 'licencias' && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Clave de Licencia</th>
                    <th>Cafetería</th>
                    <th>Tipo</th>
                    <th>Duración</th>
                    <th>Dispositivos</th>
                    <th>Estado</th>
                    <th>Expiración</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map(license => (
                    <tr key={license._id}>
                      <td>
                        <div className="license-key-badge">
                          {license.licenseKey}
                          <button
                            className="copy-icon-btn"
                            title="Copiar Clave"
                            onClick={() => copyToClipboard(license.licenseKey)}
                          >
                            {copiedKey === license.licenseKey ? (
                              <Check size={14} color="#059669" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td><strong>{license.client?.businessName || license.client?.name || '-'}</strong></td>
                      <td>
                        <span className={`status-badge ${license.type}`}>
                          {license.type === 'trial' ? 'Demo' : license.type === 'subscription' ? 'Suscripción' : 'Vitalicia'}
                        </span>
                      </td>
                      <td>{license.duration} días</td>
                      <td>
                        <span className="username-pill">
                          {license.devicesUsed || 0} / {license.maxDevices}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${license.status}`}>
                          {license.status === 'active' ? 'Activa' : license.status === 'expired' ? 'Expirada' : 'Bloqueada'}
                        </span>
                      </td>
                      <td>{new Date(license.endDate).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleViewDevices(license._id)}
                          >
                            <Laptop size={14} />
                            Dispositivos
                          </button>

                          {license.status === 'active' ? (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleBlockLicense(license._id)}
                            >
                              <Lock size={14} />
                              Bloquear
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleActivateLicense(license._id)}
                            >
                              <Unlock size={14} />
                              Activar
                            </button>
                          )}

                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => handleExtendLicense(license._id)}
                          >
                            <Calendar size={14} />
                            Extender
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Clock size={28} />
              </div>
              <p>Cargando información...</p>
            </div>
          )}

          {!loading && activeTab === 'clientes' && filteredClients.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Building2 size={28} />
              </div>
              <p>No se encontraron cafeterías registradas.</p>
            </div>
          )}

          {!loading && activeTab === 'licencias' && filteredLicenses.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Key size={28} />
              </div>
              <p>No se encontraron licencias generadas.</p>
            </div>
          )}
        </main>

        {/* Modal: Registrar Cafetería */}
        {showClientModal && (
          <div className="modal-overlay">
            <div className="modal-content animate-scale-in">
              <div className="modal-header">
                <h2>Registrar Nueva Cafetería</h2>
                <button className="modal-close" onClick={() => setShowClientModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateClient}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Propietario *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre del dueño"
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Contacto *</label>
                    <input
                      type="email"
                      required
                      placeholder="correo@ejemplo.com"
                      value={clientForm.email}
                      onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Usuario POS *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: cafeteria_admin"
                      value={clientForm.username}
                      onChange={(e) => setClientForm({ ...clientForm, username: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Contraseña Admin *</label>
                    <input
                      type="password"
                      required
                      placeholder="Contraseña del sistema POS"
                      value={clientForm.password}
                      onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Nombre Cafetería *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Café Mi Sueño"
                      value={clientForm.businessName}
                      onChange={(e) => setClientForm({ ...clientForm, businessName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Teléfono</label>
                    <input
                      type="text"
                      placeholder="Número telefónico"
                      value={clientForm.phone}
                      onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Dirección</label>
                    <input
                      type="text"
                      placeholder="Dirección del local"
                      value={clientForm.address}
                      onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Notas</label>
                    <textarea
                      placeholder="Observaciones adicionales..."
                      value={clientForm.notes}
                      onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowClientModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Building2 size={16} />
                    Registrar Cafetería
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Generar Licencia */}
        {showLicenseModal && (
          <div className="modal-overlay">
            <div className="modal-content animate-scale-in">
              <div className="modal-header">
                <h2>Generar Licencia</h2>
                <button className="modal-close" onClick={() => setShowLicenseModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleGenerateLicense}>
                <div className="form-group">
                  <label>Cafetería *</label>
                  <select
                    required
                    value={licenseForm.clientId}
                    onChange={(e) => setLicenseForm({ ...licenseForm, clientId: e.target.value })}
                  >
                    <option value="">Seleccionar cafetería</option>
                    {clients.map(client => (
                      <option key={client._id} value={client._id}>
                        {client.businessName || client.name} ({client.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Tipo de Licencia *</label>
                    <select
                      required
                      value={licenseForm.type}
                      onChange={(e) => setLicenseForm({ ...licenseForm, type: e.target.value })}
                    >
                      <option value="trial">Prueba (Demo)</option>
                      <option value="subscription">Suscripción</option>
                      <option value="lifetime">Vitalicia</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Duración (días) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={licenseForm.durationDays}
                      onChange={(e) => setLicenseForm({ ...licenseForm, durationDays: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Máximo de Dispositivos *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={licenseForm.maxDevices}
                      onChange={(e) => setLicenseForm({ ...licenseForm, maxDevices: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowLicenseModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Key size={16} />
                    Generar Licencia
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Dispositivos Activos */}
        {showDevicesModal && (
          <div className="modal-overlay">
            <div className="modal-content animate-scale-in">
              <div className="modal-header">
                <h2>Dispositivos Registrados</h2>
                <button className="modal-close" onClick={() => setShowDevicesModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="devices-list">
                {devices.map(device => (
                  <div key={device._id} className="device-card">
                    <div className="device-info">
                      <div className="device-header">
                        <Laptop size={18} color="#5c4033" />
                        <span className="device-title">{device.deviceName}</span>
                      </div>
                      <div className="device-meta">
                        <span>Sistema: {device.os} - {device.browser}</span>
                        <span>IP: {device.ipAddress}</span>
                        <span>Último uso: {new Date(device.lastUsed).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="action-buttons">
                      {device.status === 'active' ? (
                        <>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleBlockDevice(device.deviceId)}
                          >
                            Bloquear
                          </button>
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => handleReleaseDevice(device.deviceId)}
                          >
                            Liberar
                          </button>
                        </>
                      ) : (
                        <span className={`status-badge ${device.status}`}>
                          {device.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {devices.length === 0 && (
                <div className="empty-state">
                  <p>No hay dispositivos registrados en esta licencia.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Licencias;
