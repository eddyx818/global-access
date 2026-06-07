import React from 'react';
import { t } from '../lib/theme';

export default class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Support chat error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          background: t.bgElevated,
          minHeight: 240,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 8 }}>Support chat could not load</div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, maxWidth: 320, marginBottom: '1.25rem' }}>
            Something went wrong opening chat. Try again or go back to Home.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Try again
            </button>
            {this.props.onFallback && (
              <button
                type="button"
                onClick={this.props.onFallback}
                style={{ background: t.bgMuted, color: t.textSecondary, border: t.borderHairline, borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Go to Home
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
