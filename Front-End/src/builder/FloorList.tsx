import type { VenueModel } from "@indoor-map/core";

/** Cột trái: các tầng theo toà nhà, kèm số đếm tuỳ trang */
export default function FloorList({ model, floorId, onSelect, count }: {
    model: VenueModel; floorId: number | null; onSelect(id: number): void; count?: (floorId: number) => string | number;
}) {
    return (
        <>
            {model.buildings.map(b => {
                const floors = model.floorsOf(b.id);
                if (!floors.length) return null;
                return (
                    <div key={b.id}>
                        <div className="cb-side-title">{b.code} · {b.name}</div>
                        <ul className="cb-side-list">
                            {floors.map(f => (
                                <li key={f.id}>
                                    <button type="button" aria-current={f.id === floorId} onClick={() => onSelect(f.id)}>
                                        <span>{f.name}</span>
                                        <small>{!f.plan ? "chưa có mặt bằng" : count ? count(f.id) : ""}</small>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </>
    );
}
