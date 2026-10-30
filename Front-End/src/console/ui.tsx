import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { toast as sonner } from "sonner";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";

// Phần dùng chung Builder + Admin ngoài bộ shadcn: thông báo nhanh, hộp xác nhận, chạy thao tác API, bảng màu và icon cho dữ liệu.
// Thành phần giao diện (nút, ô nhập, bảng…) lấy từ @/components/ui; khung trang từ ./page và ./Shell.

// ---------------------------------------------------------------- thông báo nhanh + hộp xác nhận
interface Confirm {
    text: string;
    detail?: string;
    danger?: boolean;
    okLabel?: string;
    resolve: (ok: boolean) => void;
}
interface FeedbackState {
    toast(text: string, kind?: "ok" | "err"): void;
    confirm(text: string, options?: { detail?: string; danger?: boolean; okLabel?: string }): Promise<boolean>;
}
const FeedbackContext = createContext<FeedbackState | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [dialog, setDialog] = useState<Confirm | null>(null);

    // Thông báo nhanh và hộp xác nhận dùng shadcn/ui (sonner + AlertDialog), giống mọi màn máy tính
    const toast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
        if (kind === "err") sonner.error(text, { duration: 6000 });
        else sonner.success(text);
    }, []);
    const confirm = useCallback((text: string, options: { detail?: string; danger?: boolean; okLabel?: string } = {}) =>
        new Promise<boolean>(resolve => setDialog({ text, ...options, resolve })), []);

    const close = (ok: boolean) => {
        dialog?.resolve(ok);
        setDialog(null);
    };

    return (
        <FeedbackContext.Provider value={{ toast, confirm }}>
            {children}
            <Toaster position="bottom-right" />
            <AlertDialog open={!!dialog} onOpenChange={open => !open && close(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{dialog?.text}</AlertDialogTitle>
                        {dialog?.detail && <AlertDialogDescription>{dialog.detail}</AlertDialogDescription>}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => close(false)}>Huỷ</AlertDialogCancel>
                        <AlertDialogAction variant={dialog?.danger ? "destructive" : "default"} onClick={() => close(true)}>
                            {dialog?.okLabel ?? "Đồng ý"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </FeedbackContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback(): FeedbackState {
    const value = useContext(FeedbackContext);
    if (!value) throw new Error("useFeedback() phải nằm trong <FeedbackProvider>");
    return value;
}

/** Chạy một thao tác gọi API: hiện lỗi bằng toast, trả về kết quả hoặc null */
// eslint-disable-next-line react-refresh/only-export-components
export function useAction() {
    const { toast } = useFeedback();
    const [busy, setBusy] = useState(false);
    const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | null> => {
        setBusy(true);
        try {
            const result = await fn();
            if (success) toast(success);
            return result;
        } catch (error) {
            toast((error as Error).message || "Có lỗi xảy ra", "err");
            return null;
        } finally {
            setBusy(false);
        }
    }, [toast]);
    return { busy, run };
}

// eslint-disable-next-line react-refresh/only-export-components
export const COLORS = ["#a83039", "#3f6fb5", "#6d4fb5", "#d9822b", "#c96a8e", "#1f8a8a", "#2a7f62", "#8a5a2b", "#7a8794", "#4a4f55", "#7b5ea7", "#5f6368"];

// eslint-disable-next-line react-refresh/only-export-components
export const ICONS = [
    "bi-door-open", "bi-suitcase", "bi-shield-check", "bi-luggage", "bi-ticket-perforated", "bi-fork-knife", "bi-cup-hot", "bi-bag",
    "bi-lamp", "bi-credit-card", "bi-info-lg", "bi-hospital", "bi-badge-wc", "bi-arrow-down-up", "bi-chevron-double-up", "bi-stairs",
    "bi-box-arrow-in-right", "bi-p-square", "bi-easel", "bi-building", "bi-book", "bi-heart-pulse", "bi-tree", "bi-geo-alt"
];
