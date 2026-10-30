import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeOff, Info, Lock, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { venueApi } from "../../console/api";
import { Page, Section } from "../../console/page";
import { HeaderStatus, SaveState } from "../../console/Shell";
import { useAction, useFeedback } from "../../console/ui";
import { useWorkspace } from "../Workspace";
import { LocationPicker } from "../LocationPicker";
import { OutlineMap } from "./VenueCreatePage";
import { KIND_LABEL } from "./VenuesPage";

function NotAvailable({ children }: { children: string }) {
    return (
        <Alert>
            <Info />
            <AlertTitle>Chưa khả dụng</AlertTitle>
            <AlertDescription>{children}</AlertDescription>
        </Alert>
    );
}

// Cài đặt địa điểm: tên, loại hình, mô tả, vùng bao (venueApi.update); gỡ xuất bản; xoá địa điểm (venueApi.remove).
export default function VenueSettingsPage() {
    const { venueId, data, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const navigate = useNavigate();
    const venue = data.venue;
    const [tab, setTab] = useState<"general" | "members">("general");
    const [form, setForm] = useState({ name: venue.name, kind: venue.kind ?? "other", description: venue.description ?? "" });
    const [outline, setOutline] = useState<[number, number][]>(venue.outline ?? []);
    const savedPin: [number, number] | null = venue.centerLat != null && venue.centerLng != null ? [venue.centerLat, venue.centerLng] : null;
    const [pin, setPin] = useState<[number, number] | null>(savedPin);
    const [deleting, setDeleting] = useState<string | null>(null);
    const hidden = venue.status === "HIDDEN";
    const dirty = form.name !== venue.name || form.kind !== (venue.kind ?? "other") || form.description !== (venue.description ?? "")
        || JSON.stringify(outline) !== JSON.stringify(venue.outline ?? []) || JSON.stringify(pin) !== JSON.stringify(savedPin);
    const host = window.location.host;

    const save = async () => {
        // Tâm địa điểm = ghim vị trí; chưa có ghim thì lấy giữa vùng bao như trước
        const center = pin ? { centerLat: pin[0], centerLng: pin[1] }
            : outline.length ? { centerLat: outline.reduce((s, p) => s + p[0], 0) / outline.length, centerLng: outline.reduce((s, p) => s + p[1], 0) / outline.length } : {};
        const saved = await run(() => venueApi.update(venueId, {
            ...venue, name: form.name.trim(), kind: form.kind, description: form.description.trim(), outline: outline.length >= 3 ? outline : undefined, ...center
        }), "Đã lưu cài đặt địa điểm");
        if (saved) patch("venue", { ...venue, ...saved });
    };

    const unpublish = async () => {
        if (!(await confirm(`Gỡ xuất bản ${venue.name}?`, { danger: true, okLabel: "Gỡ xuất bản", detail: "Khách mở đường dẫn hoặc quét tem sẽ không thấy bản đồ. Bản nháp và mã QR giữ nguyên, xuất bản lại được bất cứ lúc nào." }))) return;
        const saved = await run(() => venueApi.unpublish(venueId), "Đã gỡ xuất bản");
        if (saved) patch("venue", { ...venue, ...saved });
    };

    const remove = async () => {
        if (await run(() => venueApi.remove(venueId), "Đã xoá địa điểm") !== null) navigate("/builder", { replace: true });
    };

    const saveButton = (
        <Button disabled={busy || !dirty || !form.name.trim()} title={dirty ? undefined : "Chưa có thay đổi"} onClick={() => void save()}>Lưu thay đổi</Button>
    );

    return (
        <Page width="narrow" actions={saveButton}>
            <HeaderStatus>{dirty ? <SaveState state={busy ? "saving" : "dirty"} /> : null}</HeaderStatus>

            {hidden && (
                <Alert variant="destructive">
                    <EyeOff />
                    <AlertTitle>Quản trị hệ thống đã ẩn địa điểm này</AlertTitle>
                    <AlertDescription>Bạn vẫn sửa bản nháp được. Không gỡ, xoá hay đổi đường dẫn khi đang bị ẩn.</AlertDescription>
                </Alert>
            )}

            <Tabs value={tab} onValueChange={v => setTab(v as "general" | "members")} className="gap-6">
                <TabsList>
                    <TabsTrigger value="general">Chung</TabsTrigger>
                    <TabsTrigger value="members">Thành viên<Badge variant="outline" className="ml-1">GĐ 2</Badge></TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="flex flex-col gap-6">
                    <Section title="Thông tin chung">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="v-name">Tên địa điểm</Label>
                                    <Input id="v-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="v-kind">Loại hình</Label>
                                    <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
                                        <SelectTrigger id="v-kind" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(KIND_LABEL).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="v-slug">Đường dẫn</Label>
                                <div className="relative">
                                    <Input id="v-slug" readOnly value={`${host}/v/${venue.slug}`} aria-describedby="slug-h" className="bg-muted/50 pr-9 text-muted-foreground" />
                                    <Lock className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                </div>
                                <p id="slug-h" className="text-xs text-muted-foreground">Không đổi được sau khi tạo, vì mã QR đã in chứa đường dẫn này.</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="v-desc">Mô tả</Label>
                                <Textarea id="v-desc" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                        </div>
                    </Section>

                    <Section title="Vị trí" flush description="Khách mở bản đồ sẽ thấy chỗ này trước. Tìm địa chỉ hoặc kéo ghim cho đúng cổng chính.">
                        <LocationPicker value={pin} onChange={setPin} initialQuery={venue.name} />
                    </Section>

                    <Section title="Vùng bao" description={`${outline.length} góc, bấm lên bản đồ để thêm góc, kéo để sửa.`}
                        actions={(
                            <>
                                <Button variant="outline" size="sm" disabled={!outline.length} onClick={() => setOutline(o => o.slice(0, -1))}><Undo2 />Bỏ góc cuối</Button>
                                <Button variant="outline" size="sm" disabled={!outline.length} onClick={() => setOutline([])}><X />Xoá vùng bao</Button>
                            </>
                        )}>
                        <div className="relative h-112 overflow-hidden rounded-lg border [&_.cb-map]:absolute [&_.cb-map]:inset-0 [&_.cb-map]:min-h-0">
                            {/* vẽ lại khi ghim đổi để ghim trên bản đồ vùng bao luôn đúng chỗ */}
                            <OutlineMap key={pin?.join(",") ?? "none"} value={outline} onChange={setOutline} center={pin ?? undefined} pin={pin} />
                        </div>
                    </Section>

                    <Section title="Lối vào chính">
                        <NotAvailable>Điểm xuất phát mặc định cho khách chưa định vị cần trường dữ liệu mới ở backend.</NotAvailable>
                    </Section>

                    <Section title="Liên hệ cho khách">
                        <NotAvailable>Điện thoại và trang web của địa điểm chưa có chỗ lưu ở backend.</NotAvailable>
                    </Section>

                    <div className="divide-y rounded-xl border border-destructive/30">
                        <div className="flex items-center justify-between gap-4 px-6 py-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Gỡ xuất bản</p>
                                <p id="dz-1" className="text-sm text-muted-foreground">
                                    {hidden ? "Khoá khi địa điểm đang bị quản trị ẩn." : venue.status === "PUBLISHED" ? "Khách không mở được bản đồ. Bản nháp và mã QR giữ nguyên." : "Địa điểm chưa công khai."}
                                </p>
                            </div>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" aria-describedby="dz-1"
                                disabled={hidden || venue.status !== "PUBLISHED" || busy} onClick={() => void unpublish()}>
                                {hidden ? <Lock /> : <EyeOff />}Gỡ xuất bản…
                            </Button>
                        </div>
                        <div className="flex items-center justify-between gap-4 px-6 py-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Xoá địa điểm</p>
                                <p id="dz-2" className="text-sm text-muted-foreground">{hidden ? "Khoá khi địa điểm đang bị quản trị ẩn." : "Xoá toà nhà, tầng, điểm, lối đi. Không hoàn tác."}</p>
                            </div>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" aria-describedby="dz-2" aria-haspopup="dialog"
                                disabled={hidden || busy} onClick={() => setDeleting("")}>
                                {hidden ? <Lock /> : <Trash2 />}Xoá địa điểm…
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="members" className="flex flex-col gap-6">
                    <NotAvailable>Mời người biên tập, người dán tem và chuyển quyền sở hữu cần API thành viên ở giai đoạn 2.</NotAvailable>
                    <Section title="Thành viên" flush actions={<Button variant="outline" size="sm" disabled title="Chưa khả dụng"><UserPlus />Mời thành viên</Button>}>
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">Người dùng</TableHead>
                                    <TableHead className="pr-6">Vai trò</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">Chưa mời ai.</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </Section>
                </TabsContent>
            </Tabs>

            <Dialog open={deleting !== null} onOpenChange={open => !open && setDeleting(null)}>
                <DialogContent className="sm:max-w-md">
                    {deleting !== null && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Xoá {venue.name}?</DialogTitle>
                                <DialogDescription>Không hoàn tác được. Toàn bộ dữ liệu của địa điểm bị xoá.</DialogDescription>
                            </DialogHeader>
                            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm">
                                <dt className="text-muted-foreground">Toà nhà</dt><dd className="text-right font-medium tabular-nums">{data.buildings.length}</dd>
                                <dt className="text-muted-foreground">Tầng</dt><dd className="text-right font-medium tabular-nums">{data.floors.length}</dd>
                                <dt className="text-muted-foreground">Điểm (kèm mọi lối đi)</dt><dd className="text-right font-medium tabular-nums">{data.locations.length}</dd>
                                <dt className="text-destructive">Mã QR hết hiệu lực</dt><dd className="text-right font-medium text-destructive">Tất cả</dd>
                            </dl>
                            <div className="grid gap-2">
                                <Label htmlFor="dl-conf">Gõ <span className="font-semibold">{venue.name}</span> để xác nhận</Label>
                                <Input id="dl-conf" autoComplete="off" spellCheck={false} placeholder={venue.name} value={deleting} onChange={e => setDeleting(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleting(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy || deleting.trim() !== venue.name.trim()} onClick={() => void remove()}>Xoá vĩnh viễn</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Page>
    );
}
