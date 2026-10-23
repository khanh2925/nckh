import { airportFloors } from "../data/airportCatalog";
import { floorLabel } from "../utils/text";

const TOOLS = [
    { id: "draw", label: "Vẽ", icon: "bi-pencil", hint: "Bấm lên mặt bằng để đặt điểm, mỗi điểm mới tự nối với điểm trước. Bấm vào một điểm có sẵn để nối tới nó, bấm vào giữa một đoạn để rẽ nhánh. Esc hoặc bấm lại điểm cuối để kết thúc nét." },
    { id: "select", label: "Chọn", icon: "bi-cursor", hint: "Bấm vào một điểm để đánh dấu thang máy / thang cuốn / thang bộ và nối sang tầng khác. Kéo điểm để dời vị trí." },
    { id: "erase", label: "Xóa", icon: "bi-eraser", hint: "Bấm vào một điểm (xóa cả các đoạn nối với nó) hoặc một đoạn để xóa." }
];

const CONNECTORS = ["Thang máy", "Thang cuốn", "Thang bộ"];

// Admin tab "Lối đi": tools for drawing the walkway network that directions use.
// All the logic lives in hooks/useWalkwayEditor.js, this component only shows buttons.
function WalkwayPanel({ editor, terminal, floor }) {
    const { draft, tool, selectedId } = editor;
    const floorNodes = draft.nodes.filter(node => node.terminal === terminal && node.floor === floor);
    const floorNodeIds = new Set(floorNodes.map(node => node.id));
    const floorEdgeCount = draft.edges.filter(edge => floorNodeIds.has(edge.from) && floorNodeIds.has(edge.to)).length;
    const selected = draft.nodes.find(node => node.id === selectedId);

    // Floor links of the selected point: [{ floor, nodeId }]
    const links = selected
        ? draft.edges
            .filter(edge => edge.from === selected.id || edge.to === selected.id)
            .map(edge => draft.nodes.find(node => node.id === (edge.from === selected.id ? edge.to : edge.from)))
            .filter(node => node && node.floor !== selected.floor)
            .map(node => ({ floor: node.floor, nodeId: node.id }))
        : [];
    const otherFloors = airportFloors.filter(item => item.terminal === terminal && item.id !== floor);

    const handleCancel = () => {
        if (window.confirm("Bỏ tất cả thay đổi chưa lưu?")) editor.discard();
    };

    return (
        <div>
            <div className="btn-group btn-group-sm w-100 mb-2" role="group" aria-label="Công cụ vẽ lối đi">
                {TOOLS.map(item => (
                    <button type="button" key={item.id} className={`btn ${tool === item.id ? "btn-dark" : "btn-outline-dark"}`} aria-pressed={tool === item.id} onClick={() => editor.handleToolChange(item.id)}>
                        <i className={`bi ${item.icon} me-1`} />{item.label}
                    </button>
                ))}
            </div>
            <p className="small text-muted mb-2">{TOOLS.find(item => item.id === tool).hint}</p>

            <div className="d-flex align-items-center gap-2 small mb-2">
                <span className="flex-grow-1">{floorLabel(floor)}: <b>{floorNodes.length}</b> điểm · <b>{floorEdgeCount}</b> đoạn</span>
                {editor.activeId && (
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={editor.endLine}>Kết thúc nét</button>
                )}
            </div>

            {tool === "select" && selected && (
                <div className="walkway-selected mb-2">
                    <label className="form-label small fw-semibold mb-1" htmlFor="walkway-connector">Điểm đang chọn</label>
                    <select id="walkway-connector" className="form-select form-select-sm mb-2" value={selected.connector || ""} onChange={(e) => editor.handleConnectorChange(selected.id, e.target.value)}>
                        <option value="">Lối đi thường</option>
                        {CONNECTORS.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>

                    {selected.connector && otherFloors.map(item => {
                        const link = links.find(entry => entry.floor === item.id);
                        return (
                            <div key={item.id} className="d-flex align-items-center gap-2 small mb-1">
                                <span className="flex-grow-1">{floorLabel(item.id)}</span>
                                {link
                                    ? <button type="button" className="btn btn-outline-danger btn-sm py-0" onClick={() => editor.handleUnlink(selected.id, link.nodeId)}>Bỏ nối</button>
                                    : <button type="button" className="btn btn-outline-primary btn-sm py-0" onClick={() => editor.handleLinkFloor(selected.id, item.id)}>Nối tới tầng này</button>}
                            </div>
                        );
                    })}

                    <button type="button" className="btn btn-outline-danger btn-sm w-100 mt-1" onClick={editor.handleDeleteSelected}>
                        <i className="bi bi-trash me-1" />Xóa điểm này
                    </button>
                </div>
            )}

            <div className="d-flex gap-2">
                <button type="button" className="btn btn-light border btn-sm" onClick={editor.undo} disabled={!editor.canUndo} title="Hoàn tác (Ctrl+Z)" aria-label="Hoàn tác">
                    <i className="bi bi-arrow-counterclockwise" />
                </button>
                <button type="button" className="btn btn-light border btn-sm" onClick={handleCancel} disabled={!editor.isDirty} title="Bỏ thay đổi" aria-label="Bỏ thay đổi">
                    <i className="bi bi-x-lg" />
                </button>
                <button type="button" className="btn btn-danger btn-sm flex-grow-1" onClick={editor.handleSave} disabled={!editor.isDirty || editor.isSaving}>
                    {editor.isSaving ? "Đang lưu…" : editor.isDirty ? "Lưu lối đi" : "Đã lưu"}
                </button>
            </div>

            {editor.message && <p className="small mt-2 mb-0" role="status">{editor.message}</p>}
            <p className="small text-muted mt-2 mb-0">Mở "Chỉ đường" để thử ngay trên bản nháp trước khi lưu.</p>
        </div>
    );
}

export default WalkwayPanel;
