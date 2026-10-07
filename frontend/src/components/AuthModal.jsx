import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, apiBase }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = tab === 'login'
      ? { username, password }
      : { username, password, email };

    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Помилка авторизації');
      }

      setSuccessMsg(data.message || 'Успішно!');
      if (data.token && data.user) {
        onAuthSuccess(data.user, data.token);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              {tab === 'login' ? 'Вхід до системи' : 'Реєстрація користувача'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              Збереження історії аналізу та індивідуальних звітів у базі даних
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Закрити">
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="modal-tabs" style={{ padding: '0.5rem 1.25rem' }}>
          <button
            className={`modal-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setError(null);
            }}
          >
            Вхід
          </button>
          <button
            className={`modal-tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setError(null);
            }}
          >
            Реєстрація
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fb7185',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.8rem'
            }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#6ee7b7',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.8rem'
            }}>
              {successMsg}
            </div>
          )}

          <div>
            <label className="manual-label">Ім'я користувача (Логін)</label>
            <input
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введіть логін..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="manual-label">Електронна пошта (необов'язково)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          )}

          <div>
            <label className="manual-label">Пароль</label>
            <input
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введіть пароль..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', height: '42px', marginTop: '0.5rem', fontSize: '0.88rem' }}
          >
            {loading ? 'Обробка...' : (tab === 'login' ? 'Увійти' : 'Створити акаунт')}
          </button>
        </form>

        <div className="modal-footer" style={{ padding: '0.75rem 1.5rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Авторизація зберігає історію сесії в локальній базі даних SQLite
          </span>
        </div>
      </div>
    </div>
  );
}
