import { Component, type ReactNode } from 'react';
import { Brand } from '../components/Brand';

export class StudioBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="recovery">
        <Brand />
        <h1>Let’s take that again.</h1>
        <p>The studio hit an unexpected problem. Your saved sessions are still on this device.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reopen the studio
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
