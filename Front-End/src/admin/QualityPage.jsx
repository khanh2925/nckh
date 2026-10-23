import { useEffect, useMemo, useState } from "react";
import Meter from "./Meter";
import { findLocationIssues, terminalSummaries } from "./dataChecks";
import { getGroup, getLocationType } from "../data/locationTypes";
import { airportTerminals } from "../data/airportCatalog";
import { floorLabel } from "../utils/text";

const PREVIEW = 8;
const REASONS = { noWalkway: "không có lối đi trong 60 m", isolated: "chỉ nối vào mảnh lối đi rời" };
const terminalName = (id) => airportTerminals.find(item => item.id === id)?.name || id;

// One rule and the places it found; long lists show the first few until expanded
function IssueList({ id, title, why, items, renderAction }) {
    const [isOpen, setIsOpen] = useState(false);
    const shown = isOpen ? items : items.slice(0, PREVIEW);
    return (
        <section className="panel issue" id={id}>
            <header className="issue-head">
                <h2>{title}</h2>
                <span className="issue-count">{items.length}</span>
            </header>
            {why && <p className="issue-why">{why}</p>}
            <ul className="issue-items">
                {shown.map(item => {
                    const type = getLocationType(item.type);
                    return (
                        <li key={item.id}>
                            <span className="type-dot is-small" style={{ background: getGroup(type.group).color }}><i className={`bi ${type.icon}`} aria-hidden="true" /></span>
                            <span className="issue-name">{item.name}</span>
                            <span className="muted">{item.terminal}, {floorLabel(item.floor)}{item.detail ? `, ${item.detail}` : ""}</span>
                            {renderAction(item)}
                        </li>
                    );
                })}
            </ul>
            {items.length > PREVIEW && (
                <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? "Thu gọn" : `Xem cả ${items.length}`}
                </button>
            )}
        </section>
    );
}

// "Kiểm tra dữ liệu": everything that makes the map or directions wrong, with a way to fix each one
function QualityPage({ locations, walkways, navigate }) {
    const summaries = useMemo(() => terminalSummaries(locations, walkways), [locations, walkways]);
    const issues = useMemo(() => findLocationIssues(locations, walkways), [locations, walkways]);
    const go = (to) => (event) => {
        event.preventDefault();
        navigate(to);
    };
    const editLink = (item) => <a href={`/admin/locations?edit=${item.id}`} onClick={go(`/admin/locations?edit=${item.id}`)}>Sửa</a>;

    // Links from "Tổng quan" end with #rule-id: scroll to it once the page is drawn
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, []);

    return (
        <div className="admin-page">
            <header className="page-head">
                <div>
                    <h1>Kiểm tra dữ liệu</h1>
                    <p>Các lỗi làm bản đồ hoặc chỉ đường sai. Danh sách tự cập nhật sau mỗi lần sửa.</p>
                </div>
            </header>

            <section className="panel">
                <h2>Chỉ đường</h2>
                <ul className="check-rows">
                    {summaries.map(item => (
                        <li key={item.terminal}>
                            <strong>{terminalName(item.terminal)}</strong>
                            <Meter value={item.reachable} total={item.locations} />
                            <span className="muted">
                                {item.reachable === item.locations ? "Mọi địa điểm đều tới được." : `${item.locations - item.reachable} địa điểm chưa tới được.`}
                                {item.pieces > 0 && ` ${item.pieces} mảnh lối đi rời.`}
                                {item.connectors > 0 && ` ${item.connectors} thang chưa nối tầng.`}
                            </span>
                            <a href={`/admin/walkways?terminal=${item.terminal}`} onClick={go(`/admin/walkways?terminal=${item.terminal}`)}>Mở lối đi</a>
                        </li>
                    ))}
                </ul>
            </section>

            {summaries.filter(item => item.unreachable.length > 0).map(item => (
                <IssueList
                    key={item.terminal}
                    id={`unreachable-${item.terminal}`}
                    title={`${terminalName(item.terminal)}: địa điểm chưa chỉ đường tới được`}
                    why="Sửa bằng cách vẽ nối lối đi gần các địa điểm này vào mạng chính."
                    items={item.unreachable.map(entry => ({ ...entry.location, detail: REASONS[entry.reason] }))}
                    renderAction={() => <a href={`/admin/walkways?terminal=${item.terminal}`} onClick={go(`/admin/walkways?terminal=${item.terminal}`)}>Vẽ lối đi</a>}
                />
            ))}

            {issues.map(issue => <IssueList key={issue.id} {...issue} renderAction={editLink} />)}

            {issues.length === 0 && summaries.every(item => item.unreachable.length === 0) && (
                <p className="admin-state">Không phát hiện lỗi nào.</p>
            )}
        </div>
    );
}

export default QualityPage;
