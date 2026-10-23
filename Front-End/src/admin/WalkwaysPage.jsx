import { useEffect, useMemo, useState } from "react";
import MapView from "../components/MapView";
import WalkwayPanel from "../components/WalkwayPanel";
import { useWalkwayEditor } from "../hooks/useWalkwayEditor";
import { checkWalkways } from "../utils/walkwayCheck";
import { airportFloors, airportTerminals } from "../data/airportCatalog";
import { floorLabel } from "../utils/text";

const firstFloor = (terminal) => airportFloors.find(item => item.terminal === terminal)?.id ?? 0;

// "Lối đi": the walkway network that directions use, drawn on a full-screen map.
// Tools and the live check are in the panel on the right (components/WalkwayPanel.jsx).
// URL ?terminal=T2 opens that terminal (links from "Tổng quan" and "Kiểm tra dữ liệu").
function WalkwaysPage({ locations, walkways, params, onWalkwaysChange, onUnsavedChange }) {
    const [terminal, setTerminal] = useState(() => {
        const requested = params.get("terminal");
        return airportTerminals.some(item => item.id === requested) ? requested : "T1";
    });
    const [floor, setFloor] = useState(() => firstFloor(terminal));
    const [focusPoint, setFocusPoint] = useState(null);
    const editor = useWalkwayEditor({ terminal, floor, onSaved: onWalkwaysChange, initialNetwork: walkways });

    // Tell the admin app, so leaving with an unsaved drawing asks first
    useEffect(() => onUnsavedChange(editor.isDirty), [editor.isDirty, onUnsavedChange]);

    // Re-checked after every change (a few ms), so problems disappear as they get fixed
    const check = useMemo(() => checkWalkways(editor.draft, locations, terminal), [editor.draft, locations, terminal]);
    // Map highlight: points of cut-off pieces and connectors linked to no floor
    const problemIds = useMemo(() => {
        const ids = new Set(check.connectors.map(node => node.id));
        const cutOff = new Set(check.pieces.map(piece => piece.id));
        check.pieceOf.forEach((piece, id) => {
            if (cutOff.has(piece)) ids.add(id);
        });
        return ids;
    }, [check]);

    const floors = airportFloors.filter(item => item.terminal === terminal);
    const terminals = airportTerminals.filter(item => item.id !== "SGN_CAMPUS");

    const changeTerminal = (value) => {
        setTerminal(value);
        setFloor(firstFloor(value));
        setFocusPoint(null);
        editor.endLine();
    };
    const changeFloor = (value) => {
        setFloor(value);
        setFocusPoint(null);
    };
    const handleFocus = (point) => {
        setFloor(point.floor);
        setFocusPoint(point);
    };

    return (
        <div className="walkway-page">
            <section className="walkway-map" aria-label="Bản đồ lối đi">
                <MapView
                    terminal={terminal}
                    onTerminalChange={changeTerminal}
                    floor={floor}
                    onFloorChange={changeFloor}
                    locations={locations.filter(item => item.terminal === terminal && item.floor === floor)}
                    onSelect={() => {}}
                    onMapClick={editor.handleMapClick}
                    focusPoint={focusPoint}
                    walkwayEditor={{
                        network: editor.draft,
                        tool: editor.tool,
                        activeId: editor.activeId,
                        selectedId: editor.selectedId,
                        isLocked: false,
                        problemIds,
                        onNodeClick: editor.handleNodeClick,
                        onEdgeClick: editor.handleEdgeClick,
                        onNodeMove: editor.handleNodeMove
                    }}
                />

                <div className="walkway-switch">
                    <select className="form-select form-select-sm" aria-label="Nhà ga" value={terminal} onChange={(e) => changeTerminal(e.target.value)}>
                        {terminals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <div className="segmented" role="group" aria-label="Tầng">
                        {floors.map(item => (
                            <button type="button" key={item.id} className={item.id === floor ? "is-active" : ""} aria-pressed={item.id === floor} title={item.name} onClick={() => changeFloor(item.id)}>
                                {floorLabel(item.id)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <aside className="walkway-side" aria-label="Công cụ vẽ lối đi">
                <h1>Lối đi</h1>
                <p className="walkway-intro">Mạng lối đi dùng để chỉ đường. Thay đổi chỉ được ghi khi bấm Lưu lối đi.</p>
                <WalkwayPanel editor={editor} terminal={terminal} floor={floor} check={check} onFocus={handleFocus} />
            </aside>
        </div>
    );
}

export default WalkwaysPage;
