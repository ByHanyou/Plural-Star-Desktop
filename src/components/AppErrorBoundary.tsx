import React from 'react';
import i18n from '../i18n/i18n';
import { log } from '../utils/log';

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.error('errorBoundary', 'caught:', error, info?.componentStack);
  }
  reset = () => this.setState({ error: null });
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0a0a0a', color: '#fff', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, fontFamily: 'var(--font-display)' }}>
          {i18n.t('errorBoundary.title')}
        </h1>
        <p style={{ fontSize: 14, color: '#bbb', marginBottom: 16, maxWidth: 480 }}>
          {i18n.t('errorBoundary.body')}
        </p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-wrap' }}>
          {error.message || String(error)}
        </p>
        <button onClick={this.reset} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#3a7bd5', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {i18n.t('errorBoundary.retry')}
        </button>
      </div>
    );
  }
}
