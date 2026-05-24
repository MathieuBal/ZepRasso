import { Component, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="card grid">
            <span className="badge closed">Erreur</span>
            <h1 className="hero-title gradient-text">Un souci est survenu</h1>
            <p className="lead">L'application a rencontré une erreur. Tu peux recharger la page pour continuer.</p>
            <p className="muted">{this.state.error.message}</p>
            <div className="actions">
              <button className="button primary" onClick={this.handleReload}>Recharger</button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
