import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatMeters, planJourney, type JourneyDto, type JourneyPlan, type VenueModel } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { getSettings } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import { journeyIcon, newRun, useJourneyRun, type JourneyRun } from "../journeyRun";
import { Button, ErrorScreen, Option, Row, Sheet, Status, TopBar } from "../components/ui";
import { minutesOf, placeWhere, positionLabel } from "../format";
import { WhereFromRows } from "./RoutePage";

// Quy trình (Viewer-Journeys, Viewer-JourneyRun; docs/DAC_TA_QUY_TRINH.md UC028):
// /journeys      "Bạn cần làm gì?": danh sách quy trình chủ địa điểm đã công khai
// /journeys/:id  câu hỏi đầu → điểm xuất phát → tổng quan (nơi chọn cho từng bước, thời gian) → đi từng bước (màn Đang đi)
export default function JourneysPage() {
    const { id } = useParams();
    return id ? <JourneyRunPage id={Number(id)} /> : <JourneyList />;
}

/** Tổng thời gian để khách hình dung: đi bộ + chờ, luôn ghi "ước tính" (BR-33) */
function timeText(plan: Pick<JourneyPlan, "walkSeconds" | "dwellMinutes">): string {
    const walk = Math.max(1, Math.round(plan.walkSeconds / 60));
    return plan.dwellMinutes > 0 ? `đi bộ ${walk} phút + chờ khoảng ${plan.dwellMinutes} phút` : `đi bộ ${walk} phút`;
}

function JourneyList() {
    const model = useModel();
    const { slug } = useVenue();
    const navigate = useNavigate();
    const [run] = useJourneyRun(slug);
    const active = run && run.current != null && !run.finishedAt ? model.journeys.find(j => j.id === run.journeyId) : undefined;
    return (
        <div className="wf-screen">
            <TopBar title="Bạn cần làm gì?" onBack={() => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}/map`))} />
            <main className="wf-main">
                {active && (
                    <div className="wf-group">
                        <Row lead={<Lc name={journeyIcon(active)} size={20} />} title={`Đang làm: ${active.name}`}
                            sub={`Xong ${run!.done.length}/${active.steps.length} bước`} to={`/v/${slug}/journeys/${active.id}`} chevron />
                    </div>
                )}
                {model.journeys.length === 0 ? (
                    <div className="wf-card">
                        <p className="wf-t17">Chưa có quy trình nào</p>
                        <p className="wf-t13" style={{ marginTop: 4 }}>{model.venue.name} chưa soạn quy trình dẫn từng bước. Bạn vẫn tìm và chỉ đường tới từng nơi được.</p>
                    </div>
                ) : (
                    <section aria-labelledby="jr-list">
                        <h2 id="jr-list" className="wf-sec">Quy trình</h2>
                        <div className="wf-group">
                            {model.journeys.map(j => (
                                <Row key={j.id} lead={<Lc name={journeyIcon(j)} size={20} />} title={j.name}
                                    sub={j.description || `${j.steps.length} bước`} to={`/v/${slug}/journeys/${j.id}`} chevron />
                            ))}
                        </div>
                    </section>
                )}
                <section aria-labelledby="jr-other">
                    <h2 id="jr-other" className="wf-sec">Hoặc</h2>
                    <div className="wf-group">
                        <Row lead={<Lc name="search" size={20} />} title="Tìm điểm cần đến" sub="Chỉ đường tới từng nơi một" to={`/v/${slug}/search`} chevron />
                    </div>
                </section>
            </main>
            <div className="wf-foot"><Button variant="secondary" to={`/v/${slug}/map`}>Về bản đồ</Button></div>
        </div>
    );
}

function JourneyRunPage({ id }: { id: number }) {
    const model = useModel();
    const { slug, position, trip, endTrip } = useVenue();
    const navigate = useNavigate();
    const [run, setRun] = useJourneyRun(slug);
    const journey = model.journeys.find(j => j.id === id);
    const mine = run?.journeyId === id ? run : null;
    // Xong quy trình: kết thúc chuyến đi của bước cuối (vị trí đã đặt ở nơi đó)
    const finished = Boolean(mine?.finishedAt);
    useEffect(() => {
        if (finished && trip) endTrip();
    }, [finished, trip, endTrip]);
    const back = () => navigate(`/v/${slug}/journeys`);

    if (!journey) {
        return <ErrorScreen status="Không tìm thấy" icon="workflow" title="Quy trình này không còn" message="Chủ địa điểm có thể đã gỡ hoặc đổi quy trình." headerTitle={model.venue.name} back={`/v/${slug}/journeys`} />;
    }
    if (mine?.finishedAt) return <Finished journey={journey} run={mine} onClose={() => { setRun(null); navigate(`/v/${slug}/map`); }} />;
    if (journey.questions.length > 0 && !mine?.answered) {
        return <Questions journey={journey} onBack={back} onDone={answers => setRun(newRun(id, answers))} />;
    }
    if (!position) {
        const firstFloor = model.locations.find(l => l.type === journey.steps[0]?.targetType || l.id === journey.steps[0]?.targetLocationId)?.floorId
            ?? model.defaultFloor?.id ?? model.floors[0]?.id ?? 0;
        return (
            <div className="wf-screen">
                <TopBar title={journey.name} onBack={back} />
                <main className="wf-main">
                    <div>
                        <h2 className="wf-t28">Bạn đang ở đâu?</h2>
                        <p className="wf-t13" style={{ marginTop: 4 }}>Để chọn nơi gần bạn cho từng bước và tính thời gian.</p>
                    </div>
                    <WhereFromRows slug={slug} returnPath={`journeys/${id}`} floorId={firstFloor} />
                </main>
            </div>
        );
    }
    return <Overview journey={journey} run={mine ?? newRun(id)} saveRun={setRun} onBack={back} model={model} />;
}

function Questions({ journey, onBack, onDone }: { journey: JourneyDto; onBack(): void; onDone(answers: Record<string, boolean>): void }) {
    const [answers, setAnswers] = useState<Record<string, boolean>>({});
    const complete = journey.questions.every(q => q.id in answers);
    return (
        <div className="wf-screen">
            <TopBar title={journey.name} onBack={onBack} />
            <main className="wf-main">
                <p className="wf-t15 wf-muted">Trả lời để bỏ qua những bước bạn không cần.</p>
                {journey.questions.map(q => (
                    <section key={q.id} aria-labelledby={`q-${q.id}`}>
                        <h2 id={`q-${q.id}`} className="wf-t17" style={{ marginBottom: 8 }}>{q.text}</h2>
                        <div className="wf-group" role="radiogroup" aria-labelledby={`q-${q.id}`}>
                            <Option title="Có" checked={answers[q.id] === true} onSelect={() => setAnswers(a => ({ ...a, [q.id]: true }))} />
                            <Option title="Không" checked={answers[q.id] === false} onSelect={() => setAnswers(a => ({ ...a, [q.id]: false }))} />
                        </div>
                    </section>
                ))}
            </main>
            <div className="wf-foot"><Button disabled={!complete} onClick={() => onDone(answers)}>Tiếp tục</Button></div>
        </div>
    );
}

function Overview({ journey, run, saveRun, onBack, model }: { journey: JourneyDto; run: JourneyRun; saveRun(r: JourneyRun | null): void; onBack(): void; model: VenueModel }) {
    const { slug, position, startTrip, trip } = useVenue();
    const navigate = useNavigate();
    const [changing, setChanging] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const started = run.current != null;
    const plan = useMemo(
        () => planJourney(model, position!, journey, run.answers, { pinned: run.pinned, done: run.done, skip: run.skipped, avoidStairs: getSettings().avoidStairs }),
        [model, position, journey, run]
    );
    const next = plan.steps.find(s => !s.skipped && s.place);

    const go = () => {
        if (!next?.place || !position) return;
        // Đang đi dở đúng bước này thì vào lại màn Đang đi, không lập chuyến mới
        if (trip && trip.to.id === next.place.id && run.targetId === next.place.id && !trip.arrived) {
            navigate(`/v/${slug}/go`);
            return;
        }
        const result = startTrip(position, next.place);
        if (!result || "error" in result) {
            setError(result?.error ?? "Không tìm được đường tới bước này.");
            return;
        }
        saveRun({ ...run, current: next.index, targetId: next.place.id, startedAt: run.startedAt ?? Date.now() });
        navigate(`/v/${slug}/go`);
    };
    const choosing = changing != null ? plan.steps[changing] : undefined;

    return (
        <div className="wf-screen">
            <TopBar title={journey.name} onBack={onBack} />
            <main className="wf-main is-tight">
                <div>
                    <p className="wf-t28">{plan.error ? "Chưa đi được" : timeText(plan)}</p>
                    <p className="wf-t13" style={{ marginTop: 4 }}>
                        {plan.error ?? `${formatMeters(plan.distance)}, thời gian chờ là ước tính của ${model.venue.name}. Từ ${positionLabel(model, position)}.`}
                    </p>
                </div>
                {error && <Status icon="circle-alert" tone="danger">{error}</Status>}
                <ol className="wf-steps" aria-label="Các bước">
                    {plan.steps.map(s => {
                        const isDone = run.done.includes(s.index);
                        const isNow = !s.skipped && s.index === next?.index;
                        const sub = s.skipped
                            ? s.skipReason
                            : s.place ? `${s.place.name}, ${placeWhere(model, s.place)}${s.route ? `, ${formatMeters(s.route.distance)}` : ""}${s.dwellMinutes ? `, chờ khoảng ${s.dwellMinutes} phút` : ""}` : "Chưa có nơi phục vụ";
                        return (
                            <li key={s.index} style={{ opacity: s.skipped && !isDone ? 0.55 : 1 }}>
                                <Row lead={<Lc name={isDone ? "circle-check" : isNow ? "navigation" : "circle-dot"} size={20} color={isDone ? "var(--ok)" : undefined} />}
                                    title={`${s.index + 1}. ${s.step.title}`} sub={sub}
                                    trailing={!s.skipped && s.choices.length > 1 && !isDone
                                        ? <button type="button" className="wf-btn wf-btn-t" onClick={() => setChanging(s.index)}>Đổi nơi</button>
                                        : undefined} />
                            </li>
                        );
                    })}
                </ol>
                {next?.step.instruction && !started && (
                    <div className="wf-card"><p className="wf-t13">Bước đầu</p><p className="wf-t15" style={{ marginTop: 4 }}>{next.step.instruction}</p></div>
                )}
            </main>
            <div className="wf-foot" style={{ display: "flex", gap: 8 }}>
                {started && <Button variant="secondary" onClick={() => { saveRun(null); onBack(); }}>Thoát</Button>}
                <Button icon="navigation" disabled={Boolean(plan.error) || !next} onClick={go}>{started ? `Tiếp tục: ${next?.step.title ?? ""}` : "Bắt đầu"}</Button>
            </div>

            {choosing && (
                <Sheet labelledBy="ch-t" over>
                    <div>
                        <h2 id="ch-t" className="wf-t22">{choosing.step.title}: chọn nơi khác</h2>
                        <p className="wf-t13" style={{ marginTop: 4 }}>Gần nhất trước. Các bước sau tự tính lại.</p>
                    </div>
                    <div className="wf-group" role="radiogroup" aria-labelledby="ch-t" style={{ maxHeight: "45vh", overflowY: "auto" }}>
                        {choosing.choices.slice(0, 30).map(c => (
                            <Option key={c.place.id} title={c.place.name} sub={`${placeWhere(model, c.place)}, ${formatMeters(c.distance)}`}
                                checked={c.place.id === choosing.place?.id}
                                onSelect={() => { saveRun({ ...run, pinned: { ...run.pinned, [choosing.index]: c.place.id } }); setChanging(null); }} />
                        ))}
                    </div>
                    <div className="wf-acts">
                        {run.pinned[choosing.index] != null && (
                            <Button variant="secondary" onClick={() => { const pinned = { ...run.pinned }; delete pinned[choosing.index]; saveRun({ ...run, pinned }); setChanging(null); }}>Để hệ thống chọn</Button>
                        )}
                        <Button variant="secondary" onClick={() => setChanging(null)}>Đóng</Button>
                    </div>
                </Sheet>
            )}
        </div>
    );
}

function Finished({ journey, run, onClose }: { journey: JourneyDto; run: JourneyRun; onClose(): void }) {
    const seconds = Math.max(0, Math.round(((run.finishedAt ?? 0) - (run.startedAt ?? run.finishedAt ?? 0)) / 1000));
    return (
        <div className="wf-screen">
            <TopBar title={journey.name} />
            <main className="wf-main">
                <Status icon="circle-check" tone="ok">Đã xong quy trình</Status>
                <div className="wf-stats">
                    <div><p className="wf-t17">{run.done.length}/{journey.steps.length}</p><p className="wf-t13">bước đã làm</p></div>
                    <div><p className="wf-t17">{formatMeters(run.meters)}</p><p className="wf-t13">đã đi</p></div>
                    <div><p className="wf-t17">{seconds < 60 ? `${seconds} giây` : `${minutesOf(seconds)} phút`}</p><p className="wf-t13">thời gian</p></div>
                </div>
            </main>
            <div className="wf-foot"><Button onClick={onClose}>Xong, về bản đồ</Button></div>
        </div>
    );
}
