import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "../../lib/monitoring";

// Lỗi khi vẽ giao diện: báo về Sentry (nếu bật) và hiện màn hình thay thế thay vì trang trắng.

interface State {
    failed: boolean;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        reportError(error, { componentStack: info.componentStack ?? "" });
    }

    render(): ReactNode {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="wf-screen wf-center" role="alert" style={{ flexDirection: "column", gap: 16, padding: 24, textAlign: "center" }}>
                <p className="wf-t17">Có lỗi xảy ra, app chưa hiển thị được trang này.</p>
                <button type="button" className="wf-btn wf-btn-p" onClick={() => window.location.reload()}>
                    <span>Tải lại</span>
                </button>
            </div>
        );
    }
}
