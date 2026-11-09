import { useEffect, useMemo, useState } from "react";
import {
    formatMeters, isStepSkipped, planJourney, searchPlaces, stepCandidates,
    type JourneyAnswers, type JourneyDto, type JourneyStepDto, type Place, type VenueModel
} from "@indoor-map/core";
import { ArrowDown, ArrowUp, CircleAlert, Clock, MapPin, MousePointer2, Plus, Route, Search, Trash2, Workflow, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { HeaderActions, HeaderStatus } from "../../console/Shell";
import { journeyApi } from "../../console/api";
import { ErrorState } from "../../console/page";
import { useAction, useFeedback } from "../../console/ui";
import { floorLabel } from "../FloorList";
import { useWorkspace } from "../Workspace";

const MAX_STEPS = 15;
const MAX_QUESTIONS = 3;
const MAX_INSTRUCTION = 280;
const newStep = (n: number): JourneyStepDto => ({ title: `Bước ${n}`, targetType: null, targetLocationId: null, optional: false, skipIf: [], dwellMinutes: null, mustConfirm: true });
const newJourney = (): JourneyDto => ({ id: 0, name: "Quy trình mới", description: "", status: "DRAFT", questions: [], steps: [newStep(1), newStep(2)] });

function placeLabel(model: VenueModel, place: Place): string {
    const floor = model.floorsById.get(place.floorId);
    return `${place.name}${floor ? `, ${floorLabel(model, floor)}` : ""}`;
}

/** Đích của bước, viết ngắn để hiện trên thẻ bước */
function targetText(model: VenueModel, step: JourneyStepDto): string | null {
    if (step.targetLocationId != null) {
        const place = model.locationsById.get(step.targetLocationId);
        return place ? placeLabel(model, place) : "Điểm đã bị xoá";
    }
    if (step.targetType) {
        const count = model.locations.filter(l => l.type === step.targetType).length;
        return `${model.typeOf(step.targetType).name} gần nhất trong ${count} nơi`;
    }
    return null;
}

function Idle({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-5">{icon}</span>
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

/** Tìm và chọn một điểm của địa điểm (705 điểm ở sân bay: tìm thay vì danh sách thả xuống) */
function PlacePicker({ model, value, onChange, label }: { model: VenueModel; value: number | null; onChange(id: number): void; label: string }) {
    const [query, setQuery] = useState("");
    const selected = value != null ? model.locationsById.get(value) : undefined;
    const hits = useMemo(() => (query.trim() ? searchPlaces(model, query, { limit: 8 }).map(h => h.place) : []), [model, query]);
    return (
        <div className="space-y-2">
            {selected && (
                <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <MapPin className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{placeLabel(model, selected)}</span>
                </p>
            )}
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={selected ? "Đổi điểm khác" : "Tìm tên điểm"} aria-label={label} className="pl-9" />
            </div>
            {hits.length > 0 && (
                <ul className="max-h-56 overflow-y-auto rounded-md border p-1" aria-label="Kết quả">
                    {hits.map(p => (
                        <li key={p.id}>
                            <button type="button" onClick={() => { onChange(p.id); setQuery(""); }} className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-muted">
                                <span className="text-sm">{p.name}</span>
                                <span className="text-xs text-muted-foreground">{model.typeOf(p.type).name}, {floorLabel(model, model.floorsById.get(p.floorId))}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Quy trình (docs/DAC_TA_QUY_TRINH.md, UC027): chuỗi bước dẫn khách qua nhiều nơi (thủ tục → an ninh → cửa ra).
// Trái: danh sách quy trình. Giữa: thông tin, câu hỏi đầu, các bước kèm tuyến thử. Phải: thuộc tính bước đang chọn.
export default function JourneysPage() {
    const { venueId, model } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [list, setList] = useState<JourneyDto[] | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [draft, setDraft] = useState<JourneyDto | null>(null);
    const [dirty, setDirty] = useState(false);
    const [stepIndex, setStepIndex] = useState<number | null>(null);
    const [startId, setStartId] = useState<number | null>(null);
    const [answers, setAnswers] = useState<JourneyAnswers>({});

    useEffect(() => {
        let alive = true;
        journeyApi.list(venueId).then(rows => {
            if (!alive) return;
            setList(rows);
            setError(null);
        }).catch((err: Error) => alive && setError(err));
        return () => {
            alive = false;
        };
    }, [venueId, attempt]);

    const edit = (fn: (j: JourneyDto) => void) => {
        setDraft(current => {
            if (!current) return current;
            const next = structuredClone(current);
            fn(next);
            return next;
        });
        setDirty(true);
    };
    const editStep = (i: number, fn: (s: JourneyStepDto) => void) => edit(j => fn(j.steps[i]!));

    const open = async (journey: JourneyDto) => {
        if (dirty && !(await confirm("Bỏ thay đổi chưa lưu?", { okLabel: "Bỏ thay đổi", danger: true }))) return;
        setDraft(structuredClone(journey));
        setDirty(journey.id === 0);
        setStepIndex(null);
        setAnswers({});
    };

    const save = async (status?: JourneyDto["status"]) => {
        if (!draft) return;
        const body = { ...draft, status: status ?? draft.status };
        const saved = await run(
            () => (draft.id ? journeyApi.update(venueId, draft.id, body) : journeyApi.create(venueId, body)),
            status === "PUBLISHED" ? "Đã công khai quy trình" : status === "DRAFT" ? "Đã chuyển về nháp" : "Đã lưu quy trình"
        );
        if (!saved) return;
        setDraft(saved);
        setDirty(false);
        setList(rows => {
            const others = (rows ?? []).filter(r => r.id !== saved.id);
            return [...others, saved].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
        });
    };

    const remove = async () => {
        if (!draft) return;
        if (!draft.id) {
            setDraft(null);
            setDirty(false);
            return;
        }
        if (!(await confirm(`Xoá quy trình "${draft.name}"?`, { detail: "Khách sẽ không thấy quy trình này nữa.", danger: true, okLabel: "Xoá" }))) return;
        if (await run(() => journeyApi.remove(venueId, draft.id), "Đã xoá quy trình") !== null) {
            setList(rows => (rows ?? []).filter(r => r.id !== draft.id));
            setDraft(null);
            setDirty(false);
        }
    };

    // Điểm thử tuyến: mặc định là một lối vào / quầy thông tin, không có thì điểm đầu tiên
    const start = useMemo(() => {
        const chosen = startId != null ? model.locationsById.get(startId) : undefined;
        return chosen ?? model.locations.find(l => l.type === "entrance") ?? model.locations.find(l => l.type === "information") ?? model.locations[0];
    }, [model, startId]);
    const plan = useMemo(() => (draft && start ? planJourney(model, start, draft, answers) : null), [model, draft, start, answers]);
    const missingTarget = draft?.steps.findIndex(s => s.targetLocationId == null && !s.targetType) ?? -1;
    const publishBlock = !draft ? null
        : draft.steps.length < 2 ? "Cần ít nhất 2 bước"
            : missingTarget >= 0 ? `Bước ${missingTarget + 1} chưa chọn nơi đến`
                : plan?.error ?? null;

    const step = draft && stepIndex != null ? draft.steps[stepIndex] : undefined;
    const typesWithPlaces = useMemo(() => [...new Set(model.locations.map(l => l.type ?? "other"))]
        .map(code => ({ code, name: model.typeOf(code).name, count: model.locations.filter(l => (l.type ?? "other") === code).length }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")), [model]);

    return (
        <div className="flex min-h-0 flex-1">
            <HeaderStatus>
                {draft && <Badge variant={draft.status === "PUBLISHED" ? "default" : "secondary"}>{draft.status === "PUBLISHED" ? "Công khai" : "Nháp"}</Badge>}
            </HeaderStatus>
            <HeaderActions>
                {draft && (
                    <>
                        <Button variant="ghost" size="icon" onClick={() => void remove()} disabled={busy} aria-label="Xoá quy trình" title="Xoá quy trình"><Trash2 /></Button>
                        {draft.status === "PUBLISHED"
                            ? <Button variant="outline" onClick={() => void save("DRAFT")} disabled={busy || !draft.id}>Về nháp</Button>
                            : <Button variant="outline" onClick={() => void save("PUBLISHED")} disabled={busy || Boolean(publishBlock)} title={publishBlock ?? undefined}>Công khai</Button>}
                        <Button onClick={() => void save()} disabled={busy || !dirty}>Lưu</Button>
                    </>
                )}
            </HeaderActions>

            {/* Trái: danh sách quy trình */}
            <aside aria-label="Danh sách quy trình" className="flex w-64 shrink-0 flex-col border-r bg-background">
                <div className="border-b p-3">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => void open(newJourney())}><Plus />Tạo quy trình</Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {error && <div className="p-2"><ErrorState error={error} onRetry={() => setAttempt(a => a + 1)} /></div>}
                    {!list && !error && [0, 1, 2].map(i => <Skeleton key={i} className="mb-2 h-12 rounded-md" />)}
                    {list?.length === 0 && !draft && <p className="px-2 py-3 text-sm text-muted-foreground">Chưa có quy trình nào.</p>}
                    {[...(list ?? []), ...(draft && !draft.id ? [draft] : [])].map(j => {
                        const active = draft?.id === j.id;
                        const shown = active ? draft : j;
                        return (
                            <button key={j.id || "new"} type="button" onClick={() => !active && void open(j)} aria-current={active || undefined}
                                className={cn("flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left hover:bg-muted", active && "bg-primary/10 text-primary hover:bg-primary/10")}>
                                <span className="w-full truncate text-sm font-medium">{shown.name || "Chưa đặt tên"}</span>
                                <span className="text-xs text-muted-foreground">
                                    {shown.steps.length} bước · {shown.status === "PUBLISHED" ? "Công khai" : "Nháp"}{active && dirty ? " · chưa lưu" : ""}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Giữa: quy trình đang soạn */}
            <section aria-label="Quy trình đang soạn" className="min-w-0 flex-1 overflow-y-auto bg-muted/40">
                {!draft ? (
                    <div className="mx-auto mt-16 w-96 rounded-xl border bg-background p-2 shadow-sm">
                        <Idle icon={<Workflow />} text={list?.length ? "Chọn một quy trình bên trái để sửa, hoặc tạo quy trình mới." : "Tạo quy trình đầu tiên, ví dụ: làm thủ tục, kiểm tra an ninh, ra cửa máy bay."} />
                    </div>
                ) : (
                    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
                        <div className="space-y-4 rounded-xl border bg-background p-5">
                            <div className="space-y-2">
                                <Label htmlFor="jr-name">Tên quy trình</Label>
                                <Input id="jr-name" value={draft.name} maxLength={120} onChange={e => edit(j => { j.name = e.target.value; })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="jr-desc">Mô tả cho khách</Label>
                                <Textarea id="jr-desc" rows={2} value={draft.description ?? ""} onChange={e => edit(j => { j.description = e.target.value; })} />
                            </div>
                        </div>

                        <div className="space-y-3 rounded-xl border bg-background p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Câu hỏi đầu</p>
                                    <p className="text-xs text-muted-foreground">Có/không, tối đa {MAX_QUESTIONS}. Dùng để bỏ bước không cần.</p>
                                </div>
                                <Button variant="outline" size="sm" disabled={draft.questions.length >= MAX_QUESTIONS}
                                    onClick={() => edit(j => {
                                        const used = new Set(j.questions.map(q => q.id));
                                        let n = 1;
                                        while (used.has(`q${n}`)) n++;
                                        j.questions.push({ id: `q${n}`, text: "" });
                                    })}><Plus />Thêm câu hỏi</Button>
                            </div>
                            {draft.questions.map((q, qi) => (
                                <div key={q.id} className="flex items-center gap-2">
                                    <Input value={q.text} placeholder="Bạn đã check-in trực tuyến chưa?" aria-label={`Câu hỏi ${qi + 1}`}
                                        onChange={e => edit(j => { j.questions[qi]!.text = e.target.value; })} />
                                    <Button variant="ghost" size="icon" aria-label="Xoá câu hỏi" onClick={() => edit(j => {
                                        j.questions.splice(qi, 1);
                                        j.steps.forEach(s => { s.skipIf = (s.skipIf ?? []).filter(c => c.questionId !== q.id); });
                                    })}><X /></Button>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3 rounded-xl border bg-background p-5">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <p className="mr-auto text-sm font-medium">Các bước</p>
                                {plan && !plan.error && (
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />
                                        đi bộ {Math.max(1, Math.round(plan.walkSeconds / 60))} phút ({formatMeters(plan.distance)}) + chờ khoảng {plan.dwellMinutes} phút, ước tính
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_auto]">
                                <div className="space-y-1.5">
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Route className="size-3.5" />Thử tuyến từ</p>
                                    <PlacePicker model={model} value={start?.id ?? null} onChange={setStartId} label="Điểm thử tuyến" />
                                </div>
                                {draft.questions.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">Thử với câu trả lời</p>
                                        {draft.questions.map(q => (
                                            <label key={q.id} className="flex items-center gap-2 text-sm">
                                                <Switch checked={answers[q.id] === true} onCheckedChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} />
                                                <span className="max-w-48 truncate">{q.text || q.id}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {plan?.error && (
                                <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                    <CircleAlert className="mt-0.5 size-4 shrink-0" />{plan.error}
                                </p>
                            )}
                            <ol className="space-y-2">
                                {draft.steps.map((s, i) => {
                                    const target = targetText(model, s);
                                    const sp = plan?.steps[i];
                                    const skipped = isStepSkipped(s, answers) || sp?.skipped;
                                    return (
                                        <li key={i} className={cn("flex items-start gap-3 rounded-lg border p-3", stepIndex === i && "border-primary ring-1 ring-primary", skipped && "opacity-60")}>
                                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                                            <button type="button" onClick={() => setStepIndex(i)} className="min-w-0 flex-1 space-y-1 text-left">
                                                <span className="block truncate text-sm font-medium">{s.title || "Chưa đặt tên"}</span>
                                                {target
                                                    ? <span className="block truncate text-xs text-muted-foreground">{target}</span>
                                                    : <span className="flex items-center gap-1 text-xs text-destructive"><CircleAlert className="size-3.5" />Chưa chọn nơi đến</span>}
                                                {sp?.skipped
                                                    ? <span className="block text-xs text-muted-foreground">{sp.skipReason}</span>
                                                    : sp?.place && <span className="block truncate text-xs text-primary">Tới {placeLabel(model, sp.place)}{sp.route ? `, ${formatMeters(sp.route.distance)}` : ""}</span>}
                                                <span className="flex flex-wrap gap-1.5">
                                                    {s.optional && <Badge variant="outline">Tuỳ chọn</Badge>}
                                                    {(s.skipIf?.length ?? 0) > 0 && <Badge variant="outline">Có điều kiện bỏ qua</Badge>}
                                                    {s.dwellMinutes ? <Badge variant="outline">{s.dwellMinutes} phút</Badge> : null}
                                                </span>
                                            </button>
                                            <div className="flex shrink-0 flex-col">
                                                <Button variant="ghost" size="icon" className="size-7" aria-label="Lên trên" disabled={i === 0}
                                                    onClick={() => { edit(j => { [j.steps[i - 1], j.steps[i]] = [j.steps[i]!, j.steps[i - 1]!]; }); setStepIndex(i - 1); }}><ArrowUp /></Button>
                                                <Button variant="ghost" size="icon" className="size-7" aria-label="Xuống dưới" disabled={i === draft.steps.length - 1}
                                                    onClick={() => { edit(j => { [j.steps[i + 1], j.steps[i]] = [j.steps[i]!, j.steps[i + 1]!]; }); setStepIndex(i + 1); }}><ArrowDown /></Button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            <Button variant="outline" size="sm" disabled={draft.steps.length >= MAX_STEPS}
                                onClick={() => { edit(j => { j.steps.push(newStep(j.steps.length + 1)); }); setStepIndex(draft.steps.length); }}><Plus />Thêm bước</Button>
                        </div>
                    </div>
                )}
            </section>

            {/* Phải: thuộc tính bước */}
            <aside aria-label="Thuộc tính bước" className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-background">
                {!draft || stepIndex == null || !step ? (
                    <Idle icon={<MousePointer2 />} text="Chưa chọn bước" />
                ) : (
                    <div className="space-y-5 p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Bước {stepIndex + 1}</p>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={draft.steps.length <= 1}
                                onClick={() => { edit(j => { j.steps.splice(stepIndex, 1); }); setStepIndex(null); }}><Trash2 />Xoá bước</Button>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="st-title">Tên bước</Label>
                            <Input id="st-title" value={step.title} onChange={e => editStep(stepIndex, s => { s.title = e.target.value; })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="st-ins">Hướng dẫn tại bước</Label>
                            <Textarea id="st-ins" rows={3} maxLength={MAX_INSTRUCTION} value={step.instruction ?? ""} placeholder="Chuẩn bị CCCD và thẻ lên máy bay"
                                onChange={e => editStep(stepIndex, s => { s.instruction = e.target.value; })} />
                            <p className="text-right text-xs text-muted-foreground tabular-nums">{(step.instruction ?? "").length}/{MAX_INSTRUCTION}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Nơi đến</Label>
                            <Select value={step.targetLocationId != null ? "place" : "type"}
                                onValueChange={v => editStep(stepIndex, s => {
                                    if (v === "place") { s.targetType = null; s.targetLocationId = s.targetLocationId ?? null; } else { s.targetLocationId = null; }
                                })}>
                                <SelectTrigger className="w-full" aria-label="Cách chọn nơi đến"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="type">Theo loại: hệ thống chọn nơi hợp lý nhất</SelectItem>
                                    <SelectItem value="place">Một điểm cụ thể</SelectItem>
                                </SelectContent>
                            </Select>
                            {step.targetLocationId != null ? (
                                <PlacePicker model={model} value={step.targetLocationId} label="Điểm đến của bước"
                                    onChange={id => editStep(stepIndex, s => { s.targetLocationId = id; s.targetType = null; })} />
                            ) : (
                                <>
                                    <Select value={step.targetType ?? ""} onValueChange={v => editStep(stepIndex, s => { s.targetType = v; s.targetLocationId = null; })}>
                                        <SelectTrigger className="w-full" aria-label="Loại điểm"><SelectValue placeholder="Chọn loại điểm" /></SelectTrigger>
                                        <SelectContent>
                                            {typesWithPlaces.map(t => <SelectItem key={t.code} value={t.code}>{t.name} ({t.count})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <button type="button" className="text-xs text-primary underline-offset-4 hover:underline"
                                        onClick={() => editStep(stepIndex, s => { s.targetType = null; s.targetLocationId = stepCandidates(model, step)[0]?.id ?? model.locations[0]?.id ?? null; })}>
                                        Hoặc chọn một điểm cụ thể
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="st-dwell">Thời gian ở bước (phút, ước tính)</Label>
                            <Input id="st-dwell" type="number" min={0} max={600} value={step.dwellMinutes ?? ""} placeholder="Xếp hàng, làm thủ tục"
                                onChange={e => editStep(stepIndex, s => { s.dwellMinutes = e.target.value === "" ? null : Math.max(0, Math.min(600, Number(e.target.value))); })} />
                        </div>
                        <label className="flex items-start justify-between gap-3">
                            <span className="space-y-0.5">
                                <span className="block text-sm font-medium">Bước tuỳ chọn</span>
                                <span className="block text-xs text-muted-foreground">Khách tự bỏ qua được</span>
                            </span>
                            <Switch checked={Boolean(step.optional)} onCheckedChange={v => editStep(stepIndex, s => { s.optional = v; })} />
                        </label>
                        <label className="flex items-start justify-between gap-3">
                            <span className="space-y-0.5">
                                <span className="block text-sm font-medium">Bấm "Đã xong" mới sang bước sau</span>
                                <span className="block text-xs text-muted-foreground">Tắt: tới nơi là tự sang bước sau</span>
                            </span>
                            <Switch checked={step.mustConfirm !== false} onCheckedChange={v => editStep(stepIndex, s => { s.mustConfirm = v; })} />
                        </label>
                        {draft.questions.length > 0 && (
                            <div className="space-y-2">
                                <Label>Bỏ qua bước khi</Label>
                                <p className="text-xs text-muted-foreground">Bỏ khi mọi điều kiện đã chọn đều đúng.</p>
                                {draft.questions.map(q => {
                                    const cond = step.skipIf?.find(c => c.questionId === q.id);
                                    return (
                                        <div key={q.id} className="space-y-1">
                                            <p className="truncate text-xs">{q.text || q.id}</p>
                                            <Select value={cond ? (cond.answer ? "yes" : "no") : "any"}
                                                onValueChange={v => editStep(stepIndex, s => {
                                                    const rest = (s.skipIf ?? []).filter(c => c.questionId !== q.id);
                                                    s.skipIf = v === "any" ? rest : [...rest, { questionId: q.id, answer: v === "yes" }];
                                                })}>
                                                <SelectTrigger className="w-full" aria-label={`Điều kiện: ${q.text}`}><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="any">Không xét</SelectItem>
                                                    <SelectItem value="yes">Khách trả lời Có</SelectItem>
                                                    <SelectItem value="no">Khách trả lời Không</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}
