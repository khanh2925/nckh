import { useMemo } from "react";
import Meter from "./Meter";
import { findLocationIssues, terminalSummaries } from "./dataChecks";
import { getGroup, getLocationType, typeGroups } from "../data/locationTypes";
import { airportTerminals } from "../data/airportCatalog";
import { floorLabel } from "../utils/text";

const terminalName = (id) => airportTerminals.find(item => item.id === id)?.name || id;

// "Tổng quan": the state of the data at a glance and what to fix next
function OverviewPage({ locations, walkways, navigate }) {
    const summaries = useMemo(() => terminalSummaries(locations, walkways), [locations, walkways]);
    const issues = useMemo(() => findLocationIssues(locations, walkways), [locations, walkways]);
    const groups = typeGroups
        .filter(group => group.id !== "all")
        .map(group => ({ ...group, count: locations.filter(item => getLocationType(item.type).group === group.id).length }))
        .sort((a, b) => b.count - a.count);
    const maxGroup = Math.max(...groups.map(group => group.count), 1);

    // What to do next: walkway gaps first (they break directions), then the data rules
    const todo = [
        ...summaries.filter(item => item.reachable < item.locations).map(item => ({
            key: `walk-${item.terminal}`,
            text: `${item.locations - item.reachable} địa điểm ở ${terminalName(item.terminal)} chưa chỉ đường tới được`,
            action: "Vẽ nối lối đi",
            to: `/admin/walkways?terminal=${item.terminal}`
        })),
        ...issues.map(issue => ({
            key: issue.id,
            text: `${issue.items.length} địa điểm: ${issue.title.charAt(0).toLowerCase()}${issue.title.slice(1)}`,
            action: "Xem danh sách",
            to: `/admin/quality#${issue.id}`
        }))
    ];

    return (
        <div className="admin-page">
            <header className="page-head">
                <div>
                    <h1>Tổng quan</h1>
                    <p>
                        {locations.length} địa điểm và {walkways.nodes.length.toLocaleString("vi")} điểm lối đi đang hiện trên bản đồ công khai.
                        Thay đổi ở đây có hiệu lực ngay cho hành khách.
                    </p>
                </div>
            </header>

            <section className="panel">
                <h2>Theo nhà ga</h2>
                <div className="table-wrap">
                    <table className="data-table is-static">
                        <thead>
                            <tr>
                                <th scope="col">Nhà ga</th>
                                <th scope="col" className="num">Địa điểm</th>
                                <th scope="col" className="num">Điểm lối đi</th>
                                <th scope="col">Chỉ đường tới được</th>
                                <th scope="col" className="num">Mảnh lối đi rời</th>
                                <th scope="col"><span className="visually-hidden">Thao tác</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaries.map(item => [
                                <tr key={item.terminal} className="row-group">
                                    <th scope="row">{terminalName(item.terminal)}</th>
                                    <td className="num">{item.locations}</td>
                                    <td className="num">{item.walkwayPoints.toLocaleString("vi")}</td>
                                    <td><Meter value={item.reachable} total={item.locations} /> <span className="muted">{item.reachable}/{item.locations}</span></td>
                                    <td className="num">{item.pieces || "—"}</td>
                                    <td className="text-end">
                                        <a href={`/admin/walkways?terminal=${item.terminal}`} onClick={(e) => { e.preventDefault(); navigate(`/admin/walkways?terminal=${item.terminal}`); }}>Mở lối đi</a>
                                    </td>
                                </tr>,
                                ...item.floors.map(floor => (
                                    <tr key={`${item.terminal}-${floor.floor}`} className="row-sub">
                                        <th scope="row">{floorLabel(floor.floor)}</th>
                                        <td className="num">{floor.total}</td>
                                        <td />
                                        <td><Meter value={floor.reachable} total={floor.total} /></td>
                                        <td />
                                        <td className="text-end">
                                            <a href={`/admin/locations?terminal=${item.terminal}&floor=${floor.floor}`} onClick={(e) => { e.preventDefault(); navigate(`/admin/locations?terminal=${item.terminal}&floor=${floor.floor}`); }}>Xem địa điểm</a>
                                        </td>
                                    </tr>
                                ))
                            ])}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="overview-split">
                <section className="panel">
                    <h2>Việc cần làm</h2>
                    {todo.length === 0 ? <p className="muted mb-0">Không còn vấn đề nào được phát hiện.</p> : (
                        <ul className="todo-list">
                            {todo.map(item => (
                                <li key={item.key}>
                                    <span>{item.text}</span>
                                    <a href={item.to} onClick={(e) => { e.preventDefault(); navigate(item.to); }}>{item.action}</a>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="panel">
                    <h2>Theo nhóm</h2>
                    <ul className="group-bars">
                        {groups.map(group => (
                            <li key={group.id}>
                                <span className="group-label"><i className={`bi ${group.icon}`} style={{ color: getGroup(group.id).color }} aria-hidden="true" />{group.label}</span>
                                <span className="group-bar" aria-hidden="true"><span style={{ width: `${group.count / maxGroup * 100}%`, background: group.color }} /></span>
                                <span className="num">{group.count}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}

export default OverviewPage;
