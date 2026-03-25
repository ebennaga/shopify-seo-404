'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// ── Tipe Data ──
type Error404 = {
  id: string;
  url: string;
  suggested_target: string;
  hits: number;
  status: 'pending' | 'fixed' | 'ignored';
  last_seen: string;
};

type Redirect = {
  id: string;
  from_path: string;
  to_path: string;
  type: string;
  hits: number;
  created_at: string;
};

type Pattern = {
  id: string;
  name: string;
  match_pattern: string;
  target_url: string;
  is_active: boolean;
  matched_count: number;
};

// ── Komponen Utama ──
export default function Dashboard() {
  const params = useSearchParams();
  const shop = params.get('shop') || '';
  const [tab, setTab] = useState<'errors' | 'redirects' | 'patterns'>('errors');
  const [errors, setErrors] = useState<Error404[]>([]);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(
    null,
  );
  const [bulkLoading, setBulkLoading] = useState(false);

  // Form states
  const [addFrom, setAddFrom] = useState('');
  const [addTo, setAddTo] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCSV, setBulkCSV] = useState('');
  const [pName, setPName] = useState('');
  const [pMatch, setPMatch] = useState('');
  const [pTarget, setPTarget] = useState('');

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch Data ──
  const fetchErrors = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    const res = await fetch(`/api/errors?shop=${shop}&status=all`);
    const json = await res.json();
    setErrors(json.data || []);
    setLoading(false);
  }, [shop]);

  const fetchRedirects = useCallback(async () => {
    if (!shop) return;
    const res = await fetch(`/api/redirects?shop=${shop}`);
    const json = await res.json();
    setRedirects(json.data || []);
  }, [shop]);

  const fetchPatterns = useCallback(async () => {
    if (!shop) return;
    const res = await fetch(`/api/patterns?shop=${shop}`);
    const json = await res.json();
    setPatterns(json.data || []);
  }, [shop]);

  useEffect(() => {
    fetchErrors();
    fetchRedirects();
    fetchPatterns();
  }, [shop]);

  // ── Actions ──
  const fixOne = async (error: Error404) => {
    const res = await fetch('/api/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        from_path: error.url,
        to_path: error.suggested_target,
        error_id: error.id,
      }),
    });
    if (res.ok) {
      showToast(`✓ Redirect dibuat: ${error.url}`);
      fetchErrors();
      fetchRedirects();
    } else {
      const j = await res.json();
      showToast(j.error || 'Gagal', 'error');
    }
  };

  const ignoreError = async (id: string) => {
    await fetch('/api/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'ignored' }),
    });
    fetchErrors();
    showToast('Error diabaikan');
  };

  const updateSuggestion = async (id: string, val: string) => {
    await fetch('/api/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, suggested_target: val }),
    });
    fetchErrors();
  };

  const bulkFixAll = async () => {
    setBulkLoading(true);
    const res = await fetch('/api/redirects/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, mode: 'fix_all' }),
    });
    const json = await res.json();
    setBulkLoading(false);
    showToast(`⚡ ${json.created} redirect dibuat, ${json.failed} gagal`);
    fetchErrors();
    fetchRedirects();
  };

  const addRedirect = async () => {
    if (!addFrom || !addTo) return showToast('Isi kedua field URL', 'warning');
    const res = await fetch('/api/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, from_path: addFrom, to_path: addTo }),
    });
    if (res.ok) {
      setAddFrom('');
      setAddTo('');
      setShowAddModal(false);
      showToast('✓ Redirect ditambahkan!');
      fetchRedirects();
    } else {
      const j = await res.json();
      showToast(j.error || 'Gagal', 'error');
    }
  };

  const deleteRedirect = async (id: string) => {
    await fetch('/api/redirects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, shop }),
    });
    showToast('Redirect dihapus');
    fetchRedirects();
  };

  const importCSV = async () => {
    if (!bulkCSV.trim()) return showToast('Paste CSV dulu', 'warning');
    const pairs = bulkCSV
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const [from, to] = line.split(',').map((s) => s.trim());
        return { from, to };
      })
      .filter((p) => p.from?.startsWith('/') && p.to?.startsWith('/'));

    if (!pairs.length)
      return showToast('Format salah. Gunakan: /from,/to', 'warning');

    setBulkLoading(true);
    const res = await fetch('/api/redirects/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, mode: 'import', pairs }),
    });
    const json = await res.json();
    setBulkLoading(false);
    setBulkCSV('');
    setShowBulkModal(false);
    showToast(`✓ ${json.created} redirect diimport`);
    fetchRedirects();
  };

  const savePattern = async () => {
    if (!pName || !pMatch || !pTarget)
      return showToast('Isi semua field pattern', 'warning');
    const res = await fetch('/api/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop,
        name: pName,
        match_pattern: pMatch,
        target_url: pTarget,
      }),
    });
    if (res.ok) {
      setPName('');
      setPMatch('');
      setPTarget('');
      showToast('✓ Pattern disimpan!');
      fetchPatterns();
    }
  };

  const togglePattern = async (id: string, current: boolean) => {
    await fetch('/api/patterns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    });
    fetchPatterns();
    showToast(current ? 'Pattern dinonaktifkan' : 'Pattern diaktifkan');
  };

  const deletePattern = async (id: string) => {
    await fetch('/api/patterns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchPatterns();
    showToast('Pattern dihapus');
  };

  const pending = errors.filter((e) => e.status === 'pending');
  const fixed = errors.filter((e) => e.status === 'fixed');

  // ── RENDER ──
  return (
    <div style={s.root}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>↩</div>
          <div style={s.logoText}>
            SEO<span style={{ color: '#60a5fa' }}>Redirect</span>
          </div>
        </div>
        <div style={s.storeChip}>
          <div style={s.dot} />
          <div style={s.storeName}>{shop || 'No store'}</div>
        </div>
        <nav style={{ padding: '12px' }}>
          {(
            [
              { id: 'errors', label: '⚠️  404 Errors', count: pending.length },
              {
                id: 'redirects',
                label: '↩  Redirects',
                count: redirects.length,
              },
              { id: 'patterns', label: '⚡  Auto Patterns', count: 0 },
            ] as const
          ).map((item) => (
            <div
              key={item.id}
              style={{ ...s.navItem, ...(tab === item.id ? s.navActive : {}) }}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.count > 0 && (
                <span
                  style={{
                    ...s.navBadge,
                    background: item.id === 'errors' ? '#ef4444' : '#2563eb',
                  }}
                >
                  {item.count}
                </span>
              )}
            </div>
          ))}
        </nav>
        {/* Stats di sidebar bawah */}
        <div style={s.sidebarStats}>
          <div style={s.sidebarStat}>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 20 }}>
              {pending.length}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
              Pending
            </div>
          </div>
          <div style={s.sidebarStat}>
            <div style={{ color: '#10b981', fontWeight: 700, fontSize: 20 }}>
              {fixed.length}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
              Fixed
            </div>
          </div>
          <div style={s.sidebarStat}>
            <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: 20 }}>
              {redirects.length}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
              Rules
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={s.main}>
        {/* TOPBAR */}
        <div style={s.topbar}>
          <div style={s.pageTitle}>
            {tab === 'errors' && '404 Error Monitor'}
            {tab === 'redirects' && 'Redirect Rules'}
            {tab === 'patterns' && 'Auto-Redirect Patterns'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {tab === 'errors' && (
              <button
                style={{
                  ...s.btnPrimary,
                  opacity: bulkLoading || !pending.length ? 0.5 : 1,
                }}
                onClick={bulkFixAll}
                disabled={bulkLoading || !pending.length}
              >
                {bulkLoading
                  ? 'Memproses...'
                  : `⚡ Fix Semua (${pending.length})`}
              </button>
            )}
            {tab === 'redirects' && (
              <>
                <button
                  style={s.btnWhite}
                  onClick={() => setShowBulkModal(true)}
                >
                  ⬆ Import CSV
                </button>
                <button
                  style={s.btnPrimary}
                  onClick={() => setShowAddModal(true)}
                >
                  + Tambah Redirect
                </button>
              </>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div style={s.content}>
          {/* ── TAB: 404 ERRORS ── */}
          {tab === 'errors' && (
            <>
              {/* Stats row */}
              <div style={s.statsRow}>
                {[
                  {
                    label: 'Pending 404',
                    value: pending.length,
                    color: '#ef4444',
                  },
                  {
                    label: 'Sudah Fixed',
                    value: fixed.length,
                    color: '#10b981',
                  },
                  {
                    label: 'Total Errors',
                    value: errors.length,
                    color: '#6b7280',
                  },
                  {
                    label: 'Total Rules',
                    value: redirects.length,
                    color: '#2563eb',
                  },
                ].map((st) => (
                  <div key={st.label} style={s.statBox}>
                    <div style={s.statLabel}>{st.label}</div>
                    <div style={{ ...s.statNum, color: st.color }}>
                      {st.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitle}>
                    <div style={s.liveDot} />
                    Real-time 404 Errors
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {pending.length} pending
                  </span>
                </div>
                {loading ? (
                  <div style={s.empty}>Loading...</div>
                ) : pending.length === 0 ? (
                  <div style={s.empty}>
                    <div style={{ fontSize: 36 }}>✅</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>
                      Tidak ada 404 error!
                    </div>
                    <div style={{ color: '#6b7280', marginTop: 4 }}>
                      Toko kamu bersih dari broken links.
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {[
                            'Broken URL',
                            'Target URL',
                            'Hits',
                            'Terakhir Dilihat',
                            'Aksi',
                          ].map((h) => (
                            <th key={h} style={s.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((e) => (
                          <tr key={e.id} style={s.tr}>
                            <td style={s.td}>
                              <code style={s.urlRed}>{e.url}</code>
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.inlineInput}
                                defaultValue={e.suggested_target}
                                onBlur={(ev) =>
                                  updateSuggestion(e.id, ev.target.value)
                                }
                                title="Klik untuk edit target URL"
                              />
                            </td>
                            <td style={s.td}>
                              <span
                                style={{
                                  ...s.badge,
                                  color: e.hits > 50 ? '#ef4444' : '#6b7280',
                                  fontWeight: e.hits > 50 ? 700 : 400,
                                }}
                              >
                                {e.hits}
                              </span>
                            </td>
                            <td style={s.td}>
                              <span style={s.muted}>
                                {new Date(e.last_seen).toLocaleDateString(
                                  'id-ID',
                                )}
                              </span>
                            </td>
                            <td style={s.td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  style={s.btnSuccess}
                                  onClick={() => fixOne(e)}
                                >
                                  → Fix
                                </button>
                                <button
                                  style={s.btnGhost}
                                  onClick={() => ignoreError(e.id)}
                                >
                                  Abaikan
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TAB: REDIRECTS ── */}
          {tab === 'redirects' && (
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Redirect Rules</div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {redirects.length} rules
                </span>
              </div>
              {redirects.length === 0 ? (
                <div style={s.empty}>
                  <div style={{ fontSize: 36 }}>↩</div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>
                    Belum ada redirect
                  </div>
                  <div style={{ color: '#6b7280', marginTop: 4 }}>
                    Tambah redirect atau fix 404 error di tab sebelumnya.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['Dari URL', 'Ke URL', 'Type', 'Dibuat', ''].map(
                          (h) => (
                            <th key={h} style={s.th}>
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {redirects.map((r) => (
                        <tr key={r.id} style={s.tr}>
                          <td style={s.td}>
                            <code style={s.urlRed}>{r.from_path}</code>
                          </td>
                          <td style={s.td}>
                            <code style={s.urlGreen}>{r.to_path}</code>
                          </td>
                          <td style={s.td}>
                            <span
                              style={{
                                ...s.badge,
                                background: '#eff6ff',
                                color: '#2563eb',
                              }}
                            >
                              {r.type === 'auto' ? '⚡ Auto' : '↩ 301'}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={s.muted}>
                              {new Date(r.created_at).toLocaleDateString(
                                'id-ID',
                              )}
                            </span>
                          </td>
                          <td style={s.td}>
                            <button
                              style={s.btnDanger}
                              onClick={() => deleteRedirect(r.id)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: PATTERNS ── */}
          {tab === 'patterns' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                gap: 20,
              }}
            >
              <div>
                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <div style={s.cardTitle}>⚡ Pattern Aktif</div>
                  </div>
                  {patterns.length === 0 ? (
                    <div style={s.empty}>Belum ada pattern</div>
                  ) : (
                    patterns.map((p) => (
                      <div key={p.id} style={s.patternRow}>
                        <div style={s.patternIcon}>⚡</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {p.name}
                          </div>
                          <code style={{ fontSize: 11, color: '#6b7280' }}>
                            {p.match_pattern} → {p.target_url}
                          </code>
                          <span
                            style={{
                              ...s.badge,
                              background: '#f5f3ff',
                              color: '#7c3aed',
                              marginLeft: 8,
                            }}
                          >
                            {p.matched_count} matched
                          </span>
                        </div>
                        <div
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 100,
                            background: p.is_active ? '#10b981' : '#d1d5db',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: '.2s',
                            flexShrink: 0,
                          }}
                          onClick={() => togglePattern(p.id, p.is_active)}
                        >
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              background: 'white',
                              borderRadius: '50%',
                              position: 'absolute',
                              top: 3,
                              left: p.is_active ? 19 : 3,
                              transition: '.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                            }}
                          />
                        </div>
                        <button
                          style={s.btnDanger}
                          onClick={() => deletePattern(p.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Form tambah pattern */}
                <div style={{ ...s.card, marginTop: 16 }}>
                  <div style={s.cardHeader}>
                    <div style={s.cardTitle}>Buat Pattern Baru</div>
                  </div>
                  <div
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label style={s.label}>Nama Pattern</label>
                      <input
                        style={s.input}
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="contoh: Produk Lama"
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-end',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <label style={s.label}>URL Pattern (wildcard *)</label>
                        <input
                          style={{ ...s.input, fontFamily: 'monospace' }}
                          value={pMatch}
                          onChange={(e) => setPMatch(e.target.value)}
                          placeholder="/products/lama-*"
                        />
                      </div>
                      <div
                        style={{
                          color: '#9ca3af',
                          paddingBottom: 10,
                          fontSize: 18,
                        }}
                      >
                        →
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={s.label}>Redirect Ke</label>
                        <input
                          style={{ ...s.input, fontFamily: 'monospace' }}
                          value={pTarget}
                          onChange={(e) => setPTarget(e.target.value)}
                          placeholder="/collections/all"
                        />
                      </div>
                    </div>
                    <button style={s.btnPrimary} onClick={savePattern}>
                      Simpan Pattern
                    </button>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div style={{ ...s.card, height: 'fit-content' }}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitle}>Cara Kerja Pattern</div>
                </div>
                <div
                  style={{
                    padding: 16,
                    fontSize: 13,
                    color: '#374151',
                    lineHeight: 1.7,
                  }}
                >
                  <p>
                    Ketika 404 baru terdeteksi, sistem cek semua pattern aktif.
                  </p>
                  <br />
                  <p>
                    Kalau URL cocok dengan pattern, redirect{' '}
                    <strong>dibuat otomatis</strong> — tanpa perlu fix manual.
                  </p>
                  <br />
                  <p>
                    <strong>Contoh pattern:</strong>
                  </p>
                  <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                    <li>
                      <code style={{ fontSize: 11 }}>/products/lama-*</code>
                    </li>
                    <li>
                      <code style={{ fontSize: 11 }}>/blogs/arsip/*</code>
                    </li>
                    <li>
                      <code style={{ fontSize: 11 }}>/diskon/*-2023</code>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Tambah Redirect */}
      {showAddModal && (
        <div style={s.overlay} onClick={() => setShowAddModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalTitle}>Tambah Redirect</div>
            <label style={s.label}>Dari URL</label>
            <input
              style={s.input}
              value={addFrom}
              onChange={(e) => setAddFrom(e.target.value)}
              placeholder="/halaman-lama"
            />
            <label style={{ ...s.label, marginTop: 12 }}>Ke URL</label>
            <input
              style={s.input}
              value={addTo}
              onChange={(e) => setAddTo(e.target.value)}
              placeholder="/halaman-baru"
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                style={{ ...s.btnPrimary, flex: 1 }}
                onClick={addRedirect}
              >
                Simpan
              </button>
              <button style={s.btnWhite} onClick={() => setShowAddModal(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Import CSV */}
      {showBulkModal && (
        <div style={s.overlay} onClick={() => setShowBulkModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalTitle}>Import Bulk CSV</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
              Format: <code>/dari-url,/ke-url</code> per baris
            </div>
            <textarea
              style={{
                ...s.input,
                minHeight: 120,
                resize: 'vertical',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
              value={bulkCSV}
              onChange={(e) => setBulkCSV(e.target.value)}
              placeholder={
                '/produk-lama,/produk-baru\n/koleksi-lama,/koleksi-baru'
              }
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                style={{
                  ...s.btnPrimary,
                  flex: 1,
                  opacity: bulkLoading ? 0.5 : 1,
                }}
                onClick={importCSV}
                disabled={bulkLoading}
              >
                {bulkLoading ? 'Mengimport...' : '⬆ Import'}
              </button>
              <button
                style={s.btnWhite}
                onClick={() => setShowBulkModal(false)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          style={{
            ...s.toast,
            background:
              toast.type === 'error'
                ? '#ef4444'
                : toast.type === 'warning'
                  ? '#f59e0b'
                  : '#10b981',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Styles ──
const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    background: '#f5f6fa',
    fontSize: 14,
  },
  sidebar: {
    width: 220,
    background: '#0f1117',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  logoWrap: {
    padding: '22px 20px 18px',
    borderBottom: '1px solid rgba(255,255,255,.07)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 34,
    height: 34,
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    color: 'white',
    fontWeight: 800,
  },
  logoText: { fontSize: 15, fontWeight: 800, color: '#fff' },
  storeChip: {
    margin: '12px 12px 0',
    background: 'rgba(255,255,255,.05)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    background: '#10b981',
    borderRadius: '50%',
    flexShrink: 0,
  },
  storeName: {
    fontSize: 12,
    color: 'rgba(255,255,255,.65)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 10px',
    borderRadius: 8,
    color: 'rgba(255,255,255,.5)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: 2,
  },
  navActive: {
    background: 'rgba(37,99,235,.25)',
    color: '#60a5fa',
    fontWeight: 600,
  },
  navBadge: {
    color: 'white',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 100,
    minWidth: 18,
    textAlign: 'center',
  },
  sidebarStats: {
    marginTop: 'auto',
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,.07)',
    display: 'flex',
    justifyContent: 'space-around',
  },
  sidebarStat: { textAlign: 'center' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    background: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 28px',
    height: 58,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  pageTitle: { fontSize: 16, fontWeight: 700 },
  content: { padding: '24px 28px', flex: 1 },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 14,
    marginBottom: 20,
  },
  statBox: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '16px 18px',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '.8px',
    marginBottom: 6,
  },
  statNum: { fontSize: 26, fontWeight: 800, letterSpacing: -1 },
  card: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fafafa',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: { width: 7, height: 7, background: '#10b981', borderRadius: '50%' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.8px',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  urlRed: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'monospace',
    display: 'block',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  urlGreen: {
    fontSize: 12,
    color: '#10b981',
    fontFamily: 'monospace',
    display: 'block',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 600,
  },
  muted: { fontSize: 12, color: '#6b7280' },
  inlineInput: {
    padding: '5px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#374151',
    width: 200,
    outline: 'none',
  },
  patternRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    borderBottom: '1px solid #f3f4f6',
  },
  patternIcon: {
    width: 36,
    height: 36,
    background: '#f5f3ff',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  btnPrimary: {
    padding: '8px 16px',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnWhite: {
    padding: '8px 16px',
    background: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSuccess: {
    padding: '5px 12px',
    background: '#ecfdf5',
    color: '#10b981',
    border: '1px solid #a7f3d0',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnGhost: {
    padding: '5px 12px',
    background: 'transparent',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDanger: {
    padding: '5px 10px',
    background: '#fef2f2',
    color: '#ef4444',
    border: '1px solid #fecaca',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.7px',
    color: '#6b7280',
    display: 'block',
    marginBottom: 5,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.4)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'white',
    borderRadius: 16,
    padding: 28,
    width: 420,
    boxShadow: '0 10px 40px rgba(0,0,0,.15)',
  },
  modalTitle: { fontSize: 16, fontWeight: 800, marginBottom: 16 },
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    color: 'white',
    padding: '12px 20px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: '0 4px 16px rgba(0,0,0,.2)',
    zIndex: 200,
  },
  empty: { padding: '50px 20px', textAlign: 'center', color: '#6b7280' },
};
