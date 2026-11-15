import { Component } from 'react';
import { reportError } from '../monitoring/monitoring.js';

// Render errors: report them (when monitoring is on) and show a fallback instead of a blank page.
export default class ErrorBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error, info) {
        reportError(error, { componentStack: info.componentStack || '' });
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3 p-4" style={{ minHeight: '100vh' }} role="alert">
                <p className="fs-5 mb-0">Có lỗi xảy ra, trang chưa hiển thị được.</p>
                <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Tải lại</button>
            </div>
        );
    }
}
