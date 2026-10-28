import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { findNodeByCode, positionUncertainty, type Position } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, ErrorScreen, IconButton, Option, Sheet } from "../components/ui";
import { floorFull, floorInSentence, positionLabel } from "../format";

type Choice = "link" | "mine" | "qr" | "map";

// Mở link tuyến được chia sẻ (Viewer-SharedRoute): /v/<slug>/shared?den=<id>&tu=qr:<mã> | diem:<id>
export default function SharedRoutePage() {
    const model = useModel();
    const { slug, position, setPosition } = useVenue();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const to = model.locationsById.get(Number(params.get("den")));
    const tu = params.get("tu") ?? "";

    const origin = useMemo<Position | null>(() => {
        if (tu.startsWith("qr:")) {
            const node = findNodeByCode(model, tu.slice(3));
            return node ? { floorId: node.floorId, lat: node.lat, lng: node.lng, source: "qr", nodeId: node.id, label: `Mã QR ${node.id}` } : null;
        }
        if (tu.startsWith("diem:")) {
            const p = model.locationsById.get(Number(tu.slice(5)));
            return p ? { floorId: p.floorId, lat: p.lat, lng: p.lng, source: "place", label: p.name, placeId: p.id } : null;
        }
        return null;
    }, [model, tu]);
    const [choice, setChoice] = useState<Choice>(origin ? "link" : position ? "mine" : "qr");

    if (!to) {
        return (
            <ErrorScreen status="Không tìm thấy" title="Link chia sẻ không còn đúng" message="Điểm đến trong link không có trên bản đồ, có thể đã bị xoá hoặc đổi." back={`/v/${slug}/map`}
                headerTitle={model.venue.name} foot={<Button to={`/v/${slug}/search?pick=to`} icon="search">Tìm điểm đến</Button>} />
        );
    }

    const type = model.typeOf(to.type);
    const toFloor = model.floorsById.get(to.floorId);
    const routeTo = `route?to=${to.id}`;
    const start = () => {
        if (choice === "link" && origin) setPosition(origin);
        if (choice === "qr") return navigate(`/v/${slug}/scan?then=${encodeURIComponent(routeTo)}`);
        if (choice === "map") return navigate(`/v/${slug}/map?pick=position&floor=${to.floorId}&return=${encodeURIComponent(routeTo)}`);
        navigate(`/v/${slug}/${routeTo}`);
    };
    const primary = choice === "link" && origin ? `Xem tuyến từ ${origin.label?.replace(/^Mã /, "") ?? "điểm trong link"}`
        : choice === "mine" ? "Xem tuyến từ vị trí của bạn" : choice === "qr" ? "Quét mã QR" : "Chọn trên bản đồ";

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                <FloorMap model={model} floorId={to.floorId} selectedId={to.id} user={position} focus={{ lat: to.lat, lng: to.lng, zoom: 20 }} fitPadding={[84, 40]}
                    onSelect={p => navigate(`/v/${slug}/place/${p.id}`)} />
                <div className="wf-bar">
                    <IconButton kind="map" icon="arrow-left" label="Về bản đồ" to={`/v/${slug}/map`} />
                    <Link to={`/v/${slug}/search`} role="search" className="wf-field wf-lift is-strong"><Lc name="search" size={20} /><span className="wf-ell">{to.name}</span></Link>
                </div>
            </div>
            <Sheet labelledBy="sr-t">
                <div>
                    <p className="wf-t13 wf-status" style={{ fontWeight: 400 }}><Lc name="link" size={20} />Tuyến được chia sẻ</p>
                    <h1 id="sr-t" className="wf-t28" style={{ marginTop: 4 }}>Tuyến tới {to.name}</h1>
                    <p className="wf-t13" style={{ marginTop: 4 }}>{[type.name, toFloor?.buildingCode, floorFull(toFloor)].filter(Boolean).join(", ")}</p>
                </div>
                <section aria-labelledby="sr-from">
                    <h2 id="sr-from" className="wf-sec">Bắt đầu từ đâu?</h2>
                    <div role="radiogroup" aria-labelledby="sr-from">
                        {origin && <Option title={positionLabel(model, origin).replace(/,.*$/, "")} sub={`Điểm đi trong link, ${floorInSentence(model.floorsById.get(origin.floorId))}`} checked={choice === "link"} onSelect={() => setChoice("link")} />}
                        {position && <Option title="Vị trí hiện tại của bạn" sub={positionLabel(model, position)} checked={choice === "mine"} onSelect={() => setChoice("mine")} />}
                        <Option title="Quét mã QR gần bạn" sub={`Sai số ±${positionUncertainty(0, "qr")} m ước tính`} checked={choice === "qr"} onSelect={() => setChoice("qr")} />
                        <Option title="Chọn trên bản đồ" sub="Kéo dấu ngắm tới chỗ bạn đứng" checked={choice === "map"} onSelect={() => setChoice("map")} />
                    </div>
                </section>
                {tu && !origin && <p className="wf-t13">Điểm đi trong link không còn trên bản đồ, hãy chọn cách khác.</p>}
                <div className="wf-acts"><Button icon={choice === "qr" ? "scan-line" : choice === "map" ? "map-pin" : "navigation"} onClick={start}>{primary}</Button></div>
            </Sheet>
        </div>
    );
}
