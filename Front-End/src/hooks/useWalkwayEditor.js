import { useEffect, useState } from "react";
import { saveWalkways } from "../api/walkwayApi";
import { closestPointOnSegment, distance } from "../utils/geo";
import { floorLabel } from "../utils/text";

const MAX_UNDO = 50;
const SAME_SPOT_METERS = 5;   // an elevator node on another floor closer than this is "the same elevator"

// New node ids are made here (crypto.randomUUID only works on https/localhost, not on http://192.168...)
let counter = 0;
const newId = () => `w-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const isSameEdge = (edge, a, b) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a);

// ---------- Small pure functions: each one returns a NEW network (never changes the old one) ----------
// Returning new objects lets "undo" simply keep the previous networks in a list.
function addEdge(network, a, b) {
    if (a === b || network.edges.some(edge => isSameEdge(edge, a, b))) return network;
    return { ...network, edges: [...network.edges, { from: a, to: b }] };
}

function removeEdge(network, a, b) {
    return { ...network, edges: network.edges.filter(edge => !isSameEdge(edge, a, b)) };
}

function removeNode(network, id) {
    return {
        nodes: network.nodes.filter(node => node.id !== id),
        edges: network.edges.filter(edge => edge.from !== id && edge.to !== id)
    };
}

function updateNode(network, id, changes) {
    return { ...network, nodes: network.nodes.map(node => (node.id === id ? { ...node, ...changes } : node)) };
}

// Put a new node in the middle of edge a-b: a-b becomes a-node-b
function splitEdge(network, edge, node) {
    const withoutEdge = removeEdge(network, edge.from, edge.to);
    return {
        nodes: [...withoutEdge.nodes, node],
        edges: [...withoutEdge.edges, { from: edge.from, to: node.id }, { from: node.id, to: edge.to }]
    };
}

// Admin "Lối đi" mode. Tools:
// - draw:   click the map = add a point joined to the previous one, click a point = join to it,
//           click a line = add a point on that line. Esc (or clicking the last point again) ends the line.
// - select: click a point to make it an elevator/escalator/stairs and link it to other floors.
// - erase:  click a point or a line to delete it.
// Points can be dragged with the mouse in "draw" and "select".
export function useWalkwayEditor({ terminal, floor, onSaved }) {
    const [draft, setDraft] = useState(null);       // the network being edited, null = not editing
    const [history, setHistory] = useState([]);     // older drafts, for "undo"
    const [tool, setTool] = useState("draw");
    const [activeId, setActiveId] = useState(null); // end of the line being drawn
    const [selectedId, setSelectedId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    const isEditing = draft !== null;
    const isDirty = history.length > 0;
    const nodeById = (id) => draft?.nodes.find(node => node.id === id) || null;

    // Every change goes through here so it can be undone
    const change = (newDraft) => {
        if (newDraft === draft) return;
        setHistory([...history.slice(-MAX_UNDO + 1), draft]);
        setDraft(newDraft);
        setMessage("");
    };

    const createNode = (point) => ({ id: newId(), terminal, floor, lat: point.lat, lng: point.lng });

    // The line being drawn only continues on the floor where it started
    const active = nodeById(activeId);
    const lineEnd = active && active.terminal === terminal && active.floor === floor ? active.id : null;

    const start = (walkways) => {
        setDraft(walkways);
        setHistory([]);
        setActiveId(null);
        setSelectedId(null);
        setMessage("");
    };

    const stop = () => {
        setDraft(null);
        setHistory([]);
        setActiveId(null);
        setSelectedId(null);
    };

    // Back to the network as it was when editing started (or last saved)
    const discard = () => {
        if (history.length === 0) return;
        setDraft(history[0]);
        setHistory([]);
        setActiveId(null);
        setSelectedId(null);
        setMessage("");
    };

    const undo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setDraft(previous);
        setHistory(history.slice(0, -1));
        // the last drawn point may not exist any more
        if (!previous.nodes.some(node => node.id === activeId)) setActiveId(null);
        if (!previous.nodes.some(node => node.id === selectedId)) setSelectedId(null);
    };

    const handleToolChange = (newTool) => {
        setTool(newTool);
        setActiveId(null);
        setSelectedId(null);
    };

    // ---------- Clicks coming from the map ----------
    const handleMapClick = (point) => {
        if (tool === "draw") {
            const node = createNode(point);
            let next = { ...draft, nodes: [...draft.nodes, node] };
            if (lineEnd) next = addEdge(next, lineEnd, node.id);
            change(next);
            setActiveId(node.id);
        } else if (tool === "select") {
            setSelectedId(null);
        }
    };

    const handleNodeClick = (node) => {
        if (tool === "draw") {
            if (lineEnd === node.id) {
                setActiveId(null);           // clicking the last point again ends the line
            } else {
                if (lineEnd) change(addEdge(draft, lineEnd, node.id));
                setActiveId(node.id);
            }
        } else if (tool === "select") {
            setSelectedId(node.id);
        } else if (tool === "erase") {
            change(removeNode(draft, node.id));
            if (selectedId === node.id) setSelectedId(null);
        }
    };

    const handleEdgeClick = (edge, point) => {
        if (tool === "draw") {
            const a = nodeById(edge.from);
            const b = nodeById(edge.to);
            const spot = closestPointOnSegment(point, a, b);
            const node = createNode(spot);
            let next = splitEdge(draft, edge, node);
            if (lineEnd) next = addEdge(next, lineEnd, node.id);
            change(next);
            setActiveId(node.id);
        } else if (tool === "erase") {
            change(removeEdge(draft, edge.from, edge.to));
        }
    };

    const handleNodeMove = (node, point) => {
        change(updateNode(draft, node.id, { lat: point.lat, lng: point.lng }));
    };

    // ---------- Panel actions for the selected point ----------
    const handleConnectorChange = (id, connector) => {
        change(updateNode(draft, id, { connector: connector || null }));
    };

    // Elevators are (almost) at the same spot on every floor:
    // reuse the connector point of the other floor if there is one nearby, otherwise create it there.
    const handleLinkFloor = (id, otherFloor) => {
        const node = nodeById(id);
        const existing = draft.nodes.find(item => item.terminal === node.terminal && item.floor === otherFloor && item.connector && distance(item, node) < SAME_SPOT_METERS);
        if (existing) {
            change(addEdge(draft, node.id, existing.id));
            setMessage(`Đã nối với điểm "${existing.connector}" có sẵn ở ${floorLabel(otherFloor)}.`);
            return;
        }
        const copy = { ...createNode(node), floor: otherFloor, connector: node.connector };
        change(addEdge({ ...draft, nodes: [...draft.nodes, copy] }, node.id, copy.id));
        setMessage(`Đã tạo điểm "${node.connector}" ở ${floorLabel(otherFloor)}. Hãy chuyển sang tầng đó và vẽ nối nó vào lối đi.`);
    };

    const handleUnlink = (id, otherId) => change(removeEdge(draft, id, otherId));

    const handleDeleteSelected = () => {
        change(removeNode(draft, selectedId));
        setSelectedId(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const saved = await saveWalkways(draft);
            setDraft(saved);
            setHistory([]);
            setActiveId(null);
            setMessage(`Đã lưu ${saved.nodes.length} điểm, ${saved.edges.length} đoạn lối đi.`);
            onSaved(saved);
        } catch (err) {
            console.error(err);
            setMessage("Không lưu được lối đi. Hãy kiểm tra backend.");
        } finally {
            setIsSaving(false);
        }
    };

    // Keyboard: Esc ends the line being drawn, Ctrl+Z undoes
    useEffect(() => {
        if (!isEditing) return;
        const handleKeyDown = (event) => {
            if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
            if (event.key === "Escape") setActiveId(null);
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
                event.preventDefault();
                undo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });

    return {
        isEditing, draft, tool, activeId, selectedId, isDirty, isSaving, message,
        canUndo: history.length > 0,
        start, stop, undo, discard, handleToolChange,
        handleMapClick, handleNodeClick, handleEdgeClick, handleNodeMove,
        handleConnectorChange, handleLinkFloor, handleUnlink, handleDeleteSelected, handleSave,
        endLine: () => setActiveId(null)
    };
}
